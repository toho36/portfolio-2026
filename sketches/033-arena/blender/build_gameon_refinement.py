"""PARENT ONLY. Worker-safe import; no render/bake/encode/server entry.

Blender --background --factory-startup --disable-autoexec --python THIS --
  --prepare-only --kind loop|arrival|departure --camera desktop|mobile --source PINNED_ORIGINAL --out FRESH
Blender --background --factory-startup --disable-autoexec --python THIS --
  --verify-prepared FRESH/gameon112-KIND.blend --manifest FRESH/native-manifest.json

Prepare admits the original baked1–168 cache before any pose sampling. Verify uses a separate
fresh process. Inherited settings grant no rendering permission. Frame49 and
shutter subframes are evaluations only. No visual/player acceptance is claimed.
"""
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import gameon_refinement as h
import build_ambient_holds as ambient
import build_refined_holds as native

BANNER = 'GameOnVB canvas'


def canonical(value):return json.loads(json.dumps(value,sort_keys=True))


def author_sources():
    paths=[Path(__file__),Path(h.__file__),Path(ambient.__file__),Path(native.__file__),
           Path(h.hold.__file__),Path(native.h.__file__),Path(h.hold.__file__).with_name('ambient_holds.py'),
           Path(native.goal.__file__),Path(native.switch.__file__)]
    return {p.name:h.sha256(p) for p in paths}


def native_projection(scene,camera,source_frame=84):
    """Same physical front-screen corners and depth convention as original admission."""
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    faces=[o for o in scene.objects if o.name.startswith('Neutral screen front/back') and o.location.y<0]
    if len(faces)!=1:raise ValueError('need exactly one actual arena front screen')
    face=faces[0]
    ambient.assert_near((face.dimensions.x,face.dimensions.z),(8.,4.5),.001)
    y=face.location.y-face.dimensions.y/2-.001
    corners=[Vector((x,y,z)) for x,z in ((-4,10.75),(-4,15.25),(4,15.25),(4,10.75))]
    return {'frame':source_frame,'uv_bottom_origin':[list(world_to_camera_view(scene,camera,p)) for p in corners]}


def cloth_payload(mesh):
    return ambient.digest({'polygons':[(list(p.vertices),p.material_index,p.use_smooth) for p in mesh.polygons],
        'uv':{uv.name:[list(p.uv) for p in uv.data] for uv in mesh.uv_layers},
        'materials':[ambient.material_state(m) for m in mesh.materials]})


def cloth_basis(obj):
    mesh=obj.data
    if len(mesh.vertices)!=5130 or not mesh.uv_layers.active or not mesh.materials:
        raise ValueError('actual evaluated112 cloth must retain 5130 vertices, UV and materials')
    if BANNER not in [m.name for m in mesh.materials if m]:raise ValueError('original canvas shader missing')
    uvs={}
    for loop in mesh.loops:
        uv=list(mesh.uv_layers.active.data[loop.index].uv)
        if loop.vertex_index in uvs:ambient.assert_near(uv,uvs[loop.vertex_index])
        uvs[loop.vertex_index]=uv
    if set(uvs)!=set(range(5130)):raise ValueError('incomplete evaluated cloth UV coverage')
    base=[list(v.co) for v in mesh.vertices];h.validate_points(base,5130)
    return {'base':base,'uvs':[uvs[i] for i in range(5130)],
            'payload_sha256':cloth_payload(mesh),'mesh':ambient.mesh_state(mesh)}


def derivative(path,index,frame):
    mode=int(path.split('GameOn mode ')[1].split('"')[0])
    return h.coefficient_velocity(frame)[mode]


def add_cloth(obj,basis):
    from mathutils import Vector
    inverse=obj.matrix_world.inverted().to_3x3()
    # Nominal printed canvas normal is the horizontal depth axis, not world Z.
    axis=obj.matrix_world.to_3x3()@Vector((0,1,0))
    if abs(axis.normalized().dot(Vector((0,1,0))))<.99999:
        raise ValueError('original canvas normal is not the admitted horizontal depth axis')
    modes=h.flutter_modes(basis['uvs'])
    obj.shape_key_add(name='Actual baked112 Basis')
    for i in range(2):
        key=obj.shape_key_add(name=f'GameOn mode {i}')
        key.slider_min=-1;key.slider_max=2
        for j,base in enumerate(basis['base']):
            key.data[j].co=Vector(base)+inverse@Vector(modes[j][i])
        for frame in (*h.FRAMES,h.CLOSE_FRAME):
            key.value=h.coefficients(frame)[i];key.keyframe_insert('value',frame=frame)
    ambient.analytic_handles(obj.data.shape_keys,derivative)
    native.extend_action(obj.data.shape_keys,periodic=True)
    return modes


def evaluate(bpy,scene,basis,materials,projection):
    from mathutils import Vector
    from bpy_extras.object_utils import world_to_camera_view
    obj=bpy.data.objects[BANNER];modes=h.flutter_modes(basis['uvs'])
    probes=[min(range(5130),key=lambda i:(basis['uvs'][i][1]+abs(basis['uvs'][i][0]-u)))
            for u in (0.,.25,.5,.75,1.)]
    tracks={str(i):[] for i in probes}
    fixed=static=first=None;rows=[];projections=[]
    pin_error=normal=vertical=centroid=field_error=0.
    w=scene.render.resolution_x*scene.render.resolution_percentage/100
    height=scene.render.resolution_y*scene.render.resolution_percentage/100
    if (w,height)!=h.SIZE[scene.camera.name]:raise ValueError('projection admission requires original1600x900/900x1600 pixels')
    for frame in (*h.FRAMES,h.CLOSE_FRAME,.75,49.25):
        scene.frame_set(math.floor(frame),subframe=frame%1)
        graph=bpy.context.evaluated_depsgraph_get()
        current_fixed=native.fixed_state(bpy,scene)
        if fixed is None:fixed=current_fixed
        if current_fixed!=fixed:raise ValueError('camera/instances/lights/color/world/render settings moved')
        if ambient.digest({m.name:ambient.material_state(m) for m in bpy.data.materials})!=ambient.digest(materials):
            raise ValueError('source material IDs or values changed')
        current=native.geometry_state(scene,graph)
        current_static={k:v for k,v in current.items() if k!=BANNER}
        if static is None:static=current_static
        if current_static!=static:raise ValueError('unrelated visible geometry/material moved')
        evaluated=obj.evaluated_get(graph)
        mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
        try:
            if len(mesh.vertices)!=5130 or cloth_payload(mesh)!=basis['payload_sha256']:
                raise ValueError('animated cloth topology/UV/material changed')
            coords=[list(v.co) for v in mesh.vertices];h.validate_points(coords,5130)
            if first is None:first=coords
            if frame==49:ambient.assert_near(coords,first,1e-6)
            if frame==1 and canonical(ambient.mesh_state(mesh))!=canonical(basis['mesh']):
                raise ValueError('holdframe1 is not the exact actual baked112 mesh')
            summed=Vector((0,0,0));pinned=0
            for i,co in enumerate(coords):
                delta=evaluated.matrix_world.to_3x3()@(Vector(co)-Vector(basis['base'][i]))
                summed+=delta
                field_error=max(field_error,math.dist(delta,h.displacement(modes[i],frame)))
                normal=max(normal,abs(delta.y));vertical=max(vertical,abs(delta.z))
                if basis['uvs'][i][1]==1:
                    pinned+=1;pin_error=max(pin_error,delta.length)
            if not pinned:raise ValueError('no top UVv1 vertices proved')
            centroid=max(centroid,(summed/5130).length)
            if frame in (*h.FRAMES,h.CLOSE_FRAME):
                for i in probes:
                    p=world_to_camera_view(scene,scene.camera,evaluated.matrix_world@mesh.vertices[i].co)
                    if p.z<=0:raise ValueError('lower cloth probe behind camera')
                    tracks[str(i)].append([p.x*w,(1-p.y)*height,p.z])
            if frame in h.FRAMES:
                actual_projection=native_projection(scene,scene.camera)
                h.check_projection(projection,actual_projection)
                projections.append({'output_frame':frame,'source_clock':84,'row':actual_projection})
            rows.append({'frame':frame,'cloth_sha256':current[BANNER]['mesh']['geometry_uv'],
                'source_geometry_frame':112,'source_camera_frame':84})
        finally:evaluated.to_mesh_clear()
    if pin_error>1e-6 or vertical>h.VERTICAL_BOUND or centroid>2e-6 or field_error>1e-5 or normal>h.NORMAL_BOUND:
        raise ValueError('pinned/vertical/centroid/field/normal bound failed: '+str((pin_error,vertical,centroid,field_error,normal)))
    excursion={i:max(math.dist(a[:2],b[:2]) for a in pts for b in pts) for i,pts in tracks.items()}
    if normal<.01 or vertical<.01:raise ValueError('both native ripple axes must move')
    admission=h.projection_admission(scene.camera.name,excursion)
    h.check_projection(projection,native_projection(scene,scene.camera))
    keys=ambient.native_key_evidence(obj.data.shape_keys,derivative)
    if len(keys)!=2:raise ValueError('exactly two native periodic mode curves required')
    return {'fixed':fixed,'static_sha256':ambient.digest(static),'frames':rows,'projections':projections,
        'native_key_endpoint_velocities':keys,'reading_projection_row84':native_projection(scene,scene.camera),
        'motion':{'status':'UNRENDERED; math/projection is not visibility, salience, seam or art PASS',
            'normal_axis':'world Y, original nominal horizontal canvas normal; not local folded vertex normals',
            'pinned_top_error_m':pin_error,'max_normal_m':normal,'normal_bound_m':h.NORMAL_BOUND,
            'max_vertical_m':vertical,'vertical_bound_m':h.VERTICAL_BOUND,'projection_admission':admission,'max_vertex_centroid_change_m':centroid,'field_error_m':field_error,
            'probe_vertex_indices':probes,'inherited_pixel_size':[w,height],
            'lower_probe_tracks_px_depth':tracks,'lower_probe_excursion_px':excursion,'occlusion_checked':False}}



def scoped_fixed(state,kind):
    # The only intentional fixed-state exclusion is the active departure camera.
    return {k:v for k,v in state.items() if kind!='departure' or k!='camera'}


def scoped_matrices(matrices,camera,kind):
    return {k:v for k,v in matrices.items() if kind!='departure' or k!=camera}


def assert_camera(expected,actual):
    if set(expected)!=set(actual):raise ValueError('native camera field set changed')
    for row in (expected,actual):
        native.finite_matrix(row['matrix_world'])
        if not math.isfinite(row['lens']) or row['lens']<=0:raise ValueError('nonfinite/invalid native lens')
    for name in expected:
        if name in ('matrix_world','lens'):ambient.assert_near(expected[name],actual[name],1e-5)
        elif expected[name]!=actual[name]:raise ValueError('camera field changed outside native route: '+name)
    return {'matrix_max_abs_error':max(abs(x-y) for a,b in zip(expected['matrix_world'],actual['matrix_world']) for x,y in zip(a,b)),
            'lens_abs_error':abs(expected['lens']-actual['lens'])}


def bridge_handles(item,velocity):
    """Persist Hermite handles using actual interval lengths, including subframes.

    Separate one-sided slopes preserve the original piecewise-linear camera's
    genuine source-knot corners. Only loop actions receive cyclic modifiers.
    """
    for curve in ambient.curves_for(item):
        keys=curve.keyframe_points
        if curve.extrapolation!='CONSTANT':raise ValueError('set extrapolation before dense key allocation')
        for i,key in enumerate(keys):
            frame,value=key.co
            left=(frame-keys[i-1].co[0])/3 if i else (keys[i+1].co[0]-frame)/3
            right=(keys[i+1].co[0]-frame)/3 if i+1<len(keys) else left
            key.interpolation='BEZIER'
            key.handle_left_type=key.handle_right_type='FREE'
            key.handle_left=(frame-left,value-left*velocity(curve.data_path,curve.array_index,frame,-1))
            key.handle_right=(frame+right,value+right*velocity(curve.data_path,curve.array_index,frame,1))


def arrival_velocity(path,index,t,side=1):
    if 'GameOn mode ' in path:
        mode=int(path.split('GameOn mode ')[1].split('"')[0])
        return h.arrival_coefficients(t,True)[mode]
    knot=int(path.split('GameOn cache ')[1].split('"')[0])
    return h.cache_weights(h.source_clock('arrival',t),True).get(knot,0.)*h.clock_velocity('arrival',t)


def departure_velocity(reference,path,index,t,side=1):
    channels=h.camera_channels(reference['camera_knots'],h.source_clock('departure',t),True,side)
    value=channels[path]
    return (value[index] if isinstance(value,list) else value)*h.clock_velocity('departure',t)



def validate_camera_curves(camera):
    # build_scene authoring sets object route channels LINEAR. Camera-data DOF
    # uses its own interpolation and is inactive throughout this source window.
    for item,paths in ((camera,('location','rotation_quaternion')),(camera.data,('lens',))):
        for curve in ambient.curves_for(item):
            if curve.data_path in paths and (curve.modifiers or any(k.interpolation!='LINEAR' for k in curve.keyframe_points)):
                raise ValueError('source camera route interpolation differs from actual authoring pattern')

def capture_source(bpy,scene,banner,kind,reading_projection):
    """Read original cache/route without disabling cloth or changing source data.

    Runtime re-proves the cited static84/112 compatibility; the checkpoint is
    evidence only. Every original frame request is guarded by cache admission.
    """
    def at(frame):
        h.validate_cache(banner.modifiers)
        scene.frame_set(math.floor(frame),subframe=frame%1)
        h.validate_cache(banner.modifiers)
        return bpy.context.evaluated_depsgraph_get()
    graph=at(84)
    world84=native.geometry_state(scene,graph)
    fixed84=native.fixed_state(bpy,scene)
    materials84={m.name:ambient.material_state(m) for m in bpy.data.materials}
    camera84=ambient.camera_state(scene.camera)
    h.check_projection(reading_projection,native_projection(scene,scene.camera,84))
    graph=at(112)
    world112=native.geometry_state(scene,graph)
    fixed112=native.fixed_state(bpy,scene)
    if {k:v for k,v in world84.items() if k!=BANNER}!={k:v for k,v in world112.items() if k!=BANNER}:
        raise ValueError('native non-cloth world differs at84/112')
    if scoped_fixed(fixed84,'departure')!=scoped_fixed(fixed112,'departure'):
        raise ValueError('native lights/world/instances/render settings differ at84/112')
    if materials84!={m.name:ambient.material_state(m) for m in bpy.data.materials}:
        raise ValueError('native materials differ at84/112')
    reference={'camera84':camera84,'camera112':fixed112['camera'],
        'static_world84_112':'EXACT excluding cloth/camera; all materials exact',
        'cache_knots':{},'camera_knots':{},'camera_expected':{},'projection_expected':{}}
    cloth_matrix=world112[BANNER]['matrix'];payload=None
    if kind=='arrival':
        for frame in h.CACHE_KNOTS:
            graph=at(frame);evaluated=banner.evaluated_get(graph)
            if ambient.matrix_rows(evaluated.matrix_world)!=cloth_matrix:raise ValueError('source cloth object matrix moved')
            mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
            try:
                if len(mesh.vertices)!=5130:raise ValueError('real cached cloth topology changed')
                current=cloth_payload(mesh)
                if payload is None:payload=current
                if current!=payload:raise ValueError('cache knot topology/UV/material changed')
                points=[list(v.co) for v in mesh.vertices];h.validate_points(points,5130)
                reference['cache_knots'][str(frame)]=points
            finally:evaluated.to_mesh_clear()
    if kind=='departure':
        camera=scene.camera
        if camera.parent or camera.constraints or camera.rotation_mode!='QUATERNION':
            raise ValueError('original route requires native unconstrained quaternion camera')
        ambient.assert_near(list(camera.scale),(1.,1.,1.),1e-6)
        validate_camera_curves(camera)
        previous=None
        for frame in h.CACHE_KNOTS:
            at(frame)
            q=list(camera.rotation_quaternion)
            if previous is not None and sum(a*b for a,b in zip(previous,q))<0:
                raise ValueError('source camera quaternion flips; cannot silently invent a route')
            previous=q
            reference['camera_knots'][str(frame)]={'location':list(camera.location),'rotation_quaternion':q,'lens':camera.data.lens}
        for t in h.bridge_checks(kind):
            source=h.source_clock(kind,t);at(source)
            reference['camera_expected'][str(t)]=ambient.camera_state(scene.camera)
            reference['projection_expected'][str(t)]=native_projection(scene,scene.camera,source)
    at(112)
    return reference


def set_bridge_keys(curve,times,values):
    if (not times or len(times)!=len(values) or any(not math.isfinite(x) for x in (*times,*values))
            or any(b<=a for a,b in zip(times,times[1:]))):
        raise ValueError('finite ordered bridge keys required')
    curve.extrapolation='CONSTANT'
    points=curve.keyframe_points
    points.clear();points.add(len(times))
    points.foreach_set('co',[x for t,v in zip(times,values) for x in (t,v)])
    points.sort()
    if any(b.co[0]<=a.co[0] for a,b in zip(points,points[1:])):
        raise ValueError('bridge times collapse at native float32 precision')
    # keyframe_insert and FCurve.update merge close times; preserve dense knots.
    points.handles_recalc()


def local_flutter_modes(obj,basis):
    from mathutils import Vector
    inverse=obj.matrix_world.inverted().to_3x3()
    return [[list(inverse@Vector(mode)) for mode in row] for row in h.flutter_modes(basis['uvs'])]


def add_arrival(obj,basis,reference):
    from mathutils import Vector
    obj.shape_key_add(name='Actual baked112 Basis')
    times=h.bridge_key_times('arrival')
    for knot in h.CACHE_KNOTS:
        key=obj.shape_key_add(name=f'GameOn cache {knot}')
        key.slider_min=-1;key.slider_max=2
        for vertex,point in zip(key.data,reference['cache_knots'][str(knot)]):vertex.co=Vector(point)
        key.keyframe_insert('value',frame=0)
        curve=next(c for c in ambient.curves_for(obj.data.shape_keys) if c.data_path==key.path_from_id('value'))
        set_bridge_keys(curve,times,[h.cache_weights(h.source_clock('arrival',t)).get(knot,0.) for t in times])
    modes=local_flutter_modes(obj,basis)
    for i in range(2):
        key=obj.shape_key_add(name=f'GameOn mode {i}')
        key.slider_min=-1;key.slider_max=2
        for j,base in enumerate(basis['base']):key.data[j].co=Vector(base)+Vector(modes[j][i])
        key.keyframe_insert('value',frame=0)
        curve=next(c for c in ambient.curves_for(obj.data.shape_keys) if c.data_path==key.path_from_id('value'))
        set_bridge_keys(curve,times,[h.arrival_coefficients(t)[i] for t in times])
    bridge_handles(obj.data.shape_keys,arrival_velocity)


def add_departure(camera,reference):
    camera.rotation_mode='QUATERNION'
    times=h.bridge_key_times('departure')
    samples=[h.camera_channels(reference['camera_knots'],h.source_clock('departure',t)) for t in times]
    for path in ('location','rotation_quaternion'):camera.keyframe_insert(path,frame=0)
    camera.data.keyframe_insert('lens',frame=0)
    for item in (camera,camera.data):
        for curve in ambient.curves_for(item):
            values=[row[curve.data_path] for row in samples]
            set_bridge_keys(curve,times,[v[curve.array_index] if isinstance(v,list) else v for v in values])
    velocity=lambda path,index,t,side:departure_velocity(reference,path,index,t,side)
    bridge_handles(camera,velocity);bridge_handles(camera.data,velocity)


def bridge_key_evidence(item,kind,velocity):
    evidence=[];times=h.bridge_key_times(kind)
    for curve in ambient.curves_for(item):
        keys=curve.keyframe_points
        if len(keys)!=len(times) or any(abs(k.co[0]-t)>4e-6 for k,t in zip(keys,times)) or curve.modifiers:
            raise ValueError('bridge key partition changed or acquired cyclic modifiers')
        endpoints=[]
        for t in ((0.,*h.ARRIVAL_TAIL) if kind=='arrival' else (0.,24.)):
            key=min(keys,key=lambda k:abs(k.co[0]-t));f,v=key.co
            if f!=t or key.interpolation!='BEZIER':raise ValueError('native boundary key missing')
            left=(v-key.handle_left[1])/(f-key.handle_left[0])
            right=(key.handle_right[1]-v)/(key.handle_right[0]-f)
            expected=[velocity(curve.data_path,curve.array_index,t,side) for side in (-1,1)]
            ambient.assert_near([left,right],expected,5e-4)
            endpoints.append({'frame':f,'value':v,'left_velocity':left,'right_velocity':right,'expected':expected})
        evidence.append({'path':curve.data_path,'index':curve.array_index,'key_count':len(keys),'endpoints':endpoints})
    if not evidence:raise ValueError('native bridge action missing')
    return evidence


def arrival_seam_evidence(obj,basis):
    """Actual persisted shape offsets × actual one-sided handle slopes, in world m/frame.

    The target is the unchanged loop-frame1 analytic field. No finite difference
    is substituted for either native tangent. Parent still checks both artifacts.
    """
    shape=obj.data.shape_keys;base=shape.reference_key
    blocks={key.path_from_id('value'):key for key in shape.key_blocks if key!=base}
    expected_paths={f'key_blocks["GameOn cache {k}"].value' for k in h.CACHE_KNOTS}
    expected_paths.update(f'key_blocks["GameOn mode {i}"].value' for i in range(2))
    curves=list(ambient.curves_for(shape))
    if (not shape.use_relative or set(blocks)!=expected_paths or len(curves)!=len(blocks) or
        {c.data_path for c in curves}!=expected_paths or len(base.data)!=len(basis['base'])):
        raise ValueError('arrival analytic seam requires exact relative cache and loop mode keys')
    velocities={side:[[0.,0.,0.] for _ in base.data] for side in ('left','right')}
    for curve in curves:
        block=blocks[curve.data_path]
        if (curve.array_index!=0 or curve.modifiers or block.relative_key!=base or block.mute or block.vertex_group or
            len(block.data)!=len(base.data)):
            raise ValueError('arrival analytic seam shape/curve semantics changed')
        keys=[key for key in curve.keyframe_points if key.co[0]==24.]
        if len(keys)!=1 or keys[0].interpolation!='BEZIER':raise ValueError('arrival analytic seam boundary key missing')
        key=keys[0];t,value=key.co
        slopes={'left':(value-key.handle_left[1])/(t-key.handle_left[0]),
                'right':(key.handle_right[1]-value)/(key.handle_right[0]-t)}
        if any(not math.isfinite(v) for v in slopes.values()):raise ValueError('nonfinite arrival analytic seam slope')
        for j,(point,origin) in enumerate(zip(block.data,base.data)):
            delta=[point.co[a]-origin.co[a] for a in range(3)]
            for side,slope in slopes.items():
                for a in range(3):velocities[side][j][a]+=delta[a]*slope
    modes=h.flutter_modes(basis['uvs']);weights=h.coefficient_velocity(1)
    target=[[sum(m[a]*w for m,w in zip(row,weights)) for a in range(3)] for row in modes]
    result={'arrival_frame':24,'loop_boundary_frame':1,'loop_boundary_phase':0,'ceiling_m_per_frame':1e-5,
        'method':'actual relative shape offsets and actual left/right Fcurve handle slopes; world coordinates',
        'loop_analytic_velocity_sha256':ambient.digest(target)}
    for side,local in velocities.items():
        world=[[sum(obj.matrix_world[a][b]*p[b] for b in range(3)) for a in range(3)] for p in local]
        h.validate_points(world,len(target))
        error=max(math.dist(p,q) for p,q in zip(world,target))
        if error>1e-5:raise ValueError('native arrival-to-loop analytic seam exceeds1e-5m/frame: '+str(error))
        result[side]={'max_loop_analytic_error_m_per_frame':error,
            'max_speed_m_per_frame':max(math.sqrt(sum(x*x for x in p)) for p in world),
            'native_velocity_sha256':ambient.digest(world)}
    return result


def evaluate_bridge(bpy,scene,kind,basis,materials,reference,expected_fixed,matrices,static_sha):
    """Native reconstruction and trajectory admission, never decoded C1/art PASS."""
    obj=bpy.data.objects[BANNER];rows=[];projections=[];field_error=0.
    endpoint_coords={};velocity_coords={}
    local_modes=None;incremental_pin=incremental_centroid=incremental_normal=incremental_vertical=0.
    checks=h.bridge_checks(kind)
    for t in checks:
        scene.frame_set(math.floor(t),subframe=t%1);graph=bpy.context.evaluated_depsgraph_get()
        fixed=scoped_fixed(native.fixed_state(bpy,scene),kind)
        if canonical(fixed)!=canonical(expected_fixed):raise ValueError('bridge fixed world/instances/lights/settings moved')
        if scoped_matrices(native.matrix_snapshot(scene,graph),scene.camera.name,kind)!=matrices:
            raise ValueError('bridge matrix changed outside intentionally animated camera')
        if ambient.digest({m.name:ambient.material_state(m) for m in bpy.data.materials})!=ambient.digest(materials):
            raise ValueError('bridge source materials changed')
        current=native.geometry_state(scene,graph)
        if ambient.digest({k:v for k,v in current.items() if k!=BANNER})!=static_sha:
            raise ValueError('bridge unrelated visible geometry/material moved')
        camera_source=84 if kind=='arrival' else h.source_clock(kind,t)
        expected_camera=reference['camera84'] if kind=='arrival' else reference['camera_expected'][str(t)]
        actual_camera=ambient.camera_state(scene.camera)
        camera_error=assert_camera(expected_camera,actual_camera)
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
        try:
            if len(mesh.vertices)!=5130 or cloth_payload(mesh)!=basis['payload_sha256']:
                raise ValueError('bridge cloth topology/UV/material changed')
            coords=[list(v.co) for v in mesh.vertices];h.validate_points(coords,5130)
            if kind=='arrival' and local_modes is None:local_modes=local_flutter_modes(obj,basis)
            expected=h.arrival_pose(reference['cache_knots'],t,local_modes) if kind=='arrival' else basis['base']
            error=max(math.dist(a,b) for a,b in zip(coords,expected));field_error=max(field_error,error)
            if error>1e-5:raise ValueError('native cached trajectory reconstruction exceeds1e-5m: '+str(error))
            if kind=='arrival':
                # Admit only incremental flutter relative to the actual falling cache.
                cached=h.cached_pose(reference['cache_knots'],h.source_clock(kind,t))
                deltas=[[sum(evaluated.matrix_world[a][b]*(co[b]-p[b]) for b in range(3)) for a in range(3)]
                        for co,p in zip(coords,cached)]
                pinned=[d for uv,d in zip(basis['uvs'],deltas) if uv[1]==1]
                if not pinned:raise ValueError('no incremental pinned top vertices proved')
                incremental_pin=max(incremental_pin,max(math.sqrt(sum(x*x for x in d)) for d in pinned))
                incremental_centroid=max(incremental_centroid,math.sqrt(sum((sum(d[a] for d in deltas)/5130)**2 for a in range(3))))
                incremental_normal=max(incremental_normal,max(abs(d[1]) for d in deltas))
                incremental_vertical=max(incremental_vertical,max(abs(d[2]) for d in deltas))
                if (incremental_pin>1e-6 or incremental_centroid>2e-6 or
                    incremental_normal>h.NORMAL_BOUND or incremental_vertical>h.VERTICAL_BOUND):
                    raise ValueError('arrival incremental flutter pin/centroid/normal/vertical bound failed')
            if t==24 or kind=='departure':
                if canonical(ambient.mesh_state(mesh))!=canonical(basis['mesh']):raise ValueError('bridge does not retain exact baked112 endpoint/base')
            if t in (0,24):endpoint_coords[str(t)]=coords
            if t in (-.03125,.03125,23.96875,24.03125):velocity_coords[str(t)]=coords
        finally:evaluated.to_mesh_clear()
        if t in h.bridge_checks(kind):
            projection=native_projection(scene,scene.camera,camera_source)
            if kind=='departure':h.check_projection(reference['projection_expected'][str(t)],projection)
            else:h.check_projection(reference['projection84'],projection)
            mapping,progress=h.hold.entry_mapping(projection,h.SIZE[scene.camera.name],reference['lab_roi'])
            if t<=24 and progress!=0:raise ValueError('bridge expansion started before source112')
            projections.append({'output_frame':t,'source_clock':camera_source,'row':projection,
                'photo_homography':mapping,'entry_expansion':progress})
            rows.append({'frame':t,'cloth_sha256':current[BANNER]['mesh']['geometry_uv'],
                'source_geometry_frame':h.source_clock(kind,t) if kind=='arrival' else 112,
                'source_camera_frame':camera_source,'native_time_seconds':t/24,
                'actual_camera':actual_camera,'camera_trajectory_error':camera_error,'field_error_m':error})
    velocities={}
    for t in (0,24):
        a,b=(velocity_coords[str(t+offset)] for offset in (-.03125,.03125))
        actual=[[(y-x)/.0625 for x,y in zip(p,q)] for p,q in zip(a,b)]
        cache=reference['cache_knots'] if kind=='arrival' else {'112':basis['base']}
        expected=h.bridge_reference_velocity(cache,kind,t,.03125,local_modes)
        analytic=h.bridge_reference_velocity(cache,kind,t,local_modes=local_modes)
        error=max(math.dist(p,q) for p,q in zip(actual,expected))
        if error>2e-4:raise ValueError('native endpoint finite difference differs from same cached-clock finite difference: '+str(error))
        velocities[str(t)]={'native_central_difference_dt_frames':.03125,'max_reference_fd_error_m_per_frame':error,
            'max_analytic_velocity_error_m_per_frame':max(math.dist(p,q) for p,q in zip(actual,analytic)),
            'max_analytic_speed_m_per_frame':max(math.sqrt(sum(x*x for x in p)) for p in analytic),
            'max_speed_m_per_frame':max(math.sqrt(sum(x*x for x in p)) for p in actual),'ceiling_reference_fd_error_m_per_frame':2e-4,
            'note':'analytic native handle slopes checked separately; finite difference retains truncation bias'}
    if kind=='arrival':
        keys=bridge_key_evidence(obj.data.shape_keys,kind,arrival_velocity)
        seam=arrival_seam_evidence(obj,basis)
    else:
        velocity=lambda path,index,t,side:departure_velocity(reference,path,index,t,side)
        keys=bridge_key_evidence(scene.camera,kind,velocity)+bridge_key_evidence(scene.camera.data,kind,velocity)
    return {'kind':kind,'fixed':expected_fixed,'static_sha256':static_sha,'frames':rows,'projections':projections,
        'field_error_m':field_error,'endpoint_mesh_sha256':{k:ambient.digest(v) for k,v in endpoint_coords.items()},
        'native_endpoint_velocity_probes':velocities,'native_key_endpoint_velocities':keys,
        **({'arrival_to_loop_analytic_seam':seam,'incremental_flutter':{
            'reference':'actual cached trajectory at source_clock(arrival,t), world coordinates',
            'pinned_top_error_m':incremental_pin,'pinned_top_ceiling_m':1e-6,
            'max_vertex_centroid_change_m':incremental_centroid,'centroid_ceiling_m':2e-6,
            'max_normal_m':incremental_normal,'normal_bound_m':h.NORMAL_BOUND,
            'max_vertical_m':incremental_vertical,'vertical_bound_m':h.VERTICAL_BOUND}} if kind=='arrival' else {}),
        'status':'native preparation only; no decoder-level C1, visibility, visual seam or art PASS'}


def native_descriptor(descriptor,kind,camera,checks):
    return {**descriptor,'native_preparation':{'kind':kind,'camera':camera,'rendered':[],
        'actual_evaluated_projections':checks['projections'],
        'projection_role':'physical native camera/sourceclock; future registered Lab228/ROI CPU composition'}}


def verify_prepared(path,manifest_path):
    import bpy
    path=Path(path).resolve(strict=True);manifest_path=Path(manifest_path).resolve(strict=True)
    m=json.loads(manifest_path.read_text());kind=m['kind'];camera=m['camera']
    frames=h.FRAMES if kind=='loop' else h.BRIDGE_FRAMES
    if (kind not in h.KINDS or path.name!=f'gameon112-{kind}.blend' or
        manifest_path!=path.with_name('native-manifest.json')):
        raise ValueError('expected exact paired T1 kind derivative/manifest')
    if (m['status']!='prepared-not-rendered' or m['new_render_cap']!=0 or m['rendered'] or
        m['source_pose_frame']!=112 or m['source_camera_frame']!=84 or m['frames']!=list(frames) or
        m['closure_eval_only']!=(49 if kind=='loop' else None)):
        raise ValueError('not exact zero-render T1 native kind preparation')
    h.validate_source(m['source'],camera)
    if m['source_sha256']!=h.SOURCES[camera][1] or h.sha256(path)!=m['derivative_sha256'] or author_sources()!=m['author_sources']:
        raise ValueError('source/derivative/author hashes changed')
    descriptor=path.with_name('retime-projection.json')
    expected=native_descriptor(h.retime_descriptor(),kind,camera,m['native_checks'])
    if h.sha256(descriptor)!=m['retime_descriptor_sha256'] or canonical(expected)!=json.loads(descriptor.read_text()):
        raise ValueError('data-only retime/projections or real input paths/hashes changed')
    native.no_runtime(bpy)
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    native.no_runtime(bpy);native.no_drivers(bpy);scene=bpy.context.scene
    if (scene.frame_start,scene.frame_end,scene.frame_step,scene.render.fps,scene.render.fps_base)!=(1,len(frames),1,24,1):
        raise ValueError('saved native clock changed')
    if (scene['gameon112_source_sha256']!=m['source_sha256'] or scene['gameon112_source_pose']!=112 or
        scene['gameon112_camera_pose']!=84 or scene['gameon112_kind']!=kind or scene.camera.name!=camera):
        raise ValueError('saved native identity changed')
    if any(mod.show_viewport or mod.show_render for o in bpy.data.objects for mod in o.modifiers if mod.type=='CLOTH'):
        raise ValueError('cloth woke on clean reload')
    if ambient.image_state(bpy)!=m['packed_images']:raise ValueError('packed source image bytes changed')
    scene.frame_set(1)
    if scoped_matrices(native.matrix_snapshot(scene,bpy.context.evaluated_depsgraph_get()),camera,kind)!=m['frozen_matrices']:
        raise ValueError('frozen matrices changed on fresh reload')
    if kind=='loop':actual=evaluate(bpy,scene,m['cloth_basis'],m['original_materials'],m['reading_projection_row84'])
    else:actual=evaluate_bridge(bpy,scene,kind,m['cloth_basis'],m['original_materials'],m['reference'],
        m['native_checks']['fixed'],m['frozen_matrices'],m['native_checks']['static_sha256'])
    if canonical(actual)!=m['native_checks']:raise ValueError('fresh native kind/static/endpoint evidence differs')
    native.no_runtime(bpy);native.no_drivers(bpy);h.validate_source(m['source'],camera)
    return {'status':'native-reload-verified-not-rendered','kind':kind,'camera':camera,
        'source_pose_frame':112,'source_camera_frame':84,'frames_checked':list(h.FRAMES)+[49,.75,49.25] if kind=='loop' else list(h.bridge_checks(kind)),
        'rendered':[],'new_render_cap':0,'parent_pending':h.PENDING}


def main():
    args=h.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.verify_prepared:
        print(json.dumps(verify_prepared(args.verify_prepared,args.manifest)));return
    kind=args.kind
    source=h.validate_source(args.source,args.camera)
    out=h.fresh_output(args.out,h.protected_inputs())
    descriptor=h.retime_descriptor();authors=author_sources();data=h.registry()
    expected_projection=descriptor['variants'][args.camera]['projection']['row']
    import bpy
    from mathutils import Matrix
    native.no_runtime(bpy)
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    native.no_runtime(bpy);scene=bpy.context.scene
    if scene.rigidbody_world and scene.rigidbody_world.enabled:raise ValueError('live rigid body world')
    if scene.camera.name!=args.camera:raise ValueError('original camera variant differs')
    banner=bpy.data.objects[BANNER]
    if banner.hide_render:raise ValueError('original canvas hidden')
    cloths=[(o.name,m) for o in bpy.data.objects for m in o.modifiers if m.type=='CLOTH']
    if len(cloths)!=1 or cloths[0][0]!=BANNER:raise ValueError('unexpected source cloth simulation')
    cache=h.validate_cache(banner.modifiers)  # MUST precede every source pose/depsgraph request.
    reference=capture_source(bpy,scene,banner,kind,expected_projection)
    reference['projection84']=expected_projection;reference['lab_roi']=data['variants'][args.camera]['lab_roi']
    # capture_source returns to original112; freeze helpers and their guards stay unchanged.
    source_instances={};fixed=native.fixed_state(bpy,scene,source_instances)
    graph=bpy.context.evaluated_depsgraph_get();original=native.geometry_state(scene,graph)
    if original[BANNER]['mesh']['vertices']!=5130:raise ValueError('wrong evaluated original112 topology')
    flattened={o.name for o in scene.objects if o.parent is not None or len(o.constraints)}
    materials={m.name:ambient.material_state(m) for m in bpy.data.materials}
    source_images=ambient.image_state(bpy);texture=data['banner_texture']
    if not any(row.get('packed_sha256',row.get('sha256'))==texture['sha256'] for row in source_images.values()):
        raise ValueError('accepted logo texture bytes absent from original source images')
    h.fresh_output(out,[*h.protected_inputs(),*(r['path'] for r in source_images.values() if 'path' in r)])
    converted=native.convert_visible_curves(bpy,scene)
    conversion=native.geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    conversion_parity=native.assert_source_parity(original,conversion,set(),fixed,native.fixed_state(bpy,scene))
    ambient.freeze(bpy,scene)
    native.no_drivers(bpy)
    if any(mod.show_render or mod.show_viewport for o in bpy.data.objects for mod in o.modifiers if mod.type=='CLOTH'):
        raise ValueError('inherited cloth still enabled after freeze')
    frozen=native.geometry_state(scene,bpy.context.evaluated_depsgraph_get())
    freeze_parity=native.assert_source_parity(conversion,frozen,flattened,fixed,native.fixed_state(bpy,scene))
    basis=cloth_basis(banner)
    if canonical(basis['mesh'])!=canonical(original[BANNER]['mesh']):raise ValueError('frozen112 mesh/UV/shader mismatch')
    scene.camera.matrix_world=Matrix(reference['camera84']['matrix_world'])
    scene.camera.data.lens=reference['camera84']['lens'];bpy.context.view_layer.update()
    assert_camera(reference['camera84'],ambient.camera_state(scene.camera))
    mixed_fixed=native.fixed_state(bpy,scene)
    if scoped_fixed(mixed_fixed,'departure')!=scoped_fixed(fixed,'departure'):
        raise ValueError('changing reading camera affected unrelated source state')
    matrices=scoped_matrices(native.matrix_snapshot(scene,bpy.context.evaluated_depsgraph_get()),args.camera,kind)
    static_sha=ambient.digest({k:v for k,v in frozen.items() if k!=BANNER})
    if kind=='loop':add_cloth(banner,basis)
    elif kind=='arrival':add_arrival(banner,basis,reference)
    else:add_departure(scene.camera,reference)
    frames=h.FRAMES if kind=='loop' else h.BRIDGE_FRAMES
    scene.frame_start=1;scene.frame_end=len(frames);scene.frame_step=1
    scene.render.fps=24;scene.render.fps_base=1
    if kind=='loop':checks=evaluate(bpy,scene,basis,materials,expected_projection)
    else:checks=evaluate_bridge(bpy,scene,kind,basis,materials,reference,scoped_fixed(mixed_fixed,kind),matrices,static_sha)
    if checks['static_sha256']!=static_sha:raise ValueError('source static geometry changed at animation entry')
    if checks['fixed']!=scoped_fixed(mixed_fixed,kind):raise ValueError('source fixed state changed')
    scene.frame_set(1)
    if scoped_matrices(native.matrix_snapshot(scene,bpy.context.evaluated_depsgraph_get()),args.camera,kind)!=matrices:
        raise ValueError('frozen matrices moved')
    retained=[]
    for name in materials:
        material=bpy.data.materials[name]
        if material.users==0:material.use_fake_user=True;retained.append(name)
    packed=native.pack_images(bpy,source_images)
    scene['gameon112_source_sha256']=h.SOURCES[args.camera][1];scene['gameon112_source_pose']=112
    scene['gameon112_camera_pose']=84;scene['gameon112_kind']=kind;scene['gameon112_prepared_not_rendered']=True
    native.no_runtime(bpy);native.no_drivers(bpy);h.validate_source(source,args.camera)
    if author_sources()!=authors or canonical(h.retime_descriptor())!=canonical(descriptor):raise ValueError('author/input changed during preparation')
    descriptor=native_descriptor(descriptor,kind,args.camera,checks)
    h.fresh_output(out,h.protected_inputs());out.mkdir(parents=True,exist_ok=False)
    derivative_path=out/f'gameon112-{kind}.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(derivative_path))
    descriptor_path=out/'retime-projection.json';descriptor_path.write_text(json.dumps(descriptor,indent=2)+'\n')
    h.validate_source(source,args.camera)
    manifest={'status':'prepared-not-rendered','kind':kind,'camera':args.camera,'source':str(source),
        'source_sha256':h.SOURCES[args.camera][1],'source_pose_frame':112,'source_camera_frame':84,
        'source_frame_roles':'geometry112/camera84 basis; per-frame bridge clocks in native_checks',
        'cache_before_pose_request':cache,'derivative_sha256':h.sha256(derivative_path),'author_sources':authors,
        'inputs_sha256':h.INPUTS_SHA,'inputs_role':'provenance ONLY, no old approval/budget admission',
        'retime_descriptor_sha256':h.sha256(descriptor_path),'reading_projection_row84':expected_projection,
        'frames':list(frames),'closure_eval_only':49 if kind=='loop' else None,
        'boundary_eval_only':[] if kind=='loop' else [0],'fps':24,'seconds':len(frames)/24,
        'rendered':[],'new_render_cap':0,'rebaked':False,
        'source_geometry_sha256':ambient.digest(original),'source_instances':source_instances,
        'converted_evaluated_curves':converted,'conversion_parity':conversion_parity,'freeze_parity':freeze_parity,
        'frozen_matrices':matrices,'cloth_basis':basis,'reference':reference,
        'original_materials':materials,'retained_unused_materials':retained,
        'source_images':source_images,'packed_images':packed,'native_checks':checks,
        'runtime':'native shape keys/actions; no handlers/drivers; global timer enumeration UNAVAILABLE/NOT CLAIMED',
        'parent_pending':h.PENDING,'visual_acceptance':'PENDING parent native reload, owner-approved render, art/seams/player/browser',
        'budget_note':'Original resolution/samples/settings preserved; no new render approval.'}
    receipt=out/'native-manifest.json';receipt.write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'manifest':str(receipt),'derivative':str(derivative_path),'kind':kind,
        'retime_descriptor':str(descriptor_path),'rendered':0,'new_render_cap':0}))


if __name__=='__main__':main()
