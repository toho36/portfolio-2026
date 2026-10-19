"""PARENT ONLY. Import is worker-safe; main/verify_prepared require bpy.

Preparation (each camera and subject separately, always a fresh OUT):
  Blender --background --factory-startup --disable-autoexec --python THIS --
    --prepare-only --subject finished-belt|plant --camera desktop|mobile
    --source PINNED_SOURCE --out OUT
Fresh process verification, with no rendering or output writes:
  Blender --background --factory-startup --disable-autoexec --python THIS --
    --verify-prepared OUT/refined-hold.blend --manifest OUT/native-manifest.json

No renderer, cache bake, encoder, handler or autoexec path. Render settings are
inherited, not a resource approval. Frame49 is closure evaluation only.
"""
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import refined_holds as h
import build_ambient_holds as ambient
import goal_loop as goal
import screen_switch as switch

_factory_handlers=None

def no_runtime(bpy):
    global _factory_handlers
    if not bpy.app.factory_startup or bpy.context.preferences.filepaths.use_scripts_auto_execute:
        raise ValueError('factory startup and disabled autoexec required')
    snapshot={name:tuple(getattr(bpy.app.handlers,name)) for name in dir(bpy.app.handlers)
              if isinstance(getattr(bpy.app.handlers,name),list)}
    active=[name for name,callbacks in snapshot.items() if callbacks and
            name.startswith(('frame_change_','render_','depsgraph_update_','animation_playback_'))]
    if active or any(t.use_module for t in bpy.data.texts):
        raise ValueError('handlers/autoexec text present; use factory startup with autoexec disabled')
    # Blender installs its own load/version/extension callbacks even at factory startup.
    if _factory_handlers is None:_factory_handlers=snapshot
    elif snapshot!=_factory_handlers:raise ValueError('source changed factory lifecycle handlers')
    if bpy.data.libraries:raise ValueError('linked libraries are outside self-contained preparation')


def no_drivers(bpy):
    """Reject residual drivers on all current data IDs and embedded node trees."""
    seen=set()
    def check(item):
        pointer=item.as_pointer()
        if pointer in seen:return
        seen.add(pointer)
        animation=getattr(item,'animation_data',None)
        if animation and animation.drivers:raise ValueError('residual drivers: '+item.name)
        tree=getattr(item,'node_tree',None)
        if tree is not None:check(tree)
        for node in getattr(item,'nodes',()):
            nested=getattr(node,'node_tree',None)
            if nested is not None:check(nested)
    for prop in bpy.data.bl_rna.properties:
        if prop.type=='COLLECTION':
            for item in getattr(bpy.data,prop.identifier):check(item)
    # bpy.app.timers exposes only register/unregister/is_registered(function),
    # not registry enumeration. This guard makes no global timer-absence claim.


def finite_matrix(matrix):
    if len(matrix)!=4 or any(len(row)!=4 for row in matrix):
        raise ValueError('expected a finite 4x4 matrix')
    if any(not math.isfinite(value) for row in matrix for value in row):
        raise ValueError('non-finite matrix element')


def matrix_snapshot(scene,graph):
    matrices={o.name:ambient.matrix_rows(o.evaluated_get(graph).matrix_world) for o in scene.objects}
    for matrix in matrices.values():finite_matrix(matrix)
    return matrices


def assert_source_parity(before,after,flattened,before_fixed,after_fixed,exact_objects=()):
    """Only source-flattened matrices may use the existing native tolerance."""
    if before.keys()!=after.keys():raise ValueError('source object set changed')
    if before_fixed!=after_fixed:raise ValueError('source fixed state changed')
    changed=set();maximum=0.
    for name,source in before.items():
        current=after[name]
        if {k:v for k,v in source.items() if k!='matrix'}!={k:v for k,v in current.items() if k!='matrix'}:
            raise ValueError('source mesh/UV/material payload changed: '+name)
        a,b=source['matrix'],current['matrix']
        finite_matrix(a);finite_matrix(b)
        if a!=b:
            changed.add(name)
            maximum=max(maximum,max(abs(x-y) for ar,br in zip(a,b) for x,y in zip(ar,br)))
    permitted=set(flattened)-set(exact_objects)
    if not changed<=permitted:raise ValueError('matrix changed outside flattened set: '+str(sorted(changed-permitted)))
    for name in sorted(changed):ambient.assert_near(before[name]['matrix'],after[name]['matrix'])
    return {'flattened_objects':sorted(flattened),'matrix_changed_objects':sorted(changed),
            'max_matrix_delta':maximum}


def geometry_state(scene,graph):
    """Extend the old fail-closed guard only for evaluated Bezier CURVE skins."""
    curves=[o for o in scene.objects if o.type=='CURVE' and not o.hide_render]
    result=ambient.visible_mesh_state(SimpleNamespace(objects=[o for o in scene.objects if o.type!='CURVE']),graph)
    for obj in curves:
        if obj.instance_type!='NONE' or any(m.show_render and m.type in {'PARTICLE_SYSTEM','NODES'} for m in obj.modifiers):
            raise ValueError('unsupported curve instancer: '+obj.name)
        if any(s.type!='BEZIER' for s in obj.data.splines):raise ValueError('expected Bezier curve: '+obj.name)
        evaluated=obj.evaluated_get(graph)
        mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
        try:result[obj.name]={'matrix':ambient.matrix_rows(evaluated.matrix_world),'mesh':ambient.mesh_state(mesh)}
        finally:evaluated.to_mesh_clear()
    return result


def curve_surface(obj,graph):
    """Exact mesh/material and rendering attributes, using the real depsgraph."""
    mesh=obj.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
    try:
        attributes=[]
        for attribute in mesh.attributes:
            values=[]
            for datum in attribute.data:
                prop=next((p for p in ('value','vector','color','uv','matrix') if hasattr(datum,p)),None)
                if prop is None:raise ValueError('unsupported curve mesh attribute: '+attribute.name)
                value=getattr(datum,prop)
                values.append(value if isinstance(value,(str,int,float,bool)) else list(value))
            attributes.append((attribute.name,attribute.data_type,attribute.domain,values))
        rendering={'generic':attributes,'corner_normals':[list(n.vector) for n in mesh.corner_normals]}
        return {'mesh':ambient.mesh_state(mesh),'render_attributes_sha256':ambient.digest(rendering)}
    finally:obj.to_mesh_clear()


def curve_object_render(obj):
    return {'color':list(obj.color),'pass_index':obj.pass_index,
            'slots':[(s.link,ambient.material_state(s.material)) for s in obj.material_slots],
            'visibility':{n:getattr(obj,n) for n in ('hide_render','visible_camera','visible_diffuse',
                'visible_glossy','visible_transmission','visible_shadow')}}


def collection_instances(scene,graph,evidence):
    """Consume native rows immediately; only proved curve surfaces are separate.

    Every visible source curve must have exactly one such representation. All
    other rows reach the legacy fail-closed collection audit unchanged. Native
    instance wrappers are never retained past their iterator step.
    """
    curves={o.as_pointer():o for o in scene.objects if o.type=='CURVE' and not o.hide_render}
    represented={};raw=collection_count=0
    for item in graph.object_instances:
        if not item.is_instance:
            yield item;continue
        raw+=1
        obj=item.object;parent=item.parent
        if obj.type!='MESH' or parent is None or parent.type!='CURVE':
            collection_count+=1
            yield item;continue
        original=parent.original;pointer=original.as_pointer()
        source=curves.get(pointer)
        if (source is None or original.type!='CURVE' or obj.original.type!='CURVE'
                or obj.original.as_pointer()!=pointer):
            raise ValueError('unknown curve self-mesh identity')
        if source.name in represented:raise ValueError('duplicate curve self-mesh representation')
        if (not item.show_self or item.show_particles or
                tuple(item.persistent_id)!=(0,)+(2147483647,)*7):
            raise ValueError('unexpected curve self-mesh native identity/visibility')
        for candidate in (source,parent,obj):
            if (candidate.hide_render or candidate.instance_type!='NONE' or candidate.instance_collection is not None
                    or any(m.show_render and m.type in {'PARTICLE_SYSTEM','NODES'} for m in candidate.modifiers)):
                raise ValueError('unsupported curve self-mesh instancer')
        if not source.data.splines or any(s.type!='BEZIER' for s in source.data.splines):
            raise ValueError('expected Bezier curve self-mesh')
        evaluated=source.evaluated_get(graph)
        matrix=ambient.matrix_rows(item.matrix_world)
        for candidate in (matrix,ambient.matrix_rows(parent.matrix_world),ambient.matrix_rows(evaluated.matrix_world)):
            finite_matrix(candidate)
            if candidate!=matrix:raise ValueError('curve self-mesh matrix mismatch')
        surface=curve_surface(obj,graph)
        if surface!=curve_surface(parent,graph) or surface!=curve_surface(evaluated,graph):
            raise ValueError('curve self-mesh geometry/material/render attributes mismatch')
        rendering=curve_object_render(obj)
        if rendering!=curve_object_render(parent) or rendering!=curve_object_render(evaluated):
            raise ValueError('curve self-mesh object rendering mismatch')
        represented[source.name]={'original_pointer':pointer,'original_name':original.name,
            'persistent_id':list(item.persistent_id),'random_id':item.random_id,
            'show_self':item.show_self,'show_particles':item.show_particles,
            'matrix':matrix,**surface,'object_render':rendering}
    if set(represented)!={o.name for o in curves.values()}:
        raise ValueError('missing curve self-mesh representation coverage')
    evidence.update(raw_generated_count=raw,collection_count=collection_count,
        curve_self_mesh_count=len(represented),curve_self_meshes=represented)


def convert_visible_curves(bpy,scene):
    curves=[o for o in scene.objects if o.type=='CURVE' and not o.hide_render]
    if not curves:return []
    if any(o.parent or o.constraints for o in curves):raise ValueError('unexpected curve hierarchy')
    names=[o.name for o in curves]
    # Native conversion retains the evaluated bevel/tube skin and materials.
    # Only these owned derivative objects are selected; collection instances
    # are not realized. Exact appearance is checked before/after and on reload.
    for obj in bpy.context.selected_objects:obj.select_set(False)
    for obj in curves:obj.select_set(True)
    bpy.context.view_layer.objects.active=curves[0]
    bpy.ops.object.convert(target='MESH',keep_original=False)
    if any(bpy.data.objects[name].type!='MESH' for name in names):raise ValueError('curve conversion failed')
    return names


def render_settings(scene):
    r=scene.render
    return {'engine':r.engine,'size':[r.resolution_x,r.resolution_y,r.resolution_percentage],
            'pixel_aspect':[r.pixel_aspect_x,r.pixel_aspect_y], 'samples':scene.cycles.samples,
            'adaptive':scene.cycles.use_adaptive_sampling,'animated_seed':scene.cycles.use_animated_seed,
            'seed':scene.cycles.seed,'shutter':r.motion_blur_shutter,
            'motion_blur':getattr(r,'use_motion_blur',getattr(scene.cycles,'use_motion_blur',None))}


def validate_identity(bpy,scene,subject,variant):
    from mathutils import Vector
    camera=bpy.data.objects['Goal Loop '+variant]
    if scene.camera!=camera or camera.type!='CAMERA':raise ValueError('wrong active source camera')
    pos,target,lens=(goal.camera_pose(468,variant=='mobile') if subject=='finished-belt'
                     else switch.camera_pose(660,variant=='mobile'))
    ambient.assert_near(list(camera.matrix_world.translation),list(Vector(pos)))
    rotation=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y')
    if abs(camera.matrix_world.to_quaternion().dot(rotation))<.99999:raise ValueError('camera orientation differs')
    ambient.assert_near(camera.data.lens,lens)
    if camera.data.sensor_fit!='HORIZONTAL' or camera.data.sensor_width!=36:raise ValueError('camera sensor differs')
    piece=bpy.data.objects['Lab single delivery piece']
    pane=bpy.data.objects['Lab continuous six centimetre glass slab']
    joiner=bpy.data.objects['Lab repair joiner 1']
    pose,angle=switch.pane_pose(h.POSE[subject])
    ambient.assert_near(list(piece.matrix_world.translation),list(Vector(pose)))
    ambient.assert_near(list(joiner.matrix_world.translation),list(Vector(switch.corner_pose(h.POSE[subject]))))
    if pane.parent!=piece or pane.hide_render or len(joiner.children)!=3:raise ValueError('finished pane/joiner differs')
    ambient.assert_near(list(pane.scale),(1,1,1))
    if [m.name for m in pane.data.materials]!=['Build orange to clear glass','Glass blue green bevel']:
        raise ValueError('pane material identity differs')
    if subject=='finished-belt':
        for name,pos,dims in zip(h.BELT_NAMES,((597.5,3.3,.66),(597.25,5.1,.66)),((1.2,2.6,.08),(2,1,.08))):
            obj=bpy.data.objects[name]
            if obj.type!='MESH' or obj.hide_render or obj.parent:raise ValueError('wrong straight belt identity')
            ambient.assert_near(list(obj.matrix_world.translation),pos)
            ambient.assert_near(list(obj.dimensions),dims)
            if [m.name for m in obj.data.materials]!=['Lab graphite belt']:raise ValueError('wrong belt material')
        return camera,list(h.BELT_NAMES)
    actual={o.name for o in scene.objects if o.name.startswith(('SS plant broad leaf ','SS plant midrib ','SS plant petiole '))}
    if actual!=set(h.leaf_names()):raise ValueError('need exactly nine original leaf assemblies')
    origin=Vector((595.30,6.16,2.08))
    for i,(base,tip,width) in enumerate(h.LEAF_LAYOUT):
        blade,rib,stem=(bpy.data.objects[f'SS plant {part} {i+1}'] for part in ('broad leaf','midrib','petiole'))
        if blade.type!='MESH' or len(blade.data.vertices)!=225 or any(o.hide_render for o in (blade,rib,stem)):
            raise ValueError('wrong original leaf blade')
        ambient.assert_near(list(blade.matrix_world@blade.data.vertices[0].co),list(origin+Vector(base)))
        ambient.assert_near(list(blade.matrix_world@blade.data.vertices[216].co),list(origin+Vector(tip)))
        for obj,radius,start,end in ((rib,.002,origin+Vector(base),origin+Vector(tip)),
                                     (stem,.007,Vector(h.PLANT_ROOT),origin+Vector(base))):
            if obj.type!='CURVE' or len(obj.data.splines)!=1:raise ValueError('original rib/petiole must be a curve')
            spline=obj.data.splines[0]
            if spline.type!='BEZIER' or len(spline.bezier_points)!=3:raise ValueError('unexpected curve layout')
            ambient.assert_near(obj.data.bevel_depth,radius)
            ambient.assert_near(list(obj.matrix_world@spline.bezier_points[0].co),list(start))
            ambient.assert_near(list(obj.matrix_world@spline.bezier_points[-1].co),list(end))
    return camera,list(h.leaf_names())


def add_belts(bpy,names):
    ownership={}
    for name in names:
        obj=bpy.data.objects[name]
        original=obj.data.materials[0]
        ambient.reject_tread_object_shading(original.node_tree)
        private=original.copy();private.name='Refined '+name
        obj.data.materials[0]=private
        nodes,links=private.node_tree.nodes,private.node_tree.links
        shader=nodes.get('Principled BSDF')
        if shader.inputs['Base Color'].is_linked or shader.inputs['Normal'].is_linked:
            raise ValueError('expected original uniform belt surface')
        position=nodes.new('ShaderNodeNewGeometry')
        xyz=nodes.new('ShaderNodeSeparateXYZ');links.new(position.outputs['Position'],xyz.inputs[0])
        scale=nodes.new('ShaderNodeMath');scale.operation='DIVIDE';scale.inputs[1].default_value=h.BELT_PITCH
        links.new(xyz.outputs['Y'],scale.inputs[0])
        phase=nodes.new('ShaderNodeValue');phase.name='Refined belt travel'
        shift=nodes.new('ShaderNodeMath');shift.operation='SUBTRACT'
        links.new(scale.outputs[0],shift.inputs[0]);links.new(phase.outputs[0],shift.inputs[1])
        repeat=nodes.new('ShaderNodeMath');repeat.operation='FRACT';links.new(shift.outputs[0],repeat.inputs[0])
        seam=nodes.new('ShaderNodeMath');seam.operation='LESS_THAN';seam.inputs[1].default_value=h.SEAM_WIDTH/h.BELT_PITCH
        links.new(repeat.outputs[0],seam.inputs[0])
        tint=nodes.new('ShaderNodeMixRGB')
        tint.inputs[1].default_value=shader.inputs['Base Color'].default_value[:]
        tint.inputs[2].default_value=(.028,.028,.028,1)
        links.new(seam.outputs[0],tint.inputs[0]);links.new(tint.outputs[0],shader.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.invert=True
        bump.inputs['Strength'].default_value=.35;bump.inputs['Distance'].default_value=.0015
        links.new(seam.outputs[0],bump.inputs['Height']);links.new(bump.outputs[0],shader.inputs['Normal'])
        for frame in (*h.FRAMES,h.CLOSE_FRAME):
            phase.outputs[0].default_value=h.belt_phase(frame)
            phase.outputs[0].keyframe_insert('default_value',frame=frame)
        ambient.analytic_handles(private.node_tree,lambda path,index,f:h.belt_phase_velocity(f))
        extend_action(private.node_tree,periodic=False)
        if private.users!=1 or original==private:raise ValueError('belt material must be private')
        ownership[name]={'source':original.name,'private':private.name}
    return ownership


def leaf_derivative(path,index,frame):
    mode=int(path.split('Refined mode ')[1].split('"')[0])
    return h.coefficient_velocity(frame)[mode]


def extend_action(item,periodic):
    # Inherited motion blur samples across frame1. Clamp extrapolation would
    # stop the leaf/seam briefly there even though the endpoint tangents match.
    for curve in ambient.curves_for(item):
        if periodic:
            cycle=curve.modifiers.new('CYCLES')
            cycle.mode_before=cycle.mode_after='REPEAT'
        else:curve.extrapolation='LINEAR'  # unwrapped material phase


def add_leaves(bpy,names):
    from mathutils import Vector
    bases={}
    for name in names:
        obj=bpy.data.objects[name];index=int(name.rsplit(' ',1)[1])-1
        world=obj.matrix_world.copy();inverse=world.inverted().to_3x3()
        base=[v.co.copy() for v in obj.data.vertices]
        obj.shape_key_add(name='Frozen evaluated 660')
        for mode in range(2):
            key=obj.shape_key_add(name=f'Refined mode {mode}')
            key.slider_min=-1;key.slider_max=2
            for v in obj.data.vertices:
                key.data[v.index].co=base[v.index]+inverse@Vector(h.leaf_modes(world@base[v.index],index)[mode])
            for frame in (*h.FRAMES,h.CLOSE_FRAME):
                key.value=h.coefficients(frame)[mode];key.keyframe_insert('value',frame=frame)
        ambient.analytic_handles(obj.data.shape_keys,leaf_derivative)
        extend_action(obj.data.shape_keys,periodic=True)
        bases[name]=[list(p) for p in base]
    return bases


def key_evidence(bpy,subject,names):
    if subject=='finished-belt':
        return {name:ambient.native_key_evidence(bpy.data.objects[name].data.materials[0].node_tree,
                lambda path,index,f:h.belt_phase_velocity(f)) for name in names}
    return {name:ambient.native_key_evidence(bpy.data.objects[name].data.shape_keys,leaf_derivative) for name in names}


def fixed_state(bpy,scene,instance_evidence=None):
    graph=bpy.context.evaluated_depsgraph_get()
    evidence={} if instance_evidence is None else instance_evidence
    instances=ambient.instance_state(graph,collection_instances(scene,graph,evidence))
    return {'camera':ambient.camera_state(scene.camera),'color':ambient.color_state(scene),
            'lights':ambient.lighting_state(scene),'instances':instances,
            'world':ambient.tree_state(scene.world.node_tree) if scene.world else None,
            'render_settings':render_settings(scene)}


def evaluate(bpy,scene,subject,names,bases,original_materials):
    """Native saved-action/geometry checks, not pixel or salience admission."""
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    first=None;fixed=None;static=None;rows=[];tracks={};pin_error=field_error=0.
    w=scene.render.resolution_x*scene.render.resolution_percentage/100
    height=scene.render.resolution_y*scene.render.resolution_percentage/100
    def project(point):
        p=world_to_camera_view(scene,scene.camera,Vector(point))
        return [p.x*w,(1-p.y)*height,p.z]
    for frame in (*h.FRAMES,h.CLOSE_FRAME,.75,49.25):
        scene.frame_set(math.floor(frame),subframe=frame%1)
        graph=bpy.context.evaluated_depsgraph_get()
        state=fixed_state(bpy,scene)
        if fixed is None:fixed=state
        if state!=fixed:raise ValueError('camera/light/world/instance/settings changed during loop')
        for name,expected in original_materials.items():
            if ambient.digest(ambient.material_state(bpy.data.materials[name]))!=ambient.digest(expected):raise ValueError('shared source material changed: '+name)
        current=geometry_state(scene,graph)
        current_static={k:v for k,v in current.items() if k not in names}
        if static is None:static=current_static
        if current_static!=static:raise ValueError('unrelated geometry/material/visibility moved')
        row={'frame':frame,'geometry_sha256':ambient.digest(current)}
        if subject=='finished-belt':
            phases={name:bpy.data.objects[name].data.materials[0].node_tree.nodes['Refined belt travel'].outputs[0].default_value for name in names}
            for value in phases.values():ambient.assert_near(value,h.belt_phase(frame),1e-6)
            row['belt_phases']=phases
            # Compare the actual native phase modulo one pitch at both ends.
            pattern=[(y/h.BELT_PITCH-value)%1 for value in phases.values() for y in (2.011,3.127,4.211,5.537)]
            if first is None:first=pattern
            if frame==49:ambient.assert_near(pattern,first,1e-5)
        else:
            positions={}
            for name in names:
                obj=bpy.data.objects[name];evaluated=obj.evaluated_get(graph)
                mesh=evaluated.to_mesh();index=int(name.rsplit(' ',1)[1])-1
                try:
                    if len(mesh.vertices)!=len(bases[name]):raise ValueError('leaf topology changed')
                    world=evaluated.matrix_world
                    coords=[list(v.co) for v in mesh.vertices];positions[name]=coords
                    pinned=0
                    for v,base in zip(mesh.vertices,bases[name]):
                        p=world@Vector(base);actual=world@v.co-p
                        error=math.dist(actual,h.leaf_delta(p,index,frame));field_error=max(field_error,error)
                        if error>2e-4:raise ValueError('blade/rib/petiole field mismatch')
                        if p.z<=h.PLANT_ROOT[2]+.012:
                            pinned+=1
                            pin_error=max(pin_error,actual.length)
                            if actual.length>1e-6:raise ValueError('root attachment moved')
                    if 'petiole' in name and not pinned:raise ValueError('attachment skin missing')
                    if 'broad leaf' in name:
                        tip=min(range(len(coords)),key=lambda j:math.dist(world@Vector(bases[name][j]),h.leaf_tip(index)))
                        tracks.setdefault(name,[]).append(project(world@mesh.vertices[tip].co))
                finally:evaluated.to_mesh_clear()
            if first is None:first=positions
            if frame==49:
                for name in names:ambient.assert_near(positions[name],first[name],1e-6)
        rows.append(row)
    projection={'status':'UNRENDERED; projection is not visibility/salience or art PASS',
                'inherited_pixel_size':[w,height],'occlusion_checked':False}
    if subject=='plant':
        projection['blade_tip_tracks_px_depth']=tracks
        projection['max_tip_excursion_px']={name:max(math.dist(a[:2],b[:2]) for a in pts for b in pts) for name,pts in tracks.items()}
        projection['root_error_m']=pin_error;projection['component_field_error_m']=field_error
    else:
        projection['unoccluded_one_pitch_travel_px']={name:math.dist(project((x,y,.70))[:2],project((x,y+h.BELT_PITCH,.70))[:2])
            for name,x,y in ((names[0],597.5,3.3),(names[1],597.25,5.1))}
        projection['pitch_m']=h.BELT_PITCH;projection['seam_width_m']=h.SEAM_WIDTH
    return {'fixed':fixed,'static_sha256':ambient.digest(static),'frames':rows,'projection':projection,
            'native_key_endpoint_velocities':key_evidence(bpy,subject,names)}


def pack_images(bpy,source_images):
    for name,row in source_images.items():
        image=bpy.data.images[name]
        if not image.packed_file:image.pack()
        packed=ambient.image_state(bpy)[name]
        if packed.get('packed_sha256')!=row.get('packed_sha256',row.get('sha256')):
            raise ValueError('packed source texture bytes differ: '+name)
    return ambient.image_state(bpy)


def author_sources():
    return {p.name:h.sha256(p) for p in (Path(__file__),Path(h.__file__),Path(ambient.__file__),
            Path(h.ambient.__file__),Path(goal.__file__),Path(switch.__file__),Path(__file__).with_name('arena_hold.py'))}


def verify_prepared(path,manifest_path):
    """Parent fresh-process verification entry, read-only and zero-render."""
    import bpy
    path=Path(path).resolve(strict=True);manifest_path=Path(manifest_path).resolve(strict=True)
    if path.name!='refined-hold.blend' or manifest_path!=path.with_name('native-manifest.json'):
        raise ValueError('expected paired derivative/manifest paths')
    m=json.loads(manifest_path.read_text())
    if m['status']!='prepared-not-rendered' or m['rendered'] or m['new_render_cap']!=0:
        raise ValueError('not a zero-render preparation receipt')
    subject,variant=m['subject'],m['camera']
    h.validate_source(m['source'],subject,variant)
    if h.sha256(path)!=m['derivative_sha256'] or author_sources()!=m['author_sources']:
        raise ValueError('prepared bytes or authoring sources changed')
    no_runtime(bpy)
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    no_runtime(bpy);scene=bpy.context.scene
    no_drivers(bpy)
    if scene['refined_source_sha256']!=m['source_sha256'] or scene['refined_subject']!=subject:
        raise ValueError('saved source/subject metadata differs')
    if (scene.frame_start,scene.frame_end,scene.render.fps,scene.render.fps_base)!=(1,48,24,1):
        raise ValueError('saved playback range/fps differs')
    if any(mod.show_render or mod.show_viewport for o in bpy.data.objects for mod in o.modifiers if mod.type=='CLOTH'):
        raise ValueError('inherited cloth woke on reload')
    if ambient.image_state(bpy)!=m['packed_images']:raise ValueError('packed textures changed on reload')
    scene.frame_set(1)
    if matrix_snapshot(scene,bpy.context.evaluated_depsgraph_get())!=m['frozen_matrices']:
        raise ValueError('frozen matrices changed on fresh reload')
    actual=evaluate(bpy,scene,subject,m['movers'],m['leaf_bases'],m['original_materials'])
    if ambient.digest(actual)!=ambient.digest(m['native_checks']):raise ValueError('fresh-reload native evidence differs')
    h.validate_source(m['source'],subject,variant)
    return {'status':'native-reload-verified-not-rendered','subject':subject,'camera':variant,
            'integer_frames_checked':49,'shutter_subframes_checked':[.75,49.25],
            'rendered':[],'visual_acceptance':'PENDING parent render and art checks'}


def main():
    args=h.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.verify_prepared:
        print(json.dumps(verify_prepared(args.verify_prepared,args.manifest)));return
    source=h.validate_source(args.source,args.subject,args.camera)
    out=h.fresh_output(args.out,h.protected_inputs())
    source_signature=h.sha256(source);authors=author_sources()
    import bpy
    no_runtime(bpy)
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    no_runtime(bpy);scene=bpy.context.scene
    if scene.rigidbody_world and scene.rigidbody_world.enabled:raise ValueError('live rigid-body world')
    disabled=[]
    # Before ANY timeline evaluation, including identity/mesh/instance snapshots.
    for obj in bpy.data.objects:
        for mod in obj.modifiers:
            if mod.type=='CLOTH':
                mod.show_viewport=mod.show_render=False;disabled.append([obj.name,mod.name])
    scene.frame_set(h.POSE[args.subject])
    camera,names=validate_identity(bpy,scene,args.subject,args.camera)
    source_instances={}
    original_fixed=fixed_state(bpy,scene,source_instances)
    original=geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    expected_curves=({name for name in h.leaf_names() if 'broad leaf' not in name}|{'SS lamp upright'}
                     if args.subject=='plant' else set())
    if set(source_instances['curve_self_meshes'])!=expected_curves:
        raise ValueError('source curve self-mesh census differs from pinned subject')
    if args.subject=='plant' and (source_instances['raw_generated_count']!=11245 or
                                  source_instances['collection_count']!=11226):
        raise ValueError('pinned plant raw/collection instance census differs')
    for name,row in source_instances['curve_self_meshes'].items():
        if original[name]!={'matrix':row['matrix'],'mesh':row['mesh']}:
            raise ValueError('audited curve self-mesh differs from source geometry: '+name)
    flattened={o.name for o in scene.objects if o.parent is not None or len(o.constraints)}
    materials={m.name:ambient.material_state(m) for m in bpy.data.materials}
    source_images=ambient.image_state(bpy)
    # Protect external source image files as well as native inputs and repo.
    h.fresh_output(out,[*h.protected_inputs(),*(v['path'] for v in source_images.values() if 'path' in v)])
    converted=convert_visible_curves(bpy,scene)
    if set(converted)!=expected_curves:raise ValueError('converted curve coverage differs')
    conversion=geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    conversion_parity=assert_source_parity(original,conversion,set(),original_fixed,fixed_state(bpy,scene))
    ambient.freeze(bpy,scene)
    no_drivers(bpy)
    scene.camera=bpy.data.objects[camera.name]
    frozen=geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    freeze_parity=assert_source_parity(conversion,frozen,flattened,original_fixed,fixed_state(bpy,scene))
    print(json.dumps({'source_freeze_parity':freeze_parity,'curve_conversion_parity':conversion_parity}))
    frozen_matrices=matrix_snapshot(scene,bpy.context.evaluated_depsgraph_get())
    bases={};ownership={}
    if args.subject=='finished-belt':ownership=add_belts(bpy,names)
    else:bases=add_leaves(bpy,names)
    scene.frame_start=1;scene.frame_end=48;scene.frame_step=1
    scene.render.fps=24;scene.render.fps_base=1
    checks=evaluate(bpy,scene,args.subject,names,bases,materials)
    if checks['fixed']!=original_fixed:raise ValueError('inherited scene settings changed')
    scene.frame_set(1)
    plant_start_parity=None
    if args.subject=='plant':
        plant_start_parity=assert_source_parity(original,geometry_state(scene,bpy.context.evaluated_depsgraph_get()),
            flattened,original_fixed,fixed_state(bpy,scene),names)
    if matrix_snapshot(scene,bpy.context.evaluated_depsgraph_get())!=frozen_matrices:
        raise ValueError('frozen matrices changed before save')
    retained_unused_materials=[]
    for name in materials:
        material=bpy.data.materials[name]
        if material.users==0:
            material.use_fake_user=True;retained_unused_materials.append(name)
    packed=pack_images(bpy,source_images)
    scene['refined_source_sha256']=source_signature;scene['refined_subject']=args.subject
    scene['refined_prepared_not_rendered']=True
    no_runtime(bpy);no_drivers(bpy);h.validate_source(source,args.subject,args.camera)
    if author_sources()!=authors:raise ValueError('authoring sources changed while preparing')
    h.fresh_output(out,h.protected_inputs())
    out.mkdir(parents=True,exist_ok=False)
    derivative=out/'refined-hold.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(derivative))
    h.validate_source(source,args.subject,args.camera)
    manifest={'status':'prepared-not-rendered','subject':args.subject,'camera':args.camera,
        'source':str(source),'source_sha256':source_signature,'source_pose_frame':h.POSE[args.subject],
        'derivative_sha256':h.sha256(derivative),'author_sources':authors,
        'new_render_cap':0,'rendered':[],'frames':list(h.FRAMES),'closure_eval_only':49,'fps':24,
        'movers':names,'leaf_bases':bases,'private_belt_materials':ownership,
        'source_geometry_sha256':ambient.digest(original),'converted_evaluated_curves':converted,
        'source_instance_representations':source_instances,
        'source_freeze_parity':freeze_parity,'curve_conversion_parity':conversion_parity,
        'plant_start_parity':plant_start_parity,'frozen_matrices':frozen_matrices,
        'original_materials':materials,'retained_unused_materials':retained_unused_materials,
        'source_images':source_images,'packed_images':packed,
        'disabled_inherited_cloth_modifiers':disabled,'native_checks':checks,
        'visual_acceptance':'PENDING fresh parent reload, approved renders, salience/seams/art, both cameras',
        'budget_note':'Inherited resolution/samples; this file grants no rendering permission.'}
    receipt=out/'native-manifest.json';receipt.write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'manifest':str(receipt),'derivative':str(derivative),'status':manifest['status'],'rendered':0}))


if __name__=='__main__':main()
