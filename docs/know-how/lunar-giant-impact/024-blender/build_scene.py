"""Authored clay contact study, no fluid solver or external assets. No render by default."""
import argparse,json,math,random,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector

EARTH=Vector((3.9,-.2,-1.05));RE=3.45;RT=1.25
N=Vector((-.75,-.3,.48)).normalized();START=Vector((-1.8,-3.6,4.2));HIT=EARTH+N*(RE+RT-.04)
velocity=HIT-START;T=(velocity-N*velocity.dot(N)).normalized();B=N.cross(T).normalized()
CONTACT=28;END=96

def smooth(a,b,x):
    u=max(0,min(1,(x-a)/(b-a)));return u*u*(3-2*u)

def material(name,colour):
    m=bpy.data.materials.new(name);m.use_nodes=True
    node=m.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=(*colour,1);node.inputs['Roughness'].default_value=.86
    m.diffuse_color=(*colour,1);return m

def fracture_cells(count=24):
    rng=random.Random(29);seeds=[]
    for _ in range(count):
        v=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-1,1))).normalized();seeds.append(v*RT*(.25+.55*rng.random()))
    source=bmesh.new();bmesh.ops.create_icosphere(source,subdivisions=3,radius=RT);reference=source.calc_volume(signed=True)
    pieces=[]
    for i,seed in enumerate(seeds):
        bm=source.copy()
        for j,other in enumerate(seeds):
            if i==j or not bm.faces:continue
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=(seed+other)*.5,plane_no=(other-seed).normalized(),clear_outer=True,clear_inner=False)
            edges=[e for e in bm.edges if e.is_boundary]
            if edges:
                caps=bmesh.ops.holes_fill(bm,edges=edges,sides=0)
                for f in caps['faces']:f.material_index=1
        if not bm.faces:bm.free();continue
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));volume=bm.calc_volume(signed=True)
        assert volume>1e-7 and all(len(e.link_faces)==2 for e in bm.edges),'invalid fracture topology'
        centre=sum((v.co for v in bm.verts),Vector())/len(bm.verts)
        for v in bm.verts:v.co-=centre
        mesh=bpy.data.meshes.new(f'TheiaCellMesh{i:02d}');bm.to_mesh(mesh);bm.free();mesh.update()
        obj=bpy.data.objects.new(f'TheiaCell{i:02d}',mesh);bpy.context.collection.objects.link(obj);obj['role']='theia_cell';obj['source_volume']=volume
        pieces.append((obj,centre,volume))
    source.free();return pieces,reference

def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def light(name,position,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=position;aim(obj,(0,0,0))

def build_scene():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=END;scene.render.fps=24
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=4;scene.cycles.use_denoising=False
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=640;scene.render.resolution_y=360;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.film_transparent=False
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
    world=bpy.data.worlds.new('ClaySpace');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.025,.025,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35;scene.world=world
    surface=material('NeutralClay',(.48,.48,.48));inside=material('FreshFracture',(.20,.20,.20))
    bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=4,radius=RE)
    for v in bm.verts:
        d=v.co.normalized();v.co*=1+.006*math.sin(d.x*11)*math.sin(d.y*9)*math.sin(d.z*13)
    mesh=bpy.data.meshes.new('ReceivingEarthMesh');bm.to_mesh(mesh);bm.free();mesh.update()
    earth=bpy.data.objects.new('ReceivingEarth',mesh);bpy.context.collection.objects.link(earth);earth.location=EARTH;mesh.materials.append(surface)
    for p in mesh.polygons:p.use_smooth=True
    earth.shape_key_add(name='Basis');response=earth.shape_key_add(name='LocalPressure')
    for p in response.data:
        direction=p.co.normalized();c=direction.dot(N)
        if c>.55:p.co+=direction*(-.40*smooth(.65,.96,c)+.14*math.exp(-((c-.78)/.065)**2))+T*.12*smooth(.7,.99,c)
    for frame,value in [(1,0),(CONTACT,0),(CONTACT+12,1),(END,.25)]:response.value=value;response.keyframe_insert(data_path='value',frame=frame)
    pieces,reference=fracture_cells();objects=[]
    for ordinal,(obj,centre,volume) in enumerate(pieces):
        obj.data.materials.append(surface);obj.data.materials.append(inside)
        for p in obj.data.polygons:p.use_smooth=p.material_index==0
        obj.shape_key_add(name='Basis');yielding=obj.shape_key_add(name='MantleYield')
        for point in yielding.data:
            v=point.co;a=v.dot(T);n=v.dot(N);b=v.dot(B)
            point.co=T*(a*1.8+n*.48)+N*(n*.62)+B*(b/(1.8*.62))
        front=centre.dot(N)<-.10;delay=0 if front else .03+.12*(ordinal%7)/6
        for frame in range(1,END+1):
            if frame<=CONTACT:
                u=(frame-1)/(CONTACT-1);obj.location=START.lerp(HIT,u*u)+centre;yielding.value=0
            else:
                time=(frame-CONTACT)/24
                if front:
                    target=EARTH+N*2.15+T*(.2+centre.dot(T)*.35)+B*centre.dot(B)*.45
                    u=smooth(.02,.85,time);obj.location=(HIT+centre).lerp(target,u);yielding.value=.55*smooth(0,.32,time)
                else:
                    reach=.9+2.6*(centre.dot(N)/RT+1)*.5
                    target=EARTH+N*(RE+.62)+T*reach+B*centre.dot(B)*1.8
                    u=smooth(delay,1.55+delay,time);obj.location=(HIT+centre).lerp(target,u)
                    # Different source volumes and local start times break the sphere's identity, not a global scale/fade.
                    yielding.value=smooth(delay,.7+delay,time)
                obj.rotation_euler=T*(.10*smooth(.15,1.8,time)*(1 if ordinal%2 else -1))
            obj.keyframe_insert(data_path='location',frame=frame);obj.keyframe_insert(data_path='rotation_euler',frame=frame);yielding.keyframe_insert(data_path='value',frame=frame)
        objects.append(obj)
    camera_data=bpy.data.cameras.new('FixedContactCamera');camera=bpy.data.objects.new('FixedContactCamera',camera_data);bpy.context.collection.objects.link(camera)
    camera.location=(0,-22,2.0);aim(camera,(0,0,0));camera_data.type='ORTHO';camera_data.ortho_scale=11.5;camera_data.lens=50;scene.camera=camera
    light('BroadKey',(-6,-9,8),1800,5);light('QuietFill',(5,-4,4),650,7)
    scene.frame_set(1);scene['disclaimer']='Authored impact clay study, not scientifically validated planetary physics';scene['render_budget']='CPU2threads,640x360,4samples; no heavy video submission without separate approval'
    return scene,objects,reference

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);options=parser.parse_args(args)
    assert not options.output.exists(),'refusing to replace an existing Blender study'
    scene,cells,reference=build_scene();options.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(options.output),check_existing=False)
    print(json.dumps({'saved':str(options.output),'cells':len(cells),'source_volume':reference,'render_submitted':False}))
