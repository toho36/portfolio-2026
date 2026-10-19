"""Pure T3/T4 motion and source admission. No preview approval or render authority."""
import argparse
import math
from pathlib import Path

from arena_hold import sha256, fresh_output
import ambient_holds as ambient

FRAMES = tuple(range(1,49))
CLOSE_FRAME, FPS, NEW_RENDER_CAP = 49, 24, 0
ROOT = Path('/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena')
SOURCES = {
    ('finished-belt','desktop'): (ROOT/'seam-fix/render/desktop/arena.blend',
        '80a1d5a84b7bfa830c93e66ae2b651b334e5a181ed6af14b73248b2cfe8979de'),
    ('finished-belt','mobile'): (ROOT/'seam-fix/render/mobile/arena.blend',
        'a4bc08ca3b80231db8ecd9c8146d11877b063b6ef77ebc1362df3c4fc94cd169'),
    ('plant','desktop'): (ROOT/'screen-switch/final/render/desktop/screen-switch.blend',
        '84b4868336f7f5f38734323133e4a4d3d0013355fcb762132a5fb0ae0c3e6ff4'),
    ('plant','mobile'): (ROOT/'screen-switch/final/render/mobile/screen-switch.blend',
        '05b5302807854de6ad18f1ffb4be7d3ecee0e3b8d610fd9ecf27f985b64b75e4'),
}
POSE = {'finished-belt':468, 'plant':660}
BELT_NAMES = ('Lab exit belt','Lab receiving belt')
BELT_PITCH, SEAM_WIDTH = .20, .012  # metres; one pitch per two-second loop
PLANT_ROOT = (595.30,6.175,2.07)
# Literal layout from build_screen_switch.py; tested against the actual authoring source.
LEAF_LAYOUT = (((-.02,0,.208),(-.33,-.015,.736),.23),
               ((-.03,.02,.336),(-.30,.025,1.0),.27),
               ((.01,.03,.480),(-.10,.015,1.24),.28),
               ((0,0,.592),(0,-.01,1.20),.24),
               ((-.04,.04,.192),(-.45,.025,.488),.25),
               ((0,.02,.48),(-.04,.015,1.16),.24),
               ((-.02,.04,.56),(-.36,.035,1.04),.29),
               ((-.01,.07,.408),(-.36,.065,.856),.29),
               ((0,.03,.288),(-.10,.025,.816),.26))


def coefficients(frame):return ambient.coefficients(frame)[:2]
def coefficient_velocity(frame):return ambient.coefficient_velocity(frame)[:2]
def belt_phase(frame):return (frame-1)/48
def belt_phase_velocity(frame):return 1/48
def belt_coordinate(world_y,frame):return (world_y/BELT_PITCH-belt_phase(frame))%1
def belt_seam(world_y,frame):return belt_coordinate(world_y,frame)<SEAM_WIDTH/BELT_PITCH


def leaf_tip(index):
    tip=LEAF_LAYOUT[index][1]
    return (595.30+tip[0],6.16+tip[1],2.08+tip[2])


def leaf_names():
    return tuple(f'SS plant {part} {i}' for i in range(1,10)
                 for part in ('broad leaf','midrib','petiole'))


def leaf_modes(world_point,index):
    # One continuous world-space field per assembly, including the evaluated
    # tube skins. Pin the complete attachment cross-section, not just its centre.
    q=max(0.,min(1.,(world_point[2]-PLANT_ROOT[2]-.012)/
                       (leaf_tip(index)[2]-PLANT_ROOT[2]-.012)))**2
    phase=index*.63
    a=(.022*q*math.cos(phase),.032*q*math.cos(phase+.45),.004*q*math.cos(phase))
    b=(-.022*q*math.sin(phase),-.032*q*math.sin(phase+.45),-.004*q*math.sin(phase))
    return a,b


def combine(world_point,index,weights):
    modes=leaf_modes(world_point,index)
    return tuple(sum(weights[j]*modes[j][axis] for j in range(2)) for axis in range(3))


def leaf_delta(world_point,index,frame):return combine(world_point,index,coefficients(frame))
def leaf_velocity(world_point,index,frame):return combine(world_point,index,coefficient_velocity(frame))


def validate_source(path,subject,camera):
    expected,signature=SOURCES[subject,camera]
    path=Path(path).resolve(strict=True)
    if path!=expected.resolve() or sha256(path)!=signature:
        raise ValueError('source path/SHA does not match pinned subject and camera')
    return path


def protected_inputs():
    return [p.parent for p,signature in SOURCES.values()]+[Path(__file__).resolve().parents[3]]


def parse_args(argv=None):
    p=argparse.ArgumentParser(description='Parent-only native preparation; zero renders',allow_abbrev=False)
    mode=p.add_mutually_exclusive_group(required=True)
    mode.add_argument('--prepare-only',action='store_true')
    mode.add_argument('--verify-prepared',type=Path)
    p.add_argument('--subject',choices=tuple(POSE))
    p.add_argument('--camera',choices=('desktop','mobile'))
    p.add_argument('--source',type=Path)
    p.add_argument('--out',type=Path)
    p.add_argument('--manifest',type=Path)
    args=p.parse_args(argv)
    if args.prepare_only:
        if any(getattr(args,n) is None for n in ('subject','camera','source','out')) or args.manifest:
            p.error('prepare-only requires subject/camera/source/out and no manifest')
    elif not args.manifest or any(getattr(args,n) is not None for n in ('subject','camera','source','out')):
        p.error('verify-prepared requires only derivative path and manifest')
    return args
