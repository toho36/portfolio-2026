"""Worker-safe contracts; these tests confer no native or visual acceptance."""
import ast
import contextlib
import io
import json
import math
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

try:
    import continuous_motion as m
except ModuleNotFoundError:
    m = None


class ContinuousContracts(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(m, 'new continuous-motion implementation required')

    def test_global_clock_and_unwrapped_permutation_closure(self):
        import ambient_holds as old
        for i in range(72):
            self.assertEqual(m.oval_pose(i, 228), old.belt_pose(i, 1))
            for f in (228, 467.75, 468, 660, 803.25):
                a = m.oval_pose(i, f)
                b = m.oval_pose(i, f+48)
                c = m.oval_pose((i+1) % 72, f)
                self.assertLess(math.dist(b[:2], c[:2]), 1e-11)
                self.assertLess(math.dist(m.oval_velocity(i, f+48), m.oval_velocity((i+1)%72, f)), 1e-12)
                self.assertLess(math.dist(m.oval_velocity(i, f), m.oval_velocity(i, f+72*48)), 1e-12)
                self.assertGreater(b[2], a[2]-.00001)
        # 240 elapsed frames = five pitches, same physical multiset at 468.
        for i in range(72):
            self.assertLess(math.dist(m.oval_pose(i, 468)[:2], old.belt_pose((i+5)%72, 1)[:2]), 1e-11)

    def test_projected_bottom_straight_moves_left_in_both_cameras(self):
        import goal_loop as goal
        for camera in m.CAMERAS:
            pos, target, lens = goal.camera_pose(468, camera == 'mobile')
            for i in (48, 49, 50, 51):
                # Probe identifies SOURCE positions; positive distance has -X tangent.
                x, y, angle = goal.track(goal.LENGTH*i/72)
                self.assertAlmostEqual(y, 2.1)
                a = m.project_x((600+x, y, .624), pos, target, lens)
                b = m.project_x((600+x-.02, y, .624), pos, target, lens)
                self.assertLess(b, a)
                x,y,_ = m.oval_pose(i-5,468)
                nx,ny,_ = m.oval_pose(i-5,468.5)
                self.assertLess(m.project_x((600+nx,ny,.624),pos,target,lens),
                                m.project_x((600+x,y,.624),pos,target,lens))

    def test_story_idle_values_and_derivatives_share_absolute_time(self):
        for subject, anchor, count in (('belt-idle', 468, 48), ('office-idle', 660, 96)):
            self.assertEqual(m.output_frames(subject), tuple(range(1, count+1)))
            for f in (.75, 1, 13.5, count+1.25):
                self.assertEqual(m.global_frame(subject, f), anchor+f-1)
                g = m.global_frame(subject, f)
                self.assertEqual(m.leaf_coefficients(g), m.leaf_coefficients(g+count))
                self.assertEqual(m.leaf_coefficient_velocity(g), m.leaf_coefficient_velocity(g+count))
                self.assertAlmostEqual(m.seam_phase(g+48)-m.seam_phase(g), 1)
        self.assertEqual(m.output_frames('story'), tuple(range(229, 805)))
        self.assertEqual(m.leaf_coefficients(660), (0., 0.))
        for f in (228, 468, 660, 804):
            eps = 1e-4
            a, b = m.leaf_coefficients(f-eps), m.leaf_coefficients(f+eps)
            self.assertLess(math.dist(tuple((y-x)/(2*eps) for x,y in zip(a,b)), m.leaf_coefficient_velocity(f)), 1e-8)

    def test_leaf_attachment_crosssections_and_existing_field(self):
        import refined_holds as old
        self.assertEqual(m.LEAVES, old.leaf_names())
        self.assertEqual(len(m.LEAF_CURVES), 18)
        self.assertNotIn('SS lamp upright', m.LEAF_CURVES)
        for i in range(9):
            for f in (229, 468, 649.5, 660, 713, 804):
                for dz in (-.007, 0, .012):
                    p = (*old.PLANT_ROOT[:2], old.PLANT_ROOT[2]+dz)
                    self.assertLess(math.dist(m.leaf_delta(p, i, f), (0., 0., 0.)), 1e-12)
                self.assertEqual(m.leaf_delta(old.leaf_tip(i), i, f), old.leaf_delta(old.leaf_tip(i), i, f-660+1))

    def test_fan_96_frame_head_closure_and_integer_rotor_turns(self):
        self.assertEqual(m.FAN_ORIGIN, (597.5, 6.17, 1.65))
        for f in (228, 468, 660, 684.25, 804):
            self.assertAlmostEqual(m.fan_head(f), m.fan_head(f+96))
            self.assertAlmostEqual(m.fan_head_velocity(f), m.fan_head_velocity(f+96))
            self.assertAlmostEqual((m.fan_rotor(f+24)-m.fan_rotor(f))/math.tau, 1)
            e = 1e-4
            self.assertAlmostEqual((m.fan_head(f+e)-m.fan_head(f-e))/(2*e), m.fan_head_velocity(f), places=8)
        self.assertGreater(abs(m.fan_head(684)-m.fan_head(660)), .25)

    def test_click_contact_precedes_whole_front_minimize(self):
        self.assertLess(m.CURSOR_CONTACT, m.MINIMIZE_START)
        self.assertLess(m.MINIMIZE_END, 732)
        self.assertEqual(m.cursor_tip(m.CURSOR_CONTACT), m.YELLOW_LOCAL)
        self.assertLess(m.cursor_scale(m.CURSOR_PRESS), m.cursor_scale(m.CURSOR_CONTACT))
        self.assertEqual(m.front_transform(660), ((0., 0., 0.), (1., 1., 1.)))
        self.assertEqual(m.front_transform(m.MINIMIZE_START), ((0., 0., 0.), (1., 1., 1.)))
        delta, scale = m.front_transform(m.MINIMIZE_END)
        self.assertLess(delta[2], -.4)
        self.assertTrue(all(.02 < s < .1 for s in scale))
        self.assertFalse(m.front_hidden(m.MINIMIZE_END))
        self.assertTrue(m.front_hidden(m.MINIMIZE_END+1))
        self.assertGreater(m.REAR_GAP, .02)
        self.assertLess(m.REAR_GAP, .08)

    def test_house_clock_remains_original(self):
        import playground
        for f in range(660, 805):
            self.assertEqual(m.villa_frame(f), playground.villa_frame(f))
        self.assertEqual(m.villa_frame(468),156)
        self.assertEqual([m.villa_frame(f) for f in (660,743,744,780,804)], [156,156,156,192,192])

    def test_fixed_admission_and_output_negative_guards(self):
        self.assertEqual(m.SOURCES['desktop'][1], '63234fa44126fa411f4d890ae8e6e76ed29e69026019a4caec22df86a965b021')
        self.assertEqual(m.SOURCES['mobile'][1], 'feff73359e8a6fc1a9fbda6fe08c13aab4e6417f8cca50b4495606fd22add39e')
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root/'source.blend';source.write_bytes(b'fixture')
            source.with_name('playground-manifest.json').write_text(json.dumps({
                'native_scene':str(source),'native_scene_sha256':m.sha256(source)}))
            with patch.dict(m.SOURCES, {'desktop': (source, m.sha256(source))}), patch.dict(
                    m.SOURCE_MANIFEST_SHA256, {'desktop':m.sha256(source.with_name('playground-manifest.json'))}):
                self.assertEqual(m.validate_source(source, 'desktop'), source.resolve())
                duplicate=root/'duplicate.blend';duplicate.write_bytes(b'fixture')
                with self.assertRaises(ValueError):m.validate_source(duplicate, 'desktop')
                source.write_bytes(b'changed')
                with self.assertRaises(ValueError):m.validate_source(source, 'desktop')
            for out in (root, source, source/'nested', root/'absent'/'child'):
                protected = [source] if out != root/'absent'/'child' else [root/'absent']
                with self.assertRaises(ValueError):m.fresh_output(out, protected)
        m.load_approval()  # Exact nonsecret owner approval, read only.
        with patch.object(m, 'APPROVAL_SHA256', '0'*64):
            with self.assertRaises(ValueError):m.load_approval()

    def test_output_stays_in_existing_followup_and_rejects_inputs(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);scope=root/'followup';scope.mkdir()
            with patch.object(m,'FOLLOWUP',scope),patch.object(m,'protected_inputs',return_value=[scope/'input']):
                self.assertEqual(m.validate_output(scope/'new-story-desktop'),(scope/'new-story-desktop').resolve())
                for out in (root/'outside',scope,scope/'input'/'nested'):
                    with self.assertRaises(ValueError):m.validate_output(out)

    def test_actual_hierarchy_guard_keeps_rails_and_house_separate(self):
        import build_continuous_motion as native
        def obj(name,parent=None):
            result=SimpleNamespace(name=name,parent=parent,children=[])
            if parent:parent.children.append(result)
            return result
        front=obj(m.FRONT);rail=obj('source rail',front);content=obj('source content',front)
        button=obj('actual yellow',content);cursor=obj('cursor',front)
        rear=obj(m.REAR);rear_content=obj(m.REAR_CONTENT,rear);house=obj(m.HOUSE,rear_content)
        names=[front.name,rail.name,content.name,button.name]
        native.window_hierarchy(front,rear,house,cursor,names)
        front.children.remove(rail)
        with self.assertRaises(ValueError):native.window_hierarchy(front,rear,house,cursor,names)
        front.children.append(rail);rear.parent=front
        with self.assertRaises(ValueError):native.window_hierarchy(front,rear,house,cursor,names)

    def test_channel_guard_preserves_inherited_key_handles_and_filters_only_new_keys(self):
        import build_continuous_motion as native
        def point(frame,value):
            return SimpleNamespace(co=SimpleNamespace(x=frame),handle_left=(frame-1/3,value),
                                   handle_right=(frame+1/3,value),interpolation='LINEAR')
        old=point(660,1);new=point(661,1)
        curve=SimpleNamespace(data_path='location',array_index=0,keyframe_points=[old])
        def insert(**kwargs):
            old.handle_right=(999,999);curve.keyframe_points.append(new)
        item=SimpleNamespace(keyframe_insert=insert)
        with patch.object(native.ambient,'curves_for',return_value=[curve]):
            native.key(item,'location',661)
        self.assertEqual(old.handle_right,(660+1/3,1))
        self.assertEqual(new.interpolation,'LINEAR')
        with self.assertRaises(ValueError):native.require_channels([{'path':'location','index':0}], [('location',1)])

    def test_new_solid_boxes_have_outward_normals(self):
        import build_continuous_motion as native
        class Mesh:
            def __init__(self):self.materials=[]
            def from_pydata(self,vertices,edges,faces):self.vertices=vertices;self.faces=faces
            def update(self):pass
        class Objects(dict):
            def new(self,name,data):
                obj=SimpleNamespace(name=name,data=data);self[name]=obj;return obj
        bpy=SimpleNamespace(data=SimpleNamespace(meshes=SimpleNamespace(new=lambda name:Mesh()),objects=Objects()))
        collection=SimpleNamespace(objects=SimpleNamespace(link=lambda obj:None))
        link,box=native.constructors(bpy,collection)
        solid=box('test solid',(0,0,0),(1,2,3),object(),None).data
        volume=0.
        for face in solid.faces:
            a=solid.vertices[face[0]]
            for j in range(1,len(face)-1):
                b,c=(solid.vertices[face[k]] for k in (j,j+1))
                cross=(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0])
                volume+=sum(x*y for x,y in zip(a,cross))/6
        self.assertAlmostEqual(volume,6)

    def test_story_curve_audit_admits_hidden_identity_without_losing_guards(self):
        import build_continuous_motion as native
        matrix=((1,0,0,0),(0,1,0,0),(0,0,1,0),(0,0,0,1))
        curve=SimpleNamespace(name='source curve',type='CURVE',hide_render=True,
            instance_type='NONE',instance_collection=None,modifiers=[],matrix_world=matrix,
            data=SimpleNamespace(splines=[SimpleNamespace(type='BEZIER')]),payload='same')
        curve.original=curve;curve.as_pointer=lambda:1;curve.evaluated_get=lambda graph:curve
        mesh=SimpleNamespace(name='self mesh',type='MESH',original=curve,hide_render=True,
            instance_type='NONE',instance_collection=None,modifiers=[],matrix_world=matrix,payload='same')
        row=SimpleNamespace(is_instance=True,object=mesh,parent=curve,show_self=True,
            show_particles=False,persistent_id=(0,)+(2147483647,)*7,matrix_world=matrix,random_id=7)
        normal=SimpleNamespace(is_instance=False)
        scene=SimpleNamespace(objects=[curve]);graph=SimpleNamespace(object_instances=[normal,row])
        audit=native.continuous_collection_instances
        with patch.object(native.refined,'curve_surface',side_effect=lambda o,g:o.payload),patch.object(
                native.refined,'curve_object_render',side_effect=lambda o:{'hide_render':o.hide_render}):
            evidence={};self.assertEqual(list(audit(scene,graph,evidence)),[normal])
            self.assertEqual(evidence['curve_self_mesh_count'],1)
            mesh.hide_render=False
            with self.assertRaises(ValueError):list(audit(scene,graph,{}))
            mesh.hide_render=True;mesh.payload='changed'
            with self.assertRaises(ValueError):list(audit(scene,graph,{}))
            mesh.payload='same';row.show_particles=True
            with self.assertRaises(ValueError):list(audit(scene,graph,{}))
            row.show_particles=False;graph.object_instances=[normal,row,row]
            with self.assertRaises(ValueError):list(audit(scene,graph,{}))
            graph.object_instances=[normal]
            with self.assertRaises(ValueError):list(audit(scene,graph,{}))

    def test_motion_handles_preserve_inherited_visibility(self):
        import build_continuous_motion as native
        def point(f,v):
            return SimpleNamespace(co=(f,v),handle_left=(f-.5,v),handle_right=(f+.5,v),
                interpolation='CONSTANT',handle_left_type='AUTO_CLAMPED',handle_right_type='AUTO_CLAMPED')
        visibility=SimpleNamespace(data_path='hide_render',array_index=0,
            keyframe_points=[point(1,1),point(169,0)],extrapolation='CONSTANT')
        position=SimpleNamespace(data_path='location',array_index=0,
            keyframe_points=[point(228,0),point(229,1)],extrapolation='CONSTANT')
        before=[dict(p.__dict__) for p in visibility.keyframe_points]
        with patch.object(native.ambient,'curves_for',return_value=[visibility,position]):
            native.motion_handles(object(),lambda p,i,f:1,{'location','rotation_euler'})
        self.assertEqual([p.__dict__ for p in visibility.keyframe_points],before)
        self.assertEqual(visibility.extrapolation,'CONSTANT')
        self.assertEqual(position.extrapolation,'LINEAR')
        self.assertTrue(all(p.interpolation=='BEZIER' for p in position.keyframe_points))

    def test_native_key_audit_scopes_owned_paths_not_inherited_visibility(self):
        import build_continuous_motion as native
        class Pair(tuple):
            x=property(lambda s:s[0]);y=property(lambda s:s[1])
        point=SimpleNamespace(co=Pair((228,1)),handle_left=Pair((228-1/3,1-1/3)),
            handle_right=Pair((228+1/3,1+1/3)))
        owned=SimpleNamespace(data_path='location',array_index=0,keyframe_points=[point])
        inherited=SimpleNamespace(data_path='hide_render',array_index=0,keyframe_points=[])
        with patch.object(native.ambient,'curves_for',return_value=[inherited,owned]):
            rows=native.native_keys(SimpleNamespace(name='tread'),[228],lambda p,i,f:1,
                lambda p,i,f:1,paths={'location','rotation_euler'})
        self.assertEqual([(r['path'],r['index']) for r in rows],[('location',0)])

    def test_fan_inherits_exact_desk_lifetime_and_idle_anchor(self):
        import build_continuous_motion as native
        keys=[[1,1],[469,1],[470,0]]
        self.assertEqual(native.fan_visibility_keys('story',keys),keys)
        self.assertEqual(native.fan_visibility_keys('belt-idle',keys),[[1,1]])
        self.assertEqual(native.fan_visibility_keys('office-idle',keys),[[1,0]])
        with self.assertRaises(ValueError):native.fan_visibility_keys('story',[[1,1],[469,0]])
        self.assertTrue({469,469.75,470}.issubset(native.probe_frames('story')))
        # Exercise the native admission wiring with evaluated visibility fixtures.
        class Pair(tuple):
            x=property(lambda s:s[0]);y=property(lambda s:s[1])
        class Item:
            def __init__(self,name):self.name=name;self.curves=[];self.hide_render=False
            def keyframe_insert(self,data_path,frame):
                if not self.curves:
                    self.curves=[SimpleNamespace(data_path=data_path,array_index=0,keyframe_points=[],
                                                 extrapolation='CONSTANT',modifiers=[])]
                self.curves[0].keyframe_points.append(SimpleNamespace(co=Pair((frame,int(self.hide_render))),interpolation=None))
            def evaluated_get(self,graph):
                values=[[p.co.x,p.co.y] for p in self.curves[0].keyframe_points] if self.curves else [[1,self.hide_render]]
                hidden=next(v for f,v in reversed(values) if f <= max(scene.frame,1))
                return SimpleNamespace(hide_render=bool(hidden))
        scene=SimpleNamespace(frame=1)
        scene.frame_set=lambda f,subframe:setattr(scene,'frame',f+subframe)
        objects={name:Item(name) for name in (m.FAN_DESK,'fan mesh','fan head')}
        bpy=SimpleNamespace(data=SimpleNamespace(objects=objects),context=SimpleNamespace(evaluated_depsgraph_get=lambda:object()))
        fan={'objects':['fan mesh','fan head']};roles={'desk_visibility':{'keys':keys}}
        with patch.object(native.ambient,'curves_for',side_effect=lambda item:item.curves):
            for subject in m.SUBJECTS:
                desk=objects[m.FAN_DESK];desk.curves=[]
                if subject == 'story':
                    for f,v in keys:desk.hide_render=bool(v);native.key(desk,'hide_render',f,True)
                else:desk.hide_render=subject=='belt-idle'
                for name in fan['objects']:objects[name].curves=[]
                native.animate_fan_visibility(bpy,fan,subject,keys)
                result=native.check_fan_visibility(bpy,scene,subject,roles,fan)
                self.assertEqual(len(result['evaluated_samples']),len(native.probe_frames(subject)))
                if subject=='belt-idle':
                    self.assertTrue(all(all(row['fan_hidden'].values()) for row in result['evaluated_samples']))
                with patch.object(objects['fan mesh'],'evaluated_get',return_value=SimpleNamespace(hide_render=not desk.evaluated_get(None).hide_render)):
                    with self.assertRaises(ValueError):native.check_fan_visibility(bpy,scene,subject,roles,fan)

    def test_exact_visibility_audit_rejects_extra_keys_and_wrong_interpolation(self):
        import build_continuous_motion as native
        class Pair(tuple):
            x=property(lambda s:s[0]);y=property(lambda s:s[1])
        points=[SimpleNamespace(co=Pair((f,v)),interpolation='CONSTANT') for f,v in ((1,1),(469,1),(470,0))]
        curve=SimpleNamespace(data_path='hide_render',array_index=0,keyframe_points=points,
                              extrapolation='CONSTANT',modifiers=[])
        with patch.object(native.ambient,'curves_for',return_value=[curve]):
            self.assertEqual(native.exact_visibility(object(),[[1,1],[469,1],[470,0]])['keys'],[[1,1],[469,1],[470,0]])
            points[-1].interpolation='BEZIER'
            with self.assertRaises(ValueError):native.exact_visibility(object(),[[1,1],[469,1],[470,0]])
            points[-1].interpolation='CONSTANT';curve.extrapolation='LINEAR'
            with self.assertRaises(ValueError):native.exact_visibility(object(),[[1,1],[469,1],[470,0]])
            curve.extrapolation='CONSTANT';points.append(SimpleNamespace(co=Pair((471,0)),interpolation='CONSTANT'))
            with self.assertRaises(ValueError):native.exact_visibility(object(),[[1,1],[469,1],[470,0]])

    def test_house_reset_rejects_source_offset_and_checks_both_actual_depth_edges(self):
        import build_continuous_motion as native
        matrix=[[1.,0,0,-1.4357556210597977e-7],[0,1.,0,-8.064034773269668e-8],[0,0,1.,0],[0,0,0,1.]]
        native.house_relative_identity(matrix)
        for row,col,value in ((0,3,.000002),(1,3,-.000002),(0,0,1.000002)):
            bad=[r[:] for r in matrix];bad[row][col]=value
            with self.assertRaises(ValueError):native.house_relative_identity(bad)
        native.house_depth([5.9,5.91],[5.95,5.96],[6.,6.01])
        for house in ([5.914,5.96],[5.95,5.995],[5.95,6.1]):
            with self.assertRaises(ValueError):native.house_depth([5.9,5.91],house,[6.,6.01])

    def test_cursor_mirror_preserves_tip_face_normal_and_rejects_occlusion(self):
        import build_continuous_motion as native
        vertices=m.CURSOR_VERTICES
        self.assertEqual(vertices[0],(0,0,0))
        self.assertTrue(all(v[0] < 0 and v[2] < 0 for v in vertices[1:]))
        def normal_y(verts,face):
            return sum(verts[a][2]*verts[b][0]-verts[a][0]*verts[b][2] for a,b in zip(face,face[1:]+face[:1]))
        old=[(-x,y,z) for x,y,z in vertices]
        self.assertAlmostEqual(normal_y(vertices,m.CURSOR_FACE),normal_y(old,tuple(range(6,-1,-1))))
        visible={'hit':'cursor','hit_hide_render':False,'hit_visible_camera':True}
        boundary={'hit':None,'hit_hide_render':None,'hit_visible_camera':None}
        native.cursor_visibility_guard([.2,.4,1],[.21,.42,1],boundary,visible,'cursor')
        for body in ([.19,.42,1],[.21,.38,1]):
            with self.assertRaises(ValueError):native.cursor_visibility_guard([.2,.4,1],body,boundary,visible,'cursor')
        for hit in ({**visible,'hit':'unknown'},{**visible,'hit_hide_render':True},{**visible,'hit_visible_camera':False},boundary):
            with self.assertRaises(ValueError):native.cursor_visibility_guard([.2,.4,1],[.21,.42,1],boundary,hit,'cursor')
        with self.assertRaises(ValueError):native.cursor_visibility_guard([.2,.4,1],[.21,.42,1],{**visible,'hit':'occluder'},visible,'cursor')

    def test_leaf_admission_rejects_curve_and_object_animation_before_conversion(self):
        import build_continuous_motion as native
        animation=SimpleNamespace(action=None,drivers=[],nla_tracks=[])
        data=SimpleNamespace(animation_data=animation,curves=[])
        obj=SimpleNamespace(name='fixture leaf',type='CURVE',data=data,animation_data=None,
                            curves=[SimpleNamespace(data_path='hide_render')])
        with patch.object(native.ambient,'curves_for',side_effect=lambda item:item.curves),patch.object(
                native,'channel_state',return_value={'curves':[],'nla':0}):
            native.leaf_animation_admission([obj])
            for field,value in (('action',object()),('drivers',[object()]),('nla_tracks',[object()])):
                setattr(animation,field,value)
                with self.assertRaises(ValueError):native.leaf_animation_admission([obj])
                setattr(animation,field,None if field=='action' else [])
            data.curves=[SimpleNamespace(data_path='bevel_factor_end')]
            with self.assertRaises(ValueError):native.leaf_animation_admission([obj])
            data.curves=[];obj.curves.append(SimpleNamespace(data_path='location'))
            with self.assertRaises(ValueError):native.leaf_animation_admission([obj])
            obj.curves.pop();obj.animation_data=SimpleNamespace(drivers=[],nla_tracks=[object()])
            with self.assertRaises(ValueError):native.leaf_animation_admission([obj])

    def test_fan_closure_uses_saved_curves_and_detects_drift(self):
        import build_continuous_motion as native
        head=SimpleNamespace(data_path='rotation_euler',array_index=2,evaluate=lambda f:m.fan_head(659+f))
        rotor=SimpleNamespace(data_path='rotation_euler',array_index=1,evaluate=lambda f:m.fan_rotor(659+f))
        with patch.object(native.ambient,'curves_for',side_effect=lambda item:[head] if item=='head' else [rotor]):
            proof=native.fan_curve_closure('head','rotor')
            self.assertAlmostEqual(proof['rotor_turns'],4,places=5)
            head.evaluate=lambda f:m.fan_head(659+f)+.001*f
            with self.assertRaises(ValueError):native.fan_curve_closure('head','rotor')
            head.evaluate=lambda f:m.fan_head(659+f)
            rotor.evaluate=lambda f:m.fan_rotor(659+f)+.001*f
            with self.assertRaises(ValueError):native.fan_curve_closure('head','rotor')
            rotor.evaluate=lambda f:m.fan_rotor(659+f)
            head.evaluate=lambda f:m.fan_head(659+f)+.01*math.sin(math.pi*(f-1)/96)
            with self.assertRaises(ValueError):native.fan_curve_closure('head','rotor')

    def test_idle_freeze_keeps_native_values_without_matrix_roundtrip(self):
        import build_continuous_motion as native
        class Object:
            name='unchanged';parent=None
            def __init__(self):self.constraints=[]
            def evaluated_get(self,graph):return self
            @property
            def matrix_world(self):return SimpleNamespace(copy=lambda:self.matrix_world)
            @matrix_world.setter
            def matrix_world(self,value):raise AssertionError('unexpected world transform reassignment')
        obj=Object();cleared=[]
        owner=SimpleNamespace(animation_data_clear=lambda:cleared.append(True))
        scene=SimpleNamespace(objects=[obj],timeline_markers=[],frame_set=lambda *a,**k:None)
        bpy=SimpleNamespace(context=SimpleNamespace(evaluated_depsgraph_get=lambda:object(),
            view_layer=SimpleNamespace(update=lambda:None)))
        texture=SimpleNamespace(image=SimpleNamespace(source='SEQUENCE'),image_user=SimpleNamespace())
        matrix=[[int(i==j) for j in range(4)] for i in range(4)]
        geometry={'unchanged':{'mesh':{'vertices':'same'},'matrix':matrix}}
        with patch.object(native,'sequence_state',return_value=({},texture,None)),patch.object(
                native,'all_ids',return_value=[owner]),patch.object(native.refined,'geometry_state',return_value=geometry):
            native.freeze_idle(bpy,scene,468)
            self.assertEqual(cleared,[True]);self.assertEqual(texture.image.source,'FILE')
            obj.constraints.append(object())
            with self.assertRaisesRegex(ValueError,'constraints'):native.freeze_idle(bpy,scene,468)
            self.assertEqual(cleared,[True])

    def test_cli_exposes_only_prepare_and_readonly_verify(self):
        base = ['--prepare-only','--subject','story','--camera','desktop','--source','x.blend','--out','fresh']
        self.assertTrue(m.parse_args(base).prepare_only)
        verify = ['--verify-prepared','x.blend','--manifest','native-manifest.json']
        self.assertIsNotNone(m.parse_args(verify).verify_prepared)
        for args in ([], base+['--render'], base+['--samples','8'], base+['--frames','1'],
                     base+['--prepare'], verify+['--out','x'], verify+['--camera','desktop'],
                     base+['--verify-prepared','x.blend'], base[:-2], base+['--approval','other']):
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):m.parse_args(args)

    def test_native_module_is_import_safe_and_has_no_render_fallback(self):
        import build_continuous_motion as native
        self.assertTrue(callable(native.verify_prepared))
        tree = ast.parse(Path(native.__file__).read_text())
        calls = [ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n, ast.Call)]
        self.assertFalse(any(x.startswith(('bpy.ops.render', 'subprocess', 'os.system')) or 'timers.register' in x for x in calls))
        self.assertNotIn('ambient.freeze', calls)
        funcs={n.name:ast.unparse(n) for n in tree.body if isinstance(n,ast.FunctionDef)}
        self.assertIn('LEAF_CURVES', funcs['convert_leaf_curves'])
        self.assertNotIn('convert_visible_curves', calls)
        self.assertIn('refined.collection_instances', calls)
        self.assertIn('original', funcs['verify_prepared'])


if __name__ == '__main__':
    unittest.main()
