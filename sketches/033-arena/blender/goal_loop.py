"""Metres and frame-based choreography, independent of Blender."""
import math

ORIGIN_X = 600
RADIUS = 2.1
STRAIGHT = 5
LENGTH = 2 * STRAIGHT + math.tau * RADIUS
STATIONS = (0, STRAIGHT, STRAIGHT + math.pi * RADIUS, 2 * STRAIGHT + math.pi * RADIUS)
WALL_Y = 4.1
HOLE_WIDTH, HOLE_HEIGHT = 1.24, .84
PIECE_Z = 1.1
CARRIER_WIDTH, GAUGE_TAB = .9, .14
ARM_BASES = ((-2.5,-3.3),(2.5,-3.3),(2.5,3.3),(-4.2,2.55))
ARM_SCALE, ARM_LINK, SHOULDER_Z = 1.6, 1.0, 1.6
STATUS_POSTS = {2: (4.15,2.2), 3: (-.75,2.3)}
STATUS_RADIUS, STATUS_HEAD_Z = .20, 1.425
# Inverted with the local AgX/Medium High Contrast OCIO transform at exposure .35.
# Pure emission keeps the 169 cut independent of the lab key/fill.
WIPE_RADIANCE = {'desktop': (1.878376,1.938710,2.075594),
                 'mobile': (1.867645,1.930508,2.068641)}
EXIT_Y = 5.1
TRAY_SLOTS = ((2.3,-2.85,1.28), (2.7,-2.85,1.28))
JOINER_SIZE = (.10,.035,.22)


def ease(t):
    t = max(0, min(1, t))
    return t*t*t*(t*(t*6-15)+10)


def ramp(frame, start, end):
    return ease((frame-start)/(end-start))


def mix(a, b, t):
    if t <= 0:
        return a
    if t >= 1:
        return b
    return tuple(x+(y-x)*t for x, y in zip(a, b))


def track(distance):
    """Arc-length stadium centreline; tangent angle is continuous modulo 2 pi."""
    s = distance % LENGTH
    if s <= STRAIGHT:
        return -2.5+s, -RADIUS, 0
    s -= STRAIGHT
    if s <= math.pi*RADIUS:
        angle = -math.pi/2+s/RADIUS
        return 2.5+RADIUS*math.cos(angle), RADIUS*math.sin(angle), angle+math.pi/2
    s -= math.pi*RADIUS
    if s <= STRAIGHT:
        return 2.5-s, RADIUS, math.pi
    s -= STRAIGHT
    angle = math.pi/2+s/RADIUS
    return -2.5+RADIUS*math.cos(angle), RADIUS*math.sin(angle), angle+math.pi/2


TRAVEL = ((228, 0), (240, 0), (259, STATIONS[1]), (273, STATIONS[1]),
          (298, STATIONS[2]), (310, STATIONS[2]), (354, LENGTH), (362, LENGTH),
          (380, LENGTH+STATIONS[1]), (392, LENGTH+STATIONS[1]),
          (416, LENGTH+STATIONS[2]), (426, LENGTH+STATIONS[2]),
          (438, LENGTH+STATIONS[3]), (456, LENGTH+STATIONS[3]))


def piece_pose(frame):
    if frame >= 456:
        # Align inside the sight line only after the trailing face clears the wall.
        return -2.5-.25*ramp(frame,462,464), 2.1+(EXIT_Y-2.1)*ramp(frame,456,464), 3*math.pi
    distance = 0
    for (a, x), (b, y) in zip(TRAVEL, TRAVEL[1:]):
        if frame <= b:
            distance = x+(y-x)*ramp(frame, a, b)
            break
    if distance == LENGTH+STATIONS[3]:
        return -2.5,2.1,3*math.pi
    x, y, angle = track(distance)
    # Unwrap the second circuit so linear subframes never spin through a full turn.
    return x, y, angle + math.tau*math.floor(distance/LENGTH)


def pulse(frame, start, contact, release, end):
    return ramp(frame, start, contact)*(1-ramp(frame, release, end))


def activity(frame, station):
    windows = (((229, 233, 237, 240), (354, 356, 359, 362)),
               ((259, 263, 269, 273), (380, 383, 388, 392)),
               ((298, 303, 306, 310), (416, 420, 423, 426)),
               ((434, 438, 442, 444),))
    return max(pulse(frame, *window) for window in windows[station])


def tool_pose(frame, station):
    x,y,_ = track(STATIONS[station])
    stroke = activity(frame, station)
    if station == 3:
        # Approach normal to the slab, so the gauge never sweeps through it.
        y -= .3*(1-stroke)
        z = PIECE_Z+.8
        # Measure first, then park left before the clean wall shot at 446.
        return mix((x,y,z),(-4.3,1.4,1.8),ramp(frame,442,446))
    elif station == 1 and 372 <= frame <= 392:
        # Follow the actual repair material: tray pickup, lift, insert, withdraw.
        jx,jy,jz = joiner_pose(frame)
        held = (jx,jy,jz+.14)
        if frame < 378:
            return mix((x,y,1.95),held,ramp(frame,372,376))
        return mix(held,(x,y,1.95),ramp(frame,388,392))
    else:
        z = 1.95-((1.95-PIECE_Z-.4) if station==2 else .26)*stroke
    return x,y,z


def arm_points(base, destination):
    """Two rigid 1 m links: 2 m reach on a 1.6 m shoulder, with larger housings."""
    shoulder = (*base,SHOULDER_Z)
    wrist = (destination[0],destination[1],destination[2]+.24*ARM_SCALE)
    dx,dy,dz = (b-a for a,b in zip(shoulder,wrist))
    distance = math.dist(shoulder,wrist)
    assert .01 < distance < 2*ARM_LINK, 'Cobot target outside reach'
    horizontal = math.hypot(dx,dy)
    theta = math.atan2(dz,horizontal)+math.acos(distance/(2*ARM_LINK))
    reach = ARM_LINK*math.cos(theta)
    elbow = (shoulder[0]+dx/horizontal*reach,shoulder[1]+dy/horizontal*reach,SHOULDER_Z+ARM_LINK*math.sin(theta))
    return shoulder,elbow,wrist


def joiner_pose(frame):
    """One material piece leaves slot 1, travels with Build, and stays in the crack."""
    x,y,angle = piece_pose(frame)
    seated = (x+.37*math.cos(angle)+.055*math.sin(angle),
              y+.37*math.sin(angle)-.055*math.cos(angle),PIECE_Z+.26)
    slot = TRAY_SLOTS[0]
    lifted = (slot[0],slot[1],slot[2]+.34)
    approach = (2.87,-2.40,PIECE_Z+.26)
    if frame <= 382:
        return mix(slot,lifted,ramp(frame,378,382))
    if frame <= 384:
        return mix(lifted,approach,ramp(frame,382,384))
    return mix(approach,seated,ramp(frame,384,388))


def piece_state(frame):
    gap = ramp(frame,300,304)*(1-ramp(frame,384,388))
    return {'fill': ramp(frame, 259, 273), 'cracked': 304 <= frame < 388,
            'gap': gap, 'crack_glow': pulse(frame,300,304,308,316),
            'repairs_left': 2 if frame <= 378 else 1,
            'repair': pulse(frame, 384, 386, 388, 392),
            'failure_flash': pulse(frame, 300, 304, 308, 320),
            'glass': ramp(frame, 446, 448),
            'check': 'red' if 304 <= frame < 420 else 'green' if frame >= 420 else 'idle',
            'review': frame >= 446}


def camera_pose(frame, mobile=False):
    overview = (-11,-7,13) if mobile else (-3,-11,9.2)
    target = (-.8,.4,2.7) if mobile else (0,0,.5)
    lens = 59 if mobile else 35.6
    check,check_target = (-.7,-3.2,4.6),(2.65,2.2,1.35)
    check_lens = 61 if mobile else 55
    repair,repair_target = (0,-5.1,4.3),(2.5,-2.35,1.3)
    repair_lens = 42 if mobile else 37
    review,review_target,review_lens = (1,-3,1.6),(-2.5,2.1,1.1),70
    end,end_target = (-1.4,-1,1.35),(-2.5,WALL_Y,PIECE_Z)
    if frame <= 200:
        t = .20*ramp(frame,169,175)+.80*ramp(frame,175,200)
        pos,look = mix((0,-7.35,1.65),overview,t),mix((0,-7,1.65),target,t)
    elif frame <= 338:
        # Arrive before the weight touches; one wide return after release.
        t = pulse(frame,272,300,310,338)
        pos,look = mix(overview,check,t),mix(target,check_target,t)
        lens += (check_lens-lens)*t
    elif frame <= 392:
        t = ramp(frame,346,374)
        pos,look = mix(overview,repair,t),mix(target,repair_target,t)
        lens += (repair_lens-lens)*t
    elif frame <= 426:
        t = ramp(frame,392,416)
        pos,look = mix(repair,check,t),mix(repair_target,check_target,t)
        lens = repair_lens+(check_lens-repair_lens)*t
    elif frame <= 442:
        t = ramp(frame,426,438)
        pos,look = mix(check,review,t),mix(check_target,review_target,t)
        lens = check_lens+(review_lens-check_lens)*t
    elif frame <= 456:
        pos,look = review,mix(review_target,end_target,ramp(frame,442,446))
        lens = review_lens
    else:
        t = ramp(frame,456,464)
        pos,look = mix(review,end,t),end_target
        lens = review_lens+((60 if mobile else 52)-review_lens)*t
    return (pos[0]+ORIGIN_X, *pos[1:]), (look[0]+ORIGIN_X, *look[1:]), lens
