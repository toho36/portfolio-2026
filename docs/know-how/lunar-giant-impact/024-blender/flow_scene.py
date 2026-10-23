"""Authored warm weak bulk-flow mechanism. No solver, handlers, or render.

The geometry kernel is ordinary Python; build_scene adds native baked shape
keys. The retained fracture study is imported only for its light/material/aim
helpers, never invoked. Output saving is explicit and refuses replacement.
"""
import argparse
import importlib.util
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
EARTH = (3.4, -.2, -3.1)
RE, RT = 3.45, 1.25
N = (-.5, 0., math.sqrt(3)/2)
T = (-math.sqrt(3)/2, 0., -.5)
B = (0., -1., 0.)
CONTACT, SPLIT, END = 30, 96, 144
SIDES, INNER_RINGS, OUTER_RINGS = 32, 48, 32
PARTITION = .28
NECK = .004
DISCLAIMER = (
    'Authored warm weak direct-remnant pathway, not a historical reconstruction. '
    'Neutral gray mechanical proxy, not thermal appearance or a lunar map. '
    'Proxy volume, not mass/pressure conservation; no SPH or ANEOS. '
    'Earth-mantle entrainment and diffuse debris/disk are omitted. '
    'Authored RT/RE=1.25/3.45, spatial compression and 6-second time compression; '
    'the references span hours and much longer arms. Strength/temperature alter outcomes.'
)


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def mul(a, k):
    return tuple(x * k for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def length(a):
    return math.sqrt(dot(a, a))


def mix(a, b, u):
    return add(mul(a, 1-u), mul(b, u))


def smooth(a, b, t):
    u = max(0., min(1., (t-a)/(b-a)))
    return u*u*(3-2*u)


def hermite(a, b, va, vb, u, duration):
    return add(add(mul(a, 2*u**3-3*u*u+1), mul(b, -2*u**3+3*u*u)),
               add(mul(va, duration*(u**3-2*u*u+u)), mul(vb, duration*(u**3-u*u))))


HIT = add(EARTH, mul(N, RE + RT))
VELOCITY = sub(mul(T, .075), mul(N, .005))
START = (3.6, -.2, 1.80)


def path(knots, frame):
    """Explicit matching velocities, in world units/frame, at every knot."""
    for (fa, a, va), (fb, b, vb) in zip(knots, knots[1:]):
        if frame <= fb:
            return hermite(a, b, va, vb, (frame-fa)/(fb-fa), fb-fa)
    return knots[-1][1]


def carrier(frame):
    return path([
        (1, START, (-.100, 0., 0.)), (CONTACT, HIT, VELOCITY),
        (43, (.260, -.2, -.370), (-.030, 0., -.060)),
        (52, (-.20, -.2, -.55), (-.060, 0., .012)),
        (76, (-1.05, -.2, -.30), (-.041, 0., .005)),
        (SPLIT, (-1.90, -.2, -.25), (-.044, 0., -.030)),
    ], min(frame, SPLIT))


PARAMS = ([-1 + (PARTITION+1)*i/INNER_RINGS for i in range(INNER_RINGS+1)] +
          [PARTITION + (1-PARTITION)*i/OUTER_RINGS for i in range(1, OUTER_RINGS+1)])
JOINT = INNER_RINGS


def profile(frame):
    """Ordered slices guarantee a single embedded bulk, even while its spine bends.

    Paired transverse squeeze conserves cross-sectional area during pressure.
    Subsequent lobe redistribution solves measured polyhedral proxy volumes.
    Its interface weight is exactly zero: no joint tearing or global rescale.
    """
    flow = smooth(42, 82, frame)
    concentration = smooth(65, SPLIT, frame)
    rupture = smooth(SPLIT-2, SPLIT, frame)
    theta = math.atan2(T[2], T[0])
    axis = (math.cos(theta), 0., math.sin(theta))
    normal = (-axis[2], 0., axis[0])
    origin = carrier(frame)
    pressure = smooth(CONTACT, 44, frame)*(1-smooth(48, 74, frame))
    squeeze = math.exp(-.34*pressure)
    rows = []
    for s in PARAMS:
        inner = s <= PARTITION
        u = (s+1)/(PARTITION+1) if inner else (s-PARTITION)/(1-PARTITION)
        rest_x = RT*s
        future_x = -2.20*(1-u) if inner else 2.60*u
        x = (1-flow)*rest_x + flow*future_x
        bend = -.90*flow*math.sin(math.pi*(s+1)/2)
        centre = add(add(origin, mul(axis, x)), mul(normal, bend))
        rest_radius = RT*math.sqrt(max(0., 1-s*s))
        # One broad arm first, then distal concentration. The waist belongs to
        # the same area field as neighbouring rings, not two spheroid tips.
        lobe = (1.14 if inner else .74)*math.sqrt(max(0., 4*u*(1-u)))
        lobe *= .24+.76*math.exp(-((u-(.34 if inner else .70))/.29)**2)
        strand = .36*(smooth(0, 1, u) if inner else 1-smooth(0, 1, u))
        initial_length = RT*((PARTITION+1) if inner else (1-PARTITION))
        final_length = 2.20 if inner else 2.60
        current_length = (1-flow)*initial_length + flow*final_length
        # Blend transported cross-sectional volume rather than linear radii;
        # otherwise the middle of the stretch needs visible corrective growth.
        arm_area = (1-concentration)*rest_radius**2*initial_length/final_length + concentration*(lobe+strand)**2
        radius = math.sqrt(((1-flow)*rest_radius**2*initial_length + flow*arm_area*final_length)/current_length)
        interface = math.sqrt((1-flow)*RT**2*(1-PARTITION**2) + flow*.36**2)
        blend = flow*math.exp(-((s-PARTITION)/.12)**2)
        radius = radius*(1-blend)+interface*blend
        thread = .36*(1-smooth(90, 93, frame))+.018*smooth(90, 93, frame)
        thread = thread*(1-rupture)+NECK*rupture
        radius *= 1-(1-thread/.36)*math.exp(-((s-PARTITION)/.018)**2)
        # Redistribution weight vanishes at both tips and at the welded neck.
        weight = max(0., math.sin(math.pi*u))**2
        # The leading side flattens before the tail stretches; material rings
        # shear relative to each other instead of fitting one affine ellipsoid.
        sheet = smooth(46, 65, frame)
        local_squeeze = squeeze**(1-.55*smooth(-.2, .8, s))*math.exp(.72*sheet*math.exp(-((s-.24)/.40)**2))
        rows.append((centre, radius, weight, local_squeeze, inner))
    return rows, normal


def points_from_rows(rows, normal, factors=(1., 1.)):
    vertices = [rows[0][0]]
    for centre, radius, weight, squeeze, inner in rows[1:-1]:
        r = radius*(1+(factors[0 if inner else 1]-1)*weight)
        for j in range(SIDES):
            angle = 2*math.pi*j/SIDES
            vertices.append(add(centre, add(mul(normal, r*math.cos(angle)*squeeze),
                                             mul(B, r*math.sin(angle)/squeeze))))
    vertices.append(rows[-1][0])
    return vertices


def ring(i):
    return list(range(1+(i-1)*SIDES, 1+i*SIDES))


def welded_faces():
    faces = []
    first = ring(1)
    for j in range(SIDES):
        faces.append((0, first[(j+1)%SIDES], first[j]))
    for i in range(1, len(PARAMS)-2):
        a, b = ring(i), ring(i+1)
        for j in range(SIDES):
            faces.append((a[j], a[(j+1)%SIDES], b[(j+1)%SIDES], b[j]))
    last = ring(len(PARAMS)-2)
    tip = 1+(len(PARAMS)-2)*SIDES
    for j in range(SIDES):
        faces.append((last[j], last[(j+1)%SIDES], tip))
    return faces


FACES = welded_faces()


def triangles(faces):
    for face in faces:
        for i in range(1, len(face)-1):
            yield face[0], face[i], face[i+1]


def volume(vertices, faces):
    return sum(dot(vertices[a], cross(vertices[b], vertices[c])) for a,b,c in triangles(faces))/6


def domain(vertices, inner, rows):
    """Closed domains share the exact welded neck ring; only caps are new."""
    cut = ring(JOINT)
    indices = list(range(0, cut[-1]+1)) if inner else list(range(cut[0], len(vertices)))
    mapping = {old:new for new,old in enumerate(indices)}
    points = [vertices[i] for i in indices] + [rows[JOINT][0]]
    cap = len(points)-1
    faces = [tuple(mapping[i] for i in f) for f in FACES if all(i in mapping for i in f)]
    for j in range(SIDES):
        a,b = mapping[cut[j]],mapping[cut[(j+1)%SIDES]]
        faces.append((a,b,cap) if inner else (b,a,cap))
    return points, faces, indices


_REST_ROWS, _REST_NORMAL = profile(1)
REST = points_from_rows(_REST_ROWS, _REST_NORMAL)
TARGETS = tuple(volume(*domain(REST, inner, _REST_ROWS)[:2]) for inner in (True, False))


def bulk(frame):
    rows, normal = profile(frame)
    factors = [1., 1.]
    # Volume is quadratic in the weighted radius amplitude. Three evaluations
    # solve it directly; roots remain positive and no scene-space breathing is
    # introduced by scaling the whole object or moving its interface.
    for side, inner in enumerate((True, False)):
        samples = []
        for factor in (0., 1., 2.):
            probe = factors.copy()
            probe[side] = factor
            pts = points_from_rows(rows, normal, probe)
            samples.append(volume(*domain(pts, inner, rows)[:2]))
        c = samples[0]-TARGETS[side]
        a = (samples[2]-2*samples[1]+samples[0])/2
        b = samples[1]-samples[0]-a
        if abs(a) < 1e-12:
            factors[side] = -c/b
        else:
            disc = b*b-4*a*c
            if disc < 0:
                raise ValueError('no positive proxy-volume redistribution root')
            factors[side] = (-b+math.sqrt(disc))/(2*a)
        if factors[side] <= 0:
            raise ValueError('negative lobe radius redistribution')
    return points_from_rows(rows, normal, factors), rows, factors


SPLIT_POINTS, SPLIT_ROWS, _ = bulk(SPLIT)
SPLIT_DOMAINS = [domain(SPLIT_POINTS, inner, SPLIT_ROWS) for inner in (True, False)]


def centroid(points):
    return tuple(sum(p[i] for p in points)/len(points) for i in range(3))


def remnant(frame, inner, receive=True):
    side = 0 if inner else 1
    points = SPLIT_DOMAINS[side][0]
    centre = centroid(points)
    # Match incoming material-domain centroid velocity at the topology change.
    previous, rows, _ = bulk(SPLIT-.01)
    prev = centroid(domain(previous, inner, rows)[0])
    velocity = mul(sub(centre, prev), 100.)
    if inner:
        target = path([(SPLIT, centre, velocity),
                       (116, (-.65, -.2, -.40), (.065, 0., -.050)),
                       (END, (1.15, -.2, -1.65), (.034, 0., -.024))], frame)
    else:
        target = path([(SPLIT, centre, velocity),
                       (END, add(centre, (-1.18, 0., -.35)), (-.026, 0., -.008))], frame)
    # Authored settling with a volume proxy, not self-gravity SPH.
    earth_axis = mul(sub(EARTH, target), 1/length(sub(EARTH, target)))
    turn = smooth(SPLIT, SPLIT+20, frame) if not inner else 0.
    axis = mix(T, mul(earth_axis, -1.), turn)
    axis = mul(axis, 1/length(axis))
    transverse = (-axis[2], 0., axis[0])
    settled = []
    for index in SPLIT_DOMAINS[side][2]:
        if index == 0:
            phi, azimuth = 0., 0.
        elif index == len(SPLIT_POINTS)-1:
            phi, azimuth = math.pi, 0.
        else:
            ring_index = (index-1)//SIDES+1
            fraction = ring_index/(INNER_RINGS+1) if inner else (ring_index-JOINT+1)/(OUTER_RINGS+1)
            phi, azimuth = math.pi*fraction, 2*math.pi*((index-1)%SIDES)/SIDES
        axial = -math.cos(phi)
        width = math.sin(phi)*(1+.055*axial)
        settled.append(add(centre, add(mul(axis, 1.12*axial),
                                      add(mul(transverse, width*math.cos(azimuth)),
                                          mul(B, width*math.sin(azimuth))))))
    settled.append(add(centre, mul(axis, 1.12 if inner else -1.12)))
    faces = SPLIT_DOMAINS[side][1]
    radius = (TARGETS[side]/volume(settled, faces))**(1/3)
    settled = [add(centre, mul(sub(p, centre), radius)) for p in settled]
    relax = smooth(SPLIT, SPLIT+8, frame)
    shaped = [mix(a, b, relax) for a, b in zip(points, settled)]
    offset = sub(centroid(shaped), centre)
    shaped = [sub(p, offset) for p in shaped]
    correction = (TARGETS[side]/volume(shaped, faces))**(1/3)
    angle = (.010 if inner else .004)*(frame-SPLIT)*smooth(SPLIT, SPLIT+8, frame)
    result = []
    normal = sub(target, EARTH)
    normal = mul(normal, 1/length(normal))
    tangent = cross(B, normal)
    spread = smooth(RETURN_CONTACT, min(END, RETURN_CONTACT+20), frame) if inner and receive else 0.
    squeeze = math.exp(-.45*spread)
    for p in shaped:
        v = mul(sub(p, centre), correction)
        v = (v[0]*math.cos(angle)-v[2]*math.sin(angle), v[1], v[0]*math.sin(angle)+v[2]*math.cos(angle))
        if inner:
            v = add(mul(normal, dot(v, normal)*squeeze),
                    add(mul(tangent, dot(v, tangent)/math.sqrt(squeeze)), mul(B, dot(v, B)/math.sqrt(squeeze))))
        if inner:
            # Conformal tangent spread bends toward the receiving surface.
            # Recentring and measured volume correction keep this a geometry
            # deformation, never a shrink-to-hide absorption.
            curvature = -.5*spread*(dot(v, tangent)**2+dot(v, B)**2)/RE
            v = add(v, mul(normal, curvature))
        result.append(add(target, v))
    offset = sub(centroid(result), target)
    result = [sub(p, offset) for p in result]
    correction = (TARGETS[side]/volume(result, faces))**(1/3)
    return [add(target, mul(sub(p, target), correction)) for p in result]


def earth_point(rest, frame, receive=True):
    direction = mul(rest, 1/length(rest))
    contact = smooth(CONTACT, 43, frame)*(1-smooth(46, 68, frame))
    contact_normal = sub(carrier(min(frame, 52)), EARTH)
    contact_normal = mul(contact_normal, 1/length(contact_normal))
    c = dot(direction, contact_normal)
    r = dot(direction, RETURN_NORMAL if receive else N)
    footprint = math.exp(-(math.acos(max(-1., min(1., c)))/.27)**2)
    returning_footprint = math.exp(-(math.acos(max(-1., min(1., r)))/.65)**2)
    # A short compression precedes positive receiving-host redistribution.
    # The original full enclosure is geometric: no visibility, scale or fade.
    compression = (smooth(RETURN_CONTACT, RETURN_CONTACT+3, frame)*(1-smooth(RETURN_CONTACT+3, RETURN_CONTACT+8, frame))) if receive else 0.
    acceptance = smooth(RETURN_CONTACT+3, RETURN_PEAK, frame) if receive else 0.
    depression = -.42*contact*footprint
    receiving = (-.16*compression+.40*acceptance)*returning_footprint
    shoulder = .085*contact*math.exp(-((c-.84)/.17)**2)
    tide = .055*smooth(52, 96, frame)*(3*direction[2]**2-1)
    return add(mul(direction, length(rest)+depression+receiving+shoulder+tide), mul(T, .16*contact*footprint))


def surface_gap(point, frame, receive=True):
    """Radial surface estimate; native checks use the evaluated Earth BVH."""
    relative = sub(point, EARTH)
    rest = mul(relative, RE/length(relative))
    return length(relative)-length(earth_point(rest, frame, receive))


RETURN_CONTACT = next(f for f in range(SPLIT+1, END+1)
                      if min(surface_gap(p, f, False) for p in remnant(f, True, False)) <= 0.)
RETURN_PEAK = min(END-4, RETURN_CONTACT+15)
RETURN_NORMAL = sub(centroid(remnant(RETURN_CONTACT, True, False)), EARTH)
RETURN_NORMAL = mul(RETURN_NORMAL, 1/length(RETURN_NORMAL))


def _helpers():
    spec = importlib.util.spec_from_file_location('retained_clay_helpers', Path(__file__).with_name('build_scene.py'))
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    return helper


def _curves(animation):
    if not animation or not animation.action:
        return
    for layer in animation.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                yield from bag.fcurves


def _linear(animation):
    # A layered action can also contain shape-key slots; only visibility steps.
    if not animation or not animation.action:
        return
    for curve in _curves(animation):
        if curve.data_path.startswith('hide_'):
            for key in curve.keyframe_points:
                key.interpolation = 'CONSTANT'


def _bake(obj, samples, start_velocity=None, end_velocity=None):
    """Native cardinal-cubic pose weights, C1 at every baked frame.

    Four neighbouring poses blend with small signed weights. These are plain
    F-curves stored in the blend, not Python drivers/handlers. Ghost samples
    maintain a partition of unity and match material velocity at the rupture.
    """
    first, second = samples[0], samples[1]
    previous, last = samples[-2], samples[-1]
    leading = ([sub(b, mul(v,2)) for b,v in zip(second[1],start_velocity)] if start_velocity else
               [sub(mul(a,2),b) for a,b in zip(first[1],second[1])])
    trailing = ([add(a, mul(v,2)) for a,v in zip(previous[1],end_velocity)] if end_velocity else
                [sub(mul(b,2),a) for a,b in zip(previous[1],last[1])])
    leading2 = [add(a,sub(a,b)) for a,b in zip(leading,first[1])]
    trailing2 = [add(b,sub(b,a)) for a,b in zip(last[1],trailing)]
    samples = [(first[0]-2,leading2),(first[0]-1,leading)] + samples + [(last[0]+1,trailing),(last[0]+2,trailing2)]
    obj.shape_key_add(name='Basis')
    for frame, points in samples:
        key = obj.shape_key_add(name='Pose%03d' % frame)
        key.slider_min, key.slider_max = -.25, 1.25
        for vertex, point in zip(key.data, points):
            vertex.co = point
        for f, value in ((frame-2,0.), (frame-1,0.), (frame,1.), (frame+1,0.), (frame+2,0.)):
            key.value = value
            key.keyframe_insert(data_path='value', frame=f)
        key.value = 0.
    for curve in _curves(obj.data.shape_keys.animation_data):
        curve.extrapolation = 'CONSTANT'
        for index, point in enumerate(curve.keyframe_points):
            slope = (0.,.5,0.,-.5,0.)[index]
            f,value = point.co
            point.interpolation = 'BEZIER'
            point.handle_left_type = point.handle_right_type = 'FREE'
            point.handle_left = (f-1/3, value-slope/3)
            point.handle_right = (f+1/3, value+slope/3)
        curve.update()


def _mesh(name, points, faces, material, rest=None):
    import bpy
    data = bpy.data.meshes.new(name+'Mesh')
    data.from_pydata(points, [], faces)
    data.update()
    data.materials.append(material)
    for face in data.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if rest is not None:
        attr = data.attributes.new('material_rest', 'FLOAT_VECTOR', 'POINT')
        for entry, point in zip(attr.data, rest):
            entry.vector = point
    return obj


def build_scene():
    import bpy
    import bmesh
    helper = _helpers()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end, scene.render.fps = 1, END, 24
    scene.render.engine = 'CYCLES'
    scene.cycles.device, scene.cycles.samples = 'CPU', 4
    scene.cycles.use_denoising = False
    scene.render.threads_mode, scene.render.threads = 'FIXED', 2
    scene.render.resolution_x, scene.render.resolution_y = 640, 360
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform, scene.view_settings.look = 'Standard', 'None'
    world = bpy.data.worlds.new('FlowStudySpace')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.025,.025,.025,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
    scene.world = world
    surface = helper.material('TransportedNeutralClay', (.48,.48,.48))
    nodes, links = surface.node_tree.nodes, surface.node_tree.links
    attribute = nodes.new('ShaderNodeAttribute')
    attribute.attribute_name = 'material_rest'
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.8
    noise.inputs['Detail'].default_value = 2.
    links.new(attribute.outputs['Vector'], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.12,.12,.12,1)
    ramp.color_ramp.elements[1].color = (.48,.48,.48,1)
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
    welded = _mesh('ContinuousMantle', REST, FACES, surface, REST)
    welded['role'] = 'welded_bulk'
    welded['disclaimer'] = DISCLAIMER
    baked = [(f, bulk(f)[0]) for f in range(1, SPLIT+1)]
    _bake(welded, baked)
    welded.hide_render = welded.hide_viewport = False
    for f, hide in ((1, False), (SPLIT-1, False), (SPLIT, True)):
        welded.hide_render = welded.hide_viewport = hide
        welded.keyframe_insert('hide_render', frame=f)
        welded.keyframe_insert('hide_viewport', frame=f)
    _linear(welded.animation_data)
    previous = bulk(SPLIT-1)[0]
    split_velocity = [sub(a,b) for a,b in zip(SPLIT_POINTS,previous)]
    cap_velocity = centroid([split_velocity[i] for i in ring(JOINT)])
    remnants = []
    for side, inner in enumerate((True, False)):
        points, faces, indices = SPLIT_DOMAINS[side]
        rest = [REST[i] for i in indices]+[_REST_ROWS[JOINT][0]]
        obj = _mesh('ReturningBulk' if inner else 'OuterRemnant', points, faces, surface, rest)
        obj['role'] = 'returning_bulk' if inner else 'outer_remnant'
        obj['source_proxy_volume'] = TARGETS[side]
        _bake(obj, [(f, remnant(f, inner)) for f in range(SPLIT, END+1)],
              start_velocity=[split_velocity[i] for i in indices]+[cap_velocity])
        for f, hide in ((1, True), (SPLIT-1, True), (SPLIT, False)):
            obj.hide_render = obj.hide_viewport = hide
            obj.keyframe_insert('hide_render', frame=f)
            obj.keyframe_insert('hide_viewport', frame=f)
        _linear(obj.animation_data)
        remnants.append(obj)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=RE)
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    earth_rest = [tuple(v.co) for v in bm.verts]
    earth_faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    earth = _mesh('ReceivingEarth', earth_rest, earth_faces, surface, earth_rest)
    earth.location = EARTH
    earth['role'] = 'deforming_target'
    _bake(earth, [(f, [earth_point(p, f) for p in earth_rest]) for f in range(1, END+1)])
    data = bpy.data.cameras.new('FixedContactCamera')
    camera = bpy.data.objects.new('FixedContactCamera', data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0,-22,2)
    helper.aim(camera, (0,0,0))
    data.type, data.ortho_scale, data.lens = 'ORTHO', 11.5, 50
    scene.camera = camera
    helper.light('BroadKey', (-6,-9,8), 1800, 5)
    helper.light('QuietFill', (5,-4,4), 650, 7)
    scene['disclaimer'] = DISCLAIMER
    scene['representation'] = 'one welded volume until frame96; exact ring-matched closed topology swap'
    scene['render_budget'] = 'CPU2threads,640x360,4samples; geometry builder submits no render'
    scene['proxy_volumes'] = list(TARGETS)
    scene['topology_swap_frame'] = SPLIT
    scene.frame_set(1)
    return scene, [welded]+remnants, sum(TARGETS)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    options = parser.parse_args(args)
    if options.output.exists():
        raise FileExistsError('refusing to replace an existing Blender study')
    import bpy
    build_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(options.output), check_existing=True)
    print('Saved native keyframes; no render submitted: '+str(options.output))
