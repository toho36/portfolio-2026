"""One modelled arena, Z up, metres. No external textures or projected plates.
Blender 4/5: -b -P build_scene.py -- --out DIR [--preview] [--stills]
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--preview', action='store_true')
parser.add_argument('--stills', action='store_true')
parser.add_argument('--frames')
parser.add_argument('--camera', choices=['desktop', 'mobile'], default='desktop')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
start, end = (1, 468)
if args.frames:
    start, end = map(int, args.frames.split('-'))
    if not 1 <= start <= end <= 468:
        parser.error('--frames must lie within 1-468')
args.out.mkdir(parents=True, exist_ok=True)
random.seed(33033)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8 if args.preview else 32
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.seed = 33033
scene.cycles.use_animated_seed = False
scene.cycles.max_bounces = 10
scene.cycles.transmission_bounces = 8
scene.cycles.sample_clamp_indirect = 3
scene.cycles.device = 'CPU'
backend = 'CPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    devices = [d for d in prefs.devices if d.type == 'METAL']
    for d in prefs.devices:
        d.use = d in devices
    if devices:
        scene.cycles.device = 'GPU'
        backend = 'METAL'
except (TypeError, RuntimeError, AttributeError):
    pass
w, h = (640, 360) if args.preview else (1600, 900)
if args.camera == 'mobile':
    w, h = h, w
scene.render.resolution_x, scene.render.resolution_y = w, h
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.frame_start, scene.frame_end = 1, 468
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.film_transparent = False
if hasattr(scene.render, 'use_motion_blur'):
    scene.render.use_motion_blur = not args.preview
else:
    scene.cycles.use_motion_blur = not args.preview
scene.render.motion_blur_shutter = .35
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .35


def material(name, color, rough=.5, metal=0, glass=False, emission=0, texture=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    p = n.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if glass:
        p.inputs['Transmission Weight'].default_value = 1
        p.inputs['IOR'].default_value = 1.46
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = emission
    if texture:
        coord = n.new('ShaderNodeTexCoord')
        scale = n.new('ShaderNodeVectorMath'); scale.operation = 'MULTIPLY'
        scale.inputs[1].default_value = (2, 35, 90) if texture == 'wood' else (3, 3, 18)
        l.new(coord.outputs['Object'], scale.inputs[0])
        noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 2
        noise.inputs['Detail'].default_value = 4
        l.new(scale.outputs[0], noise.inputs['Vector'])
        ramp = n.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*(c*.72 for c in color), 1)
        ramp.color_ramp.elements[1].color = (*(c*1.15 for c in color), 1)
        l.new(noise.outputs['Fac'], ramp.inputs[0]); l.new(ramp.outputs[0], p.inputs['Base Color'])
        bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .25
        bump.inputs['Distance'].default_value = .0005 if texture == 'wet' else (.001 if texture == 'wood' else .008)
        l.new(noise.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs[0], p.inputs['Normal'])
        if texture == 'concrete':
            wave = n.new('ShaderNodeTexWave'); wave.wave_type = 'BANDS'; wave.bands_direction = 'Z'
            wave.inputs['Scale'].default_value = 2.2
            l.new(coord.outputs['Object'], wave.inputs['Vector'])
            seams = n.new('ShaderNodeMath'); seams.operation = 'GREATER_THAN'; seams.inputs[1].default_value = .995
            l.new(wave.outputs['Fac'], seams.inputs[0])
            board = n.new('ShaderNodeBump'); board.inputs['Distance'].default_value = .012
            board.inputs['Strength'].default_value = .65
            l.new(seams.outputs[0], board.inputs['Height']); l.new(bump.outputs[0], board.inputs['Normal'])
            l.new(board.outputs[0], p.inputs['Normal'])
            tint = n.new('ShaderNodeMixRGB'); tint.blend_type = 'MULTIPLY'
            tint.inputs[0].default_value = .16
            l.new(ramp.outputs[0], tint.inputs[1]); l.new(wave.outputs['Color'], tint.inputs[2])
            l.new(tint.outputs[0], p.inputs['Base Color'])
        if texture == 'wet':
            puddle = n.new('ShaderNodeTexNoise'); puddle.inputs['Scale'].default_value = .3
            l.new(coord.outputs['Object'], puddle.inputs['Vector'])
            r = n.new('ShaderNodeValToRGB')
            # Soft wet sheen; a hard ramp edge read as camouflage blobs.
            r.color_ramp.elements[0].position = .42; r.color_ramp.elements[0].color = (.3,.3,.3,1)
            r.color_ramp.elements[1].position = .72; r.color_ramp.elements[1].color = (.07,.07,.07,1)
            l.new(puddle.outputs['Fac'], r.inputs[0]); l.new(r.outputs[0], p.inputs['Roughness'])
    if texture == 'wood':
        variation = n.new('ShaderNodeObjectInfo')
        shade = n.new('ShaderNodeMapRange')
        shade.inputs['To Min'].default_value = .72; shade.inputs['To Max'].default_value = 1.12
        l.new(variation.outputs['Random'], shade.inputs['Value'])
        tint = n.new('ShaderNodeMixRGB'); tint.blend_type = 'MULTIPLY'; tint.inputs[0].default_value = 1
        l.new(ramp.outputs[0], tint.inputs[1]); l.new(shade.outputs[0], tint.inputs[2])
        l.new(tint.outputs[0], p.inputs['Base Color'])
    if texture == 'brushed':
        if 'Anisotropic' in p.inputs:
            p.inputs['Anisotropic'].default_value = .65
        coord = n.new('ShaderNodeTexCoord')
        stretch = n.new('ShaderNodeVectorMath'); stretch.operation = 'MULTIPLY'
        stretch.inputs[1].default_value = (180,180,2)
        l.new(coord.outputs['Object'], stretch.inputs[0])
        grain = n.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value = 3
        l.new(stretch.outputs[0], grain.inputs['Vector'])
        bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .12; bump.inputs['Distance'].default_value = .0003
        l.new(grain.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs[0], p.inputs['Normal'])
    return m


concrete = material('Pale board-formed concrete', (.54,.52,.48), .72, texture='concrete')
bronze = material('Dark bronze anodised fins', (.12,.075,.035), .32, .82, texture='brushed')
glass = material('Low iron glass', (.96,.99,.98), .055, glass=True)
wet = material('Wet concrete and puddle mask', (.08,.08,.085), .35, texture='wet')
wood = material('Sports maple grain', (.58,.38,.19), .22, texture='wood')
white = material('Painted court white', (.86,.88,.85), .4)
seatmat = material('Graphite moulded seat plastic', (.023,.029,.035), .43)
steel = material('Structural steel', (.045,.055,.065), .36, .7)
surround = material('Blue grey rubber surround', (.055,.079,.105), .65)
screen = material('Neutral scoreboard screen', (.65,.70,.76), .5, emission=2)
led = material('LED optical lens', (.85,.91,1), .2, emission=9)
darkconcrete = material('Bowl dark concrete', (.065,.071,.08), .8, texture='concrete')
roofmat = material('Dark acoustic roof', (.028,.034,.042), .92)
warm = material('Warm linear diffuser', (1,.69,.38), .35, emission=5)
ribbon = material('Warm white fascia LED', (.56,.51,.43), .6, emission=.65)
exitglow = material('Green exit marker', (.04,.65,.21), .4, emission=3)
soil = material('Planter soil', (.025,.021,.017), .98)
# Exterior materials are independent of the accepted bowl, court and suite finishes.
facade = material('Warm grey board-formed facade', (.42,.40,.37), .84)
finbronze = material('Warm bronze exterior fins', (.30,.17,.08), .35, 1, texture='brushed')
foyerwood = material('Warm oak foyer cladding', (.32,.17,.075), .38, texture='wood')
stone = material('Honed warm limestone foyer', (.46,.40,.31), .28)
entranceglass = material('Low iron entrance glazing', (.98,.995,.99), .035, glass=True)
entranceglass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.45
jointmat = material('Dark recessed plaza joints', (.014,.013,.012), .8)
n, l = facade.node_tree.nodes, facade.node_tree.links
p = n.get('Principled BSDF')
coord = n.new('ShaderNodeTexCoord')
xyz = n.new('ShaderNodeSeparateXYZ'); l.new(coord.outputs['Object'], xyz.inputs[0])
height = n.new('ShaderNodeMath'); height.operation = 'DIVIDE'; height.inputs[1].default_value = .3
l.new(xyz.outputs['Z'], height.inputs[0])
boardid = n.new('ShaderNodeMath'); boardid.operation = 'FLOOR'; l.new(height.outputs[0], boardid.inputs[0])
variation = n.new('ShaderNodeTexWhiteNoise'); variation.noise_dimensions = '1D'
l.new(boardid.outputs[0], variation.inputs['W'])
tint = n.new('ShaderNodeValToRGB')
tint.color_ramp.elements[0].color = (.35,.33,.30,1)
tint.color_ramp.elements[1].color = (.46,.44,.41,1)
l.new(variation.outputs['Value'], tint.inputs[0])
fraction = n.new('ShaderNodeMath'); fraction.operation = 'FRACT'; l.new(height.outputs[0], fraction.inputs[0])
seam = n.new('ShaderNodeMath'); seam.operation = 'LESS_THAN'; seam.inputs[1].default_value = .025
l.new(fraction.outputs[0], seam.inputs[0])
pores = n.new('ShaderNodeTexNoise'); pores.inputs['Scale'].default_value = 110; pores.inputs['Detail'].default_value = 2
l.new(coord.outputs['Object'], pores.inputs['Vector'])
grain = n.new('ShaderNodeVectorMath'); grain.operation = 'MULTIPLY'; grain.inputs[1].default_value = (2,2,65)
l.new(coord.outputs['Object'], grain.inputs[0])
boardgrain = n.new('ShaderNodeTexNoise'); boardgrain.inputs['Scale'].default_value = 3
l.new(grain.outputs[0], boardgrain.inputs['Vector'])
fine = n.new('ShaderNodeBump'); fine.inputs['Strength'].default_value = .45; fine.inputs['Distance'].default_value = .002
l.new(pores.outputs['Fac'], fine.inputs['Height'])
grainbump = n.new('ShaderNodeBump'); grainbump.inputs['Strength'].default_value = .3; grainbump.inputs['Distance'].default_value = .003
l.new(boardgrain.outputs['Fac'], grainbump.inputs['Height']); l.new(fine.outputs[0], grainbump.inputs['Normal'])
boards = n.new('ShaderNodeBump'); boards.invert = True
boards.inputs['Strength'].default_value = .8; boards.inputs['Distance'].default_value = .009
l.new(seam.outputs[0], boards.inputs['Height']); l.new(grainbump.outputs[0], boards.inputs['Normal'])
# Small recessed form-tie marks every .6 m horizontally / .9 m vertically.
distances = []
for axis, spacing in [('X',.6),('Z',.9)]:
    scale = n.new('ShaderNodeMath'); scale.operation = 'DIVIDE'; scale.inputs[1].default_value = spacing
    l.new(xyz.outputs[axis], scale.inputs[0])
    repeat = n.new('ShaderNodeMath'); repeat.operation = 'FRACT'; l.new(scale.outputs[0], repeat.inputs[0])
    centre = n.new('ShaderNodeMath'); centre.operation = 'SUBTRACT'; centre.inputs[1].default_value = .5
    l.new(repeat.outputs[0], centre.inputs[0])
    metres = n.new('ShaderNodeMath'); metres.operation = 'MULTIPLY'; metres.inputs[1].default_value = spacing
    l.new(centre.outputs[0], metres.inputs[0])
    squared = n.new('ShaderNodeMath'); squared.operation = 'MULTIPLY'
    l.new(metres.outputs[0], squared.inputs[0]); l.new(metres.outputs[0], squared.inputs[1]); distances.append(squared)
radius = n.new('ShaderNodeMath'); radius.operation = 'ADD'
l.new(distances[0].outputs[0], radius.inputs[0]); l.new(distances[1].outputs[0], radius.inputs[1])
ties = n.new('ShaderNodeMath'); ties.operation = 'LESS_THAN'; ties.inputs[1].default_value = .014**2
l.new(radius.outputs[0], ties.inputs[0])
tiecolor = n.new('ShaderNodeMixRGB'); tiecolor.inputs[2].default_value = (.13,.12,.105,1)
l.new(ties.outputs[0], tiecolor.inputs[0]); l.new(tint.outputs[0], tiecolor.inputs[1]); l.new(tiecolor.outputs[0], p.inputs['Base Color'])
tiebump = n.new('ShaderNodeBump'); tiebump.invert = True
tiebump.inputs['Strength'].default_value = .65; tiebump.inputs['Distance'].default_value = .006
l.new(ties.outputs[0], tiebump.inputs['Height']); l.new(boards.outputs[0], tiebump.inputs['Normal']); l.new(tiebump.outputs[0], p.inputs['Normal'])
# Sub-millimetre pixel gaps stay faint even when the final screen fills the frustum.
n, l = screen.node_tree.nodes, screen.node_tree.links
coord = n.new('ShaderNodeTexCoord')
separate = n.new('ShaderNodeSeparateXYZ'); l.new(coord.outputs['Object'], separate.inputs[0])
pixels = []
for axis in ['X','Y','Z']:
    frequency = n.new('ShaderNodeMath'); frequency.operation = 'MULTIPLY'; frequency.inputs[1].default_value = 850
    l.new(separate.outputs[axis], frequency.inputs[0])
    fraction = n.new('ShaderNodeMath'); fraction.operation = 'PINGPONG'; fraction.inputs[1].default_value = 1
    l.new(frequency.outputs[0], fraction.inputs[0])
    gap = n.new('ShaderNodeMath'); gap.operation = 'LESS_THAN'; gap.inputs[1].default_value = .07
    l.new(fraction.outputs[0], gap.inputs[0]); pixels.append(gap)
# On every face Z is vertical; X + Y provides the horizontal pixel coordinate.
horizontal = n.new('ShaderNodeMath'); horizontal.operation = 'MULTIPLY'
l.new(pixels[0].outputs[0], horizontal.inputs[0]); l.new(pixels[1].outputs[0], horizontal.inputs[1])
grid = n.new('ShaderNodeMath'); grid.operation = 'MAXIMUM'
l.new(horizontal.outputs[0], grid.inputs[0]); l.new(pixels[2].outputs[0], grid.inputs[1])
shade = n.new('ShaderNodeMixRGB'); shade.inputs[1].default_value = (.72,.77,.84,1); shade.inputs[2].default_value = (.68,.73,.80,1)
l.new(grid.outputs[0], shade.inputs[0])
l.new(shade.outputs[0], n.get('Principled BSDF').inputs['Emission Color'])


_MESHES = {}


def _mesh(key, build):
    # Share mesh data between identical parts; bpy.ops per part is O(n^2) with ~5k parts.
    if key not in _MESHES:
        bm = bmesh.new(); build(bm)
        me = bpy.data.meshes.new(key[0]); bm.to_mesh(me); bm.free()
        _MESHES[key] = me
    return _MESHES[key]


def _link(name, me, loc):
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); o.location = loc
    return o


def box(name, loc, dims, mat, bevel=0):
    dims = tuple(round(d, 4) for d in dims)
    def build(bm):
        bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=dims, verts=bm.verts)
    me = _mesh((name, dims, mat.name), build)
    if not me.materials: me.materials.append(mat)
    o = _link(name, me, loc)
    if bevel:
        mod = o.modifiers.new('Real edge highlights', 'BEVEL'); mod.width = bevel; mod.segments = 2
    return o


def beam(name, a, b, radius, mat=steel):
    a, b = Vector(a), Vector(b)
    depth = round((b-a).length, 4)
    def build(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=radius, radius2=radius, depth=depth)
    me = _mesh((name, depth, radius, mat.name), build)
    if not me.materials: me.materials.append(mat)
    o = _link(name, me, (a+b)/2)
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return o


def prototype(name, objects):
    col = bpy.data.collections.new(name)
    for o in objects:
        for old in list(o.users_collection):
            old.objects.unlink(o)
        col.objects.link(o)
    return col


def instance(name, col, loc, angle=0):
    o = bpy.data.objects.new(name, None); o.instance_type = 'COLLECTION'; o.instance_collection = col
    scene.collection.objects.link(o); o.location = loc; o.rotation_euler.z = angle
    return o


def light(name, loc, target, energy, color=(1,1,1), size=3, kind='AREA'):
    data = bpy.data.lights.new(name, kind); data.energy = energy; data.color = color
    if kind == 'AREA': data.shape = 'RECTANGLE'; data.size = size; data.size_y = max(.12, size*.25)
    if kind == 'SPOT': data.spot_size = .95; data.spot_blend = .65; data.shadow_soft_size = .15
    o = bpy.data.objects.new(name, data); scene.collection.objects.link(o); o.location = loc
    o.visible_camera = False  # Actual diffuser meshes provide visible fixtures, never floating area-light shapes.
    o.rotation_euler = (Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o


# World normals point inward: negate Z so visible sky grades upward into blue.
world = bpy.data.worlds.new('Blue hour with thin western afterglow'); world.use_nodes = True; scene.world = world
n, l = world.node_tree.nodes, world.node_tree.links
tex = n.new('ShaderNodeTexCoord'); separate = n.new('ShaderNodeSeparateXYZ')
l.new(tex.outputs['Normal'], separate.inputs[0])
height = n.new('ShaderNodeMath'); height.operation = 'MULTIPLY'; height.inputs[1].default_value = -1
l.new(separate.outputs['Z'], height.inputs[0])
ramp = n.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0; ramp.color_ramp.elements[0].color = (.23,.34,.53,1)
ramp.color_ramp.elements[1].position = .75; ramp.color_ramp.elements[1].color = (.014,.05,.254,1)
el = ramp.color_ramp.elements.new(.18); el.color = (.065,.17,.40,1)
l.new(height.outputs[0], ramp.inputs[0])
horizon = n.new('ShaderNodeMapRange'); horizon.clamp = True
horizon.inputs['From Min'].default_value = 0; horizon.inputs['From Max'].default_value = .035
horizon.inputs['To Min'].default_value = 1; horizon.inputs['To Max'].default_value = 0
l.new(height.outputs[0], horizon.inputs['Value'])
west = n.new('ShaderNodeMapRange'); west.clamp = True
west.inputs['From Min'].default_value = .15; west.inputs['From Max'].default_value = .8
l.new(separate.outputs['X'], west.inputs['Value'])
band = n.new('ShaderNodeMath'); band.operation = 'MULTIPLY'
l.new(horizon.outputs[0], band.inputs[0]); l.new(west.outputs[0], band.inputs[1])
afterglow = n.new('ShaderNodeMixRGB'); afterglow.inputs[2].default_value = (.65,.28,.10,1)
l.new(band.outputs[0], afterglow.inputs[0]); l.new(ramp.outputs[0], afterglow.inputs[1])
stretch = n.new('ShaderNodeVectorMath'); stretch.operation = 'MULTIPLY'; stretch.inputs[1].default_value = (3,3,32)
l.new(tex.outputs['Normal'], stretch.inputs[0])
cloud = n.new('ShaderNodeTexNoise'); cloud.inputs['Scale'].default_value = 3; cloud.inputs['Detail'].default_value = 3
l.new(stretch.outputs[0], cloud.inputs['Vector'])
cloudshade = n.new('ShaderNodeValToRGB')
cloudshade.color_ramp.elements[0].color = (.65,.70,.8,1); cloudshade.color_ramp.elements[1].color = (1,1,1,1)
l.new(cloud.outputs['Fac'], cloudshade.inputs[0])
cloudmix = n.new('ShaderNodeMixRGB'); cloudmix.blend_type = 'MULTIPLY'; cloudmix.inputs[0].default_value = .4
l.new(afterglow.outputs[0], cloudmix.inputs[1]); l.new(cloudshade.outputs[0], cloudmix.inputs[2])
l.new(cloudmix.outputs[0], n.get('Background').inputs['Color']); n.get('Background').inputs['Strength'].default_value = .65
facadefill = light('Blue hour facade fill', (-18,-48,28), (0,-25,10), 28000, (.65,.76,1), 40)
skyfill = light('Dusk sky softbox', (0,-20,48), (0,0,0), 14000, (.48,.64,1), 65)
# Camera / glossy rays retain a blue sky; diffuse fill stays low during the art pass.
background = n.get('Background')
sky = n.new('ShaderNodeBackground'); sky.inputs['Strength'].default_value = .65
l.new(cloudmix.outputs[0], sky.inputs['Color'])
ray = n.new('ShaderNodeLightPath')
visible = n.new('ShaderNodeMath'); visible.operation = 'MAXIMUM'
l.new(ray.outputs['Is Camera Ray'], visible.inputs[0]); l.new(ray.outputs['Is Glossy Ray'], visible.inputs[1])
worldmix = n.new('ShaderNodeMixShader')
l.new(visible.outputs[0], worldmix.inputs[0]); l.new(background.outputs[0], worldmix.inputs[1]); l.new(sky.outputs[0], worldmix.inputs[2])
l.new(worldmix.outputs[0], n.get('World Output').inputs['Surface'])
for frame in [1,45,46]:
    exterior = frame <= 45
    background.inputs['Strength'].default_value = .22 if exterior else .65
    background.inputs['Strength'].keyframe_insert('default_value', frame=frame)
    scene.view_settings.exposure = .45 if exterior else .35
    scene.view_settings.keyframe_insert('exposure', frame=frame)
    for lamp, early, accepted in [(facadefill,2600,28000),(skyfill,3200,14000)]:
        lamp.data.energy = early if exterior else accepted
        lamp.data.keyframe_insert('energy', frame=frame)

box('Wet plaza slab', (0,-30,-.18), (180,160,.3), wet)
# Distant landscape so the plaza edge is not a sea horizon: dark meadow, low hills, dusk tree line.
meadow = material('Dusk meadow', (.025,.032,.024), .9)
hillmat = material('Distant hills in haze', (.05,.07,.11), .95)
treemat = material('Dusk tree silhouettes', (.02,.028,.025), .9)
box('Meadow beyond plaza', (0,-30,-.32), (900,900,.2), meadow)
def _hill(bm): bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1)
def _tree(bm): bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=.5)
hill_mesh = _mesh(('Hill',), _hill); hill_mesh.materials.append(hillmat)
tree_mesh = _mesh(('Tree',), _tree); tree_mesh.materials.append(treemat)
rng = random.Random(33)
for i in range(18):
    a = math.radians(-170 + i*20 + rng.uniform(-6,6)); r = rng.uniform(260,340)
    o = _link('Distant hill', hill_mesh, (r*math.cos(a), -30+r*math.sin(a), -6))
    o.scale = (rng.uniform(60,110), rng.uniform(60,110), rng.uniform(10,22))
for i in range(420):
    a = rng.uniform(-math.pi, math.pi); r = rng.uniform(110,170)
    h = rng.uniform(7,12)
    # Rounded canopies in a dense band; cone trees read as toys.
    o = _link('Distant tree', tree_mesh, (r*math.cos(a), -30+r*math.sin(a), h*.55))
    o.scale = (h*.9, h*.9, h*.8)
# Thin recessed paving joints make real reflection breaks.
for x in range(-81,82,3): box('Plaza joint', (x,-45,-.028), (.022,90,.004), jointmat)
for y in range(-90,1,3): box('Plaza joint', (0,y,-.028), (162,.022,.004), jointmat)
# Elliptical envelope 84 x 60 m, 25 m high; front opening omitted, not hidden by a plate.
fin = prototype('FIN shared geometry', [box('Bronze fin', (0,0,0), (.16,1.35,12.5), finbronze, .025)])
for i in range(240):
    t = 2*math.pi*i/240
    x,y = 42*math.cos(t),30*math.sin(t)
    entrance = y < -28 and abs(x) < 8
    if not entrance:
        o = box('Curved concrete base module', (x,y,6), (1.25,.65,12), facade, .025)
        o.rotation_euler.z = math.atan2(30*math.cos(t),-42*math.sin(t))
    normal = math.atan2(math.sin(t)/30,math.cos(t)/42)
    if i % 6 == 0 and not entrance:
        light('Bronze base grazing uplight', (x*1.035,y*1.035,12.15), (x,y,18.5), 850, (1,.60,.27), .45, 'SPOT')
    strip = box('Continuous fin base warm strip', (x*1.018,y*1.018,17.25 if entrance else 12.08), (1.35,.09,.055), warm)
    strip.rotation_euler.z = normal-math.pi/2
    if i % 12 == 0 and y < 0 and not entrance:
        light('Concrete grazing uplight', (x*1.026,y*1.026,.2), (x,y,7), 1100, (1,.68,.39), .4, 'SPOT')
    if entrance:
        short = instance('Entrance upper bronze fin', fin, (x,y,21.1), normal-math.pi/2)
        short.scale.z = .6
    if not entrance:
        instance('Vertical bronze fin', fin, (x,y,18.25), normal-math.pi/2)
        o = box('Dark facade backing', (x*.995,y*.995,18.2), (1.3,.18,12.6), seatmat)
        o.rotation_euler.z = normal-math.pi/2
# Closed elliptical roof slab matching the facade perimeter.
roof_vertices = [(42*math.cos(i*math.tau/240),30*math.sin(i*math.tau/240),z)
                 for z in [24.55,25] for i in range(240)]
roof_faces = [tuple(reversed(range(240))), tuple(range(240,480))]
roof_faces += [(i,(i+1)%240,(i+1)%240+240,i+240) for i in range(240)]
mesh = bpy.data.meshes.new('Elliptical roof mesh'); mesh.from_pydata(roof_vertices,[],roof_faces); mesh.update()
roof = bpy.data.objects.new('Continuous elliptical roof',mesh); scene.collection.objects.link(roof); mesh.materials.append(roofmat)
# Tall glass frontage and actual sliding door leaves at Y=-29.5.
for x in [-7,-5,-3,-1,1,3,5,7]:
    box('Upper entrance glass', (x,-29.5,10), (1.94,.028,13), entranceglass)
    box('Entrance mullion', (x-1,-29.5,8.3), (.045,.10,16.6), steel)
    box('Door header', (x,-29.5,3.25), (2,.15,.1), bronze)
    door = box('Sliding glass door', (x,-29.52,1.6), (1.9,.035,3.15), entranceglass)
    handle = box('Door pull', (x+.75,-29.65,1.5), (.035,.07,.7), bronze, .012)
    handle.parent = door; handle.matrix_parent_inverse = door.matrix_world.inverted()
    door.keyframe_insert('location', frame=1)
    door.location.x += -1.95 if x < 0 else 1.95
    door.keyframe_insert('location', frame=24)
box('Entrance crown', (0,-29.5,17), (16,.5,.35), bronze)
box('Foyer maple ceiling', (0,-25,16), (16,9,.25), foyerwood)
for x in range(-39,40): box('Foyer ceiling wood slat', (x*.2,-25,15.8), (.085,9,.16), foyerwood)
for x in [-7.65,7.65]:
    box('Foyer linear ceiling cove', (x,-25,15.65), (.09,8.5,.07), warm)
    for y in [-28,-25,-22]:
        light('Warm ceiling cove wash', (x,y,15.5), (x*.8,y,7), 1200, (1,.70,.42), 2)
        light('Warm wood ceiling bounce', (x*.8,y,14.7), (0,y,15.8), 500, (1,.70,.42), 2)
for z in [6,11]:
    for x in [-7.7,7.7]:
        box('Foyer wall linear cove', (x,-25,z), (.075,8.5,.07), warm)
for z in [3.3,8.5]: box('Glazing horizontal transom', (0,-29.55,z), (16,.09,.055), steel)
box('Foyer floor', (0,-26,.02), (16,7,.12), stone)
# Foyer side walls, then short 6 m wide vomitory. Continuous unobstructed route.
for x in [-8,8]: box('Foyer sidewall', (x,-26,8), (.4,7,16), foyerwood)
for x in [-3.6,3.6]: box('Tunnel sidewall', (x,-20,2.5), (.4,6,5), foyerwood)
box('Tunnel ceiling', (0,-20,5.2), (7.6,6,.35), foyerwood)
# Warm cladding hides the lower bank ends without changing any accepted bowl meshes.
for x in [-5.9,5.9]:
    box('Foyer oak portal wing', (x,-28.25,4), (4.2,.12,8), foyerwood)
    box('Foyer mezzanine edge', (x,-28.35,8.15), (4.2,.28,.35), finbronze)
    box('Mezzanine underside warm cove', (x,-28.39,7.93), (4.1,.08,.05), warm)
    light('Mezzanine warm underglow', (x,-28.5,7.8), (x,-28.5,2), 400, (1,.67,.38), 4)
    for sx in range(21):
        box('Portal oak vertical slat', (x-2+sx*.2,-28.34,4), (.075,.06,7.8), foyerwood)
for y in [-28,-25,-21,-18]:
    for x in [-2.5,2.5]: box('Recessed small downlight', (x,y,4.98 if y > -24 else 15.68), (.12,.12,.025), warm)
    light('3000K foyer wash', (0,y,4.6 if y > -24 else 14.8), (0,y,0), 600 if y > -24 else 3200, (1,.70,.44), 4)
# Low benches and planted beds retain a clear entrance route; no polygonal tree crowns.
for tx,ty in [(-23,-34),(-13,-35),(14,-35),(29,-34)]:
    box('Concrete planter bench', (tx,ty,.35), (5,2,.7), facade, .05)
    box('Recessed planter soil', (tx,ty,.71), (4.4,1.4,.06), soil)
    box('Bench warm underglow', (tx,ty-1.005,.12), (4.7,.035,.045), warm)
    light('Bench reflected linear wash', (tx,ty-1.1,.2), (tx,ty-3,0), 85, (1,.68,.36), 4)
    for j in range(32):
        x=tx+random.uniform(-2,2); y=ty+random.uniform(-.55,.55)
        beam('Fine ornamental grass', (x,y,.73), (x+.1,y,random.uniform(.9,1.25)), .008, surround)

# Bowl and FIVB 9 x 18 m court; no basketball geometry anywhere.
box('Blue grey arena floor',(0,0,.01),(55,39,.16),surround)
for row in range(45):
    for col in range(9):
        o=box('Maple board',(-4.4+col, -8.8+row*.4,.105),(.995,.395,.05),wood,.003)
for x in [-4.5,4.5]: box('Sideline',(x,0,.137),(.05,18,.012),white)
for y in [-9,-3,0,3,9]: box('Baseline attack or centre line',(0,y,.137),(9,.05,.012),white)
for x in [-5.1,5.1]:
    beam('Volleyball padded post',(x,0,.1),(x,0,2.65),.13,surround)
    beam('Antenna',(x*.9,0,2.4),(x*.9,0,3.2),.013,white)
# Actual taut mesh threads and top/bottom tape.
for z in [1.43,2.43]: box('Net tape',(0,0,z),(10,.03,.045),white)
for i in range(101): beam('Net vertical cord',(-5+i*.1,0,1.45),(-5+i*.1,0,2.42),.003,seatmat)
for i in range(11): beam('Net horizontal cord',(-5,0,1.44+i*.098),(5,0,1.44+i*.098),.003,seatmat)
seat = prototype('SEAT shared moulded shell', [box('Seat pan',(0,0,.4),(.48,.45,.09),seatmat,.045),box('Seat back',(0,.2,.73),(.48,.09,.55),seatmat,.055),beam('Seat support',(0,0,0),(0,0,.4),.045)])
# Four raised banks. Stair gaps every 11 seats, front-end centre vomitory stays open.
for bank in range(4):
    side = bank < 2
    sign = -1 if bank % 2 == 0 else 1
    for row in range(16):
        distance=(13 if side else 17)+row*.78
        z=.35+row*.49
        for col in range(-24,25):
            along=col*.56
            if not side and abs(along)<3.8 and sign == -1: continue
            # Side-bank access portals leave genuine holes through the lower risers.
            if side and 15 <= abs(col) <= 17 and row < 6: continue
            stair=col % 11 == 0
            loc=(sign*distance,along,z) if side else (along,sign*distance,z)
            if (loc[0]/39)**2+(loc[1]/28)**2 > .98: continue
            dims=(.78,.56,z+.1) if side else (.56,.78,z+.1)
            box('Bowl concrete riser', (loc[0],loc[1],(z-.1)/2),dims,darkconcrete)
            if stair:
                offset = -.195*sign
                step_loc=(loc[0]+offset,loc[1],z+.1225) if side else (loc[0],loc[1]+offset,z+.1225)
                step_dims=(.39,.56,.245) if side else (.56,.39,.245)
                box('Half-rise aisle stair',step_loc,step_dims,darkconcrete)
                nosing=(step_loc[0],step_loc[1],step_loc[2]+.126)
                box('Stair safety nosing',nosing,(.035,.52,.008) if side else (.52,.035,.008),white)
            if not stair:
                angle=-sign*math.pi/2 if side else (math.pi if sign == -1 else 0)
                instance('Instanced arena seat',seat,loc,angle)
            elif row % 2 == 0:
                a=(loc[0],loc[1],z+.8)
                beam('Aisle rail upright',loc,a,.025)
                b=(loc[0]+sign*1.56,loc[1],z+1.78) if side else (loc[0],loc[1]+sign*1.56,z+1.78)
                beam('Aisle handrail',a,b,.027)
    if side:
        beam('Front safety rail',(sign*12.6,-14,1.3),(sign*12.6,14,1.3),.03)
    else:
        for lo,hi in [(-14,-3.2),(3.2,14)]: beam('Front safety rail',(lo,sign*16.6,1.3),(hi,sign*16.6,1.3),.03)
# Far end-bank card tifo. Stop 84 looks from (0,-14,2.8) to (0,0,5.3): +Y bank.
# Its rake is dz/dy=.49/.78, matching the existing non-side, sign=+1 risers.
# At 1600x900, 24mm / 36mm gives fx=1066.7px. At depth ~38m a .30m
# card is ~8.4px wide; .34m pitch is ~9.5px. Rake foreshortens row pitch
# to ~3.8px; the circular source mask follows the stand's perspective.
tifo_rng = random.Random(33034)
tifo_palette = [( .023,.029,.035), (.025,.008,.075), (.16,.004,.62), (1,.72,.005), (.94,.94,.94)]
tifo_mats = [material('Tifo ' + name, rgb, .6) for name, rgb in
             zip(['neutral graphite','navy outline','purple','yellow','white'], tifo_palette)]
tifo_image = bpy.data.images.load(str(Path(__file__).with_name('gameon-vb-mark.png')), check_existing=True)
tifo_pixels = list(tifo_image.pixels)  # One Blender RNA read; nearest samples below use this list.
tifo_iw, tifo_ih = tifo_image.size
tifo_font = {
    'G': ['01110','10001','10000','10111','10001','10001','01110'],
    'A': ['01110','10001','10001','11111','10001','10001','10001'],
    'M': ['10001','11011','10101','10101','10001','10001','10001'],
    'E': ['11111','10000','10000','11110','10000','10000','11111'],
    'O': ['01110','10001','10001','10001','10001','10001','01110'],
    'N': ['10001','11001','11001','10101','10011','10011','10001'],
    'V': ['10001','10001','10001','10001','10001','01010','00100'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    '.': ['00000','00000','00000','00000','00000','00110','00110'],
    'C': ['01111','10000','10000','10000','10000','10000','01111'],
    'Z': ['11111','00001','00010','00100','01000','10000','11111'],
}
tifo_text = ['0'.join(tifo_font[c][r] for c in 'GAMEONVB.CZ') for r in range(7)]
assert len(tifo_text[0]) == 65 and all(len(row) == 65 for row in tifo_text)


def tifo_card_mesh(bm):
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(.30,.018,.30), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0,0,.15), verts=bm.verts)  # Bottom-edge hand pivot.
    bm.normal_update()
    for face in bm.faces:
        face.material_index = 0 if face.normal.y < -.5 else 1


tifo_mesh = _mesh(('Tifo shared card',), tifo_card_mesh)
tifo_mesh.materials.append(tifo_mats[0]); tifo_mesh.materials.append(tifo_mats[0])


def tifo_body_mesh(bm):
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=8, radius=1)
    for v in bm.verts:
        v.co.x *= .14; v.co.y *= .105
        v.co.z = v.co.z*.14 + (.32 if v.co.z > 0 else -.32)


tifo_body = _mesh(('Tifo shared crowd capsule',), tifo_body_mesh)
tifo_head = _mesh(('Tifo shared crowd head',), lambda bm: bmesh.ops.create_icosphere(bm, subdivisions=1, radius=.105))
tifo_body.materials.append(seatmat); tifo_head.materials.append(seatmat)
tifo_cards = []
for row in range(35):
    y = 17.25 + row*.30
    floor_z = .35 + (y-17)/.78*.49
    card_z = floor_z + 2.05
    for col in range(65):
        # Wide text band below a narrow logo block keeps the top inside the end bank.
        if row >= 9 and not 20 <= col <= 44:
            continue
        x = (col-32)*.34
        ink = 0
        if row < 9:
            ink = 2 if row % 2 else 1
            if 1 <= row <= 7 and tifo_text[7-row][col] == '1':
                ink = 4
        elif 10 <= row <= 33:
            u, v = (col-20+.5)/25, (row-10+.5)/24
            px = min(tifo_iw-1, int(u*tifo_iw)); py = min(tifo_ih-1, int(v*tifo_ih))
            offset = (py*tifo_iw+px)*4
            red, green, blue, alpha = tifo_pixels[offset:offset+4]
            # White inside the circle is part of the ball, white outside stays graphite.
            outside = (u-.5)**2 + (v-.5)**2 > .48**2
            if alpha >= .5 and not (outside and min(red,green,blue) > .85):
                ink = min(range(1,5), key=lambda i: sum((a-b)**2 for a,b in zip((red,green,blue),tifo_palette[i])))
        # Owner 2026-10-15: card lettering unreadable; one large canvas instead (below).
        if False:
            dx, dy, dz = (tifo_rng.uniform(-.02,.02) for _ in range(3))
            card = _link('Tifo card %02d %02d' % (row,col), tifo_mesh, (x+dx,y+dy,card_z-.15+dz))
            card.material_slots[0].link = 'OBJECT'; card.material_slots[0].material = tifo_mats[ink]
            tilt = tuple(math.radians(tifo_rng.uniform(-4,4)) for _ in range(3))
            card.rotation_euler = tilt
            rise = 50 + 26*col/64
            for frame, angle in [(rise,math.radians(80)),(rise+6,0)]:
                card.rotation_euler.x = tilt[0] + angle
                card.keyframe_insert('rotation_euler', index=0, frame=frame)
            tifo_cards.append(card)
        # One mostly hidden silhouette per 2x2 cards; no crowd outside the tifo patch.
        if False:  # Owner 2026-10-15: crowd silhouettes removed.
            head_z = card_z-.35
            cloth = tifo_rng.choice([seatmat,roofmat,steel])
            body = _link('Tifo fan capsule', tifo_body, (x,y+.14,head_z-.87))
            body.scale.z = tifo_rng.uniform(1.60,1.72)
            body.material_slots[0].link = 'OBJECT'; body.material_slots[0].material = cloth
            _link('Tifo fan head', tifo_head, (x,y+.14,head_z))

for card in tifo_cards:
    action = card.animation_data.action
    if hasattr(action, 'fcurves'):
        curves = action.fcurves
    else:
        from bpy_extras.anim_utils import action_get_channelbag_for_slot
        bag = action_get_channelbag_for_slot(action, card.animation_data.action_slot)
        curves = bag.fcurves if bag else []
    for curve in curves:
        curve.extrapolation = 'CONSTANT'  # Hold the raised pose through frame 168.
        for key in curve.keyframe_points:
            key.interpolation = 'BEZIER'
            key.handle_left_type = key.handle_right_type = 'AUTO_CLAMPED'

# Subtle broad frontal fill for matte cards; no fixture or change to the arena key.
light('Far stand tifo soft fill', (0,10,13), (0,23,6), 500, (.93,.96,1), 12)

# Giant canvas with the GameOnVB mark and gameonvb.cz (scripts/make-banner.swift);
# it unrolls downward 50-80 behind a roll travelling down its face.
banner_tex = bpy.data.images.load(str(Path(__file__).with_name('gameon-banner.png')), check_existing=True)
banner_img_mat = bpy.data.materials.new('GameOnVB canvas'); banner_img_mat.use_nodes = True
bn, bl = banner_img_mat.node_tree.nodes, banner_img_mat.node_tree.links
bp = bn.get('Principled BSDF'); bp.inputs['Roughness'].default_value = .9
if 'Specular IOR Level' in bp.inputs: bp.inputs['Specular IOR Level'].default_value = .08  # matte print, no grey sheen
tex = bn.new('ShaderNodeTexImage'); tex.image = banner_tex; tex.interpolation = 'Closest'; tex.extension = 'CLIP'
# AgX and the bright arena wash brand colours out; push saturation back.
hsv = bn.new('ShaderNodeHueSaturation'); hsv.inputs['Saturation'].default_value = 1.8; hsv.inputs['Value'].default_value = .7
bl.new(tex.outputs['Color'], hsv.inputs['Color']); bl.new(hsv.outputs['Color'], bp.inputs['Base Color'])
fold = bn.new('ShaderNodeTexWave'); fold.inputs['Scale'].default_value = 1.2; fold.bands_direction = 'X'
fbump = bn.new('ShaderNodeBump'); fbump.inputs['Strength'].default_value = .15
bl.new(fold.outputs['Fac'], fbump.inputs['Height']); bl.new(fbump.outputs[0], bp.inputs['Normal'])
# Unroll mask: show UV v above (1 - reveal); reveal is keyframed with the roll.
uvn = bn.new('ShaderNodeTexCoord'); sep = bn.new('ShaderNodeSeparateXYZ'); bl.new(uvn.outputs['UV'], sep.inputs[0])
reveal = bn.new('ShaderNodeValue'); reveal.name = 'Reveal'
edge = bn.new('ShaderNodeMath'); edge.operation = 'SUBTRACT'; edge.inputs[0].default_value = 1; bl.new(reveal.outputs[0], edge.inputs[1])
shown = bn.new('ShaderNodeMath'); shown.operation = 'GREATER_THAN'
bl.new(sep.outputs['Y'], shown.inputs[0]); bl.new(edge.outputs[0], shown.inputs[1])
clear = bn.new('ShaderNodeBsdfTransparent'); mixs = bn.new('ShaderNodeMixShader')
bl.new(shown.outputs[0], mixs.inputs[0]); bl.new(clear.outputs[0], mixs.inputs[1]); bl.new(bp.outputs[0], mixs.inputs[2])
bl.new(mixs.outputs[0], bn.get('Material Output').inputs['Surface'])
banner_w, banner_h, banner_top, banner_y = 14, 11, 15.6, 17.8  # in front of the upper-tier rail
# Owner 2026-10-15: a real "banner drop" (Kabuki/championship banner reveal): the canvas starts
# rolled under its batten, is released at frame 25, unrolls under gravity, swings with the
# momentum and keeps fluttering in a light draught. Cloth sim, baked before rendering.
# Technique: rolled-poster cloth unroll + pin release via Vertex Weight Edit (nabesaka.com).
BANNER_NX, BANNER_NY, RELEASE = 56, 44, 25  # ~2 s real unroll ends ~80, just before stop 84
def _rolled_banner(bm):
    uv = bm.loops.layers.uv.new()
    # Spiral from the core (bottom edge, d=h) out to the top edge (d=0) attached to the batten.
    core, gap = .16, .022
    pts, theta, r = [], 0., core
    ds = banner_h / BANNER_NY
    for j in range(BANNER_NY+1):  # j=0 is the core (bottom edge)
        pts.append((r*math.sin(theta), -r*math.cos(theta)))
        dtheta = ds / r; theta += dtheta; r = core + gap*theta/(2*math.pi)
    # Rotate so the outer end (top edge) points straight up, then put it on the batten.
    ox, oz = pts[-1]; turn = math.atan2(ox, oz)
    rot = [(x*math.cos(turn)-z*math.sin(turn), x*math.sin(turn)+z*math.cos(turn)) for x, z in pts]
    tx, tz = rot[-1]
    rows = [(y-tx, z-tz) for y, z in rot]  # (depth, height) per row, top edge at (0,0)
    grid = []
    for j in range(BANNER_NY+1):
        d = banner_h * (1 - j/BANNER_NY)  # distance from the top edge
        dy, dz = rows[j]
        grid.append([bm.verts.new((banner_w*(i/BANNER_NX-.5), dy, dz)) for i in range(BANNER_NX+1)])
    for j in range(BANNER_NY):
        for i in range(BANNER_NX):
            f = bm.faces.new((grid[j][i], grid[j][i+1], grid[j+1][i+1], grid[j+1][i]))
            for loop, (ii, jj) in zip(f.loops, [(i,j),(i+1,j),(i+1,j+1),(i,j+1)]):
                loop[uv].uv = (1-ii/BANNER_NX, jj/BANNER_NY)  # v=1 top edge; u mirrored for the camera side
banner_mesh = bpy.data.meshes.new('GameOnVB canvas'); _b = bmesh.new(); _rolled_banner(_b); _b.to_mesh(banner_mesh); _b.free()
banner_mesh.materials.append(banner_img_mat)
banner = _link('GameOnVB canvas', banner_mesh, (0, banner_y, banner_top))
banner.rotation_euler = (0, 0, math.radians(180))  # printed face toward the court/camera
reveal.outputs[0].default_value = 1
pin = banner.vertex_groups.new(name='Pin')
top_row = BANNER_NY*(BANNER_NX+1)
for v in banner_mesh.vertices:  # top edge 1.0 stays pinned; everything else .99 is released
    pin.add([v.index], 1.0 if v.index >= top_row else .99, 'REPLACE')
release = banner.modifiers.new('Release roll', 'VERTEX_WEIGHT_EDIT')
release.vertex_group = 'Pin'; release.use_remove = True; release.remove_threshold = 0
release.keyframe_insert('remove_threshold', frame=RELEASE-1)
release.remove_threshold = .995; release.keyframe_insert('remove_threshold', frame=RELEASE)
cloth = banner.modifiers.new('Banner cloth', 'CLOTH')
cs = cloth.settings
cs.quality = 10; cs.mass = 1.2; cs.air_damping = .35  # heavy printed PVC mesh banner
cs.tension_stiffness = cs.compression_stiffness = 25; cs.shear_stiffness = 8; cs.bending_stiffness = .6
cs.vertex_group_mass = 'Pin'; cs.pin_stiffness = 1
cc = cloth.collision_settings; cc.use_self_collision = False  # roll-layer friction stalled the unroll; invisible at 40 m; cc.self_distance_min = .006; cc.distance_min = .01
cc.self_friction = 0; cc.friction = 0  # layers of the roll slide off each other freely
cloth.point_cache.frame_start = 1; cloth.point_cache.frame_end = 168
banner.modifiers.new('Cloth thickness', 'SOLIDIFY').thickness = .01
# Light indoor draught after the drop keeps it alive without flapping like an outdoor flag.
bpy.ops.object.effector_add(type='WIND', location=(0, banner_y+6, banner_top-5))
draught = bpy.context.object; draught.name = 'Arena draught'
draught.rotation_euler = (math.radians(90), 0, 0)  # blows toward -Y (court side)
draught.field.flow = .4; draught.field.noise = 1.5; draught.field.seed = 7
for frame, strength in [(78, 0), (100, 30)]:
    draught.field.strength = strength; draught.field.keyframe_insert('strength', frame=frame)
bpy.ops.object.effector_add(type='TURBULENCE', location=(0, banner_y, banner_top-5))
gust = bpy.context.object; gust.name = 'Arena turbulence'
gust.field.size = 3.5; gust.field.flow = .3
for frame, strength in [(78, 0), (100, 18)]:
    gust.field.strength = strength; gust.field.keyframe_insert('strength', frame=frame)
# The flag needs a visible support: a slim batten on the top edge, hung from the roof trusses.
beam('Flag batten', (-banner_w/2-.2, banner_y, banner_top+.05), (banner_w/2+.2, banner_y, banner_top+.05), .06)
for x in [-banner_w/2+.6, banner_w/2-.6]: beam('Flag suspension cable', (x, banner_y, banner_top+.05), (x, banner_y, 21.5), .012)

# Side vomitories: black portals, concrete lintels and green wayfinding lenses.
for x in [-17,17]:
    for y in [-9,9]:
        box('Vomitory dark recess', (x,y,1.7), (.12,1.7,3.4), roofmat)
        box('Vomitory lintel', (x,y,3.55), (5,1.9,.3), darkconcrete)
        box('Exit green glow box', (x+(.15 if x<0 else -.15),y,3.25), (.055,.45,.16), exitglow)
# Segmented elliptical fascia and glazed suite ring, set behind the lower banks.
for i in range(96):
    t=(i+.5)*math.tau/96
    angle=math.atan2(24*math.cos(t),-34*math.sin(t))
    x,y=34*math.cos(t),24*math.sin(t)
    width=math.hypot(34*math.sin(t),24*math.cos(t))*math.tau/96+.015
    for name,z,height,mat in [('Dark tier fascia',9.1,.9,darkconcrete),('Continuous warm LED ribbon',9.18,.18,ribbon)]:
        o=box(name,(x,y,z),(width,.16,height),mat); o.rotation_euler.z=angle
    x,y=37.5*math.cos(t),26.5*math.sin(t)
    width=math.hypot(37.5*math.sin(t),26.5*math.cos(t))*math.tau/96+.015
    o=box('Suite warm rear wall',(x*1.022,y*1.022,10.5),(width,.12,2.2),wood); o.rotation_euler.z=angle
    o=box('Suite glass front',(x,y,10.5),(width,.025,2.15),glass); o.rotation_euler.z=angle
    o=box('Suite slim dark mullion',(x,y,10.5),(.055,.08,2.3),steel); o.rotation_euler.z=angle
    o=box('Suite ceiling linear light',(x,y,11.62),(width,.08,.045),warm); o.rotation_euler.z=angle
    if i % 8 == 0:
        light('Suite warm interior', (x*1.015,y*1.015,11.3), (x,y,9.5), 180, (1,.75,.49), 2)
        box('Suite exit marker', (x*.994,y*.994,11.2), (.32,.10,.12), exitglow)
# Upper terrace: shared seat collection and shared riser meshes, with radial aisle gaps.
for row in range(6):
    rx,ry=32+row*.85,22.5+row*.65
    z=12.1+row*.54
    for i in range(128):
        t=i*math.tau/128
        x,y=rx*math.cos(t),ry*math.sin(t)
        angle=math.atan2(ry*math.cos(t),-rx*math.sin(t))
        width=math.hypot(rx*math.sin(t),ry*math.cos(t))*math.tau/128
        o=box('Upper terrace tread',(x,y,z-.12),(width,.82,.24),darkconcrete); o.rotation_euler.z=angle
        if i % 16 in [0,1]:
            o=box('Upper stair nosing',(x,y,z+.015),(width,.035,.01),white); o.rotation_euler.z=angle
            if i % 16 == 0:
                beam('Upper aisle rail',(x,y,z),(x,y,z+.9),.025)
        else:
            instance('Upper instanced seat',seat,(x,y,z),t-math.pi/2)
# Closed upper inner walls and roof acoustic panels; all remain inside same envelope.
for i in range(160):
    t=i*math.tau/160; x,y=40*math.cos(t),28.5*math.sin(t)
    if y < -27 and abs(x)<8: continue
    o=box('Inner curved perimeter wall',(x,y,12),(1.65,.35,24),darkconcrete)
    o.rotation_euler.z=math.atan2(28.5*math.cos(t),-40*math.sin(t))
for x in range(-36,37,3):
    half_length=28*math.sqrt(1-(x/42)**2)
    box('Roof acoustic panel',(x,0,24.3),(2.9,half_length*2,.15),roofmat)
# One reusable 3 m triangular truss bay, instanced across roof.
parts=[]
for y,z in [(-.5,0),(.5,0),(0,1)]: parts.append(beam('Truss chord',(0,y,z),(3,y,z),.075))
for x in [0,1.5,3]:
    parts.extend([beam('Truss diagonal',(x,-.5,0),(min(x+1.5,3),0,1),.035),beam('Truss diagonal',(x,.5,0),(min(x+1.5,3),0,1),.035)])
truss=prototype('TRUSS 3m bay',parts)
for y in range(-20,21,4):
    for x in range(-27,27,3): instance('Roof truss bay',truss,(x,y,21.5))
lamp=prototype('FLOODLIGHT fixture',[box('Floodlight housing',(0,0,0),(.32,.24,.16),steel,.04),box('LED lens',(0,0,-.12),(.24,.17,.025),led,.015)])
for x in [-24,-18,-12,12,18,24]:
    for y in range(-18,19,4):
        instance('Truss mounted LED floodlight',lamp,(x,y,21.3))
# One broad key keeps sampling cheap; small shared lenses supply the visible roof points.
light('Soft overhead court key', (0,0,20.8), (0,0,0), 52000, (.93,.96,1), 19)
for x in [-10,10]:
    for y in [-14,14]: light('Court corner spotlight', (x,y,20), (x*.4,y*.45,0), 2400, (.95,.97,1), .3, 'SPOT')
# Centre-hung cube with four neutral screens and real frame, suspended below truss.
box('Scoreboard cube body',(0,0,13),(8.6,6,5.1),steel,.07)
for y in [-3.02,3.02]: box('Neutral screen front/back',(0,y,13),(8,.025,4.5),screen)
for x in [-4.32,4.32]: box('Neutral screen sides',(x,0,13),(.025,5.4,4.5),screen)
for y in [-2.9,2.9]: box('Scoreboard underside LED ring', (0,y,10.42), (8.3,.055,.04), ribbon)
for x in [-4.15,4.15]: box('Scoreboard underside LED ring', (x,0,10.42), (.055,5.8,.04), ribbon)
for x in [-3.5,3.5]:
    for y in [-2,2]: beam('Scoreboard suspension',(x,y,15.55),(x,y,21.5),.035)


def smooth(t):
    return t*t*t*(t*(t*6-15)+10)


def spline(knots, u):
    """Cubic Hermite position/target with time-scaled tangents, no knot velocity jumps."""
    i=next((j for j in range(len(knots)-1) if u <= knots[j+1][0]),len(knots)-2)
    t0,p0=knots[i]; t1,p1=knots[i+1]; span=t1-t0; t=(u-t0)/span
    def tangent(j):
        a=max(0,j-1); b=min(len(knots)-1,j+1)
        return (Vector(knots[b][1])-Vector(knots[a][1]))/(knots[b][0]-knots[a][0])
    return (2*t**3-3*t*t+1)*Vector(p0)+(t**3-2*t*t+t)*span*tangent(i)+(-2*t**3+3*t*t)*Vector(p1)+(t**3-t*t)*span*tangent(i+1)


for variant in ['desktop','mobile']:
    mobile=variant=='mobile'
    data=bpy.data.cameras.new(variant); cam=bpy.data.objects.new(variant,data); scene.collection.objects.link(cam)
    data.lens=24 if not mobile else 28
    data.sensor_fit='HORIZONTAL'; data.sensor_width=36
    data.clip_start=.04; data.clip_end=500
    cam.rotation_mode='QUATERNION'
    origin=(0,-46,6) if mobile else (-27,-68,4.2)
    stop=(0,-14,3.6) if mobile else (0,-14,2.8)
    target0=(0,-29,13) if mobile else (-20,-20,12)
    target1=(0,0,7) if mobile else (0,0,5.3)
    positions=[(0,origin),(.38,(0,-36,3.2)),(.56,(0,-28,2.8)),(.74,(0,-22,2.8)),(1,stop)]
    targets=[(0,target0),(.38,(0,-25,3.4)),(.56,(0,-19,3.4)),(.74,(0,-8,4.1)),(1,target1)]
    for frame in range(1,169):
        if frame<=84:
            u=smooth((frame-1)/83)
            pos=spline(positions,u); target=spline(targets,u)
        else:
            u=smooth((frame-84)/84)
            # Entire final frustum inside 8 x 4.5 m screen for BOTH aspects.
            pos=spline([(0,stop),(.55,(0,-9,9.2)),(1,(0,-3.65,13))],u)
            target=Vector(target1).lerp(Vector((0,-3.02,13)),u)
        cam.location=pos; cam.rotation_quaternion=(target-pos).to_track_quat('-Z','Y')
        cam.keyframe_insert('location',frame=frame); cam.keyframe_insert('rotation_quaternion',frame=frame)
        # Only the final approach uses a restrained photographic focus falloff.
        data.dof.use_dof = frame >= 162
        data.dof.aperture_fstop = 16
        data.dof.focus_distance = max(.1, (Vector((0,-3.02,13))-pos).length)
        data.dof.keyframe_insert('use_dof',frame=frame)
        data.dof.keyframe_insert('focus_distance',frame=frame)
    if variant==args.camera: scene.camera=cam
# Per-frame samples use linear subframe interpolation; exact sampled path is eased above.
for obj in list(bpy.data.objects):
    if not obj.animation_data or not obj.animation_data.action: continue
    action=obj.animation_data.action
    if hasattr(action,'fcurves'):
        curves=action.fcurves
    else:
        from bpy_extras.anim_utils import action_get_channelbag_for_slot
        bag=action_get_channelbag_for_slot(action,obj.animation_data.action_slot)
        curves=bag.fcurves if bag else []
    for curve in curves:
        for key in curve.keyframe_points:
            key.interpolation='LINEAR' if obj.type=='CAMERA' else 'BEZIER'
# The accepted arena cameras above remain untouched, including subframe interpolation.
# A separate camera cut at 169 avoids interpolating their frame-168 motion blur to x=600.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import goal_loop as goal


def build_goal_loop():
    previous = set(scene.objects)
    labwhite = material('Lab neutral powder coat', (.7,.7,.7), .4)
    epoxy = material('Lab satin grey epoxy', (.55,.55,.55), .4)
    brushed = material('Lab brushed stainless', (.20,.23,.26), .42, .5, texture='brushed')
    beltmat = material('Lab graphite belt', (.045,.045,.045), .5)
    beltshader = beltmat.node_tree.nodes.get('Principled BSDF')
    beltshader.inputs['Coat Weight'].default_value = 0
    beltshader.inputs['Specular IOR Level'].default_value = .2
    toolgrey = material('Lab dark grey tool flange', (.025,.032,.04), .38, .45)
    seam = material('Lab precision joints', (.11,.13,.15), .6)
    outline = material('Plan cyan light outline', (.005,.65,1), .25, emission=8)
    amber = material('Build orange to clear glass', (1,.18,.005), .26)
    shader = amber.node_tree.nodes.get('Principled BSDF')
    shader.inputs['IOR'].default_value = 1.5
    shader.inputs['Transmission Weight'].default_value = 0
    shader.inputs['Coat Weight'].default_value = .3
    shader.inputs['Coat Roughness'].default_value = .08
    volume = amber.node_tree.nodes.new('ShaderNodeVolumeAbsorption')
    volume.inputs['Color'].default_value = (.25,.72,.65,1)
    volume.inputs['Density'].default_value = 0
    amber.node_tree.links.new(volume.outputs[0],amber.node_tree.nodes.get('Material Output').inputs['Volume'])
    edgeglass = material('Glass blue green bevel', (.3,.72,.65), .08, glass=True)
    edgeglass.node_tree.nodes.get('Principled BSDF').inputs['IOR'].default_value = 1.5
    farroom = material('Goal dark far side room', (.15,.15,.15), .6)
    goalwall = material('Goal contrasting grey wall', (.32,.35,.37), .5)
    crackmat = material('Check red finding to dark gap', (.008,.008,.008), .65)
    joinermat = material('Repair amber brass identity', (.48,.22,.025), .3, .45)
    chassis = material('Lab satin steel chassis', (.22,.26,.30), .5, .35)

    def point(p):
        return (p[0]+goal.ORIGIN_X, p[1], p[2])

    def cube(name, loc, dims, mat=labwhite, bevel=0):
        return box('Lab '+name, point(loc), dims, mat, bevel)

    def rod(name, a, b, radius, mat=brushed):
        a,b = Vector(a),Vector(b)
        depth = round((b-a).length,4)
        def build(bm):
            bmesh.ops.create_cone(bm,cap_ends=True,segments=48,radius1=radius,radius2=radius,depth=depth)
        me = _mesh(('Lab satin cylinder',depth,radius,mat.name),build)
        if not me.materials: me.materials.append(mat)
        for face in me.polygons: face.use_smooth = abs(face.normal.z)<.5
        obj = _link('Lab '+name,me,point((a+b)/2))
        obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
        bevel = obj.modifiers.new('Small machined edge bevel','BEVEL')
        bevel.width = min(.012,radius*.12); bevel.segments = 3
        bevel.harden_normals = True
        return obj

    def parent_box(parent, name, loc, dims, mat, bevel=0):
        obj = box('Lab '+name, loc, dims, mat, bevel)
        obj.parent = parent
        return obj

    # An enclosed room keeps the existing blue-hour world out of the white lab.
    cube('epoxy floor', (0,-2,-.15), (28,30,.3), epoxy, .05)
    cube('rear wall', (0,12,12), (28,.3,24))
    cube('front wall', (0,-17,12), (28,.3,24))
    for x in (-14,14):
        cube('side wall', (x,-2,12), (.3,30,24))
    cube('ceiling', (0,-2,24), (28,30,.2))
    # About one stop less incident light than the 3 x 14 kW ceiling wash.
    # A low fill preserves soft directional shadows and strip reflections in glass.
    key = light('Lab KEY 45 degree softbox', point((-4,-5,8)), point((0,0,1)), 5800, (1,.97,.94), 4)
    key.data.size_y = 4
    light('Lab low fill', point((6,0,10)), point((0,0,1)), 450, (.9,.96,1), 7)
    strip = light('Lab narrow glass edge strip', point((-3.97,-.4,1.48)), point((-2.75,5.1,1.45)), 850, (.85,.96,1), 3)
    strip.data.shape = 'RECTANGLE'; strip.data.size_y = .06
    # Camera-only emission: AgX-inverted accepted 168 mean, independent of key/fill.
    wipe = bpy.data.materials.new('Lab calibrated white entry panel'); wipe.use_nodes = True
    nodes = wipe.node_tree.nodes; nodes.clear()
    emission = nodes.new('ShaderNodeEmission')
    radiance = goal.WIPE_RADIANCE[args.camera]; strength = max(radiance)
    emission.inputs['Color'].default_value = (*(c/strength for c in radiance),1)
    emission.inputs['Strength'].default_value = strength
    output = nodes.new('ShaderNodeOutputMaterial')
    wipe.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
    panel = cube('entry panel', (0,-7,1.75), (4,.12,3.5), wipe)
    panel.visible_diffuse = panel.visible_glossy = panel.visible_transmission = panel.visible_shadow = False
    for frame,z in ((169,1.75),(175,-.2),(181,-3.5)):
        panel.location.z = z; panel.keyframe_insert('location',frame=frame)
    panel.hide_render = True; panel.keyframe_insert('hide_render',frame=182)
    for x in (-7,7):
        cube('floor expansion seam', (x,-2,.003), (.008,29,.006), seam)

    def track_ring(bm, half_width, z, depth):
        rings = []
        for i in range(160):
            x,y,angle = goal.track(goal.LENGTH*i/160)
            nx,ny = -math.sin(angle), math.cos(angle)
            rings.append([bm.verts.new((x+side*half_width*nx,y+side*half_width*ny,height))
                          for height,side in ((z-depth,-1),(z-depth,1),(z,1),(z,-1))])
        for i, row in enumerate(rings):
            other = rings[(i+1)%len(rings)]
            for j in range(4):
                bm.faces.new((row[j],other[j],other[(j+1)%4],row[(j+1)%4]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    for name,width,z,depth,mat in [('closed steel chassis',.57,.52,.18,chassis),
                                  ('closed oval belt',.47,.62,.10,beltmat)]:
        me = _mesh(('Lab '+name,), lambda bm, w=width, z=z, d=depth: track_ring(bm,w,z,d))
        me.materials.append(mat)
        for face in me.polygons: face.use_smooth = abs(face.normal.z)<.5
        _link('Lab '+name, me, point((0,0,0)))
    for i in range(72):
        x,y,angle = goal.track(goal.LENGTH*i/72)
        tread = cube('belt transverse tread', (x,y,.624), (.012,.89,.008), beltmat)
        tread.rotation_euler.z = angle
        if i%6 == 0:
            for side in (-1,1):
                dx,dy = -math.sin(angle)*side*.49,math.cos(angle)*side*.49
                cube('adjustable leg', (x+dx,y+dy,.21), (.08,.08,.42), brushed)
                cube('rubber foot', (x+dx,y+dy,.035), (.20,.17,.07), beltmat, .02)

    # Review's short exit is a raised transfer belt, flush with the carrier top.
    cube('exit chassis', (-2.5,3.3,.53), (1.45,2.6,.22), chassis, .035)
    cube('exit belt', (-2.5,3.3,.66), (1.20,2.6,.08), beltmat)
    # Far-side landing supports the pane's small lateral alignment beyond the wall.
    cube('receiving chassis', (-2.75,5.1,.53), (2.15,1,.22), chassis, .035)
    cube('receiving belt', (-2.75,5.1,.66), (2,1,.08), beltmat)
    for y in (3.5,5):
        for x in (-3.1,-1.9):
            cube('exit leg', (x,y,.24), (.09,.09,.48), brushed)
    # Four wall blocks form a genuine opening; nothing covers the back of the hole.
    bottom,top = goal.PIECE_Z-goal.HOLE_HEIGHT/2,goal.PIECE_Z+goal.HOLE_HEIGHT/2
    left,right = -2.5-goal.HOLE_WIDTH/2,-2.5+goal.HOLE_WIDTH/2
    cube('goal wall below opening', (-2.5,goal.WALL_Y,bottom/2), (6,.22,bottom), goalwall)
    cube('goal wall above opening', (-2.5,goal.WALL_Y,(top+3.5)/2), (6,.22,3.5-top), goalwall)
    cube('goal wall left jamb', ((-5.5+left)/2,goal.WALL_Y,goal.PIECE_Z), (left+5.5,.22,goal.HOLE_HEIGHT), goalwall)
    cube('goal wall right jamb', ((right+.5)/2,goal.WALL_Y,goal.PIECE_Z), (.5-right,.22,goal.HOLE_HEIGHT), goalwall)
    # Dark receiving niche supplies contrast through the hole and in the glass.
    cube('far side dark backdrop', (-2.5,6.4,1.8), (6,.15,3.6), farroom)
    cube('far side dark floor', (-2.5,5.3,.005), (6,2.3,.01), farroom)
    for x in (-5.5,.5):
        cube('far side dark return', (x,5.3,1.8), (.12,2.3,3.6), farroom)
    # Thin steel reveals make the fixed aperture legible without narrowing it.
    for x in (left-.015,right+.015):
        cube('goal vertical reveal', (x,goal.WALL_Y,goal.PIECE_Z), (.03,.24,goal.HOLE_HEIGHT), brushed)
    for z in (bottom-.015,top+.015):
        cube('goal horizontal reveal', (-2.5,goal.WALL_Y,z), (goal.HOLE_WIDTH+.06,.24,.03), brushed)

    piece = _link('Lab single delivery piece', None, point((-2.5,-2.1,goal.PIECE_Z)))
    carrier = cube('piece carrier', (-2.5,-2.1,.66), (goal.CARRIER_WIDTH,.48,.08), brushed, .015)
    # The physical split follows the visible fracture instead of a separate vertical seam.
    fracture = [(-.6,-.30),(-.36,-.07),(-.20,-.17),(.02,.10),(.19,-.02),(.37,.26),(.6,.32)]
    solids = []
    for name,polygon in (('lower',[(-.6,-.4),(.6,-.4)]+list(reversed(fracture))),
                         ('upper',fracture+[(.6,.4),(-.6,.4)])):
        def split_mesh(bm, polygon=polygon):
            rows = [[bm.verts.new((x,y,z)) for x,z in polygon] for y in (-.03,.03)]
            bm.faces.new(list(reversed(rows[0]))); bm.faces.new(rows[1])
            for j in range(len(polygon)):
                k = (j+1)%len(polygon)
                bm.faces.new((rows[0][j],rows[0][k],rows[1][k],rows[1][j]))
            bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        me = _mesh(('Lab fracture half',name),split_mesh); me.materials.append(amber)
        half = _link('Lab '+name+' fractured slab',me,(0,0,0)); half.parent = piece
        bevel = half.modifiers.new('Fracture machined bevel','BEVEL'); bevel.width = .004; bevel.segments = 2
        solids.append(half)

    cube('two slot repair tray',(2.5,-2.85,1.08),(.8,.36,.08),toolgrey,.02)
    for x in (2.13,2.87):
        rod('repair rack leg',(x,-2.85,.02),(x,-2.85,1.04),.025,toolgrey)
    for x,y,z in goal.TRAY_SLOTS:
        cube('repair tray slot',(x,y,1.15),(.14,.17,.04),seam,.008)
    repair_joiners = []
    for i,slot in enumerate(goal.TRAY_SLOTS):
        joiner = _link('Lab repair joiner '+str(i+1),None,point(slot))
        # One U-shaped piece shows a small amber mark on either face after the loop.
        for offset in (0,.11):
            parent_box(joiner,'joiner face',(0,offset,0),goal.JOINER_SIZE,joinermat,.008)
        parent_box(joiner,'joiner bridge',(0,.055,.10),(.10,.145,.035),joinermat,.006)
        repair_joiners.append(joiner)
    # A single manifold pane removes the split seam during the glass transfer.
    pane = parent_box(piece,'continuous six centimetre glass slab',(0,0,0),(1.2,.06,.8),amber,.012)
    pane.data.materials.append(edgeglass)
    pane.modifiers[0].segments = 3; pane.modifiers[0].material = 1
    outlines = []
    for x in (-.6,.6):
        outlines.append(parent_box(piece,'Plan vertical outline', (x,0,0), (.03,.035,.8), outline))
    for z in (-.4,.4):
        outlines.append(parent_box(piece,'Plan horizontal outline', (0,0,z), (1.2,.035,.03), outline))
    crack = _link('Lab pre-split joint crack', None, (0,0,0)); crack.parent = piece
    jagged = [(-.59,-.047,-.30),(-.36,-.047,-.07),(-.20,-.047,-.17),
              (.02,-.047,.10),(.19,-.047,-.02),(.37,-.047,.26),(.59,-.047,.32)]
    for side in (-1,1):
        for a,b in zip(jagged,jagged[1:]):
            a,b = (a[0],side*.033,a[2]),(b[0],side*.033,b[2])
            obj = rod('dark physical crack seam', a, b, .009, crackmat)
            obj.location.x -= goal.ORIGIN_X; obj.parent = crack

    def sphere(name, loc, radius, mat):
        me = _mesh(('Lab smooth signal head',mat.name), lambda bm: bmesh.ops.create_uvsphere(bm,u_segments=48,v_segments=24,radius=1))
        for face in me.polygons: face.use_smooth = True
        if not me.materials: me.materials.append(mat)
        obj = _link('Lab '+name,me,point(loc)); obj.scale = (radius,)*3
        return obj

    arms = []
    accents = ((.005,.38,.8),(.12,.32,.45),(.005,.5,.15),(.42,.025,.8))
    for i,(role,base) in enumerate(zip(('Plan','Build','Check','Review'),goal.ARM_BASES)):
        x,y,_ = goal.track(goal.STATIONS[i])
        rod(role+' bolted base',(base[0],base[1],.09),(base[0],base[1],1.33),.25,labwhite)
        rod(role+' circular mounting flange',(base[0],base[1],0),(base[0],base[1],.12),.28,brushed)
        status = material('Lab '+role+' status',(.18,.21,.23),.35,emission=.2)
        if i in (2,3):
            sx,sy = goal.STATUS_POSTS[i]
            rod(role+' status post',(sx,sy,.1),(sx,sy,1.3),.035)
            sphere(role+' 40 cm status head',(sx,sy,goal.STATUS_HEAD_Z),goal.STATUS_RADIUS,status)
        else:
            cube(role+' status lens',(base[0]+.26,base[1]-.25,.15),(.12,.12,.06),status,.02)
        target = goal.tool_pose(169,i)
        a,b,c = goal.arm_points(base,target)
        links = [rod(role+' upper link',a,b,.105*goal.ARM_SCALE,labwhite),rod(role+' forearm',b,c,.09*goal.ARM_SCALE,labwhite)]
        joints = []
        for name,centre,radius,depth in zip(('shoulder','elbow','wrist'),(a,b,c),(.25,.23,.17),(.30,.28,.24)):
            housing = rod(role+' '+name+' satin housing',(0,0,-depth/2),(0,0,depth/2),radius,labwhite)
            housing.location = point(centre)
            ring = rod(role+' '+name+' dark joint ring',(0,0,depth/2-.024),(0,0,depth/2-.006),radius+.002,toolgrey)
            ring.location.x -= goal.ORIGIN_X; ring.parent = housing
            joints.append(housing)
        tool = _link('Lab '+role+' tool',None,point(target))
        flange = rod(role+' dark tool flange',(0,0,.02),(0,0,.24*goal.ARM_SCALE),.13,toolgrey)
        flange.location.x -= goal.ORIGIN_X; flange.parent = tool
        for side in (-1,1):
            parent_box(tool,role+' gripper finger',(side*.11,0,.24 if i==2 else .03),(.045,.09,.18),toolgrey,.008)
        if i==0:
            parent_box(tool,'Plan marking tip',(0,0,-.02),(.07,.07,.1),toolgrey,.01)
        elif i==1:
            parent_box(tool,'Build forming tool',(0,0,-.02),(.42,.18,.1),toolgrey,.02)
        elif i==2:
            parent_box(tool,'Check test weight',(0,0,.11),(.94,.3,.22),toolgrey,.025)
        else:
            # Inner dimensions match the goal; parked clear of the belt on pass 1.
            parent_box(tool,'Review tool yoke',(0,0,-.17),(.06,.08,.34),brushed,.005)
            for side in (-1,1):
                parent_box(tool,'Review gauge side',(side*(goal.HOLE_WIDTH/2+.02),0,-.8),(.04,.12,goal.HOLE_HEIGHT+.08),brushed,.005)
                # Lower corner tabs measure height while the central relief clears the carrier.
                parent_box(tool,'Review lower gauge tab',(side*(goal.HOLE_WIDTH/2-goal.GAUGE_TAB/2),0,-.8-goal.HOLE_HEIGHT/2-.02),(goal.GAUGE_TAB,.12,.04),brushed,.005)
            parent_box(tool,'Review upper gauge rail',(0,0,-.8+goal.HOLE_HEIGHT/2+.02),(goal.HOLE_WIDTH,.12,.04),brushed,.005)
        arms.append((i,base,(x,y),links,joints,tool,status))

    verdict = material('Lab Verdict status',(.18,.21,.23),.4,emission=.2)
    cube('Verdict lens',(-1.4,goal.WALL_Y-.13,1.7),(.12,.035,.12),verdict,.015)
    for frame in range(169,469):
        x,y,angle = goal.piece_pose(frame); state = goal.piece_state(frame)
        piece.location = point((x,y,goal.PIECE_Z)); piece.rotation_euler.z = angle
        piece.keyframe_insert('location',frame=frame); piece.keyframe_insert('rotation_euler',frame=frame)
        cx,cy,ca = goal.piece_pose(min(frame,448))
        # Retract under the transfer: coincident .70 m tops rendered black patches.
        carrier.location = point((cx,cy,.66-.1*goal.ramp(frame,448,452))); carrier.rotation_euler.z = ca
        carrier.keyframe_insert('location',frame=frame); carrier.keyframe_insert('rotation_euler',frame=frame)
        for side,obj in zip((-1,1),solids):
            obj.scale = (1,max(.001,state['fill']),max(.001,state['fill'])) if frame<446 else (.00001,)*3
            obj.location.z = side*.012*state['gap']
            obj.keyframe_insert('scale',frame=frame); obj.keyframe_insert('location',frame=frame)
        pane.scale = (1,)*3 if frame>=446 else (.00001,)*3
        pane.keyframe_insert('scale',frame=frame)
        for obj in outlines:
            obj.scale = (max(.001,1-goal.ramp(frame,259,273)),)*3
            obj.keyframe_insert('scale',frame=frame)
        p = outline.node_tree.nodes.get('Principled BSDF')
        p.inputs['Emission Strength'].default_value = 8+2*goal.ramp(frame,229,240)
        p.inputs['Emission Strength'].keyframe_insert('default_value',frame=frame)
        crack.scale = (1,1,1) if state['cracked'] else (.00001,)*3
        crack.keyframe_insert('scale',frame=frame)
        p = crackmat.node_tree.nodes.get('Principled BSDF')
        for name,value in {'Base Color':(*goal.mix((.008,.008,.008),(1,.001,.001),state['crack_glow']),1),
                           'Emission Color':(1,.001,.001,1),'Emission Strength':12*state['crack_glow']}.items():
            p.inputs[name].default_value = value; p.inputs[name].keyframe_insert('default_value',frame=frame)
        consumed = repair_joiners[0]
        consumed.location = point(goal.joiner_pose(frame)); consumed.rotation_euler.z = angle-math.tau if frame>=388 else 0
        consumed.keyframe_insert('location',frame=frame); consumed.keyframe_insert('rotation_euler',frame=frame)
        clear = state['glass']
        tint = goal.mix((1,.18,.005),(1,.002,.001),state['failure_flash'])
        values = {'Base Color':(*goal.mix(tint,(.87,.98,.95),clear),1),
                  'Roughness':.26-.205*clear,'Transmission Weight':clear,
                  'Emission Color':(*tint,1),'Emission Strength':(.12+state['repair']*.8+state['failure_flash']*.5)*(1-clear)}
        for name,value in values.items():
            if name in shader.inputs:
                shader.inputs[name].default_value = value; shader.inputs[name].keyframe_insert('default_value',frame=frame)
        volume.inputs['Density'].default_value = .6*clear
        volume.inputs['Density'].keyframe_insert('default_value',frame=frame)
        for i,base,station,links,joints,tool,status in arms:
            target = goal.tool_pose(frame,i)
            a,b,c = (Vector(p) for p in goal.arm_points(base,target))
            for obj,p,q in zip(links,(a,b),(b,c)):
                obj.location = point((p+q)/2)
                obj.rotation_euler = (q-p).to_track_quat('Z','Y').to_euler()
                obj.keyframe_insert('location',frame=frame); obj.keyframe_insert('rotation_euler',frame=frame)
            axis = Vector((-(target[1]-base[1]),target[0]-base[0],0)).normalized()
            for obj,p,joint_axis in zip(joints,(a,b,c),(axis,axis,Vector((0,0,1)))):
                obj.location = point(p)
                obj.rotation_euler = joint_axis.to_track_quat('Z','Y').to_euler()
                obj.keyframe_insert('location',frame=frame); obj.keyframe_insert('rotation_euler',frame=frame)
            tool.location = point(target); tool.keyframe_insert('location',frame=frame)
            color = (.18,.21,.23)
            if (i==0 and frame>=237) or (i==1 and frame>=269): color = accents[i]
            if i==2 and state['check']!='idle': color = (.8,.025,.01) if state['check']=='red' else (.025,.6,.16)
            if i==3 and state['review']: color = (.025,.6,.16)
            p = status.node_tree.nodes.get('Principled BSDF')
            p.inputs['Emission Color'].default_value = (*color,1)
            p.inputs['Emission Strength'].default_value = 8 if color!=(.18,.21,.23) else .2
            for name in ('Emission Color','Emission Strength'): p.inputs[name].keyframe_insert('default_value',frame=frame)
        p = verdict.node_tree.nodes.get('Principled BSDF')
        p.inputs['Emission Color'].default_value = (*((.025,.6,.16) if frame>=448 else (.18,.21,.23)),1)
        p.inputs['Emission Color'].keyframe_insert('default_value',frame=frame)

    data = bpy.data.cameras.new('Goal Loop '+args.camera)
    cam = bpy.data.objects.new(data.name,data); scene.collection.objects.link(cam)
    cam.rotation_mode = 'QUATERNION'
    data.sensor_fit = 'HORIZONTAL'; data.sensor_width = 36
    data.clip_start = .04; data.clip_end = 100
    for frame in range(169,469):
        pos,target,lens = goal.camera_pose(frame,args.camera=='mobile')
        cam.location = pos; cam.rotation_quaternion = (Vector(target)-Vector(pos)).to_track_quat('-Z','Y')
        data.lens = lens
        cam.keyframe_insert('location',frame=frame); cam.keyframe_insert('rotation_quaternion',frame=frame)
        data.keyframe_insert('lens',frame=frame)
    marker = scene.timeline_markers.new('Accepted arena',frame=1); marker.camera = scene.camera
    marker = scene.timeline_markers.new('Goal Loop white cut',frame=169); marker.camera = cam
    lab = bpy.data.collections.new('Goal Loop isolated set x600'); scene.collection.children.link(lab)
    for obj in set(scene.objects)-previous:
        for collection in list(obj.users_collection): collection.objects.unlink(obj)
        lab.objects.link(obj)
        # Also suppress indirect illumination of the accepted 1-168 arena frames.
        for frame,hidden in ((1,True),(168,True),(169,False)):
            obj.hide_render = hidden; obj.keyframe_insert('hide_render',frame=frame)
    # Blender 4 and 5 action layouts; constant visibility, linear sampled motion.
    ids = list(lab.objects)+[data]+[m.node_tree for m in (amber,outline)+tuple(a[-1] for a in arms)+(verdict,)]
    for item in ids:
        if not item.animation_data or not item.animation_data.action: continue
        action = item.animation_data.action
        if hasattr(action,'fcurves'):
            curves = action.fcurves
        else:
            from bpy_extras.anim_utils import action_get_channelbag_for_slot
            bag = action_get_channelbag_for_slot(action,item.animation_data.action_slot)
            curves = bag.fcurves if bag else []
        for curve in curves:
            for key in curve.keyframe_points:
                key.interpolation = 'CONSTANT' if curve.data_path=='hide_render' else 'LINEAR'


build_goal_loop()
scene.frame_set(1)
# Bake the banner cloth once so stills and frame ranges see the same simulation.
with bpy.context.temp_override(scene=scene, point_cache=cloth.point_cache):
    bpy.ops.ptcache.bake(bake=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.out/'arena.blend'))
(args.out/'scene-manifest.json').write_text(json.dumps({'backend':backend,'camera':args.camera,'size':[w,h],'samples':scene.cycles.samples,'units':'metres','envelope':[84,60,25],'focal_frames':[1,84,228,468],'frames':[start,end],'scene_range':[1,468],'segments':{'segA':[1,84],'segB':[85,228],'segC':[229,468]},'goal_loop':{'origin':[600,0,0],'stations':['Plan','Build','Check','Review'],'verdict':'fixed wall aperture','first_failure':304,'repair':[378,388],'repair_budget':2,'repair_remaining':1,'check_pass':420,'review_pass':446,'glass':[446,448],'glass_hold':[448,456],'exit':[456,464],'cloth_cache':[1,168],'cut_brightness':'parent preview comparison of 168/169 required'},'images':'modelled sets; accepted local banner texture; no plates'},indent=2))
frames=[f for f in [1,30,60,84,120,168,169,174,200,228,300,304,316,360,378,382,386,388,420,442,446,448,456,458,468] if start<=f<=end] if args.stills else range(start,end+1)
for frame in frames:
    scene.frame_set(frame)
    scene.render.filepath=str(args.out/f'frame-{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
