"""T1 source preparation math and data-only retime; no render authority or bpy."""
import argparse
import json
import math
from pathlib import Path

import arena_hold as hold
from arena_hold import sha256, fresh_output
from refined_holds import coefficients, coefficient_velocity

POSE, CLOSE_FRAME, FPS, NEW_RENDER_CAP = 112, 49, 24, 0
FRAMES = tuple(range(1,49))
KINDS = ('loop','arrival','departure')
CAMERA_POSE = 84
BRIDGE_FRAMES = tuple(range(1,25))
ARRIVAL_TAIL = (20.,24.)
CACHE_KNOTS = tuple(range(82,115))
SIZE = {'desktop':(1600,900),'mobile':(900,1600)}
ROOT = Path('/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena')
INPUTS = ROOT/'gameon-hold/inputs.json'
INPUTS_SHA = '4855f6cee23d503f2cb99fee08af474923fa9e9ded13dd669ffa06fbc36c2e3c'
DERIVED = ROOT/'gameon-hold/final/derived/manifest.json'
DERIVED_SHA = '1314933c0b3a60649dd32cf5d9bd1788a7b0b6a1c00fc03102c425d23c1a1bc0'
SOURCES = {
    'desktop': (ROOT/'render/desktop/arena.blend','b3d2ac60ab6060952efcc316ce17f532544ca741aae954e0809de6872492fbe9'),
    'mobile': (ROOT/'render/mobile/arena.blend','518ecb8437cade741dfd4b265f868de3aab2cf7c95a564f19282a469dd415fa5'),
}
NORMAL_BOUND, VERTICAL_BOUND = .40, .22  # measured ceilings, never a global vertical pump
PENDING = [
    'A/poster/idle/B seams and actual pixel matching in both cameras',
    'Next from arbitrary loop phase without waiting or returning to the fall',
    'Forward Lab-peek reveal recipe/composition across arrival into camera84 reading hold remains pending T5',
    'Reverse B arrival must retain the already revealed Lab peek, not reset it',
    'Departure head retains zero cloth velocity; reverse-B entry and arbitrary-phase exits require separate T5 handoff',
    'T5 real HD media application/player update and actual browser/art proof',
    'New combined render budget requires explicit owner approval; cap remains zero',
]


def validate_source(path,camera):
    expected,signature=SOURCES[camera]
    path=Path(path).resolve(strict=True)
    if path!=expected.resolve() or sha256(path)!=signature:
        raise ValueError('only exact original arena source path/SHA accepted; never frozen84')
    return path


def validate_cache(modifiers):
    mods=[m for m in modifiers if m.type=='CLOTH']
    if len(mods)!=1:raise ValueError('need exactly one original baked cloth modifier')
    mod=mods[0];cache=mod.point_cache
    fields=('frame_start','frame_end','is_baked','is_baking','is_outdated','is_frame_skip',
            'use_disk_cache','use_external','info')
    row={key:getattr(cache,key) for key in fields}
    if (not mod.show_viewport or not mod.show_render or
        (row['frame_start'],row['frame_end'])!=(1,168) or not row['is_baked'] or
        any(row[k] for k in ('is_baking','is_outdated','is_frame_skip','use_disk_cache','use_external')) or
        not row['info'].startswith('168 frames in memory')):
        raise ValueError('require enabled, complete, current original baked 1–168 memory cache BEFORE frame112')
    return row



def validate_points(points,count):
    if len(points)!=count or not points or any(len(p)!=3 or any(not math.isfinite(x) for x in p) for p in points):
        raise ValueError('finite native cloth vertices with unchanged count required')

def flutter_modes(uvs):
    """Balanced world Y normal and world Z ripple in spatial quadrature.

    The same pin-weighted mean removal applies independently to each axis and
    temporal mode. Each vertex is bounded for ALL phases, not just keyframes.
    """
    if not uvs or any(len(p)!=2 or any(not math.isfinite(x) or not 0<=x<=1 for x in p) for p in uvs):
        raise ValueError('finite UVs within the original unit atlas required')
    pins=[(1-v)**2 for u,v in uvs]
    if sum(pins)==0:raise ValueError('need unpinned cloth vertices')
    phases=[math.tau*(u+.35*v) for u,v in uvs]
    fields=[]
    for amplitude,offset,bound in ((.18,0.,NORMAL_BOUND),(.10,math.pi/2,VERTICAL_BOUND)):
        raw=[(amplitude*p*math.cos(t+offset),amplitude*p*math.sin(t+offset)) for p,t in zip(pins,phases)]
        means=[sum(row[i] for row in raw)/sum(pins) for i in range(2)]
        balanced=[tuple(row[i]-p*means[i] for i in range(2)) for p,row in zip(pins,raw)]
        # sin(t)*a + (1-cos(t))*b has supremum |b|+hypot(a,b).
        maximum=max(abs(b)+math.hypot(a,b) for a,b in balanced)
        if maximum>bound:raise ValueError(f'authored flutter exceeds declared ceiling: {maximum}>{bound}')
        fields.append(balanced)
    return [((0.,y[0],z[0]),(0.,y[1],z[1])) for y,z in zip(*fields)]


def displacement(modes,frame):
    return tuple(sum(mode[axis]*weight for mode,weight in zip(modes,coefficients(frame))) for axis in range(3))


def projection_admission(camera,excursions):
    ceiling=14 if camera=='desktop' else 10
    if camera not in SIZE or not excursions or any(not math.isfinite(x) or x<0 for x in excursions.values()):
        raise ValueError('finite nonempty actual native lower-probe excursions required')
    peak=max(excursions.values());minimum=min(excursions.values())
    if minimum<3 or peak>ceiling:raise ValueError(f'native projection admission failed: range {minimum}..{peak}px outside [3,{ceiling}]')
    return {'status':'projection-admitted UNRENDERED; not visibility/art PASS',
            'floor_px':3,'ceiling_px':ceiling,'peak_px':peak,'minimum_px':minimum,'floor_statistic':'each declared lower-probe peak-to-peak'}


def source_clock(kind,t):
    if kind not in ('arrival','departure') or not math.isfinite(t):raise ValueError('finite bridge clock required')
    if t<0:return 84+t*(1 if kind=='arrival' else 4/3)
    if t>24:return 112. if kind=='arrival' else 112+t-24
    if kind=='arrival':
        u=t/24
        return 84+24*u+36*u*u-32*u*u*u
    return 84+4*t/3-t*t/144


def clock_velocity(kind,t):
    source_clock(kind,t)  # same finite/kind admission
    if t<0:return 1. if kind=='arrival' else 4/3
    if t>24:return 0. if kind=='arrival' else 1.
    if kind=='arrival':
        u=t/24
        return 1+3*u-4*u*u
    return 4/3-t/72


def cache_weights(s,derivative=False):
    """Cardinal cubic on actual neighbouring baked samples, never endpoints only."""
    if not math.isfinite(s) or not 83<=s<=112.999999999:
        raise ValueError('cloth interpolation needs admitted original cache neighbours 82..114')
    k=math.floor(s);u=s-k
    weights=((-u+2*u*u-u**3)/2,1-2.5*u*u+1.5*u**3,
             (u+4*u*u-3*u**3)/2,(-u*u+u**3)/2)
    if derivative:weights=((-1+4*u-3*u*u)/2,-5*u+4.5*u*u,
                           (1+8*u-9*u*u)/2,(-2*u+3*u*u)/2)
    return dict(zip(range(k-1,k+3),weights))


def cached_pose(cache,s,derivative=False):
    weights=cache_weights(s,derivative)
    rows=[cache.get(str(k)) for k in weights]
    if any(row is None or len(row)!=len(rows[0]) for row in rows):raise ValueError('missing/mismatched real cache knots')
    if not rows[0] or any(len(p)!=3 or any(not math.isfinite(x) for x in p) for row in rows for p in row):
        raise ValueError('finite real cache vertex coordinates required')
    return [[sum(w*row[i][axis] for w,row in zip(weights.values(),rows)) for axis in range(3)] for i in range(len(rows[0]))]



def arrival_envelope(t,derivative=False):
    if not math.isfinite(t):raise ValueError('finite arrival tail time required')
    start,end=ARRIVAL_TAIL
    if t<=start:return 0.
    if t>=end:return 0. if derivative else 1.
    u=(t-start)/(end-start)
    return 6*u*(1-u)/(end-start) if derivative else u*u*(3-2*u)


def arrival_coefficients(t,derivative=False):
    e=arrival_envelope(t)
    if e==0:return (0.,0.)
    weights=coefficients(t-23)
    if not derivative:return tuple(e*c for c in weights)
    de=arrival_envelope(t,True)
    return tuple(de*c+e*v for c,v in zip(weights,coefficient_velocity(t-23)))


def arrival_pose(cache,t,local_modes=None):
    base=cached_pose(cache,source_clock('arrival',t))
    if local_modes is None:return base
    if len(local_modes)!=len(base) or any(len(row)!=2 for row in local_modes):
        raise ValueError('two local flutter modes per cached vertex required')
    validate_points([mode for row in local_modes for mode in row],2*len(base))
    weights=arrival_coefficients(t)
    return [[p[axis]+sum(m[axis]*w for m,w in zip(row,weights)) for axis in range(3)]
            for p,row in zip(base,local_modes)]


def bridge_reference_velocity(cache,kind,t,epsilon=None,local_modes=None):
    source_clock(kind,t)
    if epsilon is not None and (not math.isfinite(epsilon) or epsilon<=0):raise ValueError('positive finite FD step required')
    if kind=='departure':return [[0.,0.,0.] for _ in cache['112']]
    if epsilon is None:
        velocity=[[x*clock_velocity(kind,t) for x in p] for p in cached_pose(cache,source_clock(kind,t),True)]
        if local_modes is None:return velocity
        arrival_pose(cache,t,local_modes)  # same finite/count admission as position reference
        weights=arrival_coefficients(t,True)
        return [[p[axis]+sum(m[axis]*w for m,w in zip(row,weights)) for axis in range(3)]
                for p,row in zip(velocity,local_modes)]
    a=arrival_pose(cache,t-epsilon,local_modes);b=arrival_pose(cache,t+epsilon,local_modes)
    return [[(y-x)/(2*epsilon) for x,y in zip(p,q)] for p,q in zip(a,b)]

def bridge_key_times(kind):
    source_clock(kind,0)
    end=24.25 if kind=='arrival' else 25.25
    times={i/8 for i in range(-2,round(end*8)+1)}
    if kind=='arrival':times.update(ARRIVAL_TAIL)
    # Preserve source camera slope corners, and spline support changes, exactly.
    for knot in range(85,112):
        lo,hi=0.,24.
        for _ in range(48):
            mid=(lo+hi)/2
            if source_clock(kind,mid)<knot:lo=mid
            else:hi=mid
        crossing=round((lo+hi)/2,12)
        if all(abs(crossing-t)>1e-10 for t in times):times.add(crossing)
    return tuple(sorted(times))


def bridge_checks(kind):
    return (0.,*BRIDGE_FRAMES,-.25,.0625,6.4375,12.0625,18.4375,23.9375,24.25,
            -.03125,.03125,23.96875,24.03125,*((25.,) if kind=='departure' else
            (19.96875,20.03125,20.0625,21.4375,22.0625)))


def camera_channels(knots,s,derivative=False,side=1):
    if not math.isfinite(s) or not 83<=s<114:raise ValueError('camera source clock outside original sampled route')
    nearest=round(s)
    if derivative and abs(s-nearest)<5e-6:s=float(nearest)
    k=math.floor(s)-(1 if derivative and side<0 and s==math.floor(s) else 0)
    if str(k) not in knots or str(k+1) not in knots:raise ValueError('missing genuine camera route knots')
    a,b=knots[str(k)],knots[str(k+1)];u=s-k
    for row in (a,b):
        if (set(row)!={'location','rotation_quaternion','lens'} or
            len(row['location'])!=3 or len(row['rotation_quaternion'])!=4 or
            any(not math.isfinite(x) for x in (*row['location'],*row['rotation_quaternion'],row['lens']))):
            raise ValueError('finite original camera location/quaternion/lens required')
    result={}
    for name in ('location','rotation_quaternion','lens'):
        x,y=a[name],b[name]
        if isinstance(x,(tuple,list)):
            result[name]=[v-w if derivative else (1-u)*w+u*v for w,v in zip(x,y)]
        else:result[name]=y-x if derivative else (1-u)*x+u*y
    return result


def partition():return tuple(range(1,85)),tuple(range(113,169))


def pending_bridge(kind):
    return [{'output_frame':t,'native_time_seconds':t/FPS,'planned_encoded_time_seconds':(t-1)/FPS,
             'status':'pending-owner-approved-render','kind':kind,
             'source_geometry_frame':source_clock(kind,t) if kind=='arrival' else POSE,
             'source_camera_frame':CAMERA_POSE if kind=='arrival' else source_clock(kind,t),
             'composition':('native arena frame' if kind=='arrival' else
                 'actual Lab228/ROI with actual new native projection; expansion stays 0 through112')} for t in BRIDGE_FRAMES]


def canonical_b_rows(rows,landing_sha):
    if [r['frame'] for r in rows]!=list(range(85,169)) or rows[-1]['sha256']!=landing_sha:
        raise ValueError('need canonical registered 85–168 manifest ending byte-identical actual Lab228')
    return rows[28:]


def projection(row,size,roi):
    if row['frame']!=CAMERA_POSE:raise ValueError('reading hold projection requires actual camera84')
    mapping,progress=hold.entry_mapping(row,size,roi)
    if progress!=0:raise ValueError('reading peek must remain before registered expansion')
    return {'row':row,'coordinates':'normalized top-origin TL/TR/BR/BL',
            'hold_homography':hold.homography(hold.UNIT,hold.screen_quad(row)),
            'photo_homography':mapping,'roi':list(roi),'photo_size':list(size)}


def check_projection(expected,actual):
    if expected['frame']!=actual['frame']:raise ValueError('native projection source camera clocks differ')
    hold.screen_quad(expected);hold.screen_quad(actual)
    if any(abs(a-b)>1e-5 for x,y in zip(expected['uv_bottom_origin'],actual['uv_bottom_origin']) for a,b in zip(x,y)):
        raise ValueError('physical front-screen projection differs from actual native front screen/camera including depth')


def registry():
    # Provenance only. Deliberately never calls old hold.load_inputs/admission/approval.
    if sha256(INPUTS)!=INPUTS_SHA:raise ValueError('original provenance registry changed')
    data=json.loads(INPUTS.read_text())
    if set(data['variants'])!=set(SOURCES):raise ValueError('both camera variants required')
    texture=data['banner_texture']
    if sha256(texture['path'])!=texture['sha256']:raise ValueError('banner texture changed')
    for c,v in data['variants'].items():
        if (v['native_source'],v['native_source_sha256'])!=(str(SOURCES[c][0]),SOURCES[c][1]):
            raise ValueError('registry source identity differs')
        if Path(v['arena_frames_root'])!=SOURCES[c][0].parent:raise ValueError('original HD root differs')
        if [r['frame'] for r in v['native_projection_table']]!=list(range(84,169)):
            raise ValueError('original projection rows missing/reordered')
    return data


def image_row(path,frame,size,signature=None):
    path=Path(path).resolve(strict=True)
    digest=sha256(path)
    if (signature is not None and signature!=digest) or hold.png_size(path)!=tuple(size):
        raise ValueError('real HD frame path/SHA/dimensions differ: '+str(path))
    return {'frame':frame,'path':str(path),'sha256':digest}


def retime_descriptor():
    data=registry()
    if sha256(DERIVED)!=DERIVED_SHA:raise ValueError('canonical registered composite manifest changed')
    derived=json.loads(DERIVED.read_text())
    if derived['kind']!='gameon-hold-derived-final' or derived['native_inputs_sha256']!=INPUTS_SHA:
        raise ValueError('wrong composite provenance; no approval is inferred')
    variants={}
    for camera,v in data['variants'].items():
        validate_source(v['native_source'],camera)
        size=(1600,900) if camera=='desktop' else (900,1600)
        a,b=partition();root=Path(v['arena_frames_root'])
        lab=image_row(v['lab_frame228'],228,size,v['lab_frame228_sha256'])
        canonical=canonical_b_rows(derived['variants'][camera]['derived'],lab['sha256'])
        if [r['frame'] for r in canonical]!=list(b):raise ValueError('wrong B partition')
        a_rows=[image_row(root/f'frame-{f:04d}.png',f,size) for f in a]
        b_rows=[]
        for row in canonical:
            f=row['frame']
            original=image_row(root/f'frame-{f:04d}.png',f,size,row['source_sha256'])
            composite=image_row(DERIVED.parent/camera/'travel'/f'frame-{f:04d}.png',f,size,row['sha256'])
            b_rows.append({**composite,'original':original})
        row84=next(r for r in v['native_projection_table'] if r['frame']==CAMERA_POSE)
        variants[camera]={'A':a_rows,'B':b_rows,'lab228':lab,'size':list(size),
            'projection':projection(row84,size,v['lab_roi']),
            'arrival_pending':pending_bridge('arrival'),'departure_pending':pending_bridge('departure'),
            'A_recipe':'original raw HD1–84 then 24 pending native arrival frames',
            'B_recipe':'24 pending native departure composites then existing canonical registered113–168',
            'A_frames':108,'B_frames':80,'A_seconds':108/FPS,'B_seconds':80/FPS,
            'forward_idle_junction':{'arrival_endpoint_frame':24,'loop_boundary_frame':1,
                'loop_boundary_phase':0,'first_idle_frame_after_A':2,'duplicate_endpoint_dwell':False},
            'arrival_tail':{'frames':list(ARRIVAL_TAIL),'envelope':'u*u*(3-2*u); u=(t-20)/4, clamped0..1',
                'weights':'E(t)*existing loop coefficients(t-23); added to actual cached fall',
                'endpoint':'arrival24 = loop1 = phase0 = exact baked112 at camera84, same nonzero flutter velocity'},
            'departure_head_policy':'zero cloth velocity; reverse-B entry and arbitrary-phase exits require separate T5 handoff',
            'B_endpoint':'canonical168 is actual Lab228; never raw B85–228',
            'peek_arrival_state':'forward pending reveal; reverse must keep already revealed peek'}
    return {'kind':'gameon112-camera84-data-only-retime','source_pose_frame':POSE,'source_camera_frame':CAMERA_POSE,'fps':FPS,
            'loop_poster':{'geometry_frame':POSE,'camera_frame':CAMERA_POSE},
            'proposed_not_approved_budget':{'loop':384,'closure':8,'bridge':96,'reserve':24,'total':512},
            'original_total_frames':168,'inputs_sha256':INPUTS_SHA,'inputs_role':'provenance ONLY, no render approval',
            'canonical_manifest':str(DERIVED),'canonical_manifest_sha256':DERIVED_SHA,
            'new_render_cap':0,'rendered':[],'encoded':False,'applied':False,
            'variants':variants,'parent_pending':PENDING}


def protected_inputs():
    return [ROOT/'render',ROOT/'render-gl',ROOT/'gameon-hold',
            Path(__file__).resolve().parents[3]]


def parse_args(argv=None):
    p=argparse.ArgumentParser(description='Parent-only GameOn112 preparation/verification; zero renders',allow_abbrev=False)
    mode=p.add_mutually_exclusive_group(required=True)
    mode.add_argument('--prepare-only',action='store_true')
    mode.add_argument('--verify-prepared',type=Path)
    p.add_argument('--kind',choices=KINDS)
    p.add_argument('--camera',choices=tuple(SOURCES))
    for name in ('source','out','manifest'):p.add_argument('--'+name,type=Path)
    args=p.parse_args(argv)
    if args.prepare_only:
        if any(getattr(args,k) is None for k in ('kind','camera','source','out')) or args.manifest:
            p.error('prepare-only requires kind/camera/source/out and no manifest')
    elif not args.manifest or any(getattr(args,k) is not None for k in ('kind','camera','source','out')):
        p.error('verify-prepared requires derivative path and manifest only')
    return args
