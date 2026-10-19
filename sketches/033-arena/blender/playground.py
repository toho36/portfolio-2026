"""Playground continuation and bounded render modes; no Blender dependency.

One flat, genuine 032 image inside the existing left window B. The camera
stops outside the monitor; the source is never presented as free-view 3D.
"""
import argparse
import math
from pathlib import Path

import goal_loop as goal
import screen_switch as switch

START, MOVE_START, MOVE_END, END = 660, 661, 732, 804
PREVIEW_FRAMES = (660, 684, 708, 732, 744, 756, 780, 804)
SEQUENCE_START, SEQUENCE_LENGTH = 660, 145
QUAD_WIDTH, QUAD_HEIGHT = 1.10, .61875
QUAD_Y, QUAD_Z = .055, -.035
# Local -X becomes world +X under the actual window's 3*pi rotation.
# Winding faces local +Y, hence world -Y, toward the camera.
QUAD_UV = ((1, 0), (1, 1), (0, 1), (0, 0))


def quad_local_vertices():
    w, h = QUAD_WIDTH/2, QUAD_HEIGHT/2
    return ((-w, QUAD_Y, QUAD_Z-h), (-w, QUAD_Y, QUAD_Z+h),
            (w, QUAD_Y, QUAD_Z+h), (w, QUAD_Y, QUAD_Z-h))


def quad_world_vertices():
    centre, angle = switch.window_pose(660, 'B')
    c, s = math.cos(angle), math.sin(angle)
    return tuple((centre[0]+x*c-y*s, centre[1]+x*s+y*c, centre[2]+z)
                 for x, y, z in quad_local_vertices())


def camera_pose(frame, mobile=False, accepted=None):
    """Quintic approach, sampled as native linear keys by the parent builder.

    accepted optionally supplies the measured native endpoint, so frame 661
    retains its exact float pose/lens. No change to the old camera action.
    """
    accepted = switch.camera_pose(660, mobile) if accepted is None else accepted
    if frame <= MOVE_START:
        return accepted
    centre = tuple(sum(p[i] for p in quad_world_vertices())/4 for i in range(3))
    # Horizontal sensor fit applies to BOTH aspects. A raised mobile target
    # leaves the upper portrait area quiet while preserving the entire image.
    height = centre[2]+(.29 if mobile else .065)
    end = (centre[0], 4.98, height)
    target = (centre[0], centre[1], height)
    width_fraction = .84 if mobile else .78
    lens = width_fraction*36*(centre[1]-end[1])/QUAD_WIDTH
    t = goal.ramp(frame, MOVE_START, MOVE_END)
    # Centre the left-hand document before most of the optical approach;
    # otherwise its left edge briefly leaves the portrait frustum mid-move.
    return (goal.mix(accepted[0], end, t), goal.mix(accepted[1], target, t),
            accepted[2]+(lens-accepted[2])*t*t)


def reveal(frame):
    return goal.ramp(frame, 662, 684)


def sequence_frame(frame):
    """Positive index in the padded native timeline, separate from photo ID."""
    return max(1, min(SEQUENCE_LENGTH, int(frame)-SEQUENCE_START+1))


def villa_frame(frame):
    """Original 032 photo clock: hold 156, finish 156–192, hold 192."""
    return max(156, min(192, int(frame)-744+156))


def sequence_path(root, frame):
    return Path(root)/f'frame-{sequence_frame(frame):04d}.png'


def parse_frames(value=None, final=False):
    first_allowed, limit = (MOVE_START, END-MOVE_START+1) if final else (START, 8)
    if value is None:
        return tuple(range(MOVE_START, END+1)) if final else PREVIEW_FRAMES
    try:
        if '-' in value:
            first, last = map(int, value.split('-'))
            if not first_allowed <= first <= last <= END or last-first >= limit:
                raise ValueError
            frames = tuple(range(first, last+1))
        else:
            if value.count(',') >= limit:
                raise ValueError
            frames = tuple(map(int, value.split(',')))
        if (not 1 <= len(frames) <= limit or tuple(sorted(set(frames))) != frames
                or any(f < first_allowed or f > END for f in frames)):
            raise ValueError
        return frames
    except ValueError as exc:
        raise ValueError(f'frames must be ordered unique {first_allowed}–804, at most {limit} frames') from exc


def parse_render_args(argv):
    parser = argparse.ArgumentParser(description='Explicit Playground preview or final render', allow_abbrev=False)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--preview', action='store_true')
    mode.add_argument('--final', action='store_true')
    parser.add_argument('--stills', action='store_true')
    parser.add_argument('--prepare-only', action='store_true', help='save guarded scene for fresh-process reload; render no stills')
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True, help='fresh preview-{camera} or final-{camera} directory')
    parser.add_argument('--camera', choices=('desktop', 'mobile'), required=True)
    parser.add_argument('--frames-root', type=Path, required=True, help='staged 145-file villa-timeline directory')
    parser.add_argument('--frames', help='ordered unique list or inclusive range; preview max 8, final only 661–804')
    args = parser.parse_args(argv)
    if args.preview != args.stills:
        parser.error('--preview requires --stills; --final rejects --stills')
    try:
        args.frames = parse_frames(args.frames, final=args.final)
    except ValueError as exc:
        parser.error(str(exc))
    args.size = ((360, 640) if args.camera == 'mobile' else (640, 360)) if args.preview else (
        (900, 1600) if args.camera == 'mobile' else (1600, 900))
    args.samples = 8 if args.preview else 32
    return args


def validate_output(source, out, frames_root, camera, final=False):
    """Read-only preflight. Refuse existing destinations and input subtrees."""
    source, out, frames_root = (Path(p).resolve() for p in (source, out, frames_root))
    mode = 'final' if final else 'preview'
    if (camera not in ('desktop', 'mobile') or out.name != mode+'-'+camera
            or out.exists() or out == source or out.is_relative_to(source.parent)
            or out.is_relative_to(frames_root) or frames_root.is_relative_to(out)
            or source.is_relative_to(out)):
        raise ValueError(f'Use a fresh {mode}-{{camera}} directory separate from all inputs')
    return out/'playground.blend'
