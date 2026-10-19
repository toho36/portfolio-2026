"""PARENT ONLY; worker must never execute this module with bpy.

Blender --background --factory-startup --disable-autoexec --python THIS --
--preview-motion --subject gameon|goal-loop --camera desktop|mobile
--inputs /approved/inputs.json --out /ABSENT/output [--prepare-only]

Prepare first, inspect native-manifest.json projections BEFORE any render. The
parent may freshly reload ambient-preview.blend and render ONLY frames 1..48
once, verifying stored settings/source hashes and recording each actual frame
in rendered[]. A non-prepare invocation also reloads its saved derivative and
checks native persistence before rendering. Frame 49 is evaluation only. There
is no resume, final, frame-count, resolution or sample override.
Device selection (process-local METAL) belongs to the parent operator.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import ambient_holds as h


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def matrix_rows(matrix):return [list(row) for row in matrix]


def assert_near(a,b,tolerance=1e-5):
    if isinstance(a,(tuple,list)):
        if len(a)!=len(b):raise ValueError('native array length changed')
        for x,y in zip(a,b):assert_near(x,y,tolerance)
    elif abs(a-b)>tolerance:raise ValueError(f'native value changed: {a} / {b}')


def tree_state(tree,seen=None):
    if tree is None:return None
    seen=set() if seen is None else seen
    if tree.as_pointer() in seen:return 'shared tree'
    seen.add(tree.as_pointer())
    nodes=[]
    for node in tree.nodes:
        sockets=[]
        for socket in node.inputs:
            if not hasattr(socket,'default_value'):continue
            value=socket.default_value
            if not isinstance(value,(int,float,str,bool)):
                try:value=list(value)
                except TypeError:value=str(value)
            sockets.append((socket.identifier,value))
        image=getattr(node,'image',None)
        nodes.append({'name':node.name,'type':node.bl_idname,'inputs':sockets,
                      'image':image.name if image else None,
                      'group':tree_state(getattr(node,'node_tree',None),seen)})
    return {'nodes':nodes,'links':[(x.from_node.name,x.from_socket.identifier,x.to_node.name,x.to_socket.identifier) for x in tree.links]}


def material_state(material):
    if material is None:return None
    return {'name':material.name,'diffuse':list(material.diffuse_color),
            'tree':tree_state(material.node_tree)}


def mesh_state(mesh):
    sha=hashlib.sha256()
    for v in mesh.vertices:sha.update(struct.pack('<3f',*v.co))
    for p in mesh.polygons:
        sha.update(struct.pack('<II?',len(p.vertices),p.material_index,p.use_smooth))
        for i in p.vertices:sha.update(struct.pack('<I',i))
    for layer in mesh.uv_layers:
        sha.update(layer.name.encode())
        for uv in layer.data:sha.update(struct.pack('<2f',*uv.uv))
    return {'geometry_uv':sha.hexdigest(),'vertices':len(mesh.vertices),
            'materials':[material_state(m) for m in mesh.materials]}


def visible_mesh_state(scene,graph):
    result={}
    for obj in scene.objects:
        if obj.hide_render:continue
        if getattr(obj,'instance_type','NONE')!='NONE':
            if obj.type=='EMPTY' and obj.instance_type=='COLLECTION' and getattr(obj,'instance_collection',None):continue
            raise ValueError('unsupported visible instancer: '+obj.name)
        if obj.type in {'CURVE','SURFACE','FONT','META','CURVES','POINTCLOUD','VOLUME','GPENCIL','GREASEPENCIL'}:
            raise ValueError('unsupported visible geometry: '+obj.name)
        if any(m.show_render and m.type in {'PARTICLE_SYSTEM','NODES'} for m in obj.modifiers):
            raise ValueError('unsupported visible instances: '+obj.name)
        if obj.type!='MESH' or obj.hide_render:continue
        evaluated=obj.evaluated_get(graph)
        mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
        try:result[obj.name]={'matrix':matrix_rows(evaluated.matrix_world),'mesh':mesh_state(mesh)}
        finally:evaluated.to_mesh_clear()
    return result


def instance_state(graph,object_instances=None):
    prototypes={};instances={};parents={}
    for item in graph.object_instances if object_instances is None else object_instances:
        if not item.is_instance:continue
        obj=item.object;parent=item.parent
        if obj.type!='MESH' or not parent or parent.instance_type!='COLLECTION' or not parent.instance_collection:
            raise ValueError('unsupported generated instance')
        if any(m.show_render and m.type in {'PARTICLE_SYSTEM','NODES'} for m in obj.modifiers):
            raise ValueError('unsupported instanced procedural geometry')
        name=obj.original.name
        if name not in prototypes:
            mesh=obj.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
            try:
                attributes=[]
                for attribute in mesh.attributes:
                    values=[]
                    for datum in attribute.data:
                        prop=next((p for p in ('value','vector','color','uv','matrix') if hasattr(datum,p)),None)
                        if prop is None:raise ValueError('unsupported mesh attribute: '+attribute.name)
                        value=getattr(datum,prop)
                        values.append(value if isinstance(value,(str,int,float,bool)) else list(value))
                    attributes.append((attribute.name,attribute.data_type,attribute.domain,values))
                geometry=mesh_state(mesh)
                render_attributes={'generic':attributes,'corner_normals':[list(n.vector) for n in mesh.corner_normals]}
            finally:obj.to_mesh_clear()
            prototypes[name]={'mesh':geometry,'render_attributes':digest(render_attributes),
                'color':list(obj.color),'pass_index':obj.pass_index,
                'parent':obj.parent.original.name if obj.parent else None,
                'collections':sorted(c.name for c in obj.original.users_collection),
                'slots':[(s.link,material_state(s.material)) for s in obj.material_slots],
                'visibility':{n:getattr(obj,n) for n in ('hide_render','visible_camera','visible_diffuse','visible_glossy','visible_transmission','visible_shadow')}}
        key=digest((parent.original.name,name,list(item.persistent_id)))
        if key in instances:raise ValueError('duplicate generated-instance identity')
        instances[key]={'matrix':matrix_rows(item.matrix_world),'prototype':name,'random_id':item.random_id}
        parents[parent.original.name]={'collection':parent.instance_collection.name,'color':list(parent.color),
            'pass_index':parent.pass_index,'members':sorted(o.name for o in parent.instance_collection.all_objects)}
    return {'count':len(instances),'instances_sha256':digest(instances),
            'prototypes_sha256':digest(prototypes),'parents_sha256':digest(parents)}


def curves_for(item):
    from bpy_extras.anim_utils import action_get_channelbag_for_slot
    animation=item.animation_data
    if not animation or not animation.action:return []
    if hasattr(animation.action,'fcurves'):return animation.action.fcurves
    bag=action_get_channelbag_for_slot(animation.action,animation.action_slot)
    return bag.fcurves if bag else []


def analytic_handles(item,derivative):
    for curve in curves_for(item):
        for key in curve.keyframe_points:
            frame,value=key.co
            slope=derivative(curve.data_path,curve.array_index,frame)
            key.interpolation='BEZIER'
            key.handle_left_type=key.handle_right_type='FREE'
            key.handle_left=(frame-1/3,value-slope/3)
            key.handle_right=(frame+1/3,value+slope/3)


def animation_state(item):
    animation=getattr(item,'animation_data',None)
    if animation is None:return None
    curves=[{'path':curve.data_path,'index':curve.array_index,
             'keys':[(list(k.co),list(k.handle_left),list(k.handle_right),k.interpolation) for k in curve.keyframe_points]}
            for curve in curves_for(item)]
    return {'action':animation.action.name if animation.action else None,'curves_sha256':digest(curves),
            'curves':len(curves),'drivers':len(animation.drivers),'nla_tracks':len(animation.nla_tracks)}


def native_key_evidence(item,derivative):
    """Check saved handle derivatives, including both sides of the loop seam."""
    rows=[]
    for curve in curves_for(item):
        keys=curve.keyframe_points
        if [round(k.co.x) for k in keys]!=list(range(1,50)):raise ValueError('native key frame budget differs')
        endpoints=[]
        for key in (keys[0],keys[-1]):
            expected=derivative(curve.data_path,curve.array_index,key.co.x)
            left=(key.co.y-key.handle_left.y)/(key.co.x-key.handle_left.x)
            right=(key.handle_right.y-key.co.y)/(key.handle_right.x-key.co.x)
            assert_near((left,right),(expected,expected),3e-4)
            endpoints.append({'frame':key.co.x,'value':key.co.y,'left_velocity':left,'right_velocity':right,'analytic':expected})
        rows.append({'path':curve.data_path,'index':curve.array_index,'endpoints':endpoints})
    if not rows:raise ValueError('native action missing')
    return rows


def lighting_state(scene):
    return {o.name:{'matrix':matrix_rows(o.matrix_world),'color':list(o.data.color),
                    'energy':o.data.energy,'type':o.data.type,'hidden':o.hide_render,
                    'tree':tree_state(o.data.node_tree)} for o in scene.objects if o.type=='LIGHT'}


def image_state(bpy):
    result={}
    for image in bpy.data.images:
        if image.source in {'SEQUENCE','MOVIE'}:raise ValueError('temporal source texture: '+image.name)
        if image.source!='FILE':continue
        packed=image.packed_file
        if packed:
            result[image.name]={'packed_sha256':hashlib.sha256(bytes(packed.data)).hexdigest()}
        else:
            path=Path(bpy.path.abspath(image.filepath,library=image.library)).resolve()
            if not path.is_file():raise ValueError('missing source image: '+image.name)
            result[image.name]={'path':str(path),'sha256':h.sha256(path)}
    return result


def freeze(bpy,scene):
    """Bake evaluated geometry, hierarchy and shader values BEFORE changing time."""
    graph=bpy.context.evaluated_depsgraph_get()
    matrices={o.name:o.evaluated_get(graph).matrix_world.copy() for o in scene.objects}
    meshes={o.name:bpy.data.meshes.new_from_object(o.evaluated_get(graph),preserve_all_data_layers=True,depsgraph=graph)
            for o in scene.objects if o.type=='MESH' and not o.hide_render}
    # Animation data includes actions, NLA and drivers on object/data/shape/shader
    # IDs. frame_set already evaluated their current values at the admitted pose.
    for collection in ('objects','meshes','curves','materials','node_groups','cameras','lights','worlds','shape_keys','scenes','collections'):
        for item in getattr(bpy.data,collection):
            if hasattr(item,'animation_data_clear'):item.animation_data_clear()
            tree=getattr(item,'node_tree',None)
            if tree:tree.animation_data_clear()
    for obj in scene.objects:
        if obj.parent is not None or len(obj.constraints):
            obj.parent=None
            obj.constraints.clear()
            obj.matrix_world=matrices[obj.name]
        if obj.name in meshes:
            obj.data=meshes[obj.name]
            obj.modifiers.clear()
        else:
            # Inherited offscreen cloth never resimulates in this derivative.
            for modifier in obj.modifiers:modifier.show_viewport=modifier.show_render=False
    scene.timeline_markers.clear()
    bpy.context.view_layer.update()


def reject_tread_object_shading(tree,seen=None):
    if tree is None:return
    seen=set() if seen is None else seen
    if tree.as_pointer() in seen:return
    seen.add(tree.as_pointer())
    for node in tree.nodes:
        if node.bl_idname=='ShaderNodeObjectInfo' and any(o.is_linked and o.name in {'Random','Color'} for o in node.outputs):
            raise ValueError('tread shading depends on object identity')
        if node.bl_idname=='ShaderNodeAttribute' and node.attribute_type in {'OBJECT','INSTANCER'}:
            raise ValueError('tread shading depends on object attributes')
        reject_tread_object_shading(getattr(node,'node_tree',None),seen)


def add_cloth(bpy,obj):
    from mathutils import Vector
    mesh=obj.data
    if len(mesh.vertices)!=5130 or not mesh.uv_layers.active or not mesh.materials:
        raise ValueError('cloth base/UV/material missing')
    uvs={}
    for loop in mesh.loops:
        uv=tuple(mesh.uv_layers.active.data[loop.index].uv)
        if loop.vertex_index in uvs:assert_near(uv,uvs[loop.vertex_index])
        uvs[loop.vertex_index]=uv
    if len(uvs)!=5130:raise ValueError('cloth UV coverage changed')
    base=[v.co.copy() for v in mesh.vertices]
    obj.shape_key_add(name='Frozen evaluated 84')
    keys=[obj.shape_key_add(name=f'Ambient mode {i}') for i in range(3)]
    for i,key in enumerate(keys):
        key.slider_min=-1;key.slider_max=2
        for v in mesh.vertices:key.data[v.index].co=base[v.index]+Vector(h.flutter_modes(uvs[v.index])[i])
        for frame in (*h.FRAMES,h.CLOSE_FRAME):
            key.value=h.coefficients(frame)[i];key.keyframe_insert('value',frame=frame)
    analytic_handles(mesh.shape_keys,lambda path,index,f:h.coefficient_velocity(f)[int(path.split('Ambient mode ')[1].split('"')[0])])
    return uvs,base


def add_belt(objects):
    for i,obj in enumerate(objects):
        for frame in (*h.FRAMES,h.CLOSE_FRAME):
            x,y,angle=h.belt_pose(i,frame)
            obj.location=(h.goal.ORIGIN_X+x,y,.624)
            obj.rotation_mode='XYZ';obj.rotation_euler=(0,0,angle)
            obj.keyframe_insert('location',frame=frame);obj.keyframe_insert('rotation_euler',frame=frame)
        def derivative(path,index,frame):
            dx,dy,da=h.belt_velocity(i,frame)
            return (dx,dy,0.)[index] if path=='location' else (da if index==2 else 0.)
        analytic_handles(obj,derivative)


def camera_state(camera):
    data=camera.data
    return {'name':camera.name,'matrix_world':matrix_rows(camera.matrix_world),'lens':data.lens,
            'dof':data.dof.use_dof,'sensor_width':data.sensor_width,'sensor_height':data.sensor_height,
            'sensor_fit':data.sensor_fit,'shift_x':data.shift_x,'shift_y':data.shift_y,
            'clip_start':data.clip_start,'clip_end':data.clip_end,'type':data.type}


def color_state(scene):
    v=scene.view_settings
    return {'view':v.view_transform,'look':v.look,'exposure':v.exposure,'gamma':v.gamma}


def main():
    args=h.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    inputs=h.load_inputs(args.inputs);v=inputs['variants'][args.subject][args.camera]
    source=h.validate_source(v)
    out=h.fresh_output(args.out,h.protected_inputs(inputs,args.inputs))
    import bpy
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    if any(getattr(bpy.app.handlers,n) for n in ('frame_change_pre','frame_change_post','render_pre','render_post')):
        raise ValueError('native handlers present; factory startup required')
    scene=bpy.context.scene
    disabled_cloth=[]
    if scene.rigidbody_world and scene.rigidbody_world.enabled:
        raise ValueError('live rigid-body world is outside this frozen preview')
    # Stop inherited arena physics BEFORE any frame change/depsgraph query. The
    # allowed GameOn mover is the already evaluated private mesh clone, not the
    # old simulated canvas. Neither subject may start or advance a simulation.
    for obj in scene.objects:
        for modifier in obj.modifiers:
            if modifier.type=='CLOTH':
                modifier.show_viewport=modifier.show_render=False
                disabled_cloth.append({'object':obj.name,'modifier':modifier.name})
    scene.frame_set(v['frame'])
    camera=bpy.data.objects[v['camera']['name']]
    assert_near(matrix_rows(camera.matrix_world),v['camera']['matrix_world'])
    assert_near(camera.data.lens,v['camera']['lens'])
    if camera.data.dof.use_dof!=v['camera']['dof'] or color_state(scene)!=v['color']:
        raise ValueError('source camera DOF/color mismatch')
    original_camera=camera_state(camera)
    source_images=image_state(bpy)
    graph=bpy.context.evaluated_depsgraph_get()
    original_instances=instance_state(graph)
    original=visible_mesh_state(scene,graph)
    materials={m.name:material_state(m) for m in bpy.data.materials}
    world=tree_state(scene.world.node_tree) if scene.world else None
    source_lighting=lighting_state(scene)
    if args.subject=='gameon':
        cloth=bpy.data.objects[v['cloth']['name']]
        if any(m.type=='CLOTH' for m in cloth.modifiers):raise ValueError('approved private cloth clone must not simulate')
        assert_near(matrix_rows(cloth.matrix_world),v['cloth']['matrix_world'])
        movers=[cloth]
    else:
        names=[r['name'] for r in v['treads']]
        actual={o.name for o in scene.objects if o.name.startswith('Lab belt transverse tread')}
        if set(names)!=actual or len(names)!=72:raise ValueError('unexpected tread set')
        movers=[bpy.data.objects[name] for name in names]
        for i,(obj,row) in enumerate(zip(movers,v['treads'])):
            if obj.parent is not None:raise ValueError('tread parent changed')
            assert_near(list(obj.location),row['location']);assert_near(list(obj.rotation_euler),row['rotation_euler'])
            assert_near(list(obj.scale),row['scale'])
            x,y,a=h.belt_pose(i,1)
            assert_near(list(obj.location),list(Vector((h.goal.ORIGIN_X+x,y,.624))))
            assert_near(list(obj.rotation_euler),(0,0,a))
        if len({digest(original[o.name]['mesh']) for o in movers})!=1:
            raise ValueError('treads must share identical geometry/material for permutation closure')
        if len({(tuple(o.color),o.pass_index) for o in movers})!=1:
            raise ValueError('tread object shading values differ')
        for material in movers[0].data.materials:
            if material:reject_tread_object_shading(material.node_tree)
    source_animation={o.name:{'object':animation_state(o),'data':animation_state(o.data)} for o in [*movers,camera]}
    source_shapes={}
    for obj in movers:
        keys=getattr(obj.data,'shape_keys',None)
        if keys:
            source_shapes[obj.name]={'animation':animation_state(keys),
                'blocks':[{'name':key.name,'value':key.value,'coordinates_sha256':digest([list(p.co) for p in key.data])} for key in keys.key_blocks]}
    freeze(bpy,scene)
    scene.camera=camera
    frozen=visible_mesh_state(scene,bpy.context.evaluated_depsgraph_get())
    if instance_state(bpy.context.evaluated_depsgraph_get())!=original_instances:
        raise ValueError('freeze changed generated instances')
    if set(original)!=set(frozen):raise ValueError('freeze changed visibility')
    for name in original:
        assert_near(original[name]['matrix'],frozen[name]['matrix'])
        if original[name]['mesh']!=frozen[name]['mesh']:raise ValueError('freeze changed source geometry/material: '+name)
    if {m.name:material_state(m) for m in bpy.data.materials}!=materials:raise ValueError('freeze changed source shaders')
    uvs={};base=[]
    if args.subject=='gameon':
        uvs,base=add_cloth(bpy,cloth)
        key_evidence={cloth.name:native_key_evidence(cloth.data.shape_keys,
            lambda path,index,f:h.coefficient_velocity(f)[int(path.split('Ambient mode ')[1].split('"')[0])])}
    else:
        add_belt(movers)
        key_evidence={}
        for i,obj in enumerate(movers):
            def derivative(path,index,f):
                dx,dy,da=h.belt_velocity(i,f)
                return (dx,dy,0.)[index] if path=='location' else (da if index==2 else 0.)
            key_evidence[obj.name]=native_key_evidence(obj,derivative)
    w,height=h.SIZE[args.camera]
    scene.render.engine='CYCLES';scene.cycles.samples=h.SAMPLES
    scene.cycles.use_adaptive_sampling=False;scene.cycles.use_animated_seed=False
    scene.render.resolution_x=w;scene.render.resolution_y=height;scene.render.resolution_percentage=100
    scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
    scene.render.fps=h.FPS;scene.render.fps_base=1
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
    scene.render.use_file_extension=True
    for setting in ('use_border','use_crop_to_border','use_multiview','use_sequencer','use_compositing','use_motion_blur'):
        setattr(scene.render,setting,False)
    scene.frame_start=1;scene.frame_end=48;scene.frame_step=1
    mover_names={o.name for o in movers}
    static={k:val for k,val in frozen.items() if k not in mover_names}
    samples=[];trajectories={};max_normal=max_vertical=pin_error=0.;clipped=[]
    belt_first=None;cloth_first=None
    for frame in (*h.FRAMES,h.CLOSE_FRAME):
        scene.frame_set(frame);graph=bpy.context.evaluated_depsgraph_get()
        if camera_state(camera)!=original_camera or scene.camera!=camera:raise ValueError('camera changed')
        if color_state(scene)!=v['color']:raise ValueError('color changed')
        if lighting_state(scene)!=source_lighting:raise ValueError('source lighting changed')
        if instance_state(graph)!=original_instances:raise ValueError('sequential generated instances changed')
        for obj in scene.objects:
            if obj.name in mover_names:continue
            if (obj.type=='MESH' and not obj.hide_render)!=(obj.name in static):
                raise ValueError('sequential static visibility changed')
            if obj.name in static and matrix_rows(obj.evaluated_get(graph).matrix_world)!=static[obj.name]['matrix']:
                raise ValueError('sequential static transform changed')
        if frame not in h.SAMPLE_FRAMES:continue
        current=visible_mesh_state(scene,graph)
        if {k:val for k,val in current.items() if k not in mover_names}!=static:
            raise ValueError('frozen story geometry/visibility/material changed')
        if {m.name:material_state(m) for m in bpy.data.materials}!=materials or (tree_state(scene.world.node_tree) if scene.world else None)!=world:
            raise ValueError('frozen shader/world animation woke')
        row={'frame':frame,'static_mesh_hash':digest(static),'camera':camera_state(camera)}
        if args.subject=='gameon':
            evaluated=cloth.evaluated_get(graph);mesh=evaluated.to_mesh()
            try:
                coords=[list(vertex.co) for vertex in mesh.vertices]
                if cloth_first is None:cloth_first=coords
                if frame==49:assert_near(coords,cloth_first,1e-6)
                for i,co in enumerate(coords):
                    world_delta=evaluated.matrix_world@Vector(co)-evaluated.matrix_world@base[i]
                    delta=list(world_delta)
                    max_normal=max(max_normal,abs(delta[1]));max_vertical=max(max_vertical,abs(delta[2]))
                    if uvs[i][1]>=1-1e-6:pin_error=max(pin_error,math.dist(co,base[i]))
                    point=world_to_camera_view(scene,camera,evaluated.matrix_world@mesh.vertices[i].co)
                    if point.z<=0 or not 0<point.x<1 or not 0<point.y<1:clipped.append({'frame':frame,'vertex':i})
                    if uvs[i][1]<.08:
                        trajectories.setdefault(str(i),[]).append([point.x*w,(1-point.y)*height])
                row['cloth_geometry']=current[cloth.name]['mesh']['geometry_uv']
                row['analytic_velocity_max_m_per_frame']=max(math.dist((0,0,0),h.flutter_velocity(uv,frame)) for uv in uvs.values())
            finally:evaluated.to_mesh_clear()
        else:
            poses=[matrix_rows(o.matrix_world) for o in movers]
            if belt_first is None:belt_first=poses
            if frame==49:
                for i,pose in enumerate(poses):assert_near(pose,belt_first[(i+1)%72],1e-4)
            row['tread_matrices']=poses
            row['analytic_velocities']=[h.belt_velocity(i,frame) for i in range(72)]
        samples.append(row)
    projection=None
    if args.subject=='gameon':
        excursions=[max(math.dist(a,b) for a in pts for b in pts) for pts in trajectories.values()]
        projection={'lower_vertex_trajectories_px':trajectories,'min_excursion_px':min(excursions),
                    'max_excursion_px':max(excursions),'mean_excursion_px':sum(excursions)/len(excursions),
                    'required_mean_floor_px':3.,'normal_ceiling_m':.9,'vertical_ceiling_m':.3,
                    'analytic_global_normal_bound_m':.815,'analytic_global_vertical_bound_m':.255,
                    'measured_normal_m':max_normal,'measured_vertical_m':max_vertical,'pinned_top_error_m':pin_error,
                    'clipped_vertices':clipped}
        # Persist failed admission measurements too; never silently tune after rendering.
    admitted=projection is None or (projection['mean_excursion_px']>=3 and max_normal<=.9+1e-6 and max_vertical<=.3+1e-6 and pin_error<1e-6 and not clipped)
    manifest={'status':'native-prepared' if admitted else 'projection-rejected','subject':args.subject,'camera':args.camera,
              'source':str(source),'source_sha256':h.sha256(source),'inputs_sha256':h.sha256(args.inputs),
              'approval_sha256':inputs['approval_sha256'],'budget':h.BUDGET,'frames':list(h.FRAMES),'closure_eval_only':49,
              'rendered':[],'source_pose_frame':v['frame'],'source_camera':original_camera,'color':v['color'],
              'source_visible_meshes':original,'source_material_hash':digest(materials),'source_world_hash':digest(world),
              'source_instances':original_instances,
              'source_lighting':source_lighting,'source_images':source_images,'source_animation':source_animation,
              'source_shape_key_data':source_shapes,'native_key_endpoint_velocities':key_evidence,
              'disabled_inherited_cloth_modifiers':disabled_cloth,
              'sequential_static_frames':list(range(1,50)),
              'samples':samples,'projection':projection,'native_actions':[o.name for o in movers],
              'seam':'cloth C1; belt identical-geometry permutation with analytic tangent velocities',
              'parent_required':'fresh reload, motion/art admission, 4 loops once = 192 frames; actual encoding/browser/review'}
    # Recheck immutable inputs before the first output write.
    h.validate_source(v);h.load_inputs(args.inputs)
    out.mkdir(parents=True,exist_ok=False)
    receipt=out/'native-manifest.json';receipt.write_text(json.dumps(manifest,indent=2))
    if not admitted:raise ValueError('projection motion floor/envelope failed; see native manifest; zero renders')
    scene.frame_set(1)
    scene['ambient_preview_only']=True;scene['ambient_source_sha256']=v['source_sha256']
    scene['ambient_subject']=args.subject;scene['ambient_camera']=args.camera
    scene['ambient_unique_frames']=48;scene['ambient_closure_eval_only']=49
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'ambient-preview.blend'))
    if not args.prepare_only:
        # Exercise persisted native actions, not the in-memory authoring session.
        bpy.ops.wm.open_mainfile(filepath=str(out/'ambient-preview.blend'),load_ui=False,use_scripts=False)
        scene=bpy.context.scene;camera=scene.camera
        if (scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage)!=(w,height,100) or scene.cycles.samples!=8 or scene.cycles.use_animated_seed:
            raise ValueError('reloaded preview settings differ')
        for row in samples:
            scene.frame_set(row['frame'])
            if camera_state(camera)!=original_camera or color_state(scene)!=v['color'] or lighting_state(scene)!=source_lighting:
                raise ValueError('reloaded camera/color/lighting differs')
            current=visible_mesh_state(scene,bpy.context.evaluated_depsgraph_get())
            if {k:val for k,val in current.items() if k not in mover_names}!=static:
                raise ValueError('reloaded static geometry differs')
            if args.subject=='gameon':
                if current[v['cloth']['name']]['mesh']['geometry_uv']!=row['cloth_geometry']:
                    raise ValueError('reloaded native cloth action differs')
            else:
                for obj,expected in zip((bpy.data.objects[name] for name in names),row['tread_matrices']):
                    assert_near(matrix_rows(obj.matrix_world),expected,1e-6)
        if image_state(bpy)!=source_images:raise ValueError('source textures changed')
        h.validate_source(v);h.load_inputs(args.inputs)
        manifest['status']='native-rendering';receipt.write_text(json.dumps(manifest,indent=2))
        for frame in h.FRAMES:
            scene.frame_set(frame)
            if camera_state(camera)!=original_camera:raise ValueError('camera changed before render')
            file=out/f'frame-{frame:04d}.png';scene.render.filepath=str(file)
            bpy.ops.render.render(write_still=True)
            if h.png_size(file)!=(w,height):raise ValueError('render size differs from cap')
            manifest['rendered'].append({'frame':frame,'file':file.name,'sha256':h.sha256(file)})
            receipt.write_text(json.dumps(manifest,indent=2))
        manifest['status']='native-rendered';receipt.write_text(json.dumps(manifest,indent=2))
    h.validate_source(v)
    print(json.dumps({'manifest':str(receipt),'rendered':len(manifest['rendered'])}))


if __name__=='__main__':main()
