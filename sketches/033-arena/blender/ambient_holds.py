"""Pure two-subject preview math and fixed admission. No native imports."""
import argparse
import json
import math
from pathlib import Path

import goal_loop as goal
from arena_hold import sha256, fresh_output, png_size

FRAMES = tuple(range(1,49))
CLOSE_FRAME, FPS, SAMPLES = 49, 24, 8
SIZE = {'desktop':(640,360), 'mobile':(360,640)}
BUDGET = {'scenes':['GameOnVB','GoalLoopoverview'], 'cameras':['desktop','mobile'],
          'frames_per_clip':48, 'fps':24, 'seconds':2,
          'sizes':{k:list(v) for k,v in SIZE.items()}, 'samples':8, 'total_new_native_frames':192}
SAMPLE_FRAMES = (1,13,25,37,49)
APPROVAL_SHA256 = 'a261b3500b5e1ed3c630261f5c429b492661c3d226ded26f6dcafe3e24cea743'
INPUTS_SHA256 = 'e478cde1780086c50651a152b2496bd73a762ebf7de76660abfba8f5581f7e25'
ADMISSION_SHA256 = 'a4101baa0a84d70a792500a342bda579390124317b496fcb72a366ee42109892'


def coefficients(frame):
    t=math.tau*((frame-1)%48)/48
    return math.sin(t),1-math.cos(t),math.sin(2*t)


def coefficient_velocity(frame):
    t=math.tau*((frame-1)%48)/48
    w=math.tau/48
    return w*math.cos(t),w*math.sin(t),2*w*math.cos(2*t)


def flutter_modes(uv):
    u,v=uv
    pin=(1-max(0.,min(1.,v)))**2
    phase=math.tau*(.65*u+.25*v)
    # A travelling broad fold minus its phase-zero displacement retains the
    # accepted base pose at both ends. Each mode moves geometry, never UVs.
    return ((0.,.26*pin*math.cos(phase),.23*pin),
            (0.,.26*pin*math.sin(phase),0.),
            (0.,.035*pin*math.sin(math.tau*(u-.2*v)),.025*pin*math.cos(math.tau*u)))


def combine(uv, weights):
    modes=flutter_modes(uv)
    return tuple(sum(weights[j]*modes[j][i] for j in range(3)) for i in range(3))


def flutter(uv,frame):return combine(uv,coefficients(frame))
def flutter_velocity(uv,frame):return combine(uv,coefficient_velocity(frame))
def belt_distance(index,frame):return goal.LENGTH*(index+(frame-1)/48)/72


def track_unwrapped(distance):
    x,y,a=goal.track(distance)
    return x,y,a+math.tau*math.floor(distance/goal.LENGTH)


def belt_pose(index,frame):return track_unwrapped(belt_distance(index,frame))


def belt_velocity(index,frame):
    distance=belt_distance(index,frame)
    _,_,a=track_unwrapped(distance)
    s=distance%goal.LENGTH
    curved=goal.STRAIGHT<s<goal.STRAIGHT+math.pi*goal.RADIUS or s>2*goal.STRAIGHT+math.pi*goal.RADIUS
    speed=goal.LENGTH/72/48
    return speed*math.cos(a),speed*math.sin(a),speed/goal.RADIUS if curved else 0.


def parse_args(argv=None):
    p=argparse.ArgumentParser(description='Parent only: fixed 48 unique frame preview',allow_abbrev=False)
    p.add_argument('--preview-motion',action='store_true',required=True)
    p.add_argument('--subject',choices=('gameon','goal-loop'),required=True)
    p.add_argument('--camera',choices=tuple(SIZE),required=True)
    p.add_argument('--inputs',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--prepare-only',action='store_true')
    return p.parse_args(argv)


def validate_identity(subject,camera,v):
    expected='Goal Loop '+camera if subject=='goal-loop' else 'Frozen approved camera84'
    if v['camera']['name']!=expected or v['frame']!=(228 if subject=='goal-loop' else 84):
        raise ValueError('wrong source pose/camera identity')
    if subject=='goal-loop' and len(v['treads'])!=72:raise ValueError('need exactly 72 original treads')
    if subject=='gameon' and v['cloth']['vertices']!=5130:raise ValueError('wrong cloth topology')


def load_inputs(path):
    if sha256(path)!=INPUTS_SHA256:raise ValueError('approved inputs changed')
    data=json.loads(Path(path).read_text())
    approval=json.loads(Path(data['approval']).read_text())
    if sha256(data['approval'])!=APPROVAL_SHA256 or data['approval_sha256']!=APPROVAL_SHA256 or approval.get('status')!='APPROVED' or approval.get('boundary_id')!='ambient-holds:P1:v1':
        raise ValueError('owner approval missing or changed')
    if data['budget']!=BUDGET or approval['budget']!=BUDGET:raise ValueError('exact 192-frame budget required')
    if set(data['variants'])!={'gameon','goal-loop'}:raise ValueError('need both approved subjects')
    for s,cs in data['variants'].items():
        if set(cs)!=set(SIZE):raise ValueError('need both approved cameras')
        for c,v in cs.items():validate_identity(s,c,v)
    admission=Path(path).resolve().with_name('native-admission.json')
    if sha256(admission)!=ADMISSION_SHA256 or json.loads(admission.read_text())!=data['variants']:
        raise ValueError('corrected native admission changed')
    return data


def validate_source(v):
    try:source=Path(v['source']).resolve(strict=True)
    except OSError as exc:raise ValueError('source missing') from exc
    if sha256(source)!=v['source_sha256']:raise ValueError('approved source SHA changed')
    return source


def protected_inputs(data,path):
    return [path,Path(path).resolve().with_name('native-admission.json'),data['approval'],*(v['source'] for cs in data['variants'].values() for v in cs.values()),
            *(p for m in data['media'].values() for p in m.values())]
