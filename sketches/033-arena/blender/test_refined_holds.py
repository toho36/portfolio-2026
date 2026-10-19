"""Worker-safe math/admission checks. Native Blender checks remain parent-only."""
import ast
import contextlib
import copy
import io
import json
import math
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

try:
    import refined_holds as h
except ModuleNotFoundError:
    h = None


class RefinedContracts(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(h, 'refined pure implementation required')

    def test_two_seconds_and_no_render_budget(self):
        self.assertEqual((h.FRAMES, h.CLOSE_FRAME, h.FPS), (tuple(range(1,49)),49,24))
        self.assertEqual(h.NEW_RENDER_CAP, 0)

    def test_coefficients_and_velocity_close_at_fractional_seam(self):
        self.assertEqual(h.coefficients(1), (0.,0.))
        self.assertEqual(h.coefficients(49), h.coefficients(1))
        for f in (1,7.25,25,48.75,49):
            eps=1e-4
            numeric=tuple((b-a)/(2*eps) for a,b in zip(h.coefficients(f-eps),h.coefficients(f+eps)))
            self.assertLess(math.dist(numeric,h.coefficient_velocity(f)),1e-8)

    def test_belt_seams_move_positive_world_y_and_close_with_velocity(self):
        self.assertGreater(h.BELT_PITCH, .1)
        for f in (1,12.5,25,49):
            self.assertAlmostEqual(h.belt_phase(f+1)-h.belt_phase(f),1/48)
            # A material point moving +Y retains the same seam coordinate.
            y=3.17
            self.assertAlmostEqual(h.belt_coordinate(y+h.BELT_PITCH/48,f+1),h.belt_coordinate(y,f))
        for y in (2.011,3.127,4.211,5.537):
            self.assertAlmostEqual(h.belt_coordinate(y,1),h.belt_coordinate(y,49))
            self.assertEqual(h.belt_seam(y,1),h.belt_seam(y,49))
        self.assertEqual(h.belt_phase_velocity(1),h.belt_phase_velocity(49))

    def test_root_and_attachment_skin_remain_pinned(self):
        for i in range(9):
            for f in range(1,50):
                for dz in (-.008,0,.008):
                    p=(*h.PLANT_ROOT[:2],h.PLANT_ROOT[2]+dz)
                    self.assertEqual(h.leaf_delta(p,i,f),(0.,0.,0.))

    def test_one_spatial_field_for_all_three_components(self):
        for i in range(9):
            p=h.leaf_tip(i)
            modes=h.leaf_modes(p,i)
            for f in (1,11.5,25,37,49):
                weights=h.coefficients(f)
                expected=tuple(sum(weights[j]*modes[j][a] for j in range(2)) for a in range(3))
                self.assertEqual(h.leaf_delta(p,i,f),expected)
                self.assertLess(math.dist(h.leaf_delta(p,i,1),h.leaf_delta(p,i,49)),1e-12)
                eps=1e-4
                numeric=tuple((b-a)/(2*eps) for a,b in zip(h.leaf_delta(p,i,f-eps),h.leaf_delta(p,i,f+eps)))
                self.assertLess(math.dist(numeric,h.leaf_velocity(p,i,f)),1e-8)
                self.assertLess(math.dist((0,0,0),expected),.09)
        self.assertGreater(math.dist(h.leaf_delta(h.leaf_tip(0),0,13),h.leaf_delta(h.leaf_tip(1),1,13)),.01)

    def test_layout_matches_actual_nine_leaf_builder_literals(self):
        tree=ast.parse(Path(__file__).with_name('build_screen_switch.py').read_text())
        layout=next(ast.literal_eval(n.value) for n in ast.walk(tree) if isinstance(n,ast.Assign)
                    and any(isinstance(t,ast.Name) and t.id=='leaf_layout' for t in n.targets))
        self.assertEqual(h.LEAF_LAYOUT,layout)
        self.assertEqual(len(h.leaf_names()),27)
        self.assertEqual(h.BELT_NAMES,('Lab exit belt','Lab receiving belt'))

    def test_cli_requires_prepare_only_or_reload_verification(self):
        base=['--subject','finished-belt','--camera','desktop','--source','x.blend','--out','absent']
        self.assertTrue(h.parse_args(base+['--prepare-only']).prepare_only)
        reload=['--verify-prepared','derivative.blend','--manifest','native-manifest.json']
        self.assertIsNotNone(h.parse_args(reload).verify_prepared)
        for args in (base,base+['--render'],base+['--prepare-only','--samples','8'],
                     base+['--prepare-only','--frames','49'],base+['--prepare-only','--preview'],
                     reload+['--prepare-only'],reload+['--out','x']):
            with contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):
                h.parse_args(args)

    def test_pinned_source_path_and_hash(self):
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'source.blend';source.write_bytes(b'known native')
            row=(source,h.sha256(source))
            with patch.dict(h.SOURCES,{('finished-belt','desktop'):row}):
                self.assertEqual(h.validate_source(source,'finished-belt','desktop'),source.resolve())
                other=source.with_name('other.blend');other.write_bytes(source.read_bytes())
                with self.assertRaises(ValueError):h.validate_source(other,'finished-belt','desktop')
                source.write_bytes(b'changed')
                with self.assertRaises(ValueError):h.validate_source(source,'finished-belt','desktop')

    def test_protected_paths_existing_output_and_symlink_alias(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'native';source.mkdir()
            alias=root/'alias';alias.symlink_to(source,target_is_directory=True)
            for out in (root,source/'new',alias/'new'):
                with self.assertRaises(ValueError):h.fresh_output(out,[source])
            self.assertEqual(h.fresh_output(root/'fresh',[source]),(root/'fresh').resolve())

    def test_parent_builder_has_no_render_bake_handler_or_encoding_calls(self):
        text=Path(__file__).with_name('build_refined_holds.py').read_text()
        tree=ast.parse(text)
        calls=[ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call)]
        self.assertFalse(any('ops.render' in c or 'ptcache' in c or 'subprocess' in c or 'handlers.' in c for c in calls))
        self.assertNotIn('load_inputs(',text)
        self.assertNotIn('ambient.main(',text)
        self.assertNotIn('resolution_x=',text)
        self.assertNotIn('cycles.samples=',text)
        import build_refined_holds as native
        self.assertTrue(callable(native.verify_prepared))

    def test_factory_lifecycle_handlers_are_preserved_but_scene_callbacks_rejected(self):
        import build_refined_holds as native
        handlers=SimpleNamespace(load_post=[lambda: None],frame_change_pre=[])
        bpy=SimpleNamespace(app=SimpleNamespace(factory_startup=True,handlers=handlers),
            context=SimpleNamespace(preferences=SimpleNamespace(filepaths=SimpleNamespace(use_scripts_auto_execute=False))),
            data=SimpleNamespace(texts=[],libraries=[]))
        with patch.object(native,'_factory_handlers',None,create=True):
            native.no_runtime(bpy)
            native.no_runtime(bpy)
            handlers.load_post.append(lambda: None)
            with self.assertRaises(ValueError):native.no_runtime(bpy)
        handlers.load_post.pop()
        with patch.object(native,'_factory_handlers',None,create=True):
            handlers.frame_change_pre.append(lambda: None)
            with self.assertRaises(ValueError):native.no_runtime(bpy)
        handlers.frame_change_pre.clear()
        with patch.object(native,'_factory_handlers',None,create=True):
            bpy.app.factory_startup=False
            with self.assertRaises(ValueError):native.no_runtime(bpy)
            bpy.app.factory_startup=True
            bpy.context.preferences.filepaths.use_scripts_auto_execute=True
            with self.assertRaises(ValueError):native.no_runtime(bpy)

    def test_native_actions_extend_through_inherited_shutter_at_seam(self):
        import build_refined_holds as native
        self.assertTrue(callable(getattr(native,'extend_action',None)))
        class Modifiers(list):
            def new(self,kind):
                m=SimpleNamespace(type=kind);self.append(m);return m
        curve=SimpleNamespace(extrapolation='CONSTANT',modifiers=Modifiers())
        with patch.object(native.ambient,'curves_for',return_value=[curve]):
            native.extend_action(None,periodic=False)
            self.assertEqual(curve.extrapolation,'LINEAR')
            self.assertEqual(curve.modifiers,[])
            native.extend_action(None,periodic=True)
            self.assertEqual(curve.modifiers[0].type,'CYCLES')
            self.assertEqual((curve.modifiers[0].mode_before,curve.modifiers[0].mode_after),('REPEAT','REPEAT'))

    def parity_fixture(self):
        matrix=[[float(i==j) for j in range(4)] for i in range(4)]
        geometry={name:{'matrix':copy.deepcopy(matrix),
                       'mesh':{'geometry_uv':'exact vertices/topology/UV hash','vertices':3,
                               'materials':[{'name':'original','tree':{'nodes':[]}}]}}
                  for name in ('flattened','untouched','animated leaf')}
        fixed={'instances':{'count':11226,'instances_sha256':'exact'},
               'camera':{},'lights':{},'world':{},'render_settings':{}}
        return geometry,copy.deepcopy(geometry),fixed

    def test_flattened_float32_delta_and_existing_inclusive_boundary(self):
        import build_refined_holds as native
        for delta in (2.0663208033511182e-7,1e-5):
            with self.subTest(delta=delta):
                before,after,fixed=self.parity_fixture()
                after['flattened']['matrix'][0][1]=delta
                native.ambient.assert_near(0.,delta)
                evidence=native.assert_source_parity(before,after,{'flattened'},fixed,fixed)
                self.assertEqual(evidence['matrix_changed_objects'],['flattened'])
                self.assertEqual(evidence['max_matrix_delta'],delta)

    def test_matrix_tolerance_rejects_above_boundary_and_nonflattened_drift(self):
        import build_refined_holds as native
        for name,delta,exact in (('flattened',math.nextafter(1e-5,math.inf),()),
                                 ('untouched',1e-15,()),('animated leaf',2e-7,('animated leaf',)),
                                 ('flattened',2e-7,('flattened',))):
            with self.subTest(name=name,delta=delta,exact=exact):
                before,after,fixed=self.parity_fixture()
                after[name]['matrix'][0][1]=delta
                with self.assertRaises(ValueError):
                    native.assert_source_parity(before,after,{'flattened','animated leaf'},fixed,fixed,exact)

    def test_parity_rejects_nonfinite_and_malformed_matrices_even_if_equal(self):
        import build_refined_holds as native
        for name in ('flattened','untouched'):
            for value in (math.nan,math.inf,-math.inf):
                for side in ('before','after','both'):
                    with self.subTest(name=name,value=value,side=side):
                        before,after,fixed=self.parity_fixture()
                        if side!='after':before[name]['matrix'][1][2]=value
                        if side!='before':after[name]['matrix'][1][2]=value
                        with self.assertRaises(ValueError):
                            native.assert_source_parity(before,after,{'flattened'},fixed,fixed)
        for matrix in ([],[[0.]*4]*3,[[0.]*3]*4):
            before,after,fixed=self.parity_fixture()
            before['flattened']['matrix']=after['flattened']['matrix']=matrix
            with self.assertRaises(ValueError):
                native.assert_source_parity(before,after,{'flattened'},fixed,fixed)

    def test_parity_keeps_objects_mesh_uv_material_and_fixed_state_exact(self):
        import build_refined_holds as native
        for mismatch in ('missing','extra','geometry_uv','vertices','materials',
                         'instances','camera','lights','world','render_settings'):
            with self.subTest(mismatch=mismatch):
                before,after,fixed=self.parity_fixture();changed_fixed=copy.deepcopy(fixed)
                if mismatch=='missing':del after['untouched']
                elif mismatch=='extra':after['extra']=copy.deepcopy(after['flattened'])
                elif mismatch in after['flattened']['mesh']:after['flattened']['mesh'][mismatch]='changed'
                else:changed_fixed[mismatch]='changed'
                with self.assertRaises(ValueError):
                    native.assert_source_parity(before,after,{'flattened'},fixed,changed_fixed)

    def test_exact_conversion_comparison_cannot_absorb_matrix_drift(self):
        import build_refined_holds as native
        before,after,fixed=self.parity_fixture()
        self.assertEqual(native.assert_source_parity(before,after,set(),fixed,fixed)['max_matrix_delta'],0.)
        after['flattened']['matrix'][0][1]=2e-7
        with self.assertRaises(ValueError):native.assert_source_parity(before,after,set(),fixed,fixed)

    def test_driver_guard_scans_data_collections_and_embedded_nested_node_trees(self):
        import build_refined_holds as native
        def item(pointer,drivers=(),tree=None,nodes=()):
            return SimpleNamespace(as_pointer=lambda:pointer,name=str(pointer),
                animation_data=SimpleNamespace(drivers=drivers),node_tree=tree,nodes=nodes)
        group=item(3);tree=item(2,nodes=[SimpleNamespace(node_tree=group)])
        owner=item(1,tree=tree);other=item(4)
        data=SimpleNamespace(bl_rna=SimpleNamespace(properties=[
            SimpleNamespace(type='COLLECTION',identifier='materials'),
            SimpleNamespace(type='COLLECTION',identifier='lattices'),
            SimpleNamespace(type='POINTER',identifier='rna_type')]),materials=[owner],lattices=[other])
        bpy=SimpleNamespace(data=data)
        native.no_drivers(bpy)
        for target in (owner,tree,group,other):
            target.animation_data.drivers=[SimpleNamespace(driver=SimpleNamespace(type='SCRIPTED'))]
            with self.assertRaises(ValueError):native.no_drivers(bpy)
            target.animation_data.drivers=[]

    def test_material_parity_survives_json_without_ignoring_value_changes(self):
        import build_refined_holds as native
        actual={'name':'original','tree':{'links':[('shader','BSDF','output','Surface')]}}
        saved=json.loads(json.dumps(actual))
        self.assertNotEqual(actual,saved)
        self.assertEqual(native.ambient.digest(actual),native.ambient.digest(saved))
        saved['tree']['links'][0][0]='changed shader'
        self.assertNotEqual(native.ambient.digest(actual),native.ambient.digest(saved))
        tree=ast.parse(Path(__file__).with_name('build_refined_holds.py').read_text())
        functions={n.name:ast.unparse(n) for n in tree.body if isinstance(n,ast.FunctionDef)}
        self.assertIn('ambient.digest(ambient.material_state(bpy.data.materials[name])) != ambient.digest(expected)',functions['evaluate'])
        self.assertLess(functions['main'].index('material.use_fake_user = True'),functions['main'].index('save_as_mainfile('))

    def test_native_parity_guard_integration_is_structural_only(self):
        tree=ast.parse(Path(__file__).with_name('build_refined_holds.py').read_text())
        functions={n.name:n for n in tree.body if isinstance(n,ast.FunctionDef)}
        main=ast.unparse(functions['main']);verify=ast.unparse(functions['verify_prepared'])
        self.assertIn('o.parent is not None or len(o.constraints)',main)
        self.assertLess(main.index('flattened ='),main.index('convert_visible_curves('))
        conversion=main.index('assert_source_parity(original, conversion, set(),')
        freeze=main.index('ambient.freeze(')
        self.assertLess(conversion,freeze)
        self.assertIn('assert_source_parity(conversion, frozen, flattened,',main)
        self.assertIn('original_fixed, fixed_state(bpy, scene), names)',main)
        self.assertLess(main.index('no_drivers(bpy)',freeze),main.index('add_belts('))
        self.assertLess(verify.index('open_mainfile('),verify.index('no_drivers(bpy)'))
        self.assertIn("!= m['frozen_matrices']",verify)
        self.assertIn("ambient.digest(actual) != ambient.digest(m['native_checks'])",verify)
        evaluate=ast.unparse(functions['evaluate'])
        self.assertIn('(*h.FRAMES, h.CLOSE_FRAME, 0.75, 49.25)',evaluate)
        self.assertIn('current_static != static',evaluate)
        self.assertNotIn('assert_source_parity',evaluate)
        calls=[ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call)]
        self.assertFalse(any('timers.register' in c for c in calls))


class CurveInstanceContracts(unittest.TestCase):
    """Small bpy-shaped fixtures exercise real audits, never native acceptance."""
    def setUp(self):
        import build_refined_holds as native
        self.assertTrue(callable(getattr(native,'collection_instances',None)),
                        'validated curve representation iterator required')

    def fixture(self):
        import build_refined_holds as native
        matrix=[[float(i==j) for j in range(4)] for i in range(4)]
        material=SimpleNamespace(name='original',diffuse_color=(.2,.3,.4,1),node_tree=None)
        mesh=SimpleNamespace(vertices=[SimpleNamespace(co=(0.,0.,0.)) for _ in range(250)],
            polygons=[],uv_layers=[],materials=[material],attributes=[],corner_normals=[])
        graphs=[];cleared=[]
        def obj(name,kind,pointer,payload):
            def to_mesh(*,preserve_all_data_layers,depsgraph):
                self.assertTrue(preserve_all_data_layers);graphs.append(depsgraph);return payload
            o=SimpleNamespace(name=name,type=kind,as_pointer=lambda:pointer,instance_type='NONE',
                instance_collection=None,hide_render=False,modifiers=[],matrix_world=copy.deepcopy(matrix),
                color=(1.,1.,1.,1.),pass_index=0,parent=None,users_collection=[],
                material_slots=[SimpleNamespace(link='DATA',material=material)],
                to_mesh=to_mesh,to_mesh_clear=lambda:cleared.append(name))
            for key in ('visible_camera','visible_diffuse','visible_glossy','visible_transmission','visible_shadow'):
                setattr(o,key,True)
            o.original=o;o.evaluated_get=lambda graph:o
            return o
        source=obj('actual source curve','CURVE',1,mesh)
        source.data=SimpleNamespace(splines=[SimpleNamespace(type='BEZIER')])
        generated=obj(source.name,'MESH',2,copy.deepcopy(mesh));generated.original=source
        row=SimpleNamespace(is_instance=True,object=generated,parent=source,matrix_world=copy.deepcopy(matrix),
            persistent_id=(0,)+(2147483647,)*7,random_id=17,show_self=True,show_particles=False)
        prototype=obj('collection prototype','MESH',3,copy.deepcopy(mesh))
        collection=SimpleNamespace(name='real collection',all_objects=[prototype])
        parent=obj('collection parent','EMPTY',4,mesh)
        parent.instance_type='COLLECTION';parent.instance_collection=collection
        real=SimpleNamespace(is_instance=True,object=prototype,parent=parent,matrix_world=copy.deepcopy(matrix),
            persistent_id=(7,)+(2147483647,)*7,random_id=23)
        scene=SimpleNamespace(objects=[source])
        graph=SimpleNamespace(object_instances=[real,row])
        return native,scene,graph,row,real,graphs,cleared

    def audit(self,native,scene,graph):
        evidence={}
        result=native.ambient.instance_state(graph,native.collection_instances(scene,graph,evidence))
        return result,evidence

    def test_default_iterator_equivalence_and_explicit_seam_keeps_actual_graph(self):
        native,scene,graph,row,real,graphs,cleared=self.fixture()
        graph.object_instances=[SimpleNamespace(is_instance=False),real]
        default=native.ambient.instance_state(graph)
        explicit=native.ambient.instance_state(graph,iter(graph.object_instances))
        self.assertEqual(default,explicit);self.assertEqual(default['count'],1)
        graph.object_instances=[row]  # Explicit rows, not a proxy graph, select the census.
        self.assertEqual(default,native.ambient.instance_state(graph,iter([real])))
        self.assertTrue(graphs);self.assertTrue(all(g is graph for g in graphs))
        with self.assertRaisesRegex(ValueError,'unsupported generated instance'):
            native.ambient.instance_state(graph)
        self.assertEqual(native.ambient.instance_state(graph,iter([]))['count'],0)

    def test_proven_curve_is_separate_with_honest_raw_count_and_exact_surface(self):
        native,scene,graph,row,real,graphs,cleared=self.fixture()
        baseline=native.ambient.instance_state(graph,iter([real]))
        result,evidence=self.audit(native,scene,graph)
        self.assertEqual(result,baseline)
        self.assertEqual(evidence['raw_generated_count'],2)
        self.assertEqual(evidence['curve_self_mesh_count'],1)
        self.assertEqual(evidence['collection_count'],1)
        record=evidence['curve_self_meshes'][row.parent.name]
        self.assertEqual(record['original_pointer'],1)
        self.assertEqual(record['persistent_id'],list(row.persistent_id))
        self.assertEqual(record['matrix'],row.matrix_world)
        self.assertEqual(record['mesh'],native.ambient.mesh_state(row.object.to_mesh(
            preserve_all_data_layers=True,depsgraph=graph)))
        self.assertIn('render_attributes_sha256',record)
        self.assertTrue(all(g is graph for g in graphs))
        self.assertIn(row.parent.name,cleared)
        # Conversion removes only the audited representation, not the collection census.
        row.parent.type='MESH';graph.object_instances=[real]
        after,converted=self.audit(native,scene,graph)
        self.assertEqual(after,baseline)
        self.assertEqual(converted['raw_generated_count'],1)
        self.assertEqual(converted['curve_self_meshes'],{})

    def test_curve_representation_rejects_unknown_identity_matrix_and_render_mismatches(self):
        for mismatch in ('unknown','pointer','original_type','matrix','parent_matrix','hidden',
                         'show_self','particles','collection','instancer','spline','procedural',
                         'vertices','material','attribute','normal','color','pass_index','slot','visibility',
                         'persistent_id','nonfinite'):
            with self.subTest(mismatch=mismatch):
                native,scene,graph,row,real,graphs,cleared=self.fixture()
                if mismatch=='unknown':scene.objects=[]
                elif mismatch=='pointer':row.object.original=SimpleNamespace(type='CURVE',as_pointer=lambda:99)
                elif mismatch=='original_type':row.object.original=SimpleNamespace(type='MESH',as_pointer=lambda:1)
                elif mismatch=='matrix':row.matrix_world[0][1]=1e-15
                elif mismatch=='parent_matrix':row.parent.matrix_world[0][1]=1e-15
                elif mismatch=='hidden':row.parent.hide_render=True
                elif mismatch=='show_self':row.show_self=False
                elif mismatch=='particles':row.show_particles=True
                elif mismatch=='collection':row.parent.instance_collection=SimpleNamespace()
                elif mismatch=='instancer':row.parent.instance_type='VERTS'
                elif mismatch=='spline':row.parent.data.splines[0].type='POLY'
                elif mismatch=='procedural':row.object.modifiers=[SimpleNamespace(show_render=True,type='NODES')]
                elif mismatch in ('vertices','material','attribute','normal'):
                    mesh=row.object.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
                    if mismatch=='vertices':mesh.vertices[0].co=(1.,0.,0.)
                    elif mismatch=='material':mesh.materials[0].diffuse_color=(1.,0.,0.,1.)
                    elif mismatch=='attribute':mesh.attributes=[SimpleNamespace(name='extra',data_type='FLOAT',domain='POINT',data=[SimpleNamespace(value=1.)])]
                    else:mesh.corner_normals=[SimpleNamespace(vector=(0.,1.,0.))]
                elif mismatch=='color':row.object.color=(0.,0.,0.,1.)
                elif mismatch=='pass_index':row.object.pass_index=99
                elif mismatch=='slot':row.object.material_slots=[]
                elif mismatch=='visibility':row.object.visible_shadow=False
                elif mismatch=='persistent_id':row.persistent_id=(1,)+(2147483647,)*7
                elif mismatch=='nonfinite':row.matrix_world[0][0]=math.nan
                with self.assertRaises(ValueError):self.audit(native,scene,graph)

    def test_missing_or_duplicate_curve_coverage_fails(self):
        for mode in ('missing','duplicate'):
            native,scene,graph,row,real,graphs,cleared=self.fixture()
            graph.object_instances=[real] if mode=='missing' else [real,row,row]
            with self.subTest(mode=mode),self.assertRaisesRegex(ValueError,'curve self-mesh'):
                self.audit(native,scene,graph)

    def test_unknown_generated_rows_still_reach_legacy_fail_closed_audit(self):
        native,scene,graph,row,real,graphs,cleared=self.fixture()
        real.parent.instance_type='NONE'
        with self.assertRaisesRegex(ValueError,'unsupported generated instance'):
            self.audit(native,scene,graph)
        real.parent.instance_type='COLLECTION'
        real.object.modifiers=[SimpleNamespace(show_render=True,type='NODES')]
        with self.assertRaisesRegex(ValueError,'unsupported instanced procedural geometry'):
            self.audit(native,scene,graph)


if __name__=='__main__':unittest.main()
