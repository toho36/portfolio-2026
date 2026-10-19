"""PARENT ONLY native authoring; import-safe, prepare/reload only, no renderer.

Blender --background --factory-startup --disable-autoexec --threads 8
  --python THIS -- --prepare-only --subject story|belt-idle|office-idle
  --camera desktop|mobile --source PINNED_PLAYGROUND --out ABSENT_DIRECTORY
Fresh process, same startup flags:
  --python THIS -- --verify-prepared OUT/continuous-motion.blend
  --manifest OUT/native-manifest.json

No handler installation, device selection, timer enumeration, render fallback,
image encoding or budget mutation. Native evidence is still pending until the
parent actually executes these entry points and inspects approved pixels.
"""
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import continuous_motion as m
import build_ambient_holds as ambient
import build_refined_holds as refined


def set_frame(scene, frame):
    scene.frame_set(math.floor(frame), subframe=frame % 1)


def author_sources():
    names = ('continuous_motion.py', 'build_continuous_motion.py', 'arena_hold.py',
             'ambient_holds.py', 'build_ambient_holds.py', 'refined_holds.py',
             'build_refined_holds.py', 'goal_loop.py', 'playground.py', 'screen_switch.py',
             'test_continuous_motion.py')
    return {name:m.sha256(Path(__file__).with_name(name)) for name in names}


def descendants(root):
    return [root, *(child for direct in root.children for child in descendants(direct))]


def window_hierarchy(front, rear, house, cursor, front_names):
    if {o.name for o in descendants(front)} != set(front_names)|{cursor.name}:
        raise ValueError('front rails/buttons/content ancestry changed')
    if (rear.parent is not None or house.parent is None or house.parent.name != m.REAR_CONTENT
            or house.parent.parent != rear or house in descendants(front)):
        raise ValueError('rear house window is not independent of front B')


def runtime_state(bpy):
    refined.no_runtime(bpy);refined.no_drivers(bpy)
    callbacks={name:[getattr(cb,'__module__',type(cb).__module__)+'.'+
                     getattr(cb,'__qualname__',type(cb).__qualname__) for cb in getattr(bpy.app.handlers,name)]
               for name in dir(bpy.app.handlers) if isinstance(getattr(bpy.app.handlers,name),list)}
    return {'factory_startup':bpy.app.factory_startup,
            'auto_execute':bpy.context.preferences.filepaths.use_scripts_auto_execute,
            'factory_callbacks':callbacks,'global_timer_enumeration':'UNAVAILABLE'}


def key(item, path, frame, constant=False):
    """Modify only the newly inserted key; inherited handles remain byte-exact."""
    inherited={(c.data_path,c.array_index,p.co.x):(tuple(p.handle_left),tuple(p.handle_right))
               for c in ambient.curves_for(item) for p in c.keyframe_points if p.co.x <= 660 < frame}
    item.keyframe_insert(data_path=path, frame=frame)
    for curve in ambient.curves_for(item):
        if curve.data_path == path:
            for point in curve.keyframe_points:
                if abs(point.co.x-frame) < 1e-5:
                    point.interpolation = 'CONSTANT' if constant else 'LINEAR'
        for point in curve.keyframe_points:
            old=inherited.get((curve.data_path,curve.array_index,point.co.x))
            if old:point.handle_left,point.handle_right=old


def sequence_state(bpy, static=False):
    """Admit exactly the genuine villa sequence, never arbitrary temporal media."""
    quad = bpy.data.objects[m.HOUSE]
    if quad.type != 'MESH' or len(quad.data.materials) != 1:
        raise ValueError('genuine villa quad/material missing')
    material = quad.data.materials[0]
    if material.name != 'Playground quiet genuine villa display':raise ValueError('wrong villa material')
    textures = [n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE']
    mixes = [n for n in material.node_tree.nodes if n.type == 'MIX_SHADER']
    if len(textures) != 1 or len(mixes) != 1:raise ValueError('wrong villa shader identity')
    texture = textures[0];image = texture.image;user = texture.image_user
    path = Path(bpy.path.abspath(image.filepath)).resolve(strict=True)
    root = m.ROOT/'playground/villa-timeline'
    if path != root/'frame-0001.png' or image.colorspace_settings.name != 'sRGB' or image.packed_file:
        raise ValueError('wrong genuine unpacked villa image')
    expected_source = 'FILE' if static else 'SEQUENCE'
    if image.source != expected_source:raise ValueError('wrong villa image source mode')
    if not static and (user.frame_start, user.frame_duration, user.frame_offset,
                       user.use_cyclic, user.use_auto_refresh) != (660,145,0,False,True):
        raise ValueError('villa clock was changed')
    if static and (user.frame_start,user.frame_duration,user.frame_offset,user.use_cyclic) != (1,1,0,False):
        raise ValueError('idle villa is not the narrowly frozen first genuine frame')
    if any('frame_offset' in c.data_path for c in ambient.curves_for(material.node_tree)):
        raise ValueError('villa temporal offset animation forbidden')
    temporal = [i for i in bpy.data.images if i.source in {'SEQUENCE','MOVIE'}]
    if temporal != ([] if static else [image]):raise ValueError('unknown temporal source image')
    timeline_path = root.parent/'villa-timeline-manifest.json'
    if m.sha256(timeline_path) != m.VILLA_TIMELINE_SHA256:raise ValueError('pinned genuine villa timeline changed')
    timeline = json.loads(timeline_path.read_text())
    if (timeline['scene_frames'],timeline['sequence_start'],timeline['sequence_length'],len(timeline['files'])) != ([660,804],660,145,145):
        raise ValueError('wrong genuine villa timeline')
    hashes = {}
    for index, row in enumerate(timeline['files'], 1):
        frame = 659+index;png = root/f'frame-{index:04d}.png'
        if (row['sequence_frame'] != index or row['scene_frame'] != frame
                or row['original_frame'] != m.villa_frame(frame) or Path(row['png']).resolve() != png
                or m.sha256(png) != row['png_sha256'] or row['source_png_sha256'] != row['png_sha256']):
            raise ValueError('villa timeline bytes/house clock differ')
        hashes[str(png)] = row['png_sha256']
    # Reuse the global static-image guard unchanged, filtering only the admitted
    # one sequence. No other temporal ID can evade that guard.
    other = SimpleNamespace(data=SimpleNamespace(images=[i for i in bpy.data.images if i != image]), path=bpy.path)
    return {'image':image.name, 'path':str(path), 'source':image.source,
            'colorspace':image.colorspace_settings.name,
            'settings':[user.frame_start,user.frame_duration,user.frame_offset,user.use_cyclic,user.use_auto_refresh],
            'timeline_manifest_sha256':m.sha256(timeline_path), 'timeline_files':hashes,
            'other_images':ambient.image_state(other)}, texture, mixes[0]


def all_ids(bpy):
    """IDs plus embedded trees, like the existing residual-driver admission."""
    seen=set()
    def emit(item):
        pointer=item.as_pointer()
        if pointer in seen:return
        seen.add(pointer);yield item
        tree=getattr(item,'node_tree',None)
        if tree is not None:yield from emit(tree)
    for prop in bpy.data.bl_rna.properties:
        if prop.type == 'COLLECTION':
            for item in getattr(bpy.data,prop.identifier):yield from emit(item)


def channel_state(item, permitted=None):
    permitted = permitted or {}
    curves=[]
    for c in ambient.curves_for(item):
        cutoff=permitted.get(c.data_path)
        if cutoff == 'all':continue
        points=[{'co':list(k.co),'left':list(k.handle_left),'right':list(k.handle_right),
                 'left_type':k.handle_left_type,'right_type':k.handle_right_type,
                 'interpolation':k.interpolation,'easing':k.easing,'type':k.type,
                 'amplitude':k.amplitude,'back':k.back,'period':k.period}
                for k in c.keyframe_points if cutoff is None or k.co.x <= cutoff]
        if points:curves.append({'path':c.data_path,'index':c.array_index,'keys':points,
                                 'extrapolation':c.extrapolation,
                                 'modifiers':[(mod.type,mod.mute) for mod in c.modifiers]})
    animation=getattr(item,'animation_data',None)
    return {'curves':curves,'nla':len(animation.nla_tracks) if animation else 0}


def channel_snapshot(bpy, exceptions):
    return {item.bl_rna.identifier+':'+item.name:channel_state(item,exceptions.get(item.name))
            for item in all_ids(bpy) if hasattr(item,'animation_data')}


def compare_channels(bpy, baseline, exceptions):
    current=channel_snapshot(bpy,exceptions)
    for name, expected in baseline.items():
        if ambient.digest(current.get(name,{'curves':[],'nla':0})) != ambient.digest(expected):
            raise ValueError('inherited animation changed outside owned channels: '+name)


def continuous_collection_instances(scene, graph, evidence):
    """The viewport depsgraph also emits render-hidden curve self-meshes.

    Preserve the frozen-scene validator for its original visible-only domain.
    For story frames, prove every hidden self-mesh too, never discard unknown
    entries or alter scene visibility merely to make the audit pass.
    """
    curves={o.as_pointer():o for o in scene.objects if o.type == 'CURVE'}
    if not any(o.hide_render for o in curves.values()):
        yield from refined.collection_instances(scene,graph,evidence)
        return
    represented={};raw=collection_count=0
    for item in graph.object_instances:
        if not item.is_instance:
            yield item;continue
        raw+=1;obj=item.object;parent=item.parent
        if obj.type != 'MESH' or parent is None or parent.type != 'CURVE':
            collection_count+=1;yield item;continue
        original=parent.original;pointer=original.as_pointer();source=curves.get(pointer)
        if (source is None or original.type != 'CURVE' or obj.original.type != 'CURVE'
                or obj.original.as_pointer() != pointer):
            raise ValueError('unknown story curve self-mesh identity')
        if source.name in represented:raise ValueError('duplicate story curve self-mesh')
        if (not item.show_self or item.show_particles
                or tuple(item.persistent_id) != (0,)+(2147483647,)*7):
            raise ValueError('unexpected story curve self-mesh identity/visibility')
        for candidate in (source,parent,obj):
            if (candidate.hide_render != source.hide_render or candidate.instance_type != 'NONE'
                    or candidate.instance_collection is not None
                    or any(mod.show_render and mod.type in {'PARTICLE_SYSTEM','NODES'} for mod in candidate.modifiers)):
                raise ValueError('unsupported story curve self-mesh visibility/instancer')
        if not source.data.splines or any(s.type != 'BEZIER' for s in source.data.splines):
            raise ValueError('expected source Bezier self-mesh')
        evaluated=source.evaluated_get(graph);matrix=ambient.matrix_rows(item.matrix_world)
        for candidate in (matrix,ambient.matrix_rows(parent.matrix_world),ambient.matrix_rows(evaluated.matrix_world)):
            refined.finite_matrix(candidate)
            if candidate != matrix:raise ValueError('story curve self-mesh matrix mismatch')
        surface=refined.curve_surface(obj,graph)
        if surface != refined.curve_surface(parent,graph) or surface != refined.curve_surface(evaluated,graph):
            raise ValueError('story curve self-mesh surface mismatch')
        rendering=refined.curve_object_render(obj)
        if rendering != refined.curve_object_render(parent) or rendering != refined.curve_object_render(evaluated):
            raise ValueError('story curve self-mesh render flags mismatch')
        represented[source.name]={'source_hide_render':source.hide_render,'matrix':matrix,
                                  'surface':surface,'object_render':rendering}
    if set(represented) != {o.name for o in curves.values()}:
        raise ValueError('missing story curve self-mesh coverage')
    evidence.update(raw_generated_count=raw,collection_count=collection_count,
                    curve_self_mesh_count=len(represented),curve_self_meshes=represented)


def instance_proof(bpy, scene):
    evidence={};graph=bpy.context.evaluated_depsgraph_get()
    state=ambient.instance_state(graph,continuous_collection_instances(scene,graph,evidence))
    if state['count'] != 11226:raise ValueError('11226 collection instances required')
    return state


def source_frame_state(bpy, scene, source_names, front_names, frame, subject):
    """Actual evaluated geometry outside the narrowly owned motion channels."""
    set_frame(scene,frame)
    graph=bpy.context.evaluated_depsgraph_get()
    geometry=refined.geometry_state(scene,graph)
    excluded=set(m.LEAVES)|set(m.TREADS)|{m.HOUSE}
    result={}
    for name,row in geometry.items():
        if name not in source_names or name in excluded:continue
        row=dict(row)
        # Seam shading alone is owned: keep exact geometry/UV fingerprint.
        if name in m.refined.BELT_NAMES:
            row['mesh']={k:v for k,v in row['mesh'].items() if k != 'materials'}
        if name in front_names and subject == 'story' and frame > 660:
            row.pop('matrix',None)
        result[name]=row
    # Window hide keys remove source rows only after physical minimization.
    if subject == 'story' and frame >= m.MINIMIZE_END+1:
        result={n:r for n,r in result.items() if n not in front_names}
    objects={}
    for name in source_names:
        if name in excluded:continue
        obj=bpy.data.objects[name]
        matrix=ambient.matrix_rows(obj.evaluated_get(graph).matrix_world)
        refined.finite_matrix(matrix)
        row={'parent':obj.parent.name if obj.parent else None,
             'hidden':obj.hide_render,'viewport':obj.hide_viewport,
             'matrix':matrix}
        if name in front_names and subject == 'story' and frame > 660:
            row.pop('matrix');row.pop('hidden')
        objects[name]=row
    return {'geometry_sha256':ambient.digest(result),'objects_sha256':ambient.digest(objects),
            'camera':ambient.camera_state(scene.camera),'lights':ambient.lighting_state(scene),
            'world':ambient.tree_state(scene.world.node_tree) if scene.world else None,
            'color':ambient.color_state(scene),'instances':instance_proof(bpy,scene)}


def convert_leaf_curves(bpy, scene):
    names=list(m.LEAF_CURVES)
    if any(bpy.data.objects[n].type != 'CURVE' for n in names):raise ValueError('18 source leaf curves required')
    admission=leaf_animation_admission([bpy.data.objects[n] for n in m.LEAVES])
    before=refined.geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    for obj in bpy.context.selected_objects:obj.select_set(False)
    for name in names:bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active=bpy.data.objects[names[0]]
    bpy.ops.object.convert(target='MESH',keep_original=False)
    after=refined.geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    if ambient.digest(before) != ambient.digest(after):raise ValueError('leaf curve conversion altered appearance')
    if bpy.data.objects['SS lamp upright'].type != 'CURVE':raise ValueError('lamp curve changed')
    if admission != leaf_animation_admission([bpy.data.objects[n] for n in m.LEAVES]):
        raise ValueError('leaf conversion changed inherited visibility channels')
    return {'converted':names,'evaluated_before_sha256':ambient.digest(before),
            'evaluated_after_sha256':ambient.digest(after),'animation_admission':admission}


def leaf_animation_admission(objects):
    rows={}
    for obj in objects:
        animation=obj.animation_data
        if (any(c.data_path != 'hide_render' for c in ambient.curves_for(obj))
                or animation and (animation.drivers or animation.nla_tracks)):
            raise ValueError('unsupported source leaf object animation: '+obj.name)
        data_animation=obj.data.animation_data
        if (ambient.curves_for(obj.data) or data_animation and
                (data_animation.action or data_animation.drivers or data_animation.nla_tracks)):
            raise ValueError('animated source leaf data cannot be converted: '+obj.name)
        rows[obj.name]=channel_state(obj)
    return rows


def freeze_idle(bpy, scene, anchor):
    """Only the separate idle derivative: hold evaluated values, keep ancestry."""
    set_frame(scene,anchor)
    original,texture,mix=sequence_state(bpy)
    graph=bpy.context.evaluated_depsgraph_get()
    if any(o.constraints for o in scene.objects):
        raise ValueError('idle source constraints require explicit native baking')
    before=refined.geometry_state(scene,graph)
    for item in list(all_ids(bpy)):
        if hasattr(item,'animation_data_clear'):item.animation_data_clear()
    # Current RNA values already hold the evaluated pose. Reassigning world
    # matrices decomposes/recomposes them and introduces float32 drift.
    bpy.context.view_layer.update()
    after=refined.geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    if before.keys() != after.keys():raise ValueError('idle freeze changed visible object set')
    for name in before:
        if ambient.digest(before[name]['mesh']) != ambient.digest(after[name]['mesh']):
            raise ValueError('idle freeze changed evaluated geometry/material: '+name)
        ambient.assert_near(before[name]['matrix'],after[name]['matrix'])
    # Both authorized endpoints hold villa156. Only this one admitted image is
    # made static; other images and the original sequence stay untouched on disk.
    if m.villa_frame(anchor) != 156:raise ValueError('idle endpoint no longer holds villa156')
    texture.image.source='FILE'
    texture.image_user.frame_start=1;texture.image_user.frame_duration=1
    texture.image_user.frame_offset=0;texture.image_user.use_cyclic=False
    texture.image_user.use_auto_refresh=False
    scene.timeline_markers.clear()
    return {'anchor':anchor,'hierarchy_retained':True,'source_sequence':original,
            'evaluated_before_sha256':ambient.digest(before),'evaluated_after_sha256':ambient.digest(after)}


def authored_frames(subject):
    return tuple(range(228,806)) if subject == 'story' else tuple(range(0,len(m.output_frames(subject))+3))


def motion_handles(item, derivative, paths):
    """Only authored motion channels, never inherited visibility keys."""
    curves=[c for c in ambient.curves_for(item) if c.data_path in paths]
    if not curves:raise ValueError('owned motion channels missing')
    for curve in curves:
        for point in curve.keyframe_points:
            frame,value=point.co;slope=derivative(curve.data_path,curve.array_index,frame)
            point.interpolation='BEZIER';point.handle_left_type=point.handle_right_type='FREE'
            point.handle_left=(frame-1/3,value-slope/3)
            point.handle_right=(frame+1/3,value+slope/3)
        curve.extrapolation='LINEAR'


def animate_motion(bpy, subject, fan):
    from mathutils import Vector
    frames=authored_frames(subject)
    for i,name in enumerate(m.TREADS):
        obj=bpy.data.objects[name]
        for frame in frames:
            x,y,a=m.oval_pose(i,m.global_frame(subject,frame))
            obj.location=(600+x,y,.624);obj.rotation_mode='XYZ';obj.rotation_euler=(0,0,a)
            obj.keyframe_insert('location',frame=frame);obj.keyframe_insert('rotation_euler',frame=frame)
        def derivative(path,index,frame):
            dx,dy,da=m.oval_velocity(i,m.global_frame(subject,frame))
            return (dx,dy,0.)[index] if path == 'location' else (da if index == 2 else 0.)
        motion_handles(obj,derivative,{'location','rotation_euler'})
    # Proven seam node constructor, retimed onto the same absolute scene clock.
    ownership=refined.add_belts(bpy,list(m.refined.BELT_NAMES))
    for name in m.refined.BELT_NAMES:
        tree=bpy.data.objects[name].data.materials[0].node_tree
        tree.animation_data_clear();phase=tree.nodes['Refined belt travel'].outputs[0]
        for frame in frames:
            phase.default_value=m.seam_phase(m.global_frame(subject,frame))
            phase.keyframe_insert('default_value',frame=frame)
        ambient.analytic_handles(tree,lambda path,index,f:m.seam_velocity(m.global_frame(subject,f)))
        refined.extend_action(tree,periodic=False)
    bases={}
    for name in m.LEAVES:
        obj=bpy.data.objects[name];index=int(name.rsplit(' ',1)[1])-1
        if obj.data.shape_keys:raise ValueError('unexpected existing leaf shape keys')
        world=obj.matrix_world.copy();inverse=world.inverted().to_3x3()
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        surface=evaluated.to_mesh()
        try:
            bases[name]={'raw':[list(v.co) for v in obj.data.vertices],
                         'evaluated':[list(v.co) for v in surface.vertices],
                         'source_mesh':ambient.mesh_state(obj.data),
                         'modifiers':leaf_modifiers(obj)}
        finally:evaluated.to_mesh_clear()
        obj.shape_key_add(name='CM original evaluated basis')
        for mode in range(2):
            shape=obj.shape_key_add(name=f'CM leaf mode {mode}');shape.slider_min=-1;shape.slider_max=2
            for vertex,base in zip(shape.data,bases[name]['raw']):
                vertex.co=Vector(base)+inverse@Vector(m.refined.leaf_modes(world@Vector(base),index)[mode])
            for frame in frames:
                shape.value=m.leaf_coefficients(m.global_frame(subject,frame))[mode]
                shape.keyframe_insert('value',frame=frame)
        def derivative(path,index,frame):
            mode=int(path.split('CM leaf mode ')[1].split('"')[0])
            return m.leaf_coefficient_velocity(m.global_frame(subject,frame))[mode]
        ambient.analytic_handles(obj.data.shape_keys,derivative)
        # Story has extra samples at the boundaries; idles also use real padding
        # keys, avoiding a clamp or a discontinuous unwrapped rotation seam.
    for name,path,index,function,velocity in (
            (fan['head'],'rotation_euler',2,m.fan_head,m.fan_head_velocity),
            (fan['rotor'],'rotation_euler',1,m.fan_rotor,m.fan_rotor_velocity)):
        obj=bpy.data.objects[name]
        for frame in frames:
            obj.rotation_euler[index]=function(m.global_frame(subject,frame))
            obj.keyframe_insert(path,index=index,frame=frame)
        motion_handles(obj,lambda p,i,f:velocity(m.global_frame(subject,f)),{'rotation_euler'})
    return bases,ownership


def constructors(bpy, collection):
    """Small native mesh constructors, only for the explicitly new props."""
    def link(name, vertices=None, faces=None, parent=None, location=(0,0,0), material=None):
        if name in bpy.data.objects:raise ValueError('new owned name already exists: '+name)
        data=None
        if vertices is not None:
            data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
            if material:data.materials.append(material)
        obj=bpy.data.objects.new(name,data);collection.objects.link(obj)
        obj.parent=parent;obj.location=location
        return obj
    def box(name,location,size,material,parent):
        vertices=[(x*size[0]/2,y*size[1]/2,z*size[2]/2) for x,y,z in
                  ((-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1))]
        return link(name,vertices,[(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)],parent,location,material)
    return link,box


def leaf_modifiers(obj):
    result=[]
    for mod in obj.modifiers:
        if mod.type != 'SOLIDIFY':raise ValueError('unexpected source leaf modifier')
        result.append({'name':mod.name,'type':mod.type,'viewport':mod.show_viewport,'render':mod.show_render,
                       'thickness':mod.thickness,'offset':mod.offset,'even':mod.use_even_offset,
                       'quality_normals':mod.use_quality_normals,'material_offset':mod.material_offset,
                       'material_offset_rim':mod.material_offset_rim})
    return result


def add_fan(bpy, collection):
    link,box=constructors(bpy,collection)
    material=bpy.data.materials.new('CM fan neutral warm grey');material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(.24,.25,.23,1)
    shader.inputs['Metallic'].default_value=.28;shader.inputs['Roughness'].default_value=.42
    root=link('CM compact desk fan',location=m.FAN_ORIGIN)
    box('CM fan weighted base',(0,0,.015),(.15,.115,.03),material,root)
    box('CM fan stem',(0,.012,.125),(.018,.022,.20),material,root)
    head=link('CM fan oscillating head',parent=root,location=(0,0,.25))
    rotor=link('CM fan continuous rotor',parent=head)
    def ring(name,radius,wire,y):
        vertices=[];faces=[]
        for i in range(64):
            angle=math.tau*i/64
            for j in range(6):
                a=math.tau*j/6;r=radius+wire*math.cos(a)
                vertices.append((r*math.cos(angle),y+wire*math.sin(a),r*math.sin(angle)))
        for i in range(64):
            for j in range(6):faces.append((i*6+(j+1)%6,((i+1)%64)*6+(j+1)%6,((i+1)%64)*6+j,i*6+j))
        link(name,vertices,faces,head,material=material)
    for j,y in enumerate((-.022,.022)):
        ring(f'CM fan outer cage {j}',.085,.0025,y)
        ring(f'CM fan inner cage {j}',.060,.0015,y)
        for i in range(8):
            spoke=box(f'CM fan cage spoke {j}-{i}',(0,y,0),(.002,.002,.169),material,head)
            spoke.rotation_euler.y=math.pi*i/8
    hub_vertices=[(.014*math.cos(math.tau*i/32),y,.014*math.sin(math.tau*i/32))
                  for y in (-.018,.018) for i in range(32)]
    hub_faces=[tuple(range(32)),tuple(range(63,31,-1))]
    hub_faces.extend((i,i+32,(i+1)%32+32,(i+1)%32) for i in range(32))
    link('CM fan hub',hub_vertices,hub_faces,rotor,(0,-.008,0),material)
    for i in range(3):
        blade=link(f'CM fan blade {i}',[(.012,-.002,0),(.062,-.002,-.024),(.076,-.002,.005),(.028,-.002,.024)],
                   [(0,1,2,3)],rotor,material=material)
        blade.rotation_euler.y=math.tau*i/3
        solid=blade.modifiers.new('CM fan blade thickness','SOLIDIFY');solid.thickness=.002
    return {'root':root.name,'head':head.name,'rotor':rotor.name,
            'objects':[o.name for o in descendants(root)]}


def exact_visibility(item, expected):
    curves=[c for c in ambient.curves_for(item) if c.data_path == 'hide_render']
    if len(curves) != 1:raise ValueError('exact visibility channel missing')
    curve=curves[0]
    keys=[list(p.co) for p in curve.keyframe_points]
    if (curve.array_index != 0 or keys != expected or curve.extrapolation != 'CONSTANT'
            or curve.modifiers or any(p.interpolation != 'CONSTANT' for p in curve.keyframe_points)):
        raise ValueError('exact visibility keys/interpolation/extrapolation differ')
    return {'keys':keys,'extrapolation':curve.extrapolation,'interpolation':'CONSTANT'}


def fan_visibility_keys(subject, source_keys):
    if source_keys != [list(k) for k in m.DESK_VISIBILITY]:raise ValueError('source desk visibility differs')
    if subject == 'story':return source_keys
    if subject not in m.SUBJECTS:raise ValueError('unknown fan subject')
    anchor=m.global_frame(subject,1)
    hidden=next(value for frame,value in reversed(source_keys) if frame <= anchor)
    return [[1,hidden]]


def animate_fan_visibility(bpy, fan, subject, source_keys):
    expected=fan_visibility_keys(subject,source_keys)
    for name in fan['objects']:
        obj=bpy.data.objects[name]
        for frame,hidden in expected:
            obj.hide_render=bool(hidden);key(obj,'hide_render',frame,True)
        exact_visibility(obj,expected)


def house_relative_identity(matrix):
    refined.finite_matrix(matrix)
    if any(abs(value-(1 if i == j else 0)) > 1e-6
           for i,row in enumerate(matrix) for j,value in enumerate(row)):
        raise ValueError('source house relative to front B is not identity')
    return matrix


def house_depth(front, house, screen):
    if (not all(math.isfinite(v) for pair in (front,house,screen) for v in pair)
            or any(lo > hi for lo,hi in (front,house,screen))
            or not (front[1]+.005 < house[0] and house[1] < screen[0]-.01)):
        raise ValueError('actual rear villa depth cannot fit between front B and monitor')


def add_windows(bpy, scene, subject):
    from mathutils import Vector
    front=bpy.data.objects[m.FRONT];house=bpy.data.objects[m.HOUSE]
    front_names=[o.name for o in descendants(front) if o != house]
    yellow=[o for o in descendants(front) if o.type == 'MESH'
            and any(s.material and s.material.name == 'SS native minimize' for s in o.material_slots)]
    if len(yellow) != 1:raise ValueError('unique minimize material under B required')
    if (front.matrix_world.inverted()@yellow[0].matrix_world.translation-Vector(m.YELLOW_LOCAL)).length > 2e-4:
        raise ValueError('yellow contact coordinates differ')
    sequence,texture,mix=sequence_state(bpy,static=subject != 'story')
    # Admit depth against the actual front/document and monitor source planes.
    graph=bpy.context.evaluated_depsgraph_get()
    def y_bounds(obj):
        evaluated=obj.evaluated_get(graph)
        return [min((evaluated.matrix_world@Vector(p)).y for p in evaluated.bound_box),
                max((evaluated.matrix_world@Vector(p)).y for p in evaluated.bound_box)]
    source_house_y=y_bounds(house)
    source_relative=house_relative_identity(ambient.matrix_rows(front.matrix_world.inverted()@house.matrix_world))
    documents=[o for o in descendants(front) if o.name == 'SS document surface B']
    screens=[o for o in scene.objects if o.name == 'SS monitor 1 screen']
    if len(documents) != 1 or len(screens) != 1:raise ValueError('actual front/screen planes missing')
    front_y=y_bounds(documents[0]);screen_y=y_bounds(screens[0])
    house_depth(front_y,[y+m.REAR_GAP for y in source_house_y],screen_y)
    link,box=constructors(bpy,front.users_collection[0])
    rear=link(m.REAR);rear.matrix_world=front.matrix_world.copy();rear.location.y+=m.REAR_GAP
    content=link(m.REAR_CONTENT,parent=rear)
    frame_mat=bpy.data.materials['SS native window silver edge']
    title_mat=bpy.data.materials['SS native window titlebar']
    for i,x in enumerate((-.614,.614)):box(f'CM rear vertical rail {i}',(x,.045,0),(.028,.03,.856),frame_mat,rear)
    for i,z in enumerate((-.414,.414)):box(f'CM rear horizontal rail {i}',(0,.045,z),(1.20,.03,.028),frame_mat,rear)
    box('CM rear titlebar',(0,.038,.355),(1.17,.006,.09),title_mat,content)
    # Preserve local villa geometry, UVs, shader, image ID and its actual clock.
    house.parent=content;house.matrix_parent_inverse.identity()
    house.location=(0,0,0);house.rotation_euler=(0,0,0);house.scale=(1,1,1)
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    actual_house_y=y_bounds(house)
    house_depth(front_y,actual_house_y,screen_y)
    tree=house.data.materials[0].node_tree
    fade=mix.inputs[0].path_from_id('default_value')
    removed=[]
    for curve in list(ambient.curves_for(tree)):
        if curve.data_path != fade:raise ValueError('unexpected villa material action outside obsolete fade')
        removed.append(curve.data_path)
        # The only tree action was the obsolete photo fade; clear this ID alone.
    if removed:tree.animation_data_clear()
    mix.inputs[0].default_value=1
    house.animation_data_clear()  # Only its old hide_render reveal action.
    rear_objects=descendants(rear)
    for obj in rear_objects:
        for frame,hidden in ((1,True),(660,True),(661,False)) if subject == 'story' else ((1,True),):
            obj.hide_render=hidden;key(obj,'hide_render',frame,True)
    cursor=link('CM native arrow cursor',m.CURSOR_VERTICES,[m.CURSOR_FACE],front)
    ink=bpy.data.materials.new('CM cursor ivory');ink.use_nodes=True
    shader=ink.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.93,.92,.86,1)
    cursor.data.materials.append(ink)
    outline=cursor.modifiers.new('CM cursor dark outline','SOLIDIFY');outline.thickness=.001
    if subject == 'story':
        initial_location=front.location.copy();initial_scale=front.scale.copy()
        for frame in range(661,805):
            delta,scale=m.front_transform(frame)
            front.location=initial_location+Vector(delta)
            front.scale=tuple(a*b for a,b in zip(initial_scale,scale))
            key(front,'location',frame);key(front,'scale',frame)
            tip=m.cursor_tip(frame);cursor.location=(tip[0],tip[1]+.017,tip[2])
            cursor.scale=(m.cursor_scale(frame),)*3
            key(cursor,'location',frame);key(cursor,'scale',frame)
        for obj in [bpy.data.objects[n] for n in front_names]:
            for frame,hidden in ((661,obj.hide_render),(m.MINIMIZE_END,False),(m.MINIMIZE_END+1,True)):
                obj.hide_render=hidden;key(obj,'hide_render',frame,True)
        for frame,hidden in ((1,True),(664,True),(665,False),(m.MINIMIZE_START,False),(m.MINIMIZE_START+1,True)):
            cursor.hide_render=hidden;key(cursor,'hide_render',frame,True)
    else:cursor.hide_render=True
    return {'front':front.name,'front_descendants':front_names,'yellow':yellow[0].name,
            'rear':rear.name,'rear_content':content.name,'house':house.name,'cursor':cursor.name,
            'new_objects':[o.name for o in descendants(rear) if o != house]+[cursor.name],
            'depth_admission':{'source_house':source_house_y,'source_relative_to_front':source_relative,
                               'actual_rear_house':actual_house_y,'front_document':front_y,'screen':screen_y,'gap':m.REAR_GAP},
            'removed_opacity_channels':removed,'sequence':sequence}


def source_roles(bpy, scene, camera):
    """Check the actual pinned scene, before authoring or timeline freezing."""
    from mathutils import Vector
    if scene.camera != bpy.data.objects['Goal Loop '+camera]:raise ValueError('wrong active original camera')
    if (scene.frame_start,scene.frame_end,scene.render.fps,scene.render.fps_base) != (1,804,24,1):
        raise ValueError('wrong original timeline/fps')
    if any(name not in scene.objects for name in (*m.TREADS,*m.LEAVES,m.FRONT,m.HOUSE)):
        raise ValueError('required original object roles missing')
    set_frame(scene,468)
    actual={o.name for o in scene.objects if o.name.startswith('Lab belt transverse tread')}
    if actual != set(m.TREADS):raise ValueError('need all 72 original oval treads')
    physical_tread=None
    for i,name in enumerate(m.TREADS):
        obj=bpy.data.objects[name];x,y,a=m.goal.track(m.goal.LENGTH*i/72)
        if obj.parent or obj.constraints or obj.type != 'MESH':raise ValueError('unexpected tread hierarchy/type')
        ambient.assert_near(list(obj.location),(600+x,y,.624),1e-4)
        ambient.assert_near(list(obj.dimensions),(.012,.89,.008),1e-4)
        if abs(math.remainder(obj.rotation_euler.z-a,math.tau)) > 1e-4:raise ValueError('source tread tangent differs')
        payload={'mesh':ambient.mesh_state(obj.data),'scale':list(obj.scale)}
        if physical_tread is None:physical_tread=payload
        elif ambient.digest(payload) != ambient.digest(physical_tread):
            raise ValueError('treads not physically interchangeable for permutation closure')
        for material in obj.data.materials:ambient.reject_tread_object_shading(material.node_tree)
    # Read the proven identity guard's caller and implementation before reuse:
    # its plant branch also validates the physical delivery piece and joiner.
    set_frame(scene,660)
    refined.validate_identity(bpy,scene,'plant',camera)
    leaf_animation=leaf_animation_admission([bpy.data.objects[n] for n in m.LEAVES])
    desk_visibility=exact_visibility(bpy.data.objects[m.FAN_DESK],[list(k) for k in m.DESK_VISIBILITY])
    front=bpy.data.objects[m.FRONT];house=bpy.data.objects[m.HOUSE]
    if house.parent != bpy.data.objects['SS window B content reveal'] or house.parent.parent != front:
        raise ValueError('genuine house original ancestry differs')
    if len(house.data.vertices) != 4:raise ValueError('genuine villa is not the existing quad')
    for vertex,expected in zip(house.data.vertices,m.playground.quad_local_vertices()):
        ambient.assert_near(list(vertex.co),expected,1e-6)
    ambient.assert_near([list(uv.uv) for uv in house.data.uv_layers[0].data],m.playground.QUAD_UV,1e-6)
    yellow=[o for o in descendants(front) if o.type == 'MESH' and
            any(s.material and s.material.name == 'SS native minimize' for s in o.material_slots)]
    if len(yellow) != 1:raise ValueError('yellow B control not uniquely identified by ancestry/material')
    ambient.assert_near(list(yellow[0].matrix_world.translation),(595.925,5.971,2.985),2e-4)
    sequence,texture,mix=sequence_state(bpy)
    hidden_channels={c.data_path for c in ambient.curves_for(house)}
    if hidden_channels != {'hide_render'}:raise ValueError('unexpected inherited villa object action')
    return {'source_names':sorted(o.name for o in scene.objects),
            'front_names':sorted(o.name for o in descendants(front) if o != house),
            'yellow':yellow[0].name,'house_mesh':ambient.mesh_state(house.data),
            'leaf_animation_admission':leaf_animation,'desk_visibility':desk_visibility,
            'front_location':list(front.location),'front_scale':list(front.scale),
            'sequence':sequence,'house_source_image':texture.image.name,
            'source_light_names':sorted(o.name for o in scene.objects if o.type == 'LIGHT')}


def exceptions_for(bpy, roles):
    exceptions={name:{'location':'all','rotation_euler':'all'} for name in m.TREADS}
    for name in roles['front_names']:exceptions[name]={'hide_render':660}
    exceptions[m.FRONT].update(location=660,scale=660)
    exceptions[m.HOUSE]={'hide_render':'all'}
    tree=bpy.data.objects[m.HOUSE].data.materials[0].node_tree
    mix=next(n for n in tree.nodes if n.type == 'MIX_SHADER')
    exceptions[tree.name]={mix.inputs[0].path_from_id('default_value'):'all'}
    return exceptions


def probe_frames(subject):
    if subject == 'story':
        return (1,169,228,229,350,467.75,468,468.25,469,469.75,470,576,659.75,660,660.25,
                661,684,687,694,706,718,719,731.75,732,744,756,780,804,804.25)
    count=len(m.output_frames(subject))
    return (.75,*range(1,count+2),count+1.25)


def geometry_payload(bpy, roles):
    """Unchanged source mesh/UV/material payload, excluding only explicit edits."""
    owned=set(m.LEAVES)|set(m.refined.BELT_NAMES)|{m.HOUSE}
    return {name:ambient.mesh_state(bpy.data.objects[name].data)
            for name in roles['source_names'] if name not in owned and bpy.data.objects[name].type == 'MESH'}


def native_keys(item, expected_frames, value, derivative, paths=None):
    """Real saved F-curves/handles. Missing API/actions fail, never become PASS."""
    curves=[c for c in ambient.curves_for(item) if paths is None or c.data_path in paths]
    if not curves:raise ValueError('native motion action missing: '+item.name)
    result=[]
    for curve in curves:
        points=curve.keyframe_points
        if [round(p.co.x,6) for p in points] != list(expected_frames):
            raise ValueError('native motion key range differs: '+item.name+'/'+curve.data_path)
        for point in points:
            f,v=point.co;expected=value(curve.data_path,curve.array_index,f)
            if not all(math.isfinite(x) for x in (*point.co,*point.handle_left,*point.handle_right)):
                raise ValueError('non-finite native key/handle')
            ambient.assert_near(v,expected,2e-4)
            slope=derivative(curve.data_path,curve.array_index,f)
            left=(v-point.handle_left.y)/(f-point.handle_left.x)
            right=(point.handle_right.y-v)/(point.handle_right.x-f)
            ambient.assert_near((left,right),(slope,slope),.002)
        result.append({'path':curve.data_path,'index':curve.array_index,'key_count':len(points),
                       'first':list(points[0].co),'last':list(points[-1].co)})
    return result


def require_channels(rows, channels):
    if {(r['path'],r['index']) for r in rows} != set(channels):raise ValueError('native motion channel set differs')


def check_keys(bpy, subject, fan):
    frames=authored_frames(subject);clock=lambda f:m.global_frame(subject,f)
    rows={}
    for i,name in enumerate(m.TREADS):
        def value(path,index,f):
            x,y,a=m.oval_pose(i,clock(f))
            return (600+x,y,.624)[index] if path == 'location' else (0.,0.,a)[index]
        def velocity(path,index,f):
            x,y,a=m.oval_velocity(i,clock(f))
            return (x,y,0.)[index] if path == 'location' else (0.,0.,a)[index]
        rows[name]=native_keys(bpy.data.objects[name],frames,value,velocity,paths={'location','rotation_euler'})
        require_channels(rows[name],((p,i) for p in ('location','rotation_euler') for i in range(3)))
    for name in m.LEAVES:
        def mode(path):return int(path.split('CM leaf mode ')[1].split('"')[0])
        rows[name]=native_keys(bpy.data.objects[name].data.shape_keys,frames,
            lambda path,i,f:m.leaf_coefficients(clock(f))[mode(path)],
            lambda path,i,f:m.leaf_coefficient_velocity(clock(f))[mode(path)])
        require_channels(rows[name],((f'key_blocks["CM leaf mode {i}"].value',0) for i in range(2)))
    for name in m.refined.BELT_NAMES:
        rows[name]=native_keys(bpy.data.objects[name].data.materials[0].node_tree,frames,
            lambda path,i,f:m.seam_phase(clock(f)),lambda path,i,f:m.seam_velocity(clock(f)))
        tree=bpy.data.objects[name].data.materials[0].node_tree
        require_channels(rows[name],[(tree.nodes['Refined belt travel'].outputs[0].path_from_id('default_value'),0)])
    for name,function,velocity in ((fan['head'],m.fan_head,m.fan_head_velocity),
                                    (fan['rotor'],m.fan_rotor,m.fan_rotor_velocity)):
        rows[name]=native_keys(bpy.data.objects[name],frames,
            lambda path,i,f:function(clock(f)),lambda path,i,f:velocity(clock(f)),paths={'rotation_euler'})
        require_channels(rows[name],[('rotation_euler',2 if name == fan['head'] else 1)])
    return rows


def check_window_keys(bpy, subject, roles, windows):
    if subject != 'story':return {'storyboard':'only story derivative; rear and cursor hidden in separate idle'}
    rows={}
    def sampled(item,path,expected):
        found=[]
        for curve in ambient.curves_for(item):
            if curve.data_path != path:continue
            points=[p for p in curve.keyframe_points if p.co.x >= 661]
            if [p.co.x for p in points] != list(range(661,805)):raise ValueError('window/cursor native key range differs')
            for p in points:
                if p.interpolation != 'LINEAR' or not math.isfinite(p.co.y):raise ValueError('window/cursor keys not finite linear samples')
                ambient.assert_near(p.co.y,expected(p.co.x,curve.array_index),2e-4)
            found.append(curve.array_index)
        if set(found) != {0,1,2}:raise ValueError('whole window/cursor vector channels missing')
        rows[item.name+'/'+path]={'indices':found,'first':661,'last':804,'key_count':144}
    front=bpy.data.objects[m.FRONT];cursor=bpy.data.objects[windows['cursor']]
    sampled(front,'location',lambda f,i:roles['front_location'][i]+m.front_transform(f)[0][i])
    sampled(front,'scale',lambda f,i:roles['front_scale'][i]*m.front_transform(f)[1][i])
    sampled(cursor,'location',lambda f,i:m.cursor_tip(f)[i]+(.017 if i == 1 else 0))
    sampled(cursor,'scale',lambda f,i:m.cursor_scale(f))
    for name,expected in (
            *((n,[(661,0),(718,0),(719,1)]) for n in windows['front_descendants']),
            *((n,[(1,1),(660,1),(661,0)]) for n in [*windows['new_objects'][:-1],m.HOUSE]),
            (cursor.name,[(1,1),(664,1),(665,0),(694,0),(695,1)])):
        item=bpy.data.objects[name]
        curves=[c for c in ambient.curves_for(item) if c.data_path == 'hide_render']
        if len(curves) != 1:raise ValueError('window/cursor visibility action missing')
        for frame,value in expected:
            points=[p for p in curves[0].keyframe_points if p.co.x == frame]
            if len(points) != 1 or points[0].co.y != value or points[0].interpolation != 'CONSTANT':
                raise ValueError('native click/minimize/rear visibility timing differs')
        rows[name+'/hide_render']=expected
    return rows


def check_fan_visibility(bpy, scene, subject, roles, fan):
    expected=fan_visibility_keys(subject,roles['desk_visibility']['keys'])
    keys={name:exact_visibility(bpy.data.objects[name],expected) for name in fan['objects']}
    desk=bpy.data.objects[m.FAN_DESK]
    if subject == 'story':exact_visibility(desk,roles['desk_visibility']['keys'])
    elif ambient.curves_for(desk):raise ValueError('frozen support desk still animated')
    samples=[]
    for frame in probe_frames(subject):
        set_frame(scene,frame);graph=bpy.context.evaluated_depsgraph_get()
        hidden=bool(next(value for f,value in reversed(expected) if f <= max(frame,1)))
        if desk.evaluated_get(graph).hide_render != hidden:raise ValueError('support desk lifetime differs')
        states={name:bpy.data.objects[name].evaluated_get(graph).hide_render for name in fan['objects']}
        if any(value != hidden for value in states.values()):raise ValueError('fan lifetime differs from actual support desk')
        samples.append({'frame':frame,'desk_hidden':hidden,'fan_hidden':states})
    return {'source':roles['desk_visibility'],'keys':keys,'evaluated_samples':samples,
            'belt_idle':'all fan objects render-hidden; no 48-frame head closure claim' if subject == 'belt-idle' else None}


def fan_curve_closure(head, rotor):
    def curve(item,index):
        found=[c for c in ambient.curves_for(item) if c.data_path == 'rotation_euler' and c.array_index == index]
        if len(found) != 1:raise ValueError('native fan rotation channel missing')
        return found[0]
    head_curve=curve(head,2);rotor_curve=curve(rotor,1)
    def velocity(c,f):return (c.evaluate(f+.01)-c.evaluate(f-.01))/.02
    rows=[]
    for frame in (.75,1,1.25):
        end=frame+96
        hv=[head_curve.evaluate(f) for f in (frame,end)]
        hd=[velocity(head_curve,f) for f in (frame,end)]
        rv=[rotor_curve.evaluate(f) for f in (frame,end)]
        rd=[velocity(rotor_curve,f) for f in (frame,end)]
        turns=(rv[1]-rv[0])/math.tau
        ambient.assert_near(hv[0],hv[1],2e-5);ambient.assert_near(hd[0],hd[1],2e-4)
        ambient.assert_near(turns,4,2e-5);ambient.assert_near(rd[0],rd[1],.002)
        if not all(math.isfinite(x) for x in (*hv,*hd,*rv,*rd)):raise ValueError('non-finite fan closure')
        rows.append({'frames':[frame,end],'head':hv,'head_velocity':hd,
                     'rotor':rv,'rotor_velocity':rd,'rotor_turns':turns})
    return {'period':96,'rotor_turns':rows[1]['rotor_turns'],'saved_fcurve_samples':rows,
            'velocity_measurement':'central difference of actual FCurve.evaluate, epsilon .01 frame'}


def native_fan_closure(bpy, scene, subject, fan):
    if subject != 'office-idle':
        return {'status':'render-hidden belt idle' if subject == 'belt-idle' else 'story is not a loop'}
    head=bpy.data.objects[fan['head']];rotor=bpy.data.objects[fan['rotor']]
    proof=fan_curve_closure(head,rotor)
    rows=[]
    for frame in (.99,1,1.01,96.99,97,97.01):
        set_frame(scene,frame);graph=bpy.context.evaluated_depsgraph_get()
        rows.append([head.evaluated_get(graph).rotation_euler.z,rotor.evaluated_get(graph).rotation_euler.y])
    ambient.assert_near(rows[1][0],rows[4][0],2e-5)
    ambient.assert_near((rows[4][1]-rows[1][1])/math.tau,4,2e-5)
    velocities=[[(rows[i+2][axis]-rows[i][axis])/.02 for axis in (0,1)] for i in (0,3)]
    ambient.assert_near(velocities[0],velocities[1],.002)
    proof.update(evaluated_rotations=rows,evaluated_velocities=velocities)
    return proof


def camera_ray(scene, graph, target):
    origin=scene.camera.matrix_world.translation;direction=target-origin
    hit=scene.ray_cast(graph,origin,direction.normalized(),distance=direction.length+.001)
    obj=hit[4] if hit[0] else None
    return {'hit':obj.name if obj else None,'hit_hide_render':obj.hide_render if obj else None,
            'hit_visible_camera':obj.visible_camera if obj else None,
            'target_distance':direction.length,'hit_distance':(hit[1]-origin).length if obj else None}


def cursor_visibility_guard(tip, body, boundary, interior, name):
    # Screen Y is explicitly down, unlike world_to_camera_view's Y.
    if not (0 <= tip[0] <= 1 and 0 <= tip[1] <= 1 and tip[2] > 0
            and 0 <= body[0] <= 1 and 0 <= body[1] <= 1 and body[2] > 0
            and body[0] > tip[0] and body[1] > tip[1]):
        raise ValueError('native cursor body is not screen-right and below its visible tip')
    for ray,required in ((boundary,False),(interior,True)):
        if ray['hit'] is None and not required:continue
        if (ray['hit'] != name or ray['hit_hide_render'] is not False
                or ray['hit_visible_camera'] is not True):
            raise ValueError('cursor ray encounters missing/hidden cursor or real/unknown occluder')


def native_cursor_evidence(bpy, scene, graph, cursor, yellow):
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    evaluated=cursor.evaluated_get(graph)
    # Keep the original exact tip-vertex diagnostic, before Solidify's rim.
    tip=evaluated.matrix_world@cursor.data.vertices[0].co
    body=evaluated.matrix_world@cursor.data.vertices[6].co
    interior=evaluated.matrix_world@Vector(m.CURSOR_INTERIOR)
    button=yellow.evaluated_get(graph).matrix_world.translation
    def screen(point):
        p=world_to_camera_view(scene,scene.camera,point)
        return [p.x,1-p.y,p.z]
    tip_projection=screen(tip);body_projection=screen(body)
    boundary_ray=camera_ray(scene,graph,tip);interior_ray=camera_ray(scene,graph,interior)
    cursor_visibility_guard(tip_projection,body_projection,boundary_ray,interior_ray,cursor.name)
    origin=scene.camera.matrix_world.translation
    if (evaluated.hide_render or not evaluated.visible_camera
            or (tip-origin).length >= (button-origin).length):
        raise ValueError('native cursor is hidden or behind actual yellow button')
    return {'camera':scene.camera.name,'tip_projection_screen_y_down':tip_projection,
            'body_projection_screen_y_down':body_projection,'button_projection_screen_y_down':screen(button),
            'body_screen_delta':[body_projection[i]-tip_projection[i] for i in (0,1)],
            'boundary_tip_ray':boundary_ray,'mirrored_interior_ray':interior_ray,
            'boundary_ray_note':'zero-area vertex ray may return NONE; unavailable as intersection proof',
            'tip_distance':(tip-origin).length,'button_distance':(button-origin).length,
            'cursor_hide_render':evaluated.hide_render,'cursor_visible_camera':evaluated.visible_camera,
            'pixel_acceptance':'PENDING focused review and actual cursor contrast/click control pixels'}


def native_motion(bpy, scene, subject, roles, fan, windows, bases):
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    result=[];field_error=pin_error=0.;positions={}
    frames=probe_frames(subject)
    # Motion only starts at the story's admitted endpoint. Earlier source
    # geometry/camera checks remain separate from the new C/D/E motion field.
    for frame in (f for f in frames if subject != 'story' or f >= 228):
        set_frame(scene,frame);graph=bpy.context.evaluated_depsgraph_get()
        g=m.global_frame(subject,frame);row={'frame':frame,'global_frame':g}
        tread_positions=[]
        for i,name in enumerate(m.TREADS):
            obj=bpy.data.objects[name].evaluated_get(graph);x,y,a=m.oval_pose(i,g)
            ambient.assert_near(list(obj.matrix_world.translation),(600+x,y,.624),2e-4)
            if abs(math.remainder(obj.rotation_euler.z-a,math.tau)) > .002:
                raise ValueError('evaluated tread tangent does not follow track')
            tread_positions.append(list(obj.matrix_world.translation))
        positions[frame]=tread_positions
        for name in m.refined.BELT_NAMES:
            tree=bpy.data.objects[name].data.materials[0].node_tree
            phase=tree.nodes['Refined belt travel'].outputs[0].default_value
            ambient.assert_near(phase,m.seam_phase(g),2e-5)
        for name in m.LEAVES:
            obj=bpy.data.objects[name];index=int(name.rsplit(' ',1)[1])-1
            # Native evaluated skin, including the blade's original thickness.
            # Keep the native vertex correspondence captured before authoring;
            # do not substitute an analytical reconstruction for evaluation.
            evaluated=obj.evaluated_get(graph)
            shape=obj.data.shape_keys
            if shape is None:raise ValueError('evaluated leaf keys unavailable')
            weights=[shape.key_blocks[f'CM leaf mode {i}'].value for i in range(2)]
            ambient.assert_near(weights,m.leaf_coefficients(g),2e-5)
            mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
            try:
                if len(mesh.vertices) != len(bases[name]['evaluated']):raise ValueError('leaf skin topology differs')
                for vertex,base in zip(mesh.vertices,bases[name]['evaluated']):
                    original=evaluated.matrix_world@Vector(base)
                    actual=evaluated.matrix_world@vertex.co-original
                    error=math.dist(actual,m.leaf_delta(original,index,g));field_error=max(field_error,error)
                    # The primary native blade surface and both converted tube
                    # skins follow the exact field. Solidify's second layer
                    # also changes normals, bounded within the retained 2mm
                    # thickness; it has a separate conservative 1mm check.
                    primary=vertex.index < len(bases[name]['raw'])
                    tolerance=2e-4 if primary else .001
                    if error > tolerance:raise ValueError('native leaf world/local field differs')
                    if original.z <= m.refined.PLANT_ROOT[2]+.012:
                        pin_error=max(pin_error,actual.length)
                        if actual.length > 1e-6:raise ValueError('leaf attachment cross-section moved')
            finally:evaluated.to_mesh_clear()
        head=bpy.data.objects[fan['head']].evaluated_get(graph)
        rotor=bpy.data.objects[fan['rotor']].evaluated_get(graph)
        ambient.assert_near(head.rotation_euler.z,m.fan_head(g),2e-5)
        ambient.assert_near(rotor.rotation_euler.y,m.fan_rotor(g),2e-5)
        bounds=[]
        for name in fan['objects']:
            obj=bpy.data.objects[name].evaluated_get(graph)
            if obj.type != 'MESH':continue
            bounds.extend(obj.matrix_world@Vector(p) for p in obj.bound_box)
        for p in bounds:
            if not (abs(p.x-m.FAN_ORIGIN[0]) <= .1001 and abs(p.y-m.FAN_ORIGIN[1]) <= .0801
                    and -.0001 <= p.z-m.FAN_ORIGIN[2] <= .3501):
                raise ValueError('actual oscillating fan exceeds admitted back-desk bounds')
        if g == 660:
            projection=[world_to_camera_view(scene,scene.camera,p) for p in bounds]
            if any(p.z <= 0 or not (0 <= p.x <= 1 and 0 <= p.y <= 1) for p in projection):
                raise ValueError('actual fan does not fit endpoint camera')
            row['fan_frustum_xy']=[min(p.x for p in projection),max(p.x for p in projection),
                                   min(p.y for p in projection),max(p.y for p in projection)]
        row['fan_head']=head.rotation_euler.z;row['fan_rotor']=rotor.rotation_euler.y
        if subject == 'story' and frame >= 661:
            front=bpy.data.objects[m.FRONT].evaluated_get(graph)
            delta,scale=m.front_transform(frame)
            ambient.assert_near(list(front.location),[a+b for a,b in zip(roles['front_location'],delta)],2e-4)
            ambient.assert_near(list(front.scale),[a*b for a,b in zip(roles['front_scale'],scale)],2e-5)
            if front.hide_render != m.front_hidden(frame):raise ValueError('front disappears before completed minimization')
            for name in windows['front_descendants']:
                obj=bpy.data.objects[name]
                if obj.hide_render != m.front_hidden(frame):raise ValueError('incomplete front ancestry visibility')
            rear=bpy.data.objects[m.REAR];house=bpy.data.objects[m.HOUSE]
            window_hierarchy(bpy.data.objects[m.FRONT],rear,house,bpy.data.objects[windows['cursor']],windows['front_descendants'])
            if house.hide_render or rear.hide_render:raise ValueError('rear window not revealed during E')
            if frame in (m.CURSOR_CONTACT,m.CURSOR_PRESS):
                cursor=bpy.data.objects[windows['cursor']]
                yellow=bpy.data.objects[windows['yellow']]
                contact=front.matrix_world.inverted()@cursor.matrix_world.translation
                button=front.matrix_world.inverted()@yellow.matrix_world.translation
                if cursor.hide_render or math.hypot(contact.x-button.x,contact.z-button.z) > 2e-4:
                    raise ValueError('native cursor does not contact actual yellow button')
                ambient.assert_near(list(cursor.scale),(m.cursor_scale(frame),)*3,2e-5)
                row['cursor_contact_world']=list(cursor.matrix_world.translation)
                row['cursor_visibility']=native_cursor_evidence(bpy,scene,graph,cursor,yellow)
            if frame in (684,732):
                centre=house.matrix_world@(sum((v.co for v in house.data.vertices),Vector())/4)
                origin=scene.camera.matrix_world.translation;direction=centre-origin
                hit=scene.ray_cast(graph,origin,direction.normalized(),distance=direction.length+.001)
                name=hit[4].name if hit[0] else None
                if frame == 684 and name not in windows['front_descendants']:
                    raise ValueError('rear is not occluded by front B before minimize: '+str(name))
                if frame == 732 and name != house.name:
                    raise ValueError('native rear house remains occluded after minimize: '+str(name))
                p=world_to_camera_view(scene,scene.camera,centre)
                row['rear_center_ray_hit']=name;row['rear_center_projection']=list(p)
        result.append(row)
    # A one-pitch loop matches the physical multiset, with different tread IDs.
    if subject != 'story':
        end=len(m.output_frames(subject))+1;shift=len(m.output_frames(subject))//48
        for i,p in enumerate(positions[end]):ambient.assert_near(p,positions[1][(i+shift)%72],2e-4)
        for f in (.75,1,13,25):
            a=m.global_frame(subject,f);b=a+len(m.output_frames(subject))
            ambient.assert_near(m.leaf_coefficient_velocity(a),m.leaf_coefficient_velocity(b),1e-10)
    return {'evaluated_samples':result,'max_leaf_field_error_m':field_error,'max_attachment_error_m':pin_error,
            'native_keys':check_keys(bpy,subject,fan),
            'fan_visibility':check_fan_visibility(bpy,scene,subject,roles,fan),
            'fan_native_closure':native_fan_closure(bpy,scene,subject,fan),
            'native_window_keys':check_window_keys(bpy,subject,roles,windows),
            'timers':'UNAVAILABLE global enumeration; no absence claim',
            'pixel_acceptance':'PENDING parent control renders: fan salience/occlusion, rear framing, house pixels'}


def _verify_prepared(path, manifest_path):
    """Fresh native reload, read only. No writes or render invocation."""
    import bpy
    path=Path(path).resolve(strict=True);manifest_path=Path(manifest_path).resolve(strict=True)
    if path.name != 'continuous-motion.blend' or manifest_path != path.with_name('native-manifest.json'):
        raise ValueError('expected paired fresh derivative and native manifest')
    receipt=json.loads(manifest_path.read_text());m.load_approval()
    if (receipt['render_status'] != 'prepared_pending_render' or receipt['rendered_frames'] != []
            or receipt['worker_render_cap'] != 0 or receipt['approval_sha256'] != m.APPROVAL_SHA256):
        raise ValueError('not an approved zero-render preparation')
    original=m.validate_source(receipt['source'],receipt['camera'])
    if (Path(receipt['derivative']).resolve() != path or receipt['approval'] != str(m.APPROVAL)
            or receipt['limits'] != m.LIMITS or receipt['spent_counters'] != m.SPENT
            or receipt['declared_frames'] != list(m.output_frames(receipt['subject']))
            or receipt['declared_frame_count'] != len(m.output_frames(receipt['subject']))
            or receipt['size'] != list(m.dimensions(receipt['subject'],receipt['camera']))
            or receipt['authority_files'] != m.AUTHORITY_FILES
            or receipt['source_manifest_sha256'] != m.SOURCE_MANIFEST_SHA256[receipt['camera']]):
        raise ValueError('manifest source/output/authority/frame declaration differs')
    if receipt['author_sources'] != author_sources() or m.sha256(path) != receipt['derivative_sha256']:
        raise ValueError('author code or derivative bytes changed')
    if receipt['source_sha256'] != m.sha256(original):raise ValueError('source immutable guard failed')
    refined.no_runtime(bpy)
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    refined.no_runtime(bpy);refined.no_drivers(bpy)
    if runtime_state(bpy) != receipt['runtime_admission']:raise ValueError('factory callback admission differs on reload')
    scene=bpy.context.scene;subject=receipt['subject'];camera=receipt['camera']
    if subject not in m.SUBJECTS or camera not in m.CAMERAS:raise ValueError('invalid saved subject/camera')
    if (scene.get('continuous_source_sha256'),scene.get('continuous_subject'),scene.get('continuous_approval_sha256')) != (
            receipt['source_sha256'],subject,m.APPROVAL_SHA256):raise ValueError('native binding metadata differs')
    if scene.camera.name != 'Goal Loop '+camera:raise ValueError('saved camera differs')
    expected_range=(1,804) if subject == 'story' else (1,len(m.output_frames(subject)))
    if (scene.frame_start,scene.frame_end) != expected_range:raise ValueError('saved timeline differs')
    if (scene.render.fps,scene.render.fps_base,scene.cycles.samples) != (24,1,32):raise ValueError('saved fps/samples differ')
    if (scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage) != (*m.dimensions(subject,camera),100):
        raise ValueError('saved dimensions differ')
    if any(mod.show_render or mod.show_viewport for o in scene.objects for mod in o.modifiers if mod.type == 'CLOTH'):
        raise ValueError('inherited cloth woke on reload')
    actual=evaluate_prepared(bpy,scene,receipt)
    if ambient.digest(actual) != ambient.digest(receipt['native_checks']):raise ValueError('fresh reload native evidence differs')
    m.validate_source(original,camera);m.load_approval();refined.no_runtime(bpy);refined.no_drivers(bpy)
    return {'status':'native_reload_verified_pending_pixels','camera':camera,'subject':subject,
            'rendered_frames':[],'native_checks_sha256':ambient.digest(actual),
            'visual_acceptance':'PENDING parent controls/review; this is not a completion verdict'}


def verify_prepared(path, manifest_path):
    """Always recheck the original on exit, including a failed reload check."""
    receipt=json.loads(Path(manifest_path).read_text())
    original=m.validate_source(receipt['source'],receipt['camera'])
    try:return _verify_prepared(path,manifest_path)
    finally:m.validate_source(original,receipt['camera'])


def evaluate_prepared(bpy,scene,receipt):
    subject=receipt['subject'];roles=receipt['roles']
    if sorted(o.name for o in scene.objects if o.type == 'LIGHT') != roles['source_light_names']:
        raise ValueError('source lights changed')
    expected_names=set(roles['source_names'])|set(receipt['fan']['objects'])|set(receipt['windows']['new_objects'])
    if set(o.name for o in scene.objects) != expected_names:raise ValueError('unowned object addition/removal')
    if subject == 'story':compare_channels(bpy,receipt['inherited_channels'],receipt['channel_exceptions'])
    set_frame(scene,660 if subject == 'story' else 1)
    if ambient.digest(geometry_payload(bpy,roles)) != receipt['source_payload_sha256']:
        raise ValueError('unrelated source mesh/UV/material payload differs')
    for name,base in receipt['leaf_bases'].items():
        obj=bpy.data.objects[name]
        if (ambient.digest(ambient.mesh_state(obj.data)) != ambient.digest(base['source_mesh'])
                or leaf_modifiers(obj) != base['modifiers']):raise ValueError('source leaf UV/material/modifier changed')
    # Check the genuine villa mesh/UV exactly, ignoring only the explicitly
    # authorized obsolete fade value in its retained material node tree.
    current=ambient.mesh_state(bpy.data.objects[m.HOUSE].data)
    if {k:v for k,v in current.items() if k != 'materials'} != {k:v for k,v in roles['house_mesh'].items() if k != 'materials'}:
        raise ValueError('existing villa topology/UV changed')
    sequence,texture,mix=sequence_state(bpy,static=subject != 'story')
    if ambient.digest(sequence) != ambient.digest(receipt['prepared_sequence']):raise ValueError('saved sequence/source images differ')
    if mix.inputs[0].default_value != 1 or ambient.curves_for(bpy.data.objects[m.HOUSE].data.materials[0].node_tree):
        raise ValueError('obsolete photo fade survived')
    static=[]
    for row in receipt['outside_scope_baseline']:
        frame=row['frame'];actual=source_frame_state(bpy,scene,roles['source_names'],roles['front_names'],frame,subject)
        if ambient.digest(actual) != ambient.digest(row['state']):
            raise ValueError('native outside-scope parity failed at '+str(frame))
        static.append({'frame':frame,'state_sha256':ambient.digest(actual)})
    return {'outside_scope':static,'sequence_sha256':ambient.digest(sequence),
            'motion':native_motion(bpy,scene,subject,roles,receipt['fan'],receipt['windows'],receipt['leaf_bases'])}


def prepare(args):
    m.load_approval();source=m.validate_source(args.source,args.camera)
    out=m.validate_output(args.out)
    source_signature=m.sha256(source);authors=author_sources()
    import bpy
    refined.no_runtime(bpy)
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    refined.no_runtime(bpy);refined.no_drivers(bpy)
    scene=bpy.context.scene
    if scene.rigidbody_world and scene.rigidbody_world.enabled:
        raise ValueError('live source rigid-body simulation; parent must resolve admission, not silently repair physics')
    disabled=[]
    # Match the proven non-simulating source audit before any timeline access.
    for obj in bpy.data.objects:
        for mod in obj.modifiers:
            if mod.type == 'CLOTH':
                disabled.append([obj.name,mod.name,mod.show_viewport,mod.show_render])
                mod.show_viewport=mod.show_render=False
    roles=source_roles(bpy,scene,args.camera)
    exceptions=exceptions_for(bpy,roles)
    channels=channel_snapshot(bpy,exceptions)
    source_inputs=roles['sequence']['timeline_files']
    m.validate_output(out,source_inputs)
    # Capture source static proof BEFORE any owned geometry or material change.
    anchor=660 if args.subject in ('story','office-idle') else 468
    set_frame(scene,anchor)
    payload=ambient.digest(geometry_payload(bpy,roles))
    baseline=[]
    baseline_frames=(1,169,228,229,350,468,469,576,660,661,684,694,718,719,732,744,780,804) if args.subject == 'story' else (anchor,)
    for frame in baseline_frames:
        state=source_frame_state(bpy,scene,roles['source_names'],roles['front_names'],frame,args.subject)
        baseline.append({'frame':frame,'state':state})
    set_frame(scene,anchor)
    conversion=convert_leaf_curves(bpy,scene)
    freeze=None
    if args.subject != 'story':
        freeze=freeze_idle(bpy,scene,anchor)
        # Freeze parity above establishes the endpoint; later loop samples all
        # compare to this same source state with unchanged ancestry.
        baseline=[{'frame':frame,'state':baseline[0]['state']} for frame in (1,len(m.output_frames(args.subject))+1)]
    set_frame(scene,660 if args.subject == 'story' else 1)
    fan=add_fan(bpy,bpy.data.objects[m.FRONT].users_collection[0])
    animate_fan_visibility(bpy,fan,args.subject,roles['desk_visibility']['keys'])
    windows=add_windows(bpy,scene,args.subject)
    set_frame(scene,660 if args.subject == 'story' else 1)
    bases,ownership=animate_motion(bpy,args.subject,fan)
    scene.frame_start=1;scene.frame_end=804 if args.subject == 'story' else len(m.output_frames(args.subject))
    scene.render.fps=24;scene.render.fps_base=1
    scene.render.resolution_x,scene.render.resolution_y=m.dimensions(args.subject,args.camera)
    scene.render.resolution_percentage=100;scene.cycles.samples=32
    set_frame(scene,660 if args.subject == 'story' else 1)
    prepared_sequence,texture,mix=sequence_state(bpy,static=args.subject != 'story')
    receipt={'schema':'continuous-motion-v1','subject':args.subject,'camera':args.camera,
        'source':str(source),'source_sha256':source_signature,'author_sources':authors,
        'approval':str(m.APPROVAL),'approval_sha256':m.APPROVAL_SHA256,'limits':m.LIMITS,'spent_counters':m.SPENT,
        'spent_counter_scope':'immutable worker-admission snapshot; parent ledger retains later use; no reservation/reset',
        'authority_files':m.AUTHORITY_FILES,'source_manifest_sha256':m.SOURCE_MANIFEST_SHA256[args.camera],
        'runtime_admission':runtime_state(bpy),
        'worker_render_cap':0,'render_status':'prepared_pending_render','rendered_frames':[],
        'declared_frames':list(m.output_frames(args.subject)),
        'declared_frame_count':len(m.output_frames(args.subject)),
        'closure_frame':None if args.subject == 'story' else len(m.output_frames(args.subject))+1,
        'size':list(m.dimensions(args.subject,args.camera)),'fps':24,'samples':32,
        'roles':roles,'fan':fan,'windows':windows,'leaf_bases':bases,
        'inherited_channels':channels,'channel_exceptions':exceptions,
        'source_payload_sha256':payload,'outside_scope_baseline':baseline,
        'leaf_curve_conversion':conversion,'idle_freeze':freeze,'belt_material_ownership':ownership,
        'prepared_sequence':prepared_sequence,'disabled_inherited_cloth':disabled,
        'owned_changes':{'oval':'72 tread location/tangent only, positive unwrapped track phase',
          'straight_belts':'private +Y seam shader phase','plant':'27 assembly shape keys; 18 owned curve conversions',
          'fan':'new base/stem/cage/hub/3 blades; head96f and rotor24f',
          'front':'B root location/scale 694..718; whole ancestry hidden719',
          'rear':'independent root/frame/content; same house mesh/image/UV, obsolete opacity fade removed'},
        'storyboard':{'cursor_visible':665,'yellow_contact':m.CURSOR_CONTACT,'click_press':m.CURSOR_PRESS,
          'minimize':[m.MINIMIZE_START,m.MINIMIZE_END],'front_hidden':719,'rear_visible':661,
          'inherited_camera_arrival':732,'villa_hold':[660,743],'villa_finish':[744,780],'end':804},
        'native_checks':None,'visual_acceptance':'PENDING parent native reload, sparse controls, pixels and review'}
    receipt['native_checks']=evaluate_prepared(bpy,scene,receipt)
    refined.no_runtime(bpy);refined.no_drivers(bpy)
    m.validate_source(source,args.camera);m.load_approval()
    if author_sources() != authors:raise ValueError('author code changed during preparation')
    # Freshness is checked again immediately before the only output writes.
    m.validate_output(out,source_inputs)
    scene['continuous_source_sha256']=source_signature;scene['continuous_subject']=args.subject
    scene['continuous_approval_sha256']=m.APPROVAL_SHA256
    set_frame(scene,660 if args.subject == 'story' else 1)
    out.mkdir(parents=True,exist_ok=False)
    derivative=out/'continuous-motion.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(derivative))
    m.validate_source(source,args.camera)
    receipt['derivative']=str(derivative);receipt['derivative_sha256']=m.sha256(derivative)
    (out/'native-manifest.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({'derivative':str(derivative),'manifest':str(out/'native-manifest.json'),
                      'render_status':receipt['render_status'],'rendered_frames':[]}))


def main():
    args=m.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.verify_prepared:
        print(json.dumps(verify_prepared(args.verify_prepared,args.manifest)));return
    original=m.validate_source(args.source,args.camera)
    try:prepare(args)
    finally:m.validate_source(original,args.camera)


if __name__ == '__main__':
    main()
