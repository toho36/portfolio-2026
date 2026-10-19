"""Pure math and admission for the single approved GameOnVB motion preview.

No native imports. Coordinates are normalized, top-origin, TL/TR/BR/BL.
The builder alone uses bpy; nothing in this module executes a render.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

FRAMES = tuple(range(84, 132))
CLOSE_FRAME, FPS, SAMPLES = 132, 24, 8
SIZE = {'desktop': (320, 180), 'mobile': (180, 320)}
UNIT = ((0.,0.), (1.,0.), (1.,1.), (0.,1.))
ATLAS = (640, 360)


def coefficients(frame):
    phase = ((frame-84) % 48)/48
    if phase == 0:
        return (0., 0.)
    return math.sin(math.tau*phase), 1-math.cos(math.tau*phase)


def flutter_modes(uv):
    u,v = uv
    pin = (1-max(0.,min(1.,v)))**2
    return (.032*pin*math.sin(math.tau*(u+.3*v)),
            .032*pin*math.cos(math.tau*(.7*u-.4*v)))


def flutter(uv, frame):
    a,b = coefficients(frame)
    x,y = flutter_modes(uv)
    return (0., a*x+b*y, 0.)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def png_size(path):
    with Path(path).open('rb') as stream:
        header = stream.read(24)
    if len(header) != 24 or header[:8] != b'\x89PNG\r\n\x1a\n' or header[12:16] != b'IHDR':
        raise ValueError(f'not a PNG: {path}')
    return struct.unpack('>II', header[16:24])


def parse_args(argv=None):
    parser=argparse.ArgumentParser(description='48 unique frames, 24fps, 8spp preview ONLY', allow_abbrev=False)
    parser.add_argument('--preview-motion', action='store_true', required=True)
    parser.add_argument('--camera',choices=tuple(SIZE),required=True)
    for name in ('source','inputs','out'):
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--prepare-only',action='store_true')
    return parser.parse_args(argv)


def validate_source(source, variant):
    try:
        source=Path(source).resolve(strict=True)
    except OSError as exc:
        raise ValueError('approved native source is missing') from exc
    if source != Path(variant['native_source']).resolve() or sha256(source) != variant['native_source_sha256']:
        raise ValueError('native source path/SHA differs from approved input')
    return source


def fresh_output(path, protected=()):
    out=Path(path).resolve()
    if out.exists():
        raise ValueError(f'output must be absent, not an existing directory: {out}')
    for item in protected:
        p=Path(item).resolve()
        if out == p or out in p.parents or p in out.parents:
            raise ValueError(f'output overlaps protected input: {p}')
    return out


def load_inputs(path):
    data=json.loads(Path(path).read_text())
    expected={'native_frames_per_camera':48,'native_frames_total':96,'fps':24,'seconds':2,
              'samples':8,'desktop_size':[320,180],'mobile_size':[180,320]}
    if data['budget'] != expected or set(data['variants']) != set(SIZE):
        raise ValueError('input budget/variants must match the approved 96-frame preview')
    for variant in data['variants'].values():
        rows=variant['native_projection_table']
        if [r['frame'] for r in rows] != list(range(84,169)):
            raise ValueError('need exact native projection rows 84–168')
        for row in rows:
            screen_quad(row)
    return data


def protected_inputs(data, inputs_path):
    paths=[inputs_path,data['source_native_admission'],data['banner_texture']['path']]
    for v in data['variants'].values():
        paths.extend(v[k] for k in ('native_source','arena_frames_root','lab_frame228','accepted_frame84'))
    return paths


def validate_quad(quad):
    if len(quad) != 4 or not all(math.isfinite(c) for p in quad for c in p):
        raise ValueError('nonfinite quadrilateral')
    for i in range(4):
        a,b,c=quad[i],quad[(i+1)%4],quad[(i+2)%4]
        if (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]) <= 1e-12:
            raise ValueError('degenerate, flipped or nonconvex quadrilateral')


def screen_quad(row):
    points=row['uv_bottom_origin']
    if len(points) != 4 or any(len(p)!=3 or not all(math.isfinite(c) for c in p) or p[2]<=0 for p in points):
        raise ValueError('screen corners must be in front of native camera')
    quad=tuple((points[i][0],1-points[i][1]) for i in (1,2,3,0))
    validate_quad(quad)
    return quad


def homography(source, destination):
    validate_quad(source); validate_quad(destination)
    rows=[]
    for (x,y),(u,v) in zip(source,destination):
        rows.extend(([x,y,1,0,0,0,-u*x,-u*y,u],
                     [0,0,0,x,y,1,-v*x,-v*y,v]))
    for i in range(8):
        pivot=max(range(i,8),key=lambda j:abs(rows[j][i]))
        rows[i],rows[pivot]=rows[pivot],rows[i]
        divisor=rows[i][i]
        if abs(divisor)<1e-14:
            raise ValueError('singular homography')
        rows[i]=[x/divisor for x in rows[i]]
        for j in range(8):
            if j != i:
                factor=rows[j][i]
                rows[j]=[a-factor*b for a,b in zip(rows[j],rows[i])]
    result=tuple(row[-1] for row in rows)+(1.,)
    validate_mapping(result,source)
    return result


def project(h, point):
    x,y=point
    divisor=h[6]*x+h[7]*y+h[8]
    if not math.isfinite(divisor) or abs(divisor)<1e-12:
        raise ValueError('projection pole')
    return ((h[0]*x+h[1]*y+h[2])/divisor,(h[3]*x+h[4]*y+h[5])/divisor)


def validate_mapping(h, source):
    if len(h)!=9 or not all(math.isfinite(c) for c in h):
        raise ValueError('invalid homography')
    divisors=[h[6]*x+h[7]*y+h[8] for x,y in source]
    if min(divisors)*max(divisors)<=0 or min(abs(v) for v in divisors)<1e-10:
        raise ValueError('pole within source quad')
    validate_quad(tuple(project(h,p) for p in source))


def matmul(a,b):
    return tuple(sum(a[r*3+k]*b[k*3+c] for k in range(3)) for r in range(3) for c in range(3))


def roi_fit(size, roi):
    w,h=size; left,top,right,bottom=roi
    if not (0<=left<right<=w and 0<=top<bottom<=h):
        raise ValueError('ROI outside actual source photo')
    scale=min(ATLAS[0]/(right-left),ATLAS[1]/(bottom-top))
    rw,rh=(right-left)*scale,(bottom-top)*scale
    x,y=(ATLAS[0]-rw)/2,(ATLAS[1]-rh)/2
    # Full source image -> ROI atlas; cropping is separate and never stretches pixels.
    a=(w*scale/ATLAS[0],0.,(x-left*scale)/ATLAS[0],
       0.,h*scale/ATLAS[1],(y-top*scale)/ATLAS[1],0.,0.,1.)
    return a,(x,y,rw,rh)


def smooth(value):
    t=max(0.,min(1.,value))
    return t*t*t*(t*(6*t-15)+10)


def entry_mapping(row, photo_size, roi):
    quad=screen_quad(row)
    atlas,_=roi_fit(photo_size,roi)
    initial=matmul(homography(UNIT,quad),atlas)
    validate_mapping(initial,UNIT)
    progress=smooth((row['frame']-112)/56)
    corners=tuple(tuple((1-progress)*v+progress*u for v,u in zip(project(initial,p),p)) for p in UNIT)
    return homography(UNIT,corners),progress


def encloses_viewport(quad):
    return all(all((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-10
                   for a,b in zip(quad,quad[1:]+quad[:1])) for p in UNIT)
