"""Parent-only native Blender authoring. NEVER import/run this in a worker.

Explicit --preview --stills: at most eight 640x360 (or 360x640) PNGs.
Explicit --final: only new frames 469–660 at 1600x900 (or 900x1600), 32 spp.
Opens a camera-specific accepted .blend, disables embedded
scripts, appends to existing actions, and saves a DIFFERENT .blend.
See screen_switch.py for the pure motion/geometry contract.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import screen_switch as motion
import goal_loop as goal


def curves(item):
    ad = item.animation_data
    if not ad or not ad.action:
        return []
    action = ad.action
    if hasattr(action, 'fcurves'):
        return list(action.fcurves)
    result = []
    for layer in action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(ad.action_slot)
            if bag:
                result.extend(bag.fcurves)
    return result


def key(item, path, frame, constant=False):
    item.keyframe_insert(data_path=path, frame=frame)
    # Never alter any key at or before the accepted endpoint. Existing linear
    # sampled actions retain their original interpolation through frame 468.
    for curve in curves(item):
        if curve.data_path == path:
            for point in curve.keyframe_points:
                if abs(point.co.x-frame) < .001:
                    point.interpolation = 'CONSTANT' if constant else 'LINEAR'


def accepted_keys(item):
    return [(c.data_path, c.array_index,
             [(tuple(k.co), k.interpolation) for k in c.keyframe_points if k.co.x <= 468])
            for c in curves(item) if any(k.co.x <= 468 for k in c.keyframe_points)]


def close(actual, expected, label, tolerance=2e-4):
    if len(actual) != len(expected) or any(abs(a-b) > tolerance for a,b in zip(actual,expected)):
        raise RuntimeError(f'Source/continuity mismatch: {label}: {tuple(actual)} != {tuple(expected)}')


def snapshot(objects):
    return {o.name: (tuple(v for row in o.matrix_world for v in row), o.hide_render)
            for o in objects}


def main():
    args = motion.parse_render_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    frames = args.frames
    source = args.source.resolve(strict=True)
    icon = args.icon.resolve(strict=True)
    out = args.out.resolve()
    destination = out/'screen-switch.blend'
    if (out == source.parent or destination == source or destination.exists()
            or (out.exists() and any(out.iterdir()))):
        raise SystemExit('Use a fresh render directory, separate from the accepted source')
    if icon.suffix.lower() != '.png':
        raise SystemExit('--icon must be the exported rectangle.2.swap PNG')

    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    scene.frame_set(468)
    piece = bpy.data.objects['Lab single delivery piece']
    pane = bpy.data.objects['Lab continuous six centimetre glass slab']
    joiner = bpy.data.objects['Lab repair joiner 1']
    carrier = bpy.data.objects['Lab piece carrier']
    camera = bpy.data.objects['Goal Loop '+args.camera]
    backdrop = bpy.data.objects['Lab far side dark backdrop']
    if scene.camera != camera or pane.parent != piece or joiner.parent is not None:
        raise RuntimeError('Unexpected accepted camera/pane/joiner ownership')
    close(piece.location, motion.pane_pose(468)[0], 'piece')
    close((piece.rotation_euler.z,), (motion.ANGLE,), 'piece angle')
    close(pane.location, (0,0,0), 'pane local centre')
    close(pane.scale, (1,1,1), 'pane scale')
    close(pane.dimensions, (1.2,.06,.8), 'original glass dimensions')
    close(joiner.location, motion.corner_pose(468), 'consumed amber joiner')
    close((joiner.rotation_euler.z,), (math.pi,), 'joiner angle')
    close(backdrop.location, (597.5,6.4,1.8), 'receiving niche back wall')
    close(backdrop.dimensions, (6,.15,3.6), 'receiving niche bounds')
    pos, target, lens = goal.camera_pose(468, args.camera == 'mobile')
    close(camera.location, pos, 'camera location')
    expected_rotation = (Vector(target)-Vector(pos)).to_track_quat('-Z','Y')
    if abs(camera.rotation_quaternion.dot(expected_rotation)) < .99999:
        raise RuntimeError('Unexpected accepted camera orientation')
    close((camera.data.lens,), (lens,), 'camera lens')
    if camera.data.sensor_fit != 'HORIZONTAL' or camera.data.sensor_width != 36:
        raise RuntimeError('Unexpected accepted sensor fit')
    if [m.name for m in pane.data.materials] != ['Build orange to clear glass', 'Glass blue green bevel']:
        raise RuntimeError('Unexpected accepted pane materials')
    glass = pane.data.materials[0].node_tree.nodes.get('Principled BSDF')
    for name, expected in (('Roughness',.055), ('Transmission Weight',1), ('IOR',1.5)):
        close((glass.inputs[name].default_value,), (expected,), 'glass '+name)
    close(glass.inputs['Base Color'].default_value, (.87,.98,.95,1), 'glass colour')
    if any(o.data.materials[0].name != 'Repair amber brass identity'
           for o in joiner.children if o.type == 'MESH') or len(joiner.children) != 3:
        raise RuntimeError('Unexpected U-shaped amber repair construction')
    original = tuple(scene.objects)
    before = snapshot(original)
    original_keys_before = [accepted_keys(o) for o in original]
    source_states = {}
    for f in (1,169,468,469):
        scene.frame_set(f)
        source_states[f] = snapshot(original)
    scene.frame_set(468)
    append_ids = (piece, joiner, camera, camera.data)
    # Object and Camera datablock legitimately share a name; retain ID identity.
    keys_before = [accepted_keys(o) for o in append_ids]
    carrier_before = tuple(carrier.matrix_world.translation)

    collection = bpy.data.collections.new('Screen Switch continuation only after 469')
    scene.collection.children.link(collection)

    def link(name, data=None, parent=None, location=(0,0,0)):
        obj = bpy.data.objects.new('SS '+name, data)
        collection.objects.link(obj)
        obj.parent = parent
        obj.location = location
        return obj

    emission_shaders = []

    def material(name, rgb, metal=0, rough=.45, emission=0):
        mat = bpy.data.materials.new('SS '+name)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*rgb,1)
        shader.inputs['Roughness'].default_value = rough
        shader.inputs['Metallic'].default_value = metal
        shader.inputs['Emission Color'].default_value = (*rgb,1)
        # New illumination starts at zero; none leaks into the old scene.
        if emission:
            emission_shaders.append(shader)
            for f, strength in ((1,0),(469,0),(552,emission)):
                shader.inputs['Emission Strength'].default_value = strength
                shader.inputs['Emission Strength'].keyframe_insert('default_value', frame=f)
            for curve in curves(mat.node_tree):
                for k in curve.keyframe_points:
                    k.interpolation = 'LINEAR'
        return mat

    metal = material('satin graphite aluminium', (.055,.067,.075), .65, .32)
    desk = material('quiet warm grey desktop', (.25,.24,.22), .05, .62)
    bezel = material('monitor charcoal bezel', (.014,.019,.022), .3, .37)
    screen = material('muted slate desktop', (.058,.090,.105), emission=.18)
    frame_mat = material('native window silver edge', (.32,.35,.36), .6, .3)
    paper = material('editor warm paper', (.72,.75,.72), emission=.3)
    sidebar = material('editor sidebar', (.36,.42,.42), emission=.2)
    ink = material('editor ink', (.055,.10,.13), emission=.1)
    syntax = material('editor restrained syntax', (.14,.26,.28), emission=.1)
    blue = material('image document blue grey', (.20,.30,.36), emission=.25)
    pale = material('image document pale ink', (.64,.71,.70), emission=.25)
    titlebar = material('native window titlebar', (.47,.52,.53), emission=.2)
    traffic = [material('native '+name, rgb, rough=.35, emission=.12)
               for name,rgb in (('close',(.63,.12,.09)),('minimize',(.69,.45,.10)),('zoom',(.14,.47,.22)))]

    def box(name, loc, dims, mat, parent=None, bevel=0):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=dims, verts=bm.verts)
        mesh = bpy.data.meshes.new('SS '+name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(mat)
        obj = link(name, mesh, parent, loc)
        if bevel:
            mod = obj.modifiers.new('Restrained machined edge', 'BEVEL')
            mod.width, mod.segments = bevel, 3
        return obj

    box('standing desk top', (597.5,5.86,motion.DESK_TOP-.045), (5.5,.86,.09), desk, bevel=.018)
    for x in (595,600):
        # Legs are outside the original aperture sight cone.
        box('desk leg', (x,5.89,.8), (.055,.58,1.6), metal, bevel=.012)
        box('desk foot', (x,5.89,.035), (.10,.74,.05), metal, bevel=.015)

    # Same uninterrupted wall material above the untouched receiving niche.
    # Decor sits IN FRONT of that wall, inside both fixed final camera frusta.
    # No recess, replacement source architecture, or original material edits.
    background_start = set(collection.objects)
    wall = backdrop.data.materials[0]
    box('architecture continuous upper wall', (597.5,6.4,7.2), (6,.15,7.2), wall)
    wood = material('print walnut frame', (.085,.058,.038), rough=.65)
    art_paper = material('print uncoated ivory', (.64,.60,.51), rough=.9)
    art_clay = material('print muted clay', (.33,.14,.085), rough=.9)
    art_slate = material('print muted ink', (.10,.18,.19), rough=.9)
    art_sand = material('print muted ochre', (.43,.31,.15), rough=.9)
    # Bounds include the outer frame; both prints are fully inside desktop,
    # below its top reading band, and below the portrait copy field.
    print_layout = ((597.97,6.26,3.89,.82,.82), (599.10,6.26,3.89,.82,.82))
    for i,(x,y,z,w,h) in enumerate(print_layout):
        box(f'print {i+1} backing', (x,y,z), (w,.035,h), wood, bevel=.006)
        box(f'print {i+1} ivory mat', (x,y-.022,z), (w-.04,.008,h-.04), art_paper)
        for dx in (-w/2+.012,w/2-.012):
            box(f'print {i+1} vertical frame', (x+dx,y-.031,z), (.024,.026,h), wood, bevel=.004)
        for dz in (-h/2+.012,h/2-.012):
            box(f'print {i+1} horizontal frame', (x,y-.031,z+dz), (w-.048,.026,.024), wood, bevel=.004)
        # Quiet geometric studies, modelled as ink on paper. No copy or logo.
        box(f'print {i+1} colour field', (x-.05,y-.029,z-.045),
            (w*.53,.004,h*.45), art_clay if i == 0 else art_slate)
        disc = bmesh.new()
        bmesh.ops.create_circle(disc, cap_ends=True, segments=48, radius=.115)
        mesh = bpy.data.meshes.new(f'SS print {i+1} sun')
        disc.to_mesh(mesh)
        disc.free()
        mesh.materials.append(art_sand if i == 0 else art_clay)
        sun = link(f'print {i+1} sun', mesh, location=(x+.14,y-.033,z+.16))
        sun.rotation_euler.x = math.pi/2
        box(f'print {i+1} horizon', (x,y-.036,z-.20), (w*.66,.003,.022), art_slate)

    def lathe(name, origin, profile, mat):
        verts = [(origin[0]+r*math.cos(a*math.tau/48),
                  origin[1]+r*math.sin(a*math.tau/48), origin[2]+z)
                 for r,z in profile for a in range(48)]
        faces = [(row*48+a,row*48+(a+1)%48,(row+1)*48+(a+1)%48,(row+1)*48+a)
                 for row in range(len(profile)-1) for a in range(48)]
        mesh = bpy.data.meshes.new('SS '+name)
        mesh.from_pydata(verts, [], faces)
        mesh.materials.append(mat)
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        return link(name, mesh)

    def stem(name, points, radius, mat):
        data = bpy.data.curves.new('SS '+name, 'CURVE')
        data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', radius, 3
        spline = data.splines.new('BEZIER')
        spline.bezier_points.add(len(points)-1)
        for p,co in zip(spline.bezier_points,points):
            p.co = co
            p.handle_left_type = p.handle_right_type = 'AUTO'
        data.materials.append(mat)
        return link(name, data)

    ceramic = material('plant warm stoneware', (.34,.27,.19), rough=.72)
    soil = material('plant dark soil', (.035,.027,.018), rough=1)
    greens = [material('plant leaf '+str(i), rgb, rough=.5)
              for i,rgb in enumerate(((.045,.12,.055),(.075,.18,.075),(.11,.22,.095)))]
    plant_origin = (595.30,6.16,1.65)
    pot_profile = ((0,0),(.105,0),(.112,.025),(.137,.40),(.14,.43),
                   (.135,.45),(.12,.45),(.118,.405),(0,.405))
    lathe('plant stoneware pot', plant_origin, pot_profile, ceramic)
    lathe('plant visible soil', plant_origin, ((.118,.415),(0,.415)), soil)
    # Broad, cupped blades with staggered heights, not radial spikes. The
    # canopy stays left of the monitor and below the upper-left copy band.
    leaf_layout = (((-.02,0,.208),(-.33,-.015,.736),.23),
                   ((-.03,.02,.336),(-.30,.025,1.0),.27),
                   ((.01,.03,.480),(-.10,.015,1.24),.28),
                   ((0,0,.592),(0,-.01,1.20),.24),
                   ((-.04,.04,.192),(-.45,.025,.488),.25),
                   ((0,.02,.48),(-.04,.015,1.16),.24),
                   ((-.02,.04,.56),(-.36,.035,1.04),.29),
                   ((-.01,.07,.408),(-.36,.065,.856),.29),
                   ((0,.03,.288),(-.10,.025,.816),.26))
    leaf_origin = Vector(plant_origin)+Vector((0,0,.43))
    for i,(base,tip,width) in enumerate(leaf_layout):
        base,tip = leaf_origin+Vector(base), leaf_origin+Vector(tip)
        axis = tip-base
        side = Vector((-axis.z,0,axis.x)).normalized()
        verts = []
        for row in range(25):
            t = row/24
            centre = base+axis*t+Vector((0,-.045*math.sin(math.pi*t),.025*math.sin(math.pi*t)))
            for col in range(9):
                across = (col/4-1)
                p = centre+side*(across*width/2*math.sin(math.pi*t)**.75)
                p.y += .035*across*across*math.sin(math.pi*t)
                verts.append(tuple(p))
        mesh = bpy.data.meshes.new('SS broad curved leaf '+str(i+1))
        mesh.from_pydata(verts, [], [(row*9+col,row*9+col+1,(row+1)*9+col+1,(row+1)*9+col)
                                    for row in range(24) for col in range(8)])
        mesh.materials.append(greens[i%3])
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        leaf = link('plant broad leaf '+str(i+1), mesh)
        solid = leaf.modifiers.new('Thin organic blade', 'SOLIDIFY')
        solid.thickness = .002
        root = leaf_origin+Vector((0,.015,-.01))
        stem('plant petiole '+str(i+1), (root,(root+base)/2,base), .007, greens[0])
        stem('plant midrib '+str(i+1), (base,(base+tip)/2+Vector((0,-.048,.025)),tip), .002, greens[1])

    lamp_metal = material('lamp matte tobacco', (.13,.10,.07), .25, .5)
    lamp_inner = material('lamp warm inner rim', (1,.64,.29), rough=.6, emission=2.0)
    lamp_origin = (599.75,6.15,1.65)
    lamp_base_profile = ((0,0),(.10,0),(.115,.015),(.112,.035),(.075,.05),(0,.05))
    lamp_shade_profile = ((0,1.30),(.055,1.295),(.11,1.25),(.151,1.19),(.17,1.11),
                          (.17,1.09),(.155,1.09),(.143,1.18),(.10,1.24),(.04,1.275),(0,1.275))
    lathe('lamp weighted base', lamp_origin, lamp_base_profile, lamp_metal)
    stem('lamp upright', ((599.75,6.15,1.69),(599.82,6.15,2.24),(599.75,6.15,2.91)), .012, lamp_metal)
    lathe('lamp domed shade', lamp_origin, lamp_shade_profile, lamp_metal)
    lathe('lamp warm inner rim', lamp_origin, ((.143,1.095),(.162,1.095)), lamp_inner)
    practical = bpy.data.lights.new('SS warm desk lamp practical', 'POINT')
    practical.color, practical.shadow_soft_size = (1,.66,.34), .075
    link('warm desk lamp practical', practical, location=(599.75,6.15,2.71))
    practical_keys = ((1,0),(469,0),(512,0),(552,7.5))
    for f, value in practical_keys:
        practical.energy = value
        key(practical, 'energy', f)
    background_objects = set(collection.objects)-background_start
    # At 490 the wall top is outside BOTH frusta. Prints are above aperture
    # rays; the LOWER pot/leaves/lamp are behind the lateral jambs instead.
    # Pure tests derive these different occlusions from the authored geometry.
    background_visibility_keys = ((1,True),(489,True),(490,False))

    for i, p in enumerate(motion.DOCKS):
        x, _, z = p
        box(f'monitor {i+1} body', (x,6.24,z), (motion.MONITOR_WIDTH,.14,motion.MONITOR_HEIGHT), bezel, bevel=.035)
        box(f'monitor {i+1} screen', (x,motion.SCREEN_Y-.004,z), (1.77,.008,1.20), screen, bevel=.018)
        box(f'monitor {i+1} stem', (x,6.24,1.84), (.065,.065,.35), metal, bevel=.014)
        box(f'monitor {i+1} foot', (x,6.04,1.668), (.60,.44,.035), metal, bevel=.018)
        box(f'monitor {i+1} native menu bar', (x,6.146,z+.568), (1.74,.006,.045), titlebar)

    # Actual installed SF Symbol; no invented logo or Screen Switch dashboard.
    icon_image = bpy.data.images.load(str(icon), check_existing=False)
    icon_image.pack()
    icon_material = bpy.data.materials.new('SS actual rectangle.2.swap SF Symbol')
    icon_material.use_nodes = True
    n, links = icon_material.node_tree.nodes, icon_material.node_tree.links
    n.clear()
    output = n.new('ShaderNodeOutputMaterial')
    transparent = n.new('ShaderNodeBsdfTransparent')
    emission = n.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (.025,.035,.04,1)
    emission.inputs['Strength'].default_value = .6
    texture = n.new('ShaderNodeTexImage')
    texture.image = icon_image
    mix = n.new('ShaderNodeMixShader')
    links.new(texture.outputs['Alpha'], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    for i,p in enumerate(motion.DOCKS):
        mesh = bpy.data.meshes.new('SS actual symbol quad')
        # Face toward -Y. UV preserves the native symbol's left/right orientation.
        x, z, size = p[0]+.71, p[2]+.568, .043
        mesh.from_pydata([(x-size/2,6.141,z-size/2),(x+size/2,6.141,z-size/2),
                          (x+size/2,6.141,z+size/2),(x-size/2,6.141,z+size/2)], [], [(0,1,2,3)])
        uv = mesh.uv_layers.new()
        for loop, coord in zip(uv.data, ((0,0),(1,0),(1,1),(0,1))):
            loop.uv = coord
        mesh.materials.append(icon_material)
        link(f'monitor {i+1} genuine menu-bar symbol', mesh)

    roots, contents = {}, {}
    for letter in ('A','B'):
        root = roots[letter] = link('window '+letter+' visible docking frame')
        for x in (-.614,.614):
            box('native window vertical rail', (x,.045,0), (.028,.03,.856), frame_mat, root, .008)
        for z in (-.414,.414):
            box('native window horizontal rail', (0,.045,z), (1.20,.03,.028), frame_mat, root, .008)
        content = contents[letter] = link('window '+letter+' content reveal', parent=piece if letter == 'A' else root)

        def content_box(name, loc, dims, mat, parent, bevel=0):
            # Front brass leaf is already in front of the document, but its
            # inner face intersects the old UI. Leave a small glass relief;
            # preserve the original U mesh and its source material verbatim.
            parts = motion.corner_clearance(loc,dims) if letter == 'A' else ((loc,dims),)
            for centre,size in parts:
                box(name, centre, size, mat, parent, bevel)

        content_box('native titlebar', (0,.038,.355), (1.17,.006,.09), titlebar, content, .01)
        for x, mat in zip((.55,.495,.44), traffic):
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=.014)
            mesh = bpy.data.meshes.new('SS native traffic light')
            bm.to_mesh(mesh)
            bm.free()
            mesh.materials.append(mat)
            link('native traffic light', mesh, content, (x,.049,.365))
        content_box('document surface '+letter, (0,.035,-.035), (1.17,.006,.69), paper if letter == 'A' else blue, content)
        if letter == 'A':
            # An illustration of a native text editor, with no baked copy or metrics.
            content_box('editor navigation sidebar', (.47,.040,-.035), (.20,.004,.67), sidebar, content)
            for row in range(12):
                z = .25-row*.05
                width = (.51,.66,.42,.57)[row%4]
                box('editor text stroke', (.22-width/2,.044,z), (width,.003,.009), syntax if row%3 == 0 else ink, content)
        else:
            # A native image-document canvas, visually distinct from the text editor.
            box('image document canvas', (0,.040,-.015), (.92,.003,.46), pale, content, .008)
            for x,z,w in ((.19,.06,.33),(-.16,-.04,.39),(.04,-.16,.58)):
                line = box('image study diagonal', (x,.044,z), (w,.003,.014), blue, content)
                line.rotation_euler.y = .38 if x > 0 else -.48

    for name, pos, target, energy, dock_energy, size in (
        ('soft desk key',(596.4,4.8,3.48),(597.5,6.0,2.2),160,60,2.0),
        ('glass edge strip',(599.6,5.0,3.4),(596.4,6.02,2.6),110,45,1.4)):
        data = bpy.data.lights.new('SS '+name, 'AREA')
        data.shape, data.size, data.size_y = 'RECTANGLE', size, .16 if 'strip' in name else size
        obj = link(name, data, location=pos)
        obj.rotation_euler = (Vector(target)-Vector(pos)).to_track_quat('-Z','Y').to_euler()
        obj.visible_camera = False
        # Preserve the glass/amber lighting of 536; reduce the new frontal
        # wash only as the pane docks and the view becomes nearly face-on.
        for f, value in ((1,0),(469,0),(552,energy),(576,dock_energy)):
            data.energy = value
            key(data, 'energy', f)

    for obj in collection.objects:
        visibility_keys = (background_visibility_keys if obj in background_objects
                           else ((1,True),(469,True),(470,False)))
        for frame, hidden in visibility_keys:
            obj.hide_render = hidden
            key(obj, 'hide_render', frame, constant=True)

    for f in range(469,661):
        piece.location, piece.rotation_euler.z = motion.pane_pose(f)
        # It is the ORIGINAL consumed U-shaped brass joiner; never substitute it.
        joiner.location = motion.corner_pose(f)
        for obj in (piece,joiner):
            key(obj, 'location', f)
        key(piece, 'rotation_euler', f)
        pos,target,lens = motion.camera_pose(f, args.camera == 'mobile')
        camera.location = pos
        camera.rotation_quaternion = (Vector(target)-Vector(pos)).to_track_quat('-Z','Y')
        camera.data.lens = lens
        key(camera, 'location', f)
        key(camera, 'rotation_quaternion', f)
        key(camera.data, 'lens', f)
        for letter, root in roots.items():
            # Empty native frame waits for the pane; after docking it travels
            # with the same pane. No parent swap or object identity substitution.
            p, angle = motion.window_pose(max(f,motion.DOCK_END), letter)
            root.location, root.rotation_euler.z = p,angle
            key(root, 'location', f)
            key(root, 'rotation_euler', f)
        reveal = motion.content_reveal(f)
        contents['A'].scale.z = max(.00001,reveal)
        contents['A'].location.z = -.38*(1-reveal)
        key(contents['A'], 'scale', f)
        key(contents['A'], 'location', f)

    # Native guards are evaluated by the parent, never by the worker. A source
    # disagreement is an explicit stop, not a fallback cut or regenerated pane.
    scene.frame_set(468)
    after = snapshot(original)
    for name, (matrix, hidden) in before.items():
        close(after[name][0], matrix, 'frame468 object '+name)
        if after[name][1] != hidden:
            raise RuntimeError('Original visibility changed: '+name)
    for obj, previous_keys in zip(append_ids, keys_before):
        if accepted_keys(obj) != previous_keys:
            raise RuntimeError('Original action keys changed through468: '+obj.name)
    for obj, previous_keys in zip(original, original_keys_before):
        if accepted_keys(obj) != previous_keys:
            raise RuntimeError('Original object keys changed through468: '+obj.name)
    if not all(o.hide_render for o in collection.objects):
        raise RuntimeError('New geometry or lights leak into accepted frame468')
    new_lights = tuple(o.data for o in collection.objects if o.type == 'LIGHT')
    for f in (1,169,468,469):
        scene.frame_set(f)
        if (not all(o.hide_render for o in collection.objects)
                or any(light.energy != 0 for light in new_lights)
                or any(shader.inputs['Emission Strength'].default_value != 0
                       for shader in emission_shaders)):
            raise RuntimeError(f'Background geometry/light leaks into accepted frame{f}')
        state = snapshot(original)
        for name,(matrix,hidden) in source_states[f].items():
            close(state[name][0], matrix, f'frame{f} original object '+name)
            if state[name][1] != hidden:
                raise RuntimeError(f'Original visibility changed at frame{f}: '+name)
    scene.frame_set(468)
    close(carrier.matrix_world.translation, carrier_before, 'original parked carrier')
    if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash:
        raise RuntimeError('Accepted input bytes changed')

    scene.frame_end = 660
    scene.render.resolution_x, scene.render.resolution_y = args.size
    scene.render.resolution_percentage = 100
    scene.render.fps = 24
    scene.cycles.samples = args.samples
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    if args.preview:
        if hasattr(scene.render, 'use_motion_blur'):
            scene.render.use_motion_blur = False
        else:
            scene.cycles.use_motion_blur = False
    # Final mode inherits accepted motion blur/shutter and colour management.
    blur_settings = scene.render if hasattr(scene.render, 'use_motion_blur') else scene.cycles
    # Initialize only this Blender process's Cycles devices; never save preferences.
    backend = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        devices = [d for d in prefs.devices if d.type == 'METAL']
        for d in prefs.devices:
            d.use = d in devices
        if devices:
            backend = 'METAL'
    except (TypeError,RuntimeError,AttributeError):
        pass
    scene.cycles.device = 'GPU' if backend == 'METAL' else 'CPU'
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination))
    manifest = {'source':str(source),'source_sha256':source_hash,'camera':args.camera,
                'native_guards':'frames1/169/468/469 original transforms/visibility; keys<=468; native pane/materials/camera; zero early light/emission; source SHA256 checked',
                'scene_range':[1,660],'append':[469,660],'fps':scene.render.fps,'frames':frames,
                'mode':'preview' if args.preview else 'final',
                'preview_frames':frames if args.preview else [],
                'preview_only':args.preview,'samples':scene.cycles.samples,'backend':backend,
                'size':[scene.render.resolution_x,scene.render.resolution_y],
                'motion_blur':blur_settings.use_motion_blur,
                'motion_blur_shutter':scene.render.motion_blur_shutter,
                'pane_object':pane.name,'corner_object':joiner.name,'icon_symbol':'rectangle.2.swap',
                'icon_png':str(icon),'icon_sha256':hashlib.sha256(icon.read_bytes()).hexdigest(),
                'beats':{'aperture_traversal':[512,532],'rise':[532,552],'dock':[552,576],
                         'exchange':[588,636],'final_hold':[636,660]},
                'visual_acceptance':'PENDING parent inspection of actual rendered output and encoded motion'}
    (out/'screen-switch-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest,indent=2), flush=True)
    for frame in frames:
        scene.frame_set(frame)
        scene.render.filepath = str(out/f'frame-{frame:04d}.png')
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
