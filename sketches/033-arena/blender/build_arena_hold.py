"""PARENT ONLY: run with Blender --background --factory-startup --disable-autoexec
--python build_arena_hold.py -- --preview-motion --camera desktop --source ORIGINAL
--inputs inputs.json --out FRESH [--prepare-only]. Repeat once for mobile.

The source is opened read-only and saved ONLY into a new output directory. Prepared
scenes use the same capped CLI on a later parent invocation with a DIFFERENT fresh
out; they are inspection artifacts, never accepted as the original --source.
No unrestricted resume/render mode. Never render frame 132: it is the closure key.
"""
import json
import math
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import arena_hold as hold


def main():
    args=hold.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    inputs=hold.load_inputs(args.inputs)
    variant=inputs['variants'][args.camera]
    source=hold.validate_source(args.source,variant)
    admission=json.loads(Path(inputs['source_native_admission']).read_text())[args.camera]
    if admission['source_sha256']!=variant['native_source_sha256'] or admission['source']!=str(source):
        raise ValueError('original native admission does not match')
    texture=inputs['banner_texture']
    if hold.sha256(texture['path'])!=texture['sha256']:
        raise ValueError('accepted banner texture changed')
    out=hold.fresh_output(args.out,hold.protected_inputs(inputs,args.inputs))

    import bpy
    from mathutils import Matrix, Vector
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    # Reject handlers from a host session rather than inheriting execution hooks.
    if any(getattr(bpy.app.handlers,name) for name in ('frame_change_pre','frame_change_post','render_pre','render_post')):
        raise ValueError('native handlers present; use factory-startup')
    scene=bpy.context.scene
    scene.frame_set(84)
    original=bpy.data.objects.get('GameOnVB canvas')
    if original is None:
        raise ValueError('actual banner missing')
    cloth=next((m for m in original.modifiers if m.type=='CLOTH'),None)
    if cloth is None or not cloth.point_cache.is_baked or (cloth.point_cache.frame_start,cloth.point_cache.frame_end)!=(1,168):
        raise ValueError('require original baked 1–168 cache; rebaking is forbidden')
    graph=bpy.context.evaluated_depsgraph_get()
    evaluated=original.evaluated_get(graph)
    mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=graph)
    if len(mesh.vertices)!=5130 or not mesh.uv_layers.active or not mesh.materials:
        raise ValueError('evaluated 84 banner topology/UV/material differs')
    world_bounds=[tuple(evaluated.matrix_world @ vertex.co) for vertex in mesh.vertices]
    if max(p[2] for p in world_bounds)-min(p[2] for p in world_bounds)<8:
        raise ValueError('not the dropped cloth base pose')
    clone=bpy.data.objects.new('GameOnVB preview periodic cloth',mesh)
    scene.collection.objects.link(clone)
    clone.matrix_world=evaluated.matrix_world.copy()
    original.hide_render=True
    original.hide_set(True)
    # Stop original modifier evaluation in the derivative; never touch its source cache.
    for modifier in original.modifiers:
        modifier.show_viewport=False; modifier.show_render=False
    for material in mesh.materials:
        if material and material.node_tree:
            material.node_tree.animation_data_clear()
            for node in material.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image:
                    if Path(bpy.path.abspath(node.image.filepath)).name=='gameon-banner.png':
                        node.image.filepath=texture['path']
                        node.image.reload()
    uv_by_vertex={}
    for loop in mesh.loops:
        uv=tuple(mesh.uv_layers.active.data[loop.index].uv)
        if loop.vertex_index in uv_by_vertex and max(abs(a-b) for a,b in zip(uv,uv_by_vertex[loop.vertex_index]))>1e-5:
            raise ValueError('unexpected UV seam at evaluated cloth vertex')
        uv_by_vertex[loop.vertex_index]=uv
    if len(uv_by_vertex)!=5130:
        raise ValueError('missing vertex UVs')
    clone.shape_key_add(name='Basis 84')
    keys=[clone.shape_key_add(name='Gentle sine'),clone.shape_key_add(name='Gentle cosine')]
    for vertex in mesh.vertices:
        for i,amount in enumerate(hold.flutter_modes(uv_by_vertex[vertex.index])):
            # Canvas normal is its local depth axis; preserve baked folds/UV/print.
            keys[i].data[vertex.index].co=vertex.co+Vector((0,amount,0))
    for i,key in enumerate(keys):
        key.slider_min=-1 if i==0 else 0
        key.slider_max=1 if i==0 else 2
        for frame in (*hold.FRAMES,hold.CLOSE_FRAME):
            key.value=hold.coefficients(frame)[i]
            key.keyframe_insert(data_path='value',frame=frame)
    # Give sampled sin/cos keys analytic endpoint derivatives (including the seam).
    action=mesh.shape_keys.animation_data.action
    for slot in action.slots:
        for layer in action.layers:
            for strip in layer.strips:
                bag=strip.channelbag(slot)
                if bag is None:
                    continue
                for curve in bag.fcurves:
                    index=0 if 'Gentle sine' in curve.data_path else 1
                    for point in curve.keyframe_points:
                        frame=float(point.co.x); value=float(point.co.y)
                        angle=(frame-84)*6.283185307179586/48
                        derivative=(math.cos(angle) if index==0 else math.sin(angle))*math.tau/48
                        point.interpolation='BEZIER'
                        point.handle_left_type=point.handle_right_type='FREE'
                        point.handle_left=(frame-1/3,value-derivative/3)
                        point.handle_right=(frame+1/3,value+derivative/3)
    camera=bpy.data.objects[args.camera]
    expected=admission['camera_at84']
    matrix=camera.matrix_world.copy()
    if max(abs(matrix[r][c]-expected['matrix_world'][r][c]) for r in range(4) for c in range(4))>1e-5 or abs(camera.data.lens-expected['lens'])>1e-6:
        raise ValueError('camera is not original admitted frame 84')
    frozen=camera.copy(); frozen.data=camera.data.copy()
    frozen.name='Frozen approved camera84'
    frozen.parent=None; frozen.animation_data_clear(); frozen.data.animation_data_clear()
    frozen.constraints.clear(); frozen.matrix_world=Matrix(matrix)
    scene.collection.objects.link(frozen)
    scene.timeline_markers.clear()
    scene.timeline_markers.new('Frozen frame84',frame=84).camera=frozen
    scene.camera=frozen
    w,h=hold.SIZE[args.camera]
    scene.render.engine='CYCLES'; scene.cycles.samples=hold.SAMPLES
    scene.cycles.use_adaptive_sampling=False
    scene.render.resolution_x=w; scene.render.resolution_y=h
    scene.render.resolution_percentage=100
    scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
    scene.render.fps=hold.FPS; scene.render.fps_base=1
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGB'
    scene.render.use_file_extension=True
    scene.render.use_border=False; scene.render.use_crop_to_border=False
    scene.render.use_multiview=False; scene.render.use_sequencer=False
    scene.render.use_compositing=False; scene.render.use_motion_blur=False
    scene.frame_start=84; scene.frame_end=131; scene.frame_step=1
    scene.frame_set(84)
    color={'view':scene.view_settings.view_transform,'look':scene.view_settings.look,
           'exposure':scene.view_settings.exposure,'gamma':scene.view_settings.gamma}
    if color!=admission['color'] or frozen.data.dof.use_dof!=expected['dof']:
        raise ValueError('source color/DOF differs from original admission')
    out.mkdir(parents=True,exist_ok=False)
    manifest={'kind':'gameon-hold-native-preview','camera':args.camera,'source':str(source),
        'source_sha256':hold.sha256(source),'inputs_sha256':hold.sha256(args.inputs),
        'size':[w,h],'fps':24,'samples':8,'frames':list(hold.FRAMES),'closure_key_not_rendered':132,
        'camera_at84':{'matrix_world':[list(row) for row in frozen.matrix_world],
                       'lens':frozen.data.lens,'dof':frozen.data.dof.use_dof},
        'color':color,
        'banner':{'vertices':5130,'uv_layers':[uv.name for uv in mesh.uv_layers],
                  'materials':[m.name for m in mesh.materials],'texture_sha256':texture['sha256'],
                  'modes':2,'normal_amplitude_bound_metres':.096,'top_uv_v':1,'base_frame':84},
        'rebaked':False,'handlers':False,'prepare_only':args.prepare_only,'rendered':[]}
    scene['arena_hold_preview_only']=True
    scene['arena_hold_source_sha256']=variant['native_source_sha256']
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'arena-hold-preview.blend'))
    receipt=out/'native-manifest.json'
    receipt.write_text(json.dumps(manifest,indent=2))
    if not args.prepare_only:
        for frame in hold.FRAMES:
            scene.frame_set(frame)
            if scene.camera!=frozen or max(abs(frozen.matrix_world[r][c]-matrix[r][c]) for r in range(4) for c in range(4))>1e-6:
                raise ValueError('camera moved; abort remaining approved frames')
            file=out/f'frame-{frame:04d}.png'
            scene.render.filepath=str(file)
            bpy.ops.render.render(write_still=True)
            if hold.png_size(file)!=(w,h):
                raise ValueError('render exceeded fixed preview dimensions')
            manifest['rendered'].append({'frame':frame,'file':file.name,'sha256':hold.sha256(file)})
            receipt.write_text(json.dumps(manifest,indent=2))
    if hold.sha256(source)!=variant['native_source_sha256']:
        raise ValueError('original source SHA changed')
    print(json.dumps({'manifest':str(receipt),'native_frames':len(manifest['rendered'])}))


if __name__=='__main__':
    main()
