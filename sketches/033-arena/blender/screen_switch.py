"""Screen Switch continuation in metres/frames; deliberately independent of bpy.

The accepted piece is 1.2 x .06 x .8 m, facing 3*pi at frame 468.
Its U joiner is NOT replaced: local centre (.37, -.055, .26), also
facing 3*pi. All endpoints retain the same size and normalized screen position.
The shallow original niche ends at y=6.325 (front of the back wall).
"""
import argparse
import math
from pathlib import Path

import goal_loop as goal

START, END = 468, 660
DOCK_END, SWAP_START, SWAP_END = 576, 588, 636
PREVIEW_FRAMES = (520, 528, 556, 564, 572, 600, 612, 660)
MONITOR_WIDTH, MONITOR_HEIGHT = 1.90, 1.35
SCREEN_Y = 6.16
DESK_TOP, DESK_FRONT = 1.65, 5.43
DOCKS = ((596.42, 6.02, 2.62), (598.58, 6.02, 2.62))
ANGLE = 3*math.pi


def swap_progress(frame):
    return goal.ramp(frame, SWAP_START, SWAP_END)


def window_pose(frame, window):
    if window not in ('A', 'B'):
        raise ValueError('window must be A or B')
    if window == 'A' and frame < DOCK_END:
        x, y, _ = goal.piece_pose(468)
        start = (goal.ORIGIN_X+x, y, goal.PIECE_Z)
        lifted = (DOCKS[0][0], y, DOCKS[0][2])
        if frame <= 552:
            return goal.mix(start, lifted, goal.ramp(frame, 532, 552)), ANGLE
        return goal.mix(lifted, DOCKS[0], goal.ramp(frame, 552, DOCK_END)), ANGLE
    index = 0 if window == 'A' else 1
    t = goal.ramp(frame, SWAP_START+12, SWAP_END-12)
    p = goal.mix(DOCKS[index], DOCKS[1-index], t)
    # Establish separated depth lanes BEFORE crossing, then return to the
    # identical docks. B stays well above the desk and inside both frusta.
    arc = goal.ramp(frame, SWAP_START, SWAP_START+12)*(1-goal.ramp(frame, SWAP_END-12, SWAP_END))
    return (p[0], p[1]-(.06 if index == 0 else .26)*arc,
            p[2]+(.34 if index == 0 else -.04)*arc), ANGLE


def pane_pose(frame):
    return window_pose(frame, 'A')


def corner_pose(frame):
    p, angle = pane_pose(frame)
    return (p[0]+.37*math.cos(angle)+.055*math.sin(angle),
            p[1]+.37*math.sin(angle)-.055*math.cos(angle), p[2]+.26)


def camera_pose(frame, mobile=False):
    accepted = goal.camera_pose(468, mobile)
    if frame <= 469:
        return accepted
    entry, exit = (597.5, 3.8, 1.1), (597.5, 4.48, 1.1)
    follow = (597.25, 5.1, 1.1)
    final = (597.5, 4.48, 2.95)
    final_target = (597.5, 6.1, 3.0)
    final_lens = 10.7 if mobile else 11.4
    if frame <= 512:
        t = goal.ramp(frame, 469, 512)
        return (goal.mix(accepted[0], entry, t), goal.mix(accepted[1], follow, t),
                accepted[2]+(18-accepted[2])*t)
    if frame <= 532:
        t = goal.ramp(frame, 512, 532)
        return goal.mix(entry, exit, t), follow, 18-9*t
    lifted_camera = (DOCKS[0][0]+.25, exit[1], DOCKS[0][2])
    lifted_target = (DOCKS[0][0], 5.1, DOCKS[0][2])
    if frame <= 552:
        t = goal.ramp(frame, 532, 552)
        return goal.mix(exit, lifted_camera, t), goal.mix(follow, lifted_target, t), 9
    t = goal.ramp(frame, 552, 576)
    return goal.mix(lifted_camera, final, t), goal.mix(lifted_target, final_target,t), 9+(final_lens-9)*t


def content_reveal(frame):
    """A bottom-up screen fill makes docking visible; glass stays at full size."""
    return goal.ramp(frame, 560, DOCK_END)


def corner_clearance(loc, dims):
    """Leave glass around the original U, including while content rises.

    Piece-local joiner footprint is x=.32..42, z=.15..3775. The open
    notch continues to the top so the titlebar never sweeps through it.
    No change to the original joiner, glass or their materials is involved.
    """
    x,y,z = loc
    w,d,h = dims
    x0,x1,z0,z1 = x-w/2,x+w/2,z-h/2,z+h/2
    left,right,bottom = .30,.44,.13
    if x1 <= left or x0 >= right or z1 <= bottom:
        return ((loc,dims),)
    rectangles = ((x0,x1,z0,min(z1,bottom)),
                  (x0,min(x1,left),max(z0,bottom),z1),
                  (max(x0,right),x1,max(z0,bottom),z1))
    return tuple((((a+b)/2,y,(c+e)/2),(b-a,d,e-c))
                 for a,b,c,e in rectangles if b > a and e > c)


def parse_frames(value=None, stills=False, final=False):
    first = START+1 if final else START
    if value is None:
        return PREVIEW_FRAMES if stills else tuple(range(first, END+1))
    try:
        if '-' in value:
            a, b = map(int, value.split('-'))
            if a > b or a < first or b > END:
                raise ValueError
            frames = tuple(range(a, b+1))
        else:
            frames = tuple(map(int, value.split(',')))
        if (not frames or len(set(frames)) != len(frames)
                or any(f < first or f > END for f in frames)
                or tuple(sorted(frames)) != frames
                or (stills and len(frames) > 8)):
            raise ValueError
        return frames
    except ValueError as exc:
        raise ValueError(f'frames must be ordered unique {first}–660; at most 8 with --stills') from exc


def parse_render_args(argv):
    """Validate the parent-only CLI without importing or executing Blender."""
    parser = argparse.ArgumentParser(description='Append the approved Screen Switch scene to an accepted native source')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--camera', choices=('desktop','mobile'), required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--preview', action='store_true')
    mode.add_argument('--final', action='store_true')
    parser.add_argument('--stills', action='store_true')
    parser.add_argument('--frames', help='ordered comma list or inclusive range; preview max 8; final 469–660')
    parser.add_argument('--icon', type=Path, required=True, help='PNG from export-screen-switch-icon.swift')
    args = parser.parse_args(argv)
    if args.preview and not args.stills:
        parser.error('--preview requires --stills (at most eight frames)')
    if args.final and args.stills:
        parser.error('--stills is only valid with --preview')
    try:
        args.frames = parse_frames(args.frames, args.stills, args.final)
    except ValueError as exc:
        parser.error(str(exc))
    width,height = (1600,900) if args.final else (640,360)
    args.size = (height,width) if args.camera == 'mobile' else (width,height)
    args.samples = 32 if args.final else 8
    return args
