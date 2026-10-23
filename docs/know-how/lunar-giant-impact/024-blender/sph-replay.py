"""Parent-executed real-state M4/OpenVDB replay. No simulation or old scene imports.

--self-check is stdlib only. --build requires native Blender, NumPy, openvdb.
All output files are newly created; existing receipts/scenes are never overwritten.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'pkdgrav3-impact-20261006T233418Z/runtime-sph-001'
KERNEL = HERE.parent / 'pkdgrav3-energy-20261006T221901Z/source-instrumented/SPH/SPHOptions.h'
BLENDER = '/Users/vitek/Applications/Blender.app/Contents/MacOS/Blender'
FRAMES, FPS, STEPS = 96, 24, 192
DEADLINE = datetime.fromisoformat('2026-10-07T07:45:24+00:00')
CLAY0 = (0.42, 0.47, 0.53)
CLAY1 = (0.62, 0.49, 0.37)
QUADRATURE_REL_LIMIT = 0.05


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2, allow_nan=False)


def steps():
    return [round(k * STEPS / (FRAMES - 1)) for k in range(FRAMES)]


def self_check():
    require(len(set(steps())) == 96 and steps()[0] == 0 and steps()[-1] == 192,
            'mapping endpoints/uniqueness')
    require(all(a < b for a, b in zip(steps(), steps()[1:])), 'monotonic mapping')
    plan = json.loads((HERE / 'REPLAY-PLAN.json').read_text())
    require(plan['frames'] == FRAMES and plan['fps'] == FPS, 'plan clocks')
    require(plan['caps']['render_aggregate_seconds'] == 300, 'immutable render cap')
    print(json.dumps({'stdlib_structure': True, 'native_execution': False,
                      'mapping': steps()}))


def load_sources(np):
    physical = json.loads((SOURCE / 'initial-manifest.json').read_text())
    require((physical['particles'], physical['steps'], physical['material']) == (1104,192,62),
            'source contract changed')
    require(sha(SOURCE/'initial.std') == physical['initial_sha256'], 'initial hash')
    raw = (SOURCE/'initial.std').read_bytes()
    import struct
    require(struct.unpack_from('>d6I', raw) == (0.,1104,3,1104,0,0,0), 'TIPSY header')
    initial = np.array(list(struct.iter_unpack('>12f', raw[32:])))
    require((initial[:,10] == 62).all(), 'source materials')
    states, by_step, hashes = [], {}, {}
    paths = sorted(SOURCE.glob('state-*.npz'))
    require(len(paths) == 194, 'source observation count')
    for i, path in enumerate(paths):
        require(path.name == f'state-{i:03d}.npz', 'source sequence')
        with np.load(path, allow_pickle=False) as data:
            s = {key: data[key].copy() for key in data.files}
        n = int(s['step']); stage = str(s['stage'].item())
        require(n == min(i,192), 'native step ID')
        require(stage == ('post_simulate_final' if i == 193 else 'callback_before_SPH_refresh'),
                'source stage')
        require(abs(float(s['time'])-n*physical['delta_code']) < physical['delta_code']*1e-8,
                'native clock')
        require(np.array_equal(s['id'], np.arange(1104)), 'immutable sample IDs')
        require(np.array_equal(s['mass'], initial[:,0]), 'actual source masses')
        for key, value in s.items():
            if value.dtype.kind in 'fiu':
                require(np.isfinite(value).all(), 'nonfinite source '+key)
        require(all((s[k]>0).all() for k in ('mass','ball','density')), 'positive source field')
        s['_path'] = path
        hashes[path.name] = sha(path)
        states.append(s)
        # Same native step: final post-simulate replaces its callback, never float-clock dedupe.
        require(n not in by_step or stage == 'post_simulate_final', 'unexpected duplicate step')
        by_step[n] = s
    require(set(by_step) == set(range(193)), 'native step coverage')
    return physical, initial, states, by_step, hashes


def transform(np, first):
    m = first['mass'].astype(float); p = first['position']
    centers = [np.average(p[j*552:(j+1)*552], axis=0, weights=m[j*552:(j+1)*552])
               for j in (0,1)]
    u = centers[1]-centers[0]; u /= np.linalg.norm(u)
    z = np.array([0.,0.,1.]); v = np.cross(z,u)
    require(abs(np.dot(u,z)) < 1e-7, 'initial orbital plane')
    N = np.array([-.5,0.,math.sqrt(3)/2]); B = np.array([0.,-1.,0.])
    R = np.column_stack((N,np.cross(B,N),B)) @ np.column_stack((u,v,z)).T
    require(np.allclose(R.T@R,np.eye(3),atol=1e-10) and np.linalg.det(R)>0.999999,
            'proper fixed rotation')
    return R, centers[0], np.array([3.4,-.2,-3.1])


def grid_spec(np, states):
    lo = np.min([np.min(s['position']-s['ball'][:,None],axis=0) for s in states],axis=0)
    hi = np.max([np.max(s['position']+s['ball'][:,None],axis=0) for s in states],axis=0)
    # 60 support cells + two zero padding cells at each boundary: longest axis ~65 nodes.
    h = float(np.max(hi-lo)/60)
    low = lo-2*h; shape = np.ceil((hi-lo)/h).astype(int)+5
    return low, h, tuple(int(n) for n in shape)


def m4(np, q):
    return np.where(q<.5, 1-6*q*q+6*q*q*q,
                    np.where(q<1,2*(1-q)**3,0.))


def density_grid(np, s, low, h, shape):
    origins = [np.zeros(shape,dtype=np.float32),np.zeros(shape,dtype=np.float32)]
    for pid, p, mass, ball in zip(s['id'],s['position'],s['mass'],s['ball']):
        ball = float(ball)
        a = np.maximum(np.ceil((p-ball-low)/h).astype(int),0)
        b = np.minimum(np.floor((p+ball-low)/h).astype(int)+1,shape)
        if np.any(b<=a):
            continue
        xyz = np.ogrid[tuple(slice(int(a[j]),int(b[j])) for j in range(3))]
        q = np.sqrt(sum((low[j]+h*xyz[j]-p[j])**2 for j in range(3)))/ball
        stamp = float(mass)*8/(math.pi*ball**3)*m4(np,q)
        origins[int(pid)//552][tuple(slice(int(a[j]),int(b[j])) for j in range(3))] += stamp.astype(np.float32)
    return origins[0]+origins[1], origins


def interpolate(np, grid, coords):
    a = np.floor(coords).astype(int); d = coords-a
    require((a>=0).all() and (a+1<np.array(grid.shape)).all(), 'interpolation boundary')
    value = np.zeros(len(coords))
    for i in (0,1):
        for j in (0,1):
            for k in (0,1):
                value += grid[a[:,0]+i,a[:,1]+j,a[:,2]+k] * np.prod(
                    np.where(np.array([i,j,k]),d,1-d),axis=1)
    return value


def boundary_max(np, grid):
    return float(max(np.max(grid.take(i,axis=a)) for a in range(3) for i in (0,-1)))


def orient_faces(np, vertices, faces, grid):
    # OpenVDB winding convention is checked against the *same* density gradient.
    gradients = np.gradient(grid.astype(float))
    centers = np.array([vertices[list(f)].mean(axis=0) for f in faces])
    corners = np.array([f[:3] for f in faces], dtype=int)
    p = vertices[corners]
    normals = np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0])
    gradient = np.column_stack([interpolate(np,g,centers) for g in gradients])
    signs = np.sum(normals * -gradient,axis=1)
    require(len(signs)>0 and np.isfinite(signs).all(), 'finite winding test')
    if np.median(signs)<0:
        faces = [tuple(reversed(f)) for f in faces]
    return faces


def attribute(mesh, name, data, np, integer=False):
    vector = data.ndim == 2
    attr = mesh.attributes.new(name, 'FLOAT_VECTOR' if vector else ('INT' if integer else 'FLOAT'),'POINT')
    attr.data.foreach_set('vector' if vector else 'value',np.asarray(data).ravel().tolist())


def build():
    started = time.monotonic()
    require(datetime.now(timezone.utc)<DEADLINE, 'prep deadline exhausted')
    require(not any((HERE/n).exists() for n in ('replay.blend','replay-manifest.json','build-receipt.json')),
            'fresh replay outputs required')
    import bpy
    import numpy as np
    import openvdb
    from mathutils import Vector
    physical, initial, states, by_step, hashes = load_sources(np)
    admission = json.loads((HERE/'ADMISSION.json').read_text())
    require(admission['frames']==96 and admission['threads']==2 and admission['resolution']==[640,360],
            'admission settings changed')
    R, center, earth = transform(np,by_step[0])
    low,h,shape = grid_spec(np,states)
    p0 = by_step[0]['position']
    bulk = np.zeros(1104,dtype=bool)
    for j in (0,1):
        group = slice(j*552,(j+1)*552)
        c = np.average(p0[group],axis=0,weights=by_step[0]['mass'][group])
        bulk[group] = np.linalg.norm(p0[group]-c,axis=1) <= .5*physical['R_cm']/physical['L_cm']
    require(bulk.any(), 'initial bulk selection empty')
    iso = .5*float(np.median(by_step[0]['density'][bulk]))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute=False
    scene=bpy.context.scene
    scene.frame_start=1; scene.frame_end=96; scene.render.fps=24
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=4
    scene.render.threads_mode='FIXED'; scene.render.threads=2
    scene.render.resolution_x=640; scene.render.resolution_y=360; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
    scene.render.filepath=str(HERE/'frames/frame-')
    scene.world=bpy.data.worlds.new('NeutralDark'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.018,.018,.018,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25
    camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('ProtectedCamera'))
    scene.collection.objects.link(camera); scene.camera=camera
    camera.location=(0,-22,2); camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=11.5; camera.data.lens=50
    for name,pos,energy,size in [('BroadKey',(-6,-9,8),1800,5),('QuietFill',(5,-4,4),650,7)]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
        light=bpy.data.objects.new(name,data); scene.collection.objects.link(light); light.location=pos
        light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
    mat=bpy.data.materials.new('Origin diagnostic matte clay'); mat.use_nodes=True
    nodes=mat.node_tree.nodes; bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.88; bsdf.inputs['Metallic'].default_value=0
    color=nodes.new('ShaderNodeVertexColor'); color.layer_name='OriginClay'
    mat.node_tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
    source_collection=bpy.data.collections.new('Exact source references and attributes')
    scene.collection.children.link(source_collection)
    entries=[]
    for frame,step in enumerate(steps(),1):
        require(datetime.now(timezone.utc)<DEADLINE, 'prep deadline reached; stop, preserve partial evidence')
        s=by_step[step]; total,origins=density_grid(np,s,low,h,shape)
        require(np.isfinite(total).all() and (total>=0).all(), 'invalid M4 grid')
        require(boundary_max(np,total)==0, 'support clipped by fixed grid')
        mass=float(s['mass'].astype(float).sum()); integral=float(total.sum(dtype=np.float64)*h**3)
        error=abs(integral/mass-1)
        require(error<=QUADRATURE_REL_LIMIT, 'grid quadrature error exceeds declared 5% limit')
        vdb=openvdb.FloatGrid()
        vdb.copyFromArray(np.ascontiguousarray(total),ijk=(0,0,0),tolerance=0)
        verts,triangles,quads=vdb.convertToPolygons(isovalue=iso,adaptivity=0)
        index=np.asarray(verts,dtype=float)
        require(len(index)>0 and np.isfinite(index).all(), 'empty/nonfinite native mesh')
        faces=[tuple(int(x) for x in f) for array in (triangles,quads) for f in array]
        faces=orient_faces(np,index,faces,total)
        native=low+h*index; world=8*(native-center)@R.T+earth
        mesh=bpy.data.meshes.new(f'NativeSurface_{frame:03d}'); mesh.from_pydata(world.tolist(),[],faces); mesh.update()
        obj=bpy.data.objects.new(f'Replay_{frame:03d}',mesh); scene.collection.objects.link(obj)
        mesh.materials.append(mat)
        for polygon in mesh.polygons: polygon.use_smooth=True
        r0=interpolate(np,origins[0],index); r1=interpolate(np,origins[1],index)
        fraction=r1/np.maximum(r0+r1,1e-30)
        attribute(mesh,'origin1_fraction',fraction,np)
        attribute(mesh,'density_total',r0+r1,np)
        attribute(mesh,'density_origin0',r0,np); attribute(mesh,'density_origin1',r1,np)
        colors=np.column_stack(((1-fraction[:,None])*np.array(CLAY0)+fraction[:,None]*np.array(CLAY1),np.ones(len(index))))
        ca=mesh.color_attributes.new(name='OriginClay',type='FLOAT_COLOR',domain='POINT')
        ca.data.foreach_set('color',colors.ravel().tolist())
        obj['source_file']=s['_path'].name; obj['source_sha256']=hashes[s['_path'].name]
        obj['native_step']=step; obj['native_time_code']=float(s['time']); obj['own_frame']=frame
        for channel in ('hide_render','hide_viewport'):
            for at,hidden in sorted({0:True,frame:False,frame+1:True}.items()):
                setattr(obj,channel,hidden); obj.keyframe_insert(data_path=channel,frame=at)
        # Blender 5 layered Actions: edit the owning slot/channelbag, not legacy action.fcurves.
        action=obj.animation_data.action
        for layer in action.layers:
            for strip in layer.strips:
                bag=strip.channelbag(obj.animation_data.action_slot)
                if bag:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points: key.interpolation='CONSTANT'
        srcmesh=bpy.data.meshes.new(f'SourcePoints_{frame:03d}')
        srcmesh.from_pydata((8*(s['position']-center)@R.T+earth).tolist(),[],[]); srcmesh.update()
        sourceobj=bpy.data.objects.new(f'Source_{frame:03d}',srcmesh); source_collection.objects.link(sourceobj)
        sourceobj.hide_render=True; sourceobj.hide_viewport=True
        sourceobj['source_sha256']=hashes[s['_path'].name]; sourceobj['source_file']=s['_path'].name
        sourceobj['native_step']=step; sourceobj['native_time_code']=float(s['time']); sourceobj['native_stage']=str(s['stage'].item())
        for key in ('id','position','velocity','acceleration','mass','potential','density','ball'):
            attribute(srcmesh,'native_'+key,s[key],np,integer=(key=='id'))
        attribute(srcmesh,'material_id',initial[:,10].astype(int),np,integer=True)
        attribute(srcmesh,'origin_id',(s['id']//552).astype(int),np,integer=True)
        below=float(total[total<iso].sum(dtype=np.float64)*h**3)
        entries.append({'frame':frame,'native_step':step,'source_file':s['_path'].name,
                        'source_sha256':hashes[s['_path'].name], 'stage':str(s['stage'].item()),
                        'time_code':float(s['time']),'time_seconds':float(s['time'])*physical['timeunit_seconds'],
                        'vertices':len(index),'faces':len(faces),'mesh':mesh.name,
                        'source_mass_code':mass,'integrated_density_mass_code':integral,
                        'quadrature_relative_error':error,'below_iso_grid_mass_code':below,
                        'below_iso_fraction_of_source_mass':below/mass,'boundary_density_max':0.,
                        'origin1_fraction_range':[float(fraction.min()),float(fraction.max())]})
        print(json.dumps({'baked_frame':frame,'native_step':step,'vertices':len(index),'quad_error':error}),flush=True)
    manifest={'source':str(SOURCE),'all_source_hashes':hashes,'physical_manifest':physical,
              'physical_manifest_sha256':sha(SOURCE/'initial-manifest.json'),
              'admission_sha256':sha(HERE/'ADMISSION.json'),'kernel_sha256':sha(KERNEL),
              'frames':entries,'fps':FPS,'duration_seconds':4,
              'time_compression':physical['duration_code']*physical['timeunit_seconds']/4,
              'grid':{'low_native':low.tolist(),'spacing_native':h,'shape':list(shape),
                      'bbox_from':'ALL 194 position +/- actual ball support states, padded two voxels'},
              'isovalue':iso,'bulk_definition':'source initial density median within R/2 of each initial origin COM',
              'isovalue_meaning':'visual density surface cut; not physical captured mass or solid/melt boundary',
              'quadrature_relative_limit':QUADRATURE_REL_LIMIT,
              'transform':{'rotation':R.tolist(),'center_native':center.tolist(),'earth':earth.tolist(),'scale':8},
              'native_units':{'L_cm':physical['L_cm'],'M_g':physical['M_g'],'timeunit_seconds':physical['timeunit_seconds'],
                              'native_float_units':physical['native_float_units']},
              'limitations':['1104 homogeneous equal-mass forsterite particles; no historical Moon claim',
                             'clay colors label origins, not temperature',
                             'subisothreshold density remains in source; omitted from surface',
                             'no per-frame camera/bounds fit; off-camera matter disclosed by checker'],
              'builder_sha256':sha(__file__)}
    scene['replay_manifest']=json.dumps(manifest,allow_nan=False)
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'replay.blend'),check_existing=False)
    write_json(HERE/'replay-manifest.json',manifest)
    write_json(HERE/'build-receipt.json',{'wall_seconds':time.monotonic()-started,'blend_sha256':sha(HERE/'replay.blend'),
                                       'native_frames':96,'new_simulation_seconds':0,'download_bytes':0})


def render_bounded():
    require((HERE/'check-receipt.json').exists(), 'parent native check receipt required before rendering')
    require(not (HERE/'render-receipt.json').exists(), 'render budget receipt already exists; no reset')
    require(not (HERE/'frames').exists() and not (HERE/'preview').exists(), 'fresh render output directories required')
    records=[]; spent=0.; receipt=HERE/'render-receipt.json'
    # Receipt created before first subprocess, updated in place with cumulative spent time.
    write_json(receipt,{'aggregate_wall_seconds':0,'limit_seconds':300,'jobs':[], 'status':'running'})
    for name,selection in [('preview','1,24,48,72,96'),('frames','1..96')]:
        directory=HERE/name; directory.mkdir()
        cmd=[BLENDER,'--background','--factory-startup','--disable-autoexec',str(HERE/'replay.blend'),
             '--threads','2','--render-output',str(directory/'frame-'),'--render-format','PNG',
             '--render-frame',selection]
        start=time.monotonic(); status='ok'; code=None
        try:
            with (HERE/(name+'-render.log')).open('x') as log:
                process=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT)
                try: code=process.wait(timeout=max(0.01,300-spent))
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait(); status='budget_exhausted'
            if code not in (0,None): status='failed'
        finally:
            elapsed=time.monotonic()-start; spent+=elapsed
            records.append({'name':name,'command':cmd,'wall_seconds':elapsed,'returncode':code,'status':status})
            receipt.write_text(json.dumps({'aggregate_wall_seconds':spent,'limit_seconds':300,
                                           'jobs':records,'status':status},indent=2))
        require(status=='ok' and spent<=300,'render stopped: '+status)
    require(len(list((HERE/'frames').glob('frame-*.png')))==96,'incomplete native render batch')


def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    parser=argparse.ArgumentParser(); parser.add_argument('--self-check',action='store_true')
    parser.add_argument('--build',action='store_true'); parser.add_argument('--render-bounded',action='store_true')
    opt=parser.parse_args(args)
    if opt.self_check: self_check()
    elif opt.build: build()
    elif opt.render_bounded: render_bounded()
    else: parser.error('choose an explicit mode')


if __name__=='__main__': main()
