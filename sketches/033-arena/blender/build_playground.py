"""PARENT ONLY: explicit cheap preview or bounded final Playground render.

Worker verification is AST/pure tests only; --prepare-only renders no frames.
Uses the sealed camera-specific Screen Switch file and staged 032 PNG sequence;
never saves over an input or changes preferences. Open the saved native scene
with autoexec disabled; the image sequence and camera keys need no handlers.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import playground as motion
import screen_switch as switch
from build_screen_switch import key, close, curves


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def action_keys(action):
    """All original keys, including handles, across every native action slot."""
    if hasattr(action, 'fcurves'):
        curves = list(action.fcurves)
    else:
        curves = [curve for layer in action.layers for strip in layer.strips
                  for bag in strip.channelbags for curve in bag.fcurves]
    result = []
    for curve in curves:
        points = []
        for point in curve.keyframe_points:
            frame = point.co.x
            if frame <= 660:
                points.append((tuple(point.co), point.interpolation, point.type,
                               tuple(point.handle_left), tuple(point.handle_right),
                               point.handle_left_type, point.handle_right_type,
                               point.easing, point.amplitude, point.back, point.period))
        if points:
            result.append((curve.data_path, curve.array_index, curve.extrapolation, points))
    return result


def snapshot(objects, lights, cameras, sockets, exclude_camera=None):
    """Evaluated original state, including old material/world input values.

    The same original datablocks are retained; no mesh/material/light is edited.
    Post-661 guards exempt only the active camera's transforms and lens.
    """
    def value(v):
        if v is None:
            return None
        if isinstance(v, bpy.types.ID):
            return (v.bl_rna.identifier, v.name)
        return v if isinstance(v, (int, float, bool, str)) else tuple(v)

    state = {}
    for obj in objects:
        state['object '+obj.name] = (
            None if obj == exclude_camera else (
                tuple(v for row in obj.matrix_world for v in row),
                tuple(v for row in obj.matrix_basis for v in row)),
            obj.hide_render, obj.hide_viewport, obj.hide_get(),
            obj.parent.name if obj.parent else None,
            tuple(slot.material.name if slot.material else None for slot in obj.material_slots),
            obj.data.name if obj.data else None)
    for light in lights:
        state['light '+light.name] = (light.energy, tuple(light.color), light.type)
    for camera in cameras:
        state['camera '+camera.name] = (
            None if exclude_camera and camera == exclude_camera.data else camera.lens,
            camera.type, camera.sensor_fit, camera.sensor_width, camera.sensor_height,
            camera.shift_x, camera.shift_y, camera.clip_start, camera.clip_end,
            camera.dof.use_dof, camera.dof.focus_distance)
    for label, socket in sockets:
        state[label] = value(socket.default_value)
    return state


def require_state(actual, expected, label):
    if actual != expected:
        changed = [name for name in expected if actual.get(name) != expected[name]]
        raise RuntimeError(f'Original native state changed at {label}: {changed[:12]}')


def verified_inputs(args):
    """Only the explicitly cited input manifests, never a repository inventory."""
    source = args.source.resolve(strict=True)
    root = args.frames_root.resolve(strict=True)
    natives = json.loads((root.parent/'native-inputs.json').read_text())
    native = natives[args.camera]
    source_sha256 = sha256(source)
    if (source.suffix.lower() != '.blend' or source != Path(native['path']).resolve()
            or source_sha256 != native['sha256']):
        raise RuntimeError('Source does not match the sealed camera-specific native input')
    manifest = json.loads((root.parent/'villa-input-manifest.json').read_text())
    if (manifest['size'] != [1600, 900] or manifest['source_frames'] != [156, 192]
            or len(manifest['files']) != 37):
        raise RuntimeError('Expected the exact 37 staged villa frames, 156–192')
    hashes = {source: source_sha256}
    for camera in ('desktop', 'mobile'):
        path = Path(natives[camera]['path']).resolve(strict=True)
        if path.suffix.lower() != '.blend' or sha256(path) != natives[camera]['sha256']:
            raise RuntimeError('Sealed native input hash mismatch: '+str(path))
        hashes[path] = natives[camera]['sha256']
    for index, entry in enumerate(manifest['files'], 1):
        png = root.parent/'villa-input'/f'frame-{index:04d}.png'
        original = Path(entry['source']).resolve(strict=True)
        if (entry['sequence_frame'] != index or entry['original_frame'] != 155+index
                or Path(entry['png']).resolve() != png
                or original.name != f'frame_{155+index:04d}.webp'):
            raise RuntimeError('Staged villa mapping mismatch')
        data = png.read_bytes()
        if (data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (1600, 900)
                or hashlib.sha256(data).hexdigest() != entry['png_sha256']
                or sha256(original) != entry['source_sha256']):
            raise RuntimeError('Staged villa pixel input hash/size mismatch: '+str(png))
        hashes[png], hashes[original] = entry['png_sha256'], entry['source_sha256']

    timeline = json.loads((root.parent/'villa-timeline-manifest.json').read_text())
    if (timeline['size'] != [1600, 900] or timeline['source_frames'] != [156, 192]
            or timeline['scene_frames'] != [660, 804] or timeline['sequence_start'] != 660
            or timeline['sequence_length'] != 145 or timeline['offset'] != 0
            or len(timeline['files']) != motion.SEQUENCE_LENGTH):
        raise RuntimeError('Expected the exact 145-file static villa timeline, 660–804')
    for index, entry in enumerate(timeline['files'], 1):
        frame = motion.START+index-1
        original_frame = motion.villa_frame(frame)
        provenance = manifest['files'][original_frame-156]
        png = root/f'frame-{index:04d}.png'
        if (entry['sequence_frame'] != index or entry['scene_frame'] != frame
                or entry['original_frame'] != original_frame
                or Path(entry['png']).resolve() != png
                or Path(entry['source_png']).resolve() != Path(provenance['png']).resolve()
                or entry['source_png_sha256'] != provenance['png_sha256']
                or entry['png_sha256'] != provenance['png_sha256']
                or Path(entry['source']).resolve() != Path(provenance['source']).resolve()
                or entry['source_sha256'] != provenance['source_sha256']):
            raise RuntimeError('Padded villa timeline/provenance mapping mismatch: '+str(png))
        data = png.read_bytes()
        if (data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (1600, 900)
                or hashlib.sha256(data).hexdigest() != entry['png_sha256']):
            raise RuntimeError('Padded villa pixel input hash/size mismatch: '+str(png))
        hashes[png] = entry['png_sha256']
    return source, root, source_sha256, hashes


def check_hashes(hashes):
    for path, expected in hashes.items():
        if sha256(path) != expected:
            raise RuntimeError('Read-only input bytes changed: '+str(path))


def main():
    argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    args = motion.parse_render_args(argv)
    out = args.out.resolve()
    destination = motion.validate_output(args.source, out, args.frames_root, args.camera, final=args.final)
    source, root, source_sha256, input_hashes = verified_inputs(args)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    if bpy.app.handlers.frame_change_pre or bpy.app.handlers.frame_change_post:
        raise RuntimeError('Unexpected frame handlers; preview must be native and handler-free')
    scene = bpy.context.scene
    camera = bpy.data.objects['Goal Loop '+args.camera]
    window = bpy.data.objects['SS window B visible docking frame']
    content = bpy.data.objects['SS window B content reveal']
    if scene.camera != camera or content.parent != window or camera.rotation_mode != 'QUATERNION':
        raise RuntimeError('Unexpected accepted camera/window B ownership or camera mode')
    scene.frame_set(660)
    expected_pos, expected_target, expected_lens = switch.camera_pose(660, args.camera == 'mobile')
    close(camera.location, expected_pos, 'source660 camera position')
    close((camera.data.lens,), (expected_lens,), 'source660 camera lens')
    orientation = (Vector(expected_target)-Vector(expected_pos)).to_track_quat('-Z', 'Y')
    if abs(camera.rotation_quaternion.dot(orientation)) < .999999:
        raise RuntimeError('Unexpected accepted camera orientation')
    if (camera.parent or camera.constraints or camera.data.sensor_fit != 'HORIZONTAL'
            or camera.data.sensor_width != 36 or camera.data.shift_x or camera.data.shift_y
            or scene.render.pixel_aspect_x != 1 or scene.render.pixel_aspect_y != 1):
        raise RuntimeError('Unexpected camera projection; do not silently change native framing')
    close(window.location, switch.window_pose(660, 'B')[0], 'left dock B')
    close(window.rotation_euler, (0, 0, switch.ANGLE), 'window B rotation')
    close(window.scale, (1, 1, 1), 'window B scale')
    close(content.location, (0, 0, 0), 'window B content origin')
    close(content.rotation_euler, (0, 0, 0), 'window B content rotation')
    close(content.scale, (1, 1, 1), 'window B content scale')
    native_location = camera.location.copy()
    native_rotation = camera.rotation_quaternion.copy()
    native_lens = camera.data.lens
    forward = native_rotation @ Vector((0, 0, -1))
    native_target = native_location+forward*(Vector(expected_target)-native_location).length
    accepted = (tuple(native_location), tuple(native_target), native_lens)

    original = tuple(scene.objects)
    lights, cameras = tuple(bpy.data.lights), tuple(bpy.data.cameras)
    trees = [('material '+mat.name, mat.node_tree) for mat in bpy.data.materials if mat.use_nodes]
    trees += [('world '+world.name, world.node_tree) for world in bpy.data.worlds if world.use_nodes]
    sockets = tuple((f'input {label}/{node.name}/{index}', socket)
                    for label, tree in trees for node in tree.nodes
                    for index, socket in enumerate(node.inputs) if hasattr(socket, 'default_value'))
    actions = [(action, action_keys(action)) for action in bpy.data.actions]
    guard_frames = (1, 169, 468, 660, 661)
    before = {}
    for frame in guard_frames:
        scene.frame_set(frame)
        before[frame] = snapshot(original, lights, cameras, sockets)
    scene.frame_set(660)
    held_original = snapshot(original, lights, cameras, sockets, camera)

    # Exactly one new mesh object, in the actual document's coordinates. No
    # fake UI, replacement original pane, window motion, or new room light.
    mesh = bpy.data.meshes.new('Playground genuine villa quad')
    mesh.from_pydata(motion.quad_local_vertices(), [], [(0, 1, 2, 3)])
    mesh.update()
    uv = mesh.uv_layers.new(name='Unmirrored existing villa')
    for loop, coord in zip(uv.data, motion.QUAD_UV):
        loop.uv = coord
    quad = bpy.data.objects.new('Playground existing 032 villa in window B', mesh)
    window.users_collection[0].objects.link(quad)
    quad.parent = content
    for attr in ('visible_diffuse', 'visible_glossy', 'visible_transmission',
                 'visible_volume_scatter', 'visible_shadow'):
        setattr(quad, attr, False)  # display media only; no added room illumination

    image = bpy.data.images.load(str(root/'frame-0001.png'), check_existing=False)
    image.source = 'SEQUENCE'
    image.colorspace_settings.name = 'sRGB'
    mat = bpy.data.materials.new('Playground quiet genuine villa display')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1.0
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.interpolation, texture.extension = 'Linear', 'CLIP'
    image_user = texture.image_user
    image_user.frame_start = motion.SEQUENCE_START
    image_user.frame_duration = motion.SEQUENCE_LENGTH
    image_user.frame_offset = 0
    image_user.use_cyclic = False
    image_user.use_auto_refresh = True
    mix = nodes.new('ShaderNodeMixShader')
    links.new(texture.outputs['Color'], emission.inputs['Color'])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    mesh.materials.append(mat)
    for frame, hidden in ((1, True), (661, True), (662, False)):
        quad.hide_render = hidden
        key(quad, 'hide_render', frame, constant=True)
    for frame in (1, *range(661, 685), 804):
        mix.inputs[0].default_value = motion.reveal(frame)
        mix.inputs[0].keyframe_insert('default_value', frame=frame)
    # Linear sampled opacity, no automatically overshooting spline handles.
    for curve in curves(mat.node_tree):
        for point in curve.keyframe_points:
            point.interpolation = 'LINEAR'

    camera.location, camera.rotation_quaternion = native_location, native_rotation
    camera.data.lens = native_lens
    for owner, path in ((camera, 'location'), (camera, 'rotation_quaternion'), (camera.data, 'lens')):
        key(owner, path, 661)
    previous_rotation = native_rotation
    for frame in range(662, motion.END+1):
        pos, target, lens = motion.camera_pose(frame, args.camera == 'mobile', accepted)
        rotation = (Vector(target)-Vector(pos)).to_track_quat('-Z', 'Y')
        if rotation.dot(previous_rotation) < 0:
            rotation.negate()
        camera.location, camera.rotation_quaternion = pos, rotation
        camera.data.lens = lens
        key(camera, 'location', frame)
        key(camera, 'rotation_quaternion', frame)
        key(camera.data, 'lens', frame)
        previous_rotation = rotation.copy()

    for action, expected in actions:
        if action_keys(action) != expected:
            raise RuntimeError('Original action keys/handles changed through660: '+action.name)
    for frame in guard_frames:
        scene.frame_set(frame)
        require_state(snapshot(original, lights, cameras, sockets), before[frame], f'frame{frame}')
        if not quad.hide_render or mix.inputs[0].default_value != 0:
            raise RuntimeError(f'New quad leaks into accepted frame{frame}')
    for frame in range(661, motion.END+1):
        scene.frame_set(frame)
        require_state(snapshot(original, lights, cameras, sockets, camera), held_original,
                      f'frame{frame}, only active camera transform/lens may change')
    scene.frame_set(732)
    world_vertices = [tuple(quad.matrix_world @ vertex.co) for vertex in mesh.vertices]
    for actual, expected in zip(world_vertices, motion.quad_world_vertices()):
        close(actual, expected, 'quad derived from actual window B parent')
    sequence_settings = {'sample_frame':732, 'start':image_user.frame_start, 'duration':image_user.frame_duration,
                         'offset':image_user.frame_offset, 'cyclic':image_user.use_cyclic,
                         'auto_refresh':image_user.use_auto_refresh}
    if sequence_settings != {'sample_frame':732, 'start':660, 'duration':145, 'offset':0,
                             'cyclic':False, 'auto_refresh':True}:
        raise RuntimeError('Native sequence settings mismatch')
    if (image.source != 'SEQUENCE' or image.packed_file or image.packed_files
            or Path(bpy.path.abspath(image.filepath)).resolve() != root/'frame-0001.png'
            or any(curve.data_path == image_user.path_from_id('frame_offset')
                   for curve in curves(mat.node_tree))
            or any(not (root/f'frame-{index:04d}.png').is_file() for index in range(1, 146))):
        raise RuntimeError('Static native sequence must be unpacked, complete and have no offset F-curve')
    sequence_checks = []
    for frame in sorted(set((*motion.PREVIEW_FRAMES, *args.frames, 662, 743, 781))):
        scene.frame_set(frame)
        if image_user.frame_offset != 0:
            raise RuntimeError(f'Native static sequence offset changed at frame{frame}')
        sequence_checks.append({'frame':frame, 'offset_expected':0, 'offset_actual':image_user.frame_offset,
                                'sequence_frame_expected':motion.sequence_frame(frame),
                                'original_villa_frame_expected':motion.villa_frame(frame),
                                'photo_identity_applicable':frame > 661,
                                'sequence_png_expected':str(motion.sequence_path(root, frame))})
    check_hashes(input_hashes)

    scene.frame_end = motion.END
    scene.render.resolution_x, scene.render.resolution_y = args.size
    scene.render.resolution_percentage = 100
    scene.cycles.samples = args.samples
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    blur_settings = scene.render if hasattr(scene.render, 'use_motion_blur') else scene.cycles
    if args.preview:
        blur_settings.use_motion_blur = False
    backend = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        devices = [device for device in prefs.devices if device.type == 'METAL']
        for device in prefs.devices:
            device.use = device in devices
        if devices:
            backend = 'METAL'
    except (TypeError, RuntimeError, AttributeError, KeyError):
        pass
    scene.cycles.device = 'GPU' if backend == 'METAL' else 'CPU'
    scene.frame_set(660)
    # Recheck freshness just before the first write; never overwrite a prior run.
    motion.validate_output(source, out, root, args.camera, final=args.final)
    out.mkdir(parents=True, exist_ok=False)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination))
    manifest = {
        'mode':'preview' if args.preview else 'final', 'preview_only':args.preview,
        'source':str(source), 'source_sha256':source_sha256,
        'camera':args.camera, 'size':list(args.size), 'samples':scene.cycles.samples,
        'backend':backend, 'motion_blur':blur_settings.use_motion_blur,
        'motion_blur_shutter':scene.render.motion_blur_shutter,
        'fps':scene.render.fps, 'scene_range':[scene.frame_start, scene.frame_end],
        'native_scene':str(destination), 'native_scene_sha256':sha256(destination), 'saved_frame':660,
        'frames':list(args.frames), 'rendered_frames':[],
        'render_status':'prepared_pending_reload' if args.prepare_only else 'pending',
        'native_guards':{'exact_original_state_frames':list(guard_frames),
                         'all_old_action_keys_and_handles_through':660,
                         'original_action_count':len(actions), 'original_object_count':len(original),
                         'old_state_held_except_active_camera':[661, 804],
                         'new_quad_hidden_and_transparent_through':661,
                         'source_and_villa_hashes_checked':True, 'python_frame_handlers':False},
        'quad':{'object':quad.name, 'parent':content.name,
                'local_vertices':motion.quad_local_vertices(), 'world_vertices':world_vertices,
                'uv':motion.QUAD_UV, 'reveal':[662, 684], 'emission_strength':1.0},
        'sequence':{'image_source':image.source, 'path':image.filepath, 'native_settings':sequence_settings,
                    'image_not_packed':True, 'offset_animated':False,
                    'clock_checks':sequence_checks,
                    'staged_manifest':str(root.parent/'villa-timeline-manifest.json'),
                    'source_manifest':str(root.parent/'villa-input-manifest.json'),
                    'input_sha256':{str(p):h for p, h in input_hashes.items()},
                    'initial_hold':{'original_frame':156, 'scene_frames':[660, 743]},
                    'existing_finish':{'original_frames':[156, 192], 'scene_frames':[744, 780]},
                    'final_hold':{'original_frame':192, 'scene_frames':[781, 804]}},
        'camera_approach':[661, 732], 'camera_hold':[732, 804],
        'still_evidence':[],
        'visual_acceptance':'PENDING parent native image/UV/sequence inspection and independent review; no artistic PASS',
        'sequence_pixel_acceptance':'PENDING parent rendered-pixel classification against source photos after fresh saved-scene reload; frame660 is hidden',
    }
    manifest_path = out/'playground-manifest.json'

    def write_manifest():
        manifest_path.write_text(json.dumps(manifest, indent=2)+'\n')

    if args.prepare_only:
        write_manifest()
        print(json.dumps(manifest, indent=2), flush=True)
        return
    write_manifest()
    try:
        for frame in args.frames:
            scene.frame_set(frame)
            scene.render.filepath = str(out/f'frame-{frame:04d}.png')
            bpy.ops.render.render(write_still=True)
            png = Path(scene.render.filepath)
            if struct.unpack('>II', png.read_bytes()[16:24]) != args.size:
                raise RuntimeError('Actual still dimensions differ from the selected render contract')
            manifest['rendered_frames'].append(frame)
            manifest['still_evidence'].append({
                'frame':frame, 'png':str(png), 'sha256':sha256(png),
                'size':list(args.size), 'samples':scene.cycles.samples,
                'camera_position':list(camera.location), 'camera_quaternion':list(camera.rotation_quaternion),
                'camera_lens':camera.data.lens, 'quad_hidden':quad.hide_render,
                'reveal_actual':mix.inputs[0].default_value,
                'sequence_frame_expected':motion.sequence_frame(frame),
                'original_villa_frame_expected':motion.villa_frame(frame),
                'sequence_png_expected':str(motion.sequence_path(root, frame)),
                'photo_identity_applicable':frame > 661,
                'image_user_offset_expected':0,
                'image_user_offset_actual':image_user.frame_offset,
            })
            write_manifest()
        check_hashes(input_hashes)
        manifest['render_status'] = 'stills_written_pending_visual_review'
    except Exception as exc:
        manifest['render_status'], manifest['failure'] = 'failed', str(exc)
        write_manifest()
        raise
    write_manifest()
    print(json.dumps(manifest, indent=2), flush=True)


if __name__ == '__main__':
    main()
