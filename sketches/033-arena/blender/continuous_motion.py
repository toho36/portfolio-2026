"""Absolute scene clock and fixed admission for the owner's motion correction.

No native imports, rendering, dispatch or budget reset. An idle's frame 1 is
its story endpoint; oval closure is a permutation of identical physical treads.
"""
import argparse
import json
import math
from pathlib import Path

from arena_hold import sha256, fresh_output
import ambient_holds as ambient
import goal_loop as goal
import playground
import refined_holds as refined

ROOT = Path('/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena')
FOLLOWUP = ROOT/'ambient-holds/refinement/followup-continuous-motion'
APPROVAL = FOLLOWUP/'OWNER-RENDER-APPROVAL.json'
APPROVAL_SHA256 = '68e24e6d9c71efbeb88f49e5a2dd74c4c400d456a489bbafa50e043ed6af38cb'
AUTHORITY_FILES = {
    'OWNER-FEEDBACK.md':'b6174716b748c43a74b2e2c141da9bf7f555c801f5d37d3529a83cad8817848d',
    'RENDER-BUDGET.md':'e042788e213fdfb4c55026afe7fff474b0c23ab78b3402240da4cb0ee58057dc',
}
SOURCE_MANIFEST_SHA256 = {
    'desktop':'5bd4b781e6b3bcb2ae84d588e6920df79e0ed13c45432b32931f4c0c2de854e4',
    'mobile':'7fac36fd848a3eb9c1c0a143052dc41a988bb4fe60ad0e342fb535371a16ab68',
}
VILLA_TIMELINE_SHA256 = '9cd4384a09c7ba6938db9ca1380d313c9b20acdcf8868708c7e52cf40073fc30'
SOURCES = {
    'desktop': (ROOT/'playground/final/final-desktop/playground.blend',
                '63234fa44126fa411f4d890ae8e6e76ed29e69026019a4caec22df86a965b021'),
    'mobile': (ROOT/'playground/final/final-mobile/playground.blend',
               'feff73359e8a6fc1a9fbda6fe08c13aab4e6417f8cca50b4495606fd22add39e'),
}
CAMERAS = tuple(SOURCES)
SUBJECTS = ('story', 'belt-idle', 'office-idle')
FPS, SAMPLES, WORKER_RENDER_CAP = 24, 32, 0
LIMITS = {'new_native_frame_attempts':1536, 'render_process_seconds':43200,
          'new_render_encode_bytes':21474836480, 'samples':32, 'fps':24,
          'idle_desktop':[3584,2016], 'idle_portrait':[1800,3200],
          'travel_desktop':[1600,900], 'travel_portrait':[900,1600],
          'simultaneous_blender_processes':1, 'maximum_cpu_threads':8}
SPENT = {'new_scope_native_frames':0, 'new_scope_render_seconds':0,
         'previous_batch_native_frames':488, 'previous_batch_render_seconds':22592.483298040228,
         'older_native_batches':[192,96,96], 'technical_episodes':2,
         'technical_verdict_attempts':4, 'technical_fable_attempts':0,
         'previous_harness_repair_cycles':2, 'new_scope_source_audit_workers':1,
         'new_scope_native_readonly_probes':2}
LEAVES = refined.leaf_names()
LEAF_CURVES = tuple(n for n in LEAVES if 'broad leaf' not in n)
TREADS = tuple('Lab belt transverse tread'+(f'.{i:03d}' if i else '') for i in range(72))
FRONT = 'SS window B visible docking frame'
HOUSE = 'Playground existing 032 villa in window B'
REAR = 'CM independent Playground window'
REAR_CONTENT = 'CM rear window content'
FAN_ORIGIN = (597.5, 6.17, 1.65)
FAN_DESK = 'SS standing desk top'
DESK_VISIBILITY = ((1,1),(469,1),(470,0))
REAR_GAP = .035  # world +Y: behind front B, still ahead of screen at 6.142
YELLOW_LOCAL = (.495, .049, .365)
CURSOR_CONTACT, CURSOR_PRESS = 684, 687
MINIMIZE_START, MINIMIZE_END = 694, 718
CURSOR_VERTICES = ((0,0,0),(-.006,0,-.062),(-.020,0,-.047),(-.036,0,-.072),
                   (-.046,0,-.065),(-.030,0,-.040),(-.052,0,-.037))
CURSOR_FACE = (0,1,2,3,4,5,6)  # Mirror X and reverse winding together.
CURSOR_INTERIOR = (-.002,0,-.003)


def global_frame(subject, frame):
    if subject not in SUBJECTS:raise ValueError('unknown motion subject')
    return frame if subject == 'story' else {'belt-idle':468, 'office-idle':660}[subject]+frame-1


def output_frames(subject):
    if subject not in SUBJECTS:raise ValueError('unknown motion subject')
    return tuple(range(229,805)) if subject == 'story' else tuple(range(1,49 if subject == 'belt-idle' else 97))


def dimensions(subject, camera):
    return tuple(LIMITS[('travel_' if subject == 'story' else 'idle_')+('portrait' if camera == 'mobile' else 'desktop')])


def oval_pose(index, frame):return ambient.belt_pose(index, frame-228+1)
def oval_velocity(index, frame):
    # Canonicalize full circuits for the derivative only. Floating remainder at
    # exact stadium joins must not choose opposite sides in equivalent loops.
    return ambient.belt_velocity(index, (frame-228) % (72*48)+1)
def seam_phase(frame):return refined.belt_phase(frame-468+1)
def seam_velocity(frame):return refined.belt_phase_velocity(frame-468+1)
def leaf_coefficients(frame):return refined.coefficients(frame-660+1)
def leaf_coefficient_velocity(frame):return refined.coefficient_velocity(frame-660+1)
def leaf_delta(point, index, frame):return refined.combine(point, index, leaf_coefficients(frame))
def fan_head(frame):return math.radians(22)*math.sin(math.tau*((frame-660)%96)/96)
def fan_head_velocity(frame):return math.radians(22)*math.tau/96*math.cos(math.tau*((frame-660)%96)/96)
def fan_rotor(frame):return math.tau*(frame-660)/24
def fan_rotor_velocity(frame):return math.tau/24
def villa_frame(frame):return playground.villa_frame(frame)


def cursor_tip(frame):
    t = goal.ramp(frame, 665, CURSOR_CONTACT)
    return goal.mix((-.34, .049, -.23), YELLOW_LOCAL, t)


def cursor_scale(frame):
    return 1-.22*goal.pulse(frame, CURSOR_CONTACT, CURSOR_PRESS, CURSOR_PRESS+1, CURSOR_PRESS+4)


def front_transform(frame):
    t = goal.ramp(frame, MINIMIZE_START, MINIMIZE_END)
    return (0., 0., -.47*t), (1-.94*t,)*3


def front_hidden(frame):return frame >= MINIMIZE_END+1


def project_x(point, position, target, lens):
    """Pure perspective sign check; parent must use evaluated native cameras."""
    forward = tuple(b-a for a,b in zip(position,target))
    size = math.sqrt(sum(x*x for x in forward));forward=tuple(x/size for x in forward)
    right = (forward[1], -forward[0], 0.)
    size = math.hypot(*right[:2]);right=tuple(x/size for x in right)
    delta = tuple(b-a for a,b in zip(position,point))
    depth = sum(x*y for x,y in zip(delta,forward))
    if depth <= 0:raise ValueError('projection point behind camera')
    return .5+lens/36*sum(x*y for x,y in zip(delta,right))/depth


def load_approval():
    if sha256(APPROVAL) != APPROVAL_SHA256:raise ValueError('owner approval bytes changed')
    for name,signature in AUTHORITY_FILES.items():
        if sha256(FOLLOWUP/name) != signature:raise ValueError('owner scope/budget bytes changed: '+name)
    data = json.loads(APPROVAL.read_text())
    if (data.get('status') != 'APPROVED' or data.get('budget_id') != 'continuous-motion-v1'
            or data.get('exact_response') != 'Schvaluji rozpočet, pokračuj'
            or data.get('limits') != LIMITS):
        raise ValueError('exact continuous-motion owner approval required')
    return data


def validate_source(path, camera):
    expected, signature = SOURCES[camera]
    path = Path(path).resolve(strict=True)
    if path != expected.resolve() or sha256(path) != signature:
        raise ValueError('source path/SHA differs from pinned Playground original')
    manifest_path=expected.with_name('playground-manifest.json')
    if sha256(manifest_path) != SOURCE_MANIFEST_SHA256[camera]:raise ValueError('original source manifest bytes changed')
    manifest = json.loads(manifest_path.read_text())
    if Path(manifest['native_scene']).resolve() != path or manifest['native_scene_sha256'] != signature:
        raise ValueError('original manifest source binding differs')
    return path


def protected_inputs():
    return [Path(__file__).resolve().parents[3], APPROVAL,
            *(p.parent for p, signature in SOURCES.values()), ROOT/'playground/villa-timeline']


def validate_output(path, protected=()):
    out=Path(path).resolve()
    if not out.is_relative_to(FOLLOWUP.resolve()):
        raise ValueError('fresh derivative must stay in the existing continuous-motion followup folder')
    return fresh_output(out,[*protected_inputs(),*protected])


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description='Zero-render continuous-motion preparation/reload', allow_abbrev=False)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--prepare-only', action='store_true')
    mode.add_argument('--verify-prepared', type=Path)
    parser.add_argument('--subject', choices=SUBJECTS)
    parser.add_argument('--camera', choices=CAMERAS)
    for name in ('source', 'out', 'manifest'):parser.add_argument('--'+name, type=Path)
    args = parser.parse_args(argv)
    if args.prepare_only:
        if any(getattr(args,n) is None for n in ('subject','camera','source','out')) or args.manifest:
            parser.error('prepare-only requires subject/camera/source/out and no manifest')
    elif not args.manifest or any(getattr(args,n) is not None for n in ('subject','camera','source','out')):
        parser.error('verify-prepared requires only derivative and manifest')
    return args
