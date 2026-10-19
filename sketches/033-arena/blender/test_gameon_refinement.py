"""Worker-safe contracts; actual native preparation/reload belongs to the parent."""
import ast
import contextlib
import copy
import io
import json
import math
import struct
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

try:
    import gameon_refinement as h
except ModuleNotFoundError:
    h = None


class GameOnContracts(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(h, 'new pure GameOn helper required')

    def test_pose_clock_and_zero_render(self):
        self.assertEqual((h.POSE, h.FRAMES, h.CLOSE_FRAME, h.FPS, h.NEW_RENDER_CAP),
                         (112, tuple(range(1,49)), 49, 24, 0))

    def test_periodic_coefficients_and_analytic_derivatives(self):
        self.assertEqual(h.coefficients(1), (0.,0.))
        self.assertEqual(h.coefficients(49), h.coefficients(1))
        for f in (.75,1,7.25,25,48.75,49,49.25):
            eps=1e-4
            numeric=tuple((b-a)/(2*eps) for a,b in zip(h.coefficients(f-eps),h.coefficients(f+eps)))
            self.assertLess(math.dist(numeric,h.coefficient_velocity(f)),1e-8)
            self.assertLess(math.dist(h.coefficients(f),h.coefficients(f+48)),1e-14)

    def test_travelling_modes_pin_top_balance_centroid_and_local_vertical_ripple(self):
        uvs=[(u/8,v/6) for v in range(7) for u in range(9)]
        modes=h.flutter_modes(uvs)
        self.assertEqual(len(modes),len(uvs))
        for f in (1,4.5,13,25,37,49):
            deltas=[h.displacement(row,f) for row in modes]
            for uv,d in zip(uvs,deltas):
                self.assertTrue(all(math.isfinite(x) for x in d))
                self.assertEqual((d[0],),(0.,))
                self.assertLessEqual(abs(d[1]),h.NORMAL_BOUND+1e-12)
                self.assertLessEqual(abs(d[2]),h.VERTICAL_BOUND+1e-12)
                if uv[1]==1:self.assertEqual(d,(0.,0.,0.))
            self.assertLess(abs(sum(d[1] for d in deltas)),1e-12)
            self.assertLess(abs(sum(d[2] for d in deltas)),1e-12)
        self.assertGreater(max(abs(h.displacement(row,13)[1]) for row in modes),.03)
        self.assertGreater(math.dist(h.displacement(modes[0],13),h.displacement(modes[3],13)),.01)
        self.assertGreater(max(abs(h.displacement(row,25)[2]) for row in modes),.08)
        for bad in ([],[(0,1)],[(float('nan'),0)],[(0,-.1)],[(1.1,0)]):
            with self.assertRaises(ValueError):h.flutter_modes(bad)


    def test_declared_motion_ceilings_fail_instead_of_silent_attenuation(self):
        uvs=[(u/8,v/6) for v in range(7) for u in range(9)]
        for name in ('NORMAL_BOUND','VERTICAL_BOUND'):
            with patch.object(h,name,.01),self.assertRaises(ValueError):
                h.flutter_modes(uvs)

    def test_three_kinds_clocks_derivatives_and_continuation(self):
        self.assertEqual(getattr(h,'KINDS',None),('loop','arrival','departure'))
        self.assertEqual(h.CAMERA_POSE,84)
        self.assertEqual(h.BRIDGE_FRAMES,tuple(range(1,25)))
        for kind,velocities in (('arrival',(1.,0.)),('departure',(4/3,1.))):
            self.assertEqual((h.source_clock(kind,0),h.source_clock(kind,24)),(84.,112.))
            self.assertEqual(tuple(h.clock_velocity(kind,t) for t in (0,24)),velocities)
            for t in (.1,7.2,12.,23.9):
                eps=1e-4
                self.assertAlmostEqual((h.source_clock(kind,t+eps)-h.source_clock(kind,t-eps))/(2*eps),h.clock_velocity(kind,t),places=8)
            self.assertTrue(all(h.source_clock(kind,t)<h.source_clock(kind,t+.01) for t in range(24)))
        self.assertEqual(h.source_clock('arrival',24.25),112.)
        self.assertEqual(h.source_clock('departure',25),113.)
        for kind,t in (('bad',1),('arrival',float('nan')),('departure',float('inf'))):
            with self.assertRaises(ValueError):h.source_clock(kind,t)
        with contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):
            h.parse_args(['--prepare-only','--camera','desktop','--source','x','--out','x'])

    def test_cache_spline_reads_actual_intermediate_knots_and_derivatives(self):
        self.assertEqual(getattr(h,'CACHE_KNOTS',None),tuple(range(82,115)))
        # Nonlinear trajectory deliberately cannot be reproduced by an 84/112 morph.
        cache={str(k):[[float(k),math.sin(k),float(k*k)]] for k in h.CACHE_KNOTS}
        for k in range(84,113):
            self.assertLess(math.dist(h.cached_pose(cache,k)[0],cache[str(k)][0]),1e-12)
        self.assertGreater(abs(h.cached_pose(cache,95)[0][1]-((112-95)*cache['84'][0][1]+(95-84)*cache['112'][0][1])/28),.1)
        for s in (83.75,84.,95.2,112.):
            self.assertAlmostEqual(sum(h.cache_weights(s).values()),1.)
            self.assertAlmostEqual(sum(h.cache_weights(s,derivative=True).values()),0.)
            eps=1e-5
            numeric=[(b-a)/(2*eps) for a,b in zip(h.cached_pose(cache,s-eps)[0],h.cached_pose(cache,s+eps)[0])]
            self.assertLess(math.dist(numeric,h.cached_pose(cache,s,derivative=True)[0]),5e-6)
        for bad in (81.,114.,float('nan')):
            with self.assertRaises(ValueError):h.cached_pose(cache,bad)
        broken=dict(cache);del broken['95']
        with self.assertRaises(ValueError):h.cached_pose(broken,95.2)
        broken=dict(cache);broken['95']=[[float('nan'),0,0]]
        with self.assertRaises(ValueError):h.cached_pose(broken,95.2)

    def test_bridge_native_key_partition_includes_cache_crossings_and_subframes(self):
        self.assertTrue(callable(getattr(h,'bridge_key_times',None)))
        for kind in ('arrival','departure'):
            times=h.bridge_key_times(kind)
            self.assertEqual(times,tuple(sorted(set(times))))
            self.assertTrue(set(range(25))<=set(times))
            for k in range(85,112):
                self.assertLess(min(abs(h.source_clock(kind,t)-k) for t in times),1e-10)
            self.assertLessEqual(max(b-a for a,b in zip(times,times[1:])),.12500001)
        self.assertEqual(h.camera_channels({str(k):{'location':[k,0,0],'rotation_quaternion':[1,0,0,0],'lens':24} for k in range(82,115)},112.5)['location'],[112.5,0.,0.])

    def test_bridge_times_are_distinct_at_native_float32_precision(self):
        for kind in ('arrival','departure'):
            times=h.bridge_key_times(kind)
            native_times=[struct.unpack('f',struct.pack('f',t))[0] for t in times]
            self.assertEqual(len(native_times),len(set(native_times)))
            self.assertTrue(all(b>a for a,b in zip(native_times,native_times[1:])))

    def test_dense_bridge_keys_use_bulk_allocation_without_deduplicating_update(self):
        import build_gameon_refinement as native
        self.assertTrue(callable(getattr(native,'set_bridge_keys',None)))
        class Points(list):
            def add(self,count):self.extend(SimpleNamespace(co=[0.,0.]) for _ in range(count))
            def foreach_set(self,name,values):
                assert name=='co'
                for i,point in enumerate(self):point.co=[struct.unpack('f',struct.pack('f',v))[0] for v in values[i*2:i*2+2]]
            def sort(self,*,key=None,reverse=False):super().sort(key=key or (lambda point:point.co[0]),reverse=reverse)
            def handles_recalc(self):pass
        curve=SimpleNamespace(keyframe_points=Points(),update=lambda:(_ for _ in ()).throw(AssertionError('update deduplicates')))
        times=[0.,.0015,.125,.129,24.]
        native.set_bridge_keys(curve,times,[0.,1.,2.,3.,4.])
        self.assertEqual(len(curve.keyframe_points),5)
        self.assertEqual([p.co[1] for p in curve.keyframe_points],[0.,1.,2.,3.,4.])
        for ts,vs in [([24.-1e-7,24.],[0.,1.]),([1.,0.],[0.,1.]),([0.,1.],[0.]),([0.,1.],[0.,math.nan])]:
            with self.assertRaises(ValueError):native.set_bridge_keys(curve,ts,vs)

    def test_projection_admission_has_predeclared_floor_ceiling_and_negative_cases(self):
        self.assertEqual(getattr(h,'NORMAL_BOUND',None),.40)
        self.assertEqual(h.VERTICAL_BOUND,.22)
        for camera,ceiling in (('desktop',14),('mobile',10)):
            self.assertEqual(h.projection_admission(camera,{'edge':3.,'centre':4.})['ceiling_px'],ceiling)
            for excursions in ({'p':2.999},{'edge':2.999,'centre':4.},{'p':ceiling+.001},{'p':float('nan')},{}):
                with self.assertRaises(ValueError):h.projection_admission(camera,excursions)

    def cache(self):
        return SimpleNamespace(frame_start=1,frame_end=168,is_baked=True,is_baking=False,
            is_outdated=False,is_frame_skip=False,use_disk_cache=False,use_external=False,
            info='168 frames in memory (14.8 MiB).')

    def test_cache_must_be_real_complete_current_and_enabled_before_pose_request(self):
        mod=SimpleNamespace(type='CLOTH',show_viewport=True,show_render=True,point_cache=self.cache())
        self.assertEqual(h.validate_cache([mod])['frame_end'],168)
        for key,value in (('is_baked',False),('is_baking',True),('is_outdated',True),
                          ('is_frame_skip',True),('frame_end',84),('info','0 frames in memory'),
                          ('use_disk_cache',True),('use_external',True)):
            broken=copy.deepcopy(mod);setattr(broken.point_cache,key,value)
            with self.assertRaises(ValueError):h.validate_cache([broken])
        mod.show_viewport=False
        with self.assertRaises(ValueError):h.validate_cache([mod])
        with self.assertRaises(ValueError):h.validate_cache([])

    def test_exact_original_path_and_sha_reject_frozen_or_changed_scene(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'arena.blend';p.write_bytes(b'original')
            with patch.dict(h.SOURCES,{'desktop':(p,h.sha256(p))}):
                self.assertEqual(h.validate_source(p,'desktop'),p.resolve())
                other=p.with_name('frozen84.blend');other.write_bytes(p.read_bytes())
                with self.assertRaises(ValueError):h.validate_source(other,'desktop')
                p.write_bytes(b'changed')
                with self.assertRaises(ValueError):h.validate_source(p,'desktop')

    def test_cli_has_only_explicit_prepare_or_verify(self):
        base=['--kind','loop','--camera','desktop','--source','x.blend','--out','absent']
        self.assertTrue(h.parse_args(base+['--prepare-only']).prepare_only)
        verify=['--verify-prepared','x.blend','--manifest','native-manifest.json']
        self.assertIsNotNone(h.parse_args(verify).verify_prepared)
        for args in (base,base+['--prepare-only','--render'],base+['--prepare-only','--bake'],
                     base+['--prepare-only','--samples','8'],verify+['--out','other'],
                     verify+['--prepare-only']):
            with contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):h.parse_args(args)

    def test_retime_partition_uses_raw84_then_pending_bridges_and_canonical113_and_only_canonical_b_to_actual_lab228(self):
        a,b=h.partition()
        self.assertEqual(a,tuple(range(1,85)))
        self.assertEqual(b,tuple(range(113,169)))
        self.assertEqual(set(a)&set(b),set())
        self.assertEqual((len(a)+24,len(b)+24),(108,80))
        rows=[{'frame':f,'sha256':str(f),'source_sha256':'raw'+str(f)} for f in range(85,169)]
        selected=h.canonical_b_rows(rows,'168')
        self.assertEqual([r['frame'] for r in selected],list(b))
        for broken in (rows[:-1],rows[::-1],rows+[rows[-1]]):
            with self.assertRaises(ValueError):h.canonical_b_rows(broken,'168')
        with self.assertRaises(ValueError):h.canonical_b_rows(rows,'raw168')

    def test_homography_requires_reading_camera84_and_real_native_depth_projection(self):
        row={'frame':84,'uv_bottom_origin':[[.2,.2,2],[.3,.8,3],[.7,.8,3],[.8,.2,2]]}
        result=h.projection(row,(1600,900),(0,0,1600,900))
        for p,q in zip(h.hold.UNIT,h.hold.screen_quad(row)):
            self.assertLess(math.dist(h.hold.project(result['hold_homography'],p),q),1e-12)
        h.check_projection(row,copy.deepcopy(row))
        bad=copy.deepcopy(row);bad['uv_bottom_origin'][0][2]+=.01
        with self.assertRaises(ValueError):h.check_projection(row,bad)
        bad=copy.deepcopy(row);bad['frame']=112
        with self.assertRaises(ValueError):h.projection(bad,(1600,900),(0,0,1600,900))

    def test_real_registry_descriptor_has_actual_paths_hashes_and_new_projection(self):
        d=h.retime_descriptor()
        self.assertEqual((d['new_render_cap'],d['rendered']),(0,[]))
        for c,v in d['variants'].items():
            self.assertEqual([r['frame'] for r in v['A']],list(range(1,85)))
            self.assertEqual([r['frame'] for r in v['B']],list(range(113,169)))
            self.assertEqual(v['B'][-1]['sha256'],v['lab228']['sha256'])
            self.assertEqual((v['A_seconds'],v['B_seconds']),(4.5,80/24))
            for kind in ('arrival','departure'):
                pending=v[kind+'_pending']
                self.assertEqual([r['output_frame'] for r in pending],list(range(1,25)))
                self.assertFalse(any('path' in r or 'sha256' in r for r in pending))
                self.assertTrue(all(r['status']=='pending-owner-approved-render' for r in pending))
            self.assertEqual(v['projection']['row']['frame'],84)
            self.assertTrue(all('/final/derived/'+c+'/travel/' in row['path'] for row in v['B']))
            for row in (v['A'][0],v['A'][-1],v['B'][0],v['B'][-1]):
                self.assertEqual(h.sha256(row['path']),row['sha256'])

    def test_frame1_mesh_parity_survives_manifest_json_without_ignoring_changes(self):
        import build_gameon_refinement as native
        actual={'geometry_uv':'source112','materials':[{'tree':{'links':[('shader','BSDF','output','Surface')]}}]}
        saved=json.loads(json.dumps(actual))
        self.assertNotEqual(actual,saved)
        self.assertEqual(native.canonical(actual),native.canonical(saved))
        saved['geometry_uv']='different'
        self.assertNotEqual(native.canonical(actual),native.canonical(saved))
        tree=ast.parse(Path(native.__file__).read_text())
        evaluate=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='evaluate')
        self.assertIn("canonical(ambient.mesh_state(mesh)) != canonical(basis['mesh'])",ast.unparse(evaluate))

    def test_bridge_fixed_guard_accepts_json_roundtrip_but_rejects_value_changes(self):
        import build_gameon_refinement as native
        actual={'world':{'links':[('shader','out','world','surface')]},'lights':{'energy':12.}}
        saved=json.loads(json.dumps(actual))
        bpy=SimpleNamespace(data=SimpleNamespace(objects={native.BANNER:None}),
            context=SimpleNamespace(evaluated_depsgraph_get=lambda:None))
        scene=SimpleNamespace(frame_set=lambda *args,**kwargs:None)
        with patch.object(native.native,'fixed_state',return_value=actual),\
                patch.object(native.native,'matrix_snapshot',side_effect=RuntimeError('past fixed guard')):
            for kind in ('arrival','departure'):
                with self.assertRaisesRegex(RuntimeError,'past fixed guard'):
                    native.evaluate_bridge(bpy,scene,kind,{}, {}, {},saved,{},'')
                changed=copy.deepcopy(saved);changed['lights']['energy']+=.001
                with self.assertRaisesRegex(ValueError,'fixed world'):
                    native.evaluate_bridge(bpy,scene,kind,{}, {}, {},changed,{},'')

    def test_camera_channel_negative_cases_and_native_float_time_corner(self):
        knots={str(k):{'location':[float(k*k),0.,0.],'rotation_quaternion':[1.,0.,0.,0.],'lens':24.} for k in h.CACHE_KNOTS}
        # Native key times use float32; choose the intended source-knot side.
        self.assertEqual(h.camera_channels(knots,95+2e-6,True,-1)['location'][0],189.)
        self.assertEqual(h.camera_channels(knots,95-2e-6,True,1)['location'][0],191.)
        for s in (float('nan'),82.,114.):
            with self.assertRaises(ValueError):h.camera_channels(knots,s)
        del knots['96']
        with self.assertRaises(ValueError):h.camera_channels(knots,95.5)
        knots['96']={'location':[float('nan'),0,0],'rotation_quaternion':[1,0,0,0],'lens':24}
        with self.assertRaises(ValueError):h.camera_channels(knots,95.5)

    def test_camera_source_admission_only_requires_linear_route_channels(self):
        import build_gameon_refinement as native
        self.assertTrue(callable(getattr(native,'validate_camera_curves',None)))
        route=SimpleNamespace(data_path='location',modifiers=[],keyframe_points=[SimpleNamespace(interpolation='LINEAR')])
        dof=SimpleNamespace(data_path='dof.focus_distance',modifiers=[],keyframe_points=[SimpleNamespace(interpolation='BEZIER')])
        camera=SimpleNamespace(data=object())
        with patch.object(native.ambient,'curves_for',side_effect=lambda item:[route] if item is camera else [dof]):
            native.validate_camera_curves(camera)
            route.keyframe_points[0].interpolation='BEZIER'
            with self.assertRaises(ValueError):native.validate_camera_curves(camera)

    def test_reference_velocity_distinguishes_fd_bias_from_analytic_settle(self):
        self.assertTrue(callable(getattr(h,'bridge_reference_velocity',None)))
        cache={str(k):[[0.,float(k),0.]] for k in h.CACHE_KNOTS}
        analytic=h.bridge_reference_velocity(cache,'arrival',24)
        finite=h.bridge_reference_velocity(cache,'arrival',24,.03125)
        self.assertEqual(analytic,[[0.,0.,0.]])
        self.assertGreater(finite[0][1],0.)
        self.assertLess(finite[0][1],.002)
        self.assertEqual(h.bridge_reference_velocity(cache,'departure',24),[[0.,0.,0.]])

    def test_arrival_terminal_native_velocity_dispatch_matches_nonzero_loop_entry(self):
        import build_gameon_refinement as native
        # Cache settling alone has zero speed; the actual adjoining mode does not.
        path='key_blocks["GameOn mode 0"].value'
        try:actual=native.arrival_velocity(path,0,24)
        except (IndexError,ValueError):actual=0.  # old cache-only dispatch
        self.assertGreater(h.coefficient_velocity(1)[0],.13)
        self.assertAlmostEqual(actual,h.coefficient_velocity(1)[0],places=12)

    def test_arrival_c1_tail_ramp_and_unattenuated_loop_weights(self):
        self.assertTrue(callable(getattr(h,'arrival_envelope',None)))
        self.assertAlmostEqual(h.source_clock('arrival',20),110.48148148148148)
        for t,e,d in ((-1,0.,0.),(0,0.,0.),(19.9,0.,0.),(20,0.,0.),
                      (22,.5,.375),(24,1.,0.),(24.25,1.,0.)):
            self.assertEqual(h.arrival_envelope(t),e)
            self.assertEqual(h.arrival_envelope(t,True),d)
        for t in (-.25,0,19.9,20):
            self.assertEqual(h.arrival_coefficients(t),(0.,0.))
            self.assertEqual(h.arrival_coefficients(t,True),(0.,0.))
        self.assertEqual(h.arrival_coefficients(24),h.coefficients(1))
        self.assertEqual(h.arrival_coefficients(24,True),h.coefficient_velocity(1))
        for t in (20,20.5,22.3,23.99,24,24.1):
            eps=1e-5
            fd=[(b-a)/(2*eps) for a,b in zip(h.arrival_coefficients(t-eps),h.arrival_coefficients(t+eps))]
            self.assertLess(math.dist(fd,h.arrival_coefficients(t,True)),1e-6)
            self.assertLess(math.dist(h.arrival_coefficients(t),[h.arrival_envelope(t)*c for c in h.coefficients(t-23)]),1e-14)
        for bad in (float('nan'),float('inf'),-float('inf')):
            for fn in (h.arrival_envelope,h.arrival_coefficients):
                with self.assertRaises(ValueError):fn(bad)
        for t in (20.,24.):
            self.assertIn(t,h.bridge_key_times('arrival'))
            self.assertIn(t,h.bridge_checks('arrival'))
        for t in (19.96875,20.03125):self.assertIn(t,h.bridge_checks('arrival'))

    def test_arrival_reference_adds_local_flutter_to_actual_falling_cache_and_fd(self):
        self.assertTrue(callable(getattr(h,'arrival_pose',None)))
        cache={str(k):[[.03*k,math.sin(k*.3),.01*k*k]] for k in h.CACHE_KNOTS}
        # Explicit local directions deliberately differ from the world Y/Z modes.
        local_modes=[((.18,0.,.1),(0.,-.07,.03))]
        for t in (-.25,0,19.9,20,20.5,22.125,23.96875,24,24.03125):
            base=h.cached_pose(cache,h.source_clock('arrival',t))
            expected=[[base[0][axis]+sum(m[axis]*w for m,w in zip(local_modes[0],h.arrival_coefficients(t))) for axis in range(3)]]
            self.assertEqual(h.arrival_pose(cache,t,local_modes),expected)
            eps=.03125
            a=h.arrival_pose(cache,t-eps,local_modes);b=h.arrival_pose(cache,t+eps,local_modes)
            fd=[[(y-x)/(2*eps) for x,y in zip(p,q)] for p,q in zip(a,b)]
            self.assertEqual(h.bridge_reference_velocity(cache,'arrival',t,eps,local_modes),fd)
        self.assertEqual(h.arrival_pose(cache,24,local_modes),cache['112'])
        velocity=h.bridge_reference_velocity(cache,'arrival',24,local_modes=local_modes)[0]
        self.assertLess(math.dist(velocity,[x*h.coefficient_velocity(1)[0] for x in local_modes[0][0]]),1e-14)
        self.assertGreater(math.dist(velocity,(0,0,0)),.02)
        for eps in (0,-.1,float('nan'),float('inf')):
            with self.assertRaises(ValueError):h.bridge_reference_velocity(cache,'arrival',24,eps,local_modes)
        for bad in ([],[((0,0,0),)], [((float('nan'),0,0),(0,0,0))]):
            with self.assertRaises(ValueError):h.arrival_pose(cache,22,bad)

    def test_arrival_new_mode_dispatch_and_explicit_forward_junction_policy(self):
        import build_gameon_refinement as native
        for i in range(2):
            path=f'key_blocks["GameOn mode {i}"].value'
            for t in (-.25,20,21.25,24,24.25):
                self.assertEqual(native.arrival_velocity(path,0,t),h.arrival_coefficients(t,True)[i])
        d=h.retime_descriptor()
        for v in d['variants'].values():
            self.assertEqual(v['A_frames'],108)
            self.assertEqual(v['forward_idle_junction'],{'arrival_endpoint_frame':24,'loop_boundary_frame':1,
                'loop_boundary_phase':0,'first_idle_frame_after_A':2,'duplicate_endpoint_dwell':False})
            self.assertEqual(v['departure_head_policy'],'zero cloth velocity; reverse-B entry and arbitrary-phase exits require separate T5 handoff')
        self.assertTrue(any('Forward Lab-peek reveal' in note for note in h.PENDING))
        self.assertEqual(sum(len(v[k+'_pending']) for v in d['variants'].values() for k in ('arrival','departure')),96)

    def test_seam_evidence_uses_shape_offsets_and_both_actual_handle_slopes(self):
        import build_gameon_refinement as native
        self.assertTrue(callable(getattr(native,'arrival_seam_evidence',None)))
        basis={'uvs':[(0.,0.),(.5,0.),(1.,1.)],'base':[[3.,-2.,12.]]*3}
        modes=h.flutter_modes(basis['uvs'])
        base=SimpleNamespace(data=[SimpleNamespace(co=p) for p in basis['base']])
        blocks=[base];curves=[]
        for name in (*[f'GameOn cache {k}' for k in h.CACHE_KNOTS], 'GameOn mode 0','GameOn mode 1'):
            # Invert a nonidentity world rotation, independently of native authoring.
            vectors=[(m[int(name[-1])][1],-m[int(name[-1])][0],m[int(name[-1])][2]) for m in modes] if 'mode' in name else [[0.,0.,1.]]*3
            path=f'key_blocks["{name}"].value'
            f32=lambda x:struct.unpack('f',struct.pack('f',x))[0]
            points=[[f32(x+y) for x,y in zip(p,origin)] for p,origin in zip(vectors,basis['base'])]
            block=SimpleNamespace(name=name,data=[SimpleNamespace(co=p) for p in points],
                relative_key=base,mute=False,vertex_group='',path_from_id=lambda _,path=path:path)
            blocks.append(block)
            slope=native.arrival_velocity(path,0,24)
            key=SimpleNamespace(co=(24.,0.),interpolation='BEZIER',
                handle_left=(f32(23.95),f32(-.05*slope)),handle_right=(f32(24.04),f32(.04*slope)))
            curves.append(SimpleNamespace(data_path=path,array_index=0,keyframe_points=[key],modifiers=[]))
        shape=SimpleNamespace(use_relative=True,reference_key=base,key_blocks=blocks)
        obj=SimpleNamespace(data=SimpleNamespace(shape_keys=shape),matrix_world=[[0.,-1.,0.,0.],[1.,0.,0.,0.],[0.,0.,1.,0.],[0.,0.,0.,1.]])
        with patch.object(native.ambient,'curves_for',return_value=curves):
            evidence=native.arrival_seam_evidence(obj,basis)
            self.assertEqual(evidence,json.loads(json.dumps(evidence)))
            self.assertEqual(evidence['ceiling_m_per_frame'],1e-5)
            self.assertEqual(evidence['loop_boundary_frame'],1)
            for side in ('left','right'):
                self.assertLess(evidence[side]['max_loop_analytic_error_m_per_frame'],1e-5)
                self.assertGreater(evidence[side]['max_speed_m_per_frame'],.01)
            # Changing one handle side or the actual mode offsets must fail.
            key=curves[-2].keyframe_points[0];saved=key.handle_left
            key.handle_left=(23.95,0.)
            with self.assertRaisesRegex(ValueError,'analytic seam'):native.arrival_seam_evidence(obj,basis)
            key.handle_left=saved
            blocks[-2].data[0].co=(0.,0.,0.)
            with self.assertRaisesRegex(ValueError,'analytic seam'):native.arrival_seam_evidence(obj,basis)

    def test_native_tail_wiring_preserves_dense_allocator_and_incremental_guards(self):
        import build_gameon_refinement as native
        tree=ast.parse(Path(native.__file__).read_text())
        functions={n.name:ast.unparse(n) for n in tree.body if isinstance(n,ast.FunctionDef)}
        self.assertIn('h.arrival_pose(',functions['evaluate_bridge'])
        self.assertIn('arrival_seam_evidence(',functions['evaluate_bridge'])
        self.assertIn('incremental',functions['evaluate_bridge'])
        self.assertIn('h.arrival_coefficients(t)',functions['add_arrival'])
        self.assertIn('local_flutter_modes(obj, basis)',functions['add_arrival'])
        self.assertNotIn('.update(',functions['add_arrival'])
        self.assertNotIn('.extrapolation =',functions['bridge_handles'])
        self.assertIn('points.foreach_set(',functions['set_bridge_keys'])

    def test_bridge_weight_handles_reconstruct_nonlinear_cache_between_keys(self):
        import build_gameon_refinement as native
        times=h.bridge_key_times('arrival')
        cache={str(k):[[math.sin(k*.7),math.cos(k*.4),float(k)*.01]] for k in h.CACHE_KNOTS}
        curves=[]
        for knot in h.CACHE_KNOTS:
            keys=[SimpleNamespace(co=(t,h.cache_weights(h.source_clock('arrival',t)).get(knot,0.))) for t in times]
            curves.append(SimpleNamespace(data_path=f'key_blocks["GameOn cache {knot}"].value',array_index=0,keyframe_points=keys,extrapolation='CONSTANT'))
        with patch.object(native.ambient,'curves_for',return_value=curves):native.bridge_handles(None,native.arrival_velocity)
        base=cache['112'][0]
        for i,(a,b) in enumerate(zip(times,times[1:])):
            t=(a+b)/2;u=.5;weights=[]
            for curve in curves:
                left,right=curve.keyframe_points[i:i+2]
                weights.append((1-u)**3*left.co[1]+3*(1-u)**2*u*left.handle_right[1]+3*(1-u)*u*u*right.handle_left[1]+u**3*right.co[1])
            actual=[base[axis]+sum(w*(cache[str(k)][0][axis]-base[axis]) for k,w in zip(h.CACHE_KNOTS,weights)) for axis in range(3)]
            self.assertLess(math.dist(actual,h.cached_pose(cache,h.source_clock('arrival',t))[0]),1e-5)
        self.assertTrue(all(native.arrival_velocity(c.data_path,0,24)==0 for c in curves))

    def test_data_recipe_declares_pending_time_and_preserves_zero_budget(self):
        d=h.retime_descriptor()
        self.assertEqual(d['loop_poster'],{'geometry_frame':112,'camera_frame':84})
        self.assertEqual(d['proposed_not_approved_budget'],{'loop':384,'closure':8,'bridge':96,'reserve':24,'total':512})
        self.assertFalse(d['encoded']);self.assertFalse(d['applied'])
        for kind in ('arrival','departure'):
            row=d['variants']['desktop'][kind+'_pending'][-1]
            self.assertEqual(row.get('native_time_seconds'),1.)
            self.assertEqual(row.get('planned_encoded_time_seconds'),23/24)
            self.assertEqual(row['source_geometry_frame'],112.)
            self.assertEqual(row['source_camera_frame'],84 if kind=='arrival' else 112.)
            self.assertEqual(row['composition']=='native arena frame',kind=='arrival')
        self.assertTrue(all(f in h.bridge_checks('departure') for f in (0.,24.,24.25,25.,-.03125,24.03125)))

    def test_native_camera_comparison_records_finite_error_and_rejects_drift(self):
        import build_gameon_refinement as native
        expected={'matrix_world':[[1.,0.,0.,0.],[0.,1.,0.,-14.],[0.,0.,1.,2.8],[0.,0.,0.,1.]],'lens':24.,'dof':False}
        self.assertEqual(native.assert_camera(expected,copy.deepcopy(expected)),{'matrix_max_abs_error':0.,'lens_abs_error':0.})
        for field in ('matrix','lens','dof','extra'):
            actual=copy.deepcopy(expected)
            if field=='matrix':actual['matrix_world'][0][3]=.01
            elif field=='lens':actual['lens']=float('nan')
            elif field=='dof':actual['dof']=True
            else:actual['unexpected']=1
            with self.assertRaises(ValueError):native.assert_camera(expected,actual)

    def test_nonfinite_native_vertices_cannot_bypass_numeric_ceilings(self):
        self.assertTrue(callable(getattr(h,'validate_points',None)))
        self.assertIsNone(h.validate_points([[0.,1.,2.],[3.,4.,5.]],2))
        for points in ([],[[0.,1.]],[[float('nan'),1.,2.]],[[0.,float('inf'),2.]]):
            with self.assertRaises(ValueError):h.validate_points(points,1)
        import build_gameon_refinement as native
        tree=ast.parse(Path(native.__file__).read_text())
        for name in ('cloth_basis','capture_source','evaluate','evaluate_bridge'):
            fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name)
            self.assertIn('h.validate_points',ast.unparse(fn))

    def test_camera_is_excluded_only_for_departure_and_other_guards_stay_strict(self):
        import build_gameon_refinement as native
        self.assertTrue(callable(getattr(native,'scoped_fixed',None)))
        state={'camera':{'matrix_world':[[1]]},'lights':{'key':1},'instances':{'count':11226}}
        self.assertEqual(native.scoped_fixed(state,'loop'),state)
        self.assertEqual(native.scoped_fixed(state,'arrival'),state)
        self.assertEqual(native.scoped_fixed(state,'departure'),{'lights':{'key':1},'instances':{'count':11226}})
        self.assertIn('camera',state)
        self.assertEqual(native.scoped_matrices({'desktop':1,'mobile':2,'cloth':3},'desktop','departure'),{'mobile':2,'cloth':3})
        self.assertEqual(native.scoped_matrices({'desktop':1},'desktop','arrival'),{'desktop':1})

    def test_native_bridge_handles_respect_short_intervals_and_one_sided_camera_slopes(self):
        import build_gameon_refinement as native
        self.assertTrue(callable(getattr(native,'bridge_handles',None)))
        keys=[SimpleNamespace(co=(t,t*t)) for t in (0.,.125,.2,1.)]
        curve=SimpleNamespace(data_path='location',array_index=1,keyframe_points=keys,extrapolation='CONSTANT')
        with patch.object(native.ambient,'curves_for',return_value=[curve]):
            native.bridge_handles(None,lambda path,index,t,side:2*t+side*.01)
        for i,key in enumerate(keys):
            t,v=key.co;left=key.handle_left;right=key.handle_right
            self.assertEqual(key.interpolation,'BEZIER')
            self.assertAlmostEqual((v-left[1])/(t-left[0]),2*t-.01)
            self.assertAlmostEqual((right[1]-v)/(right[0]-t),2*t+.01)
            if i:self.assertGreater(left[0],keys[i-1].co[0])
            if i+1<len(keys):self.assertLess(right[0],keys[i+1].co[0])
        self.assertEqual(curve.extrapolation,'CONSTANT')

    def test_bridge_handles_do_not_reset_extrapolation_after_dense_allocation(self):
        import build_gameon_refinement as native
        class Curve:
            data_path='location'
            array_index=0
            keyframe_points=[SimpleNamespace(co=(0.,0.)),SimpleNamespace(co=(.0015,1.))]
            @property
            def extrapolation(self):return 'CONSTANT'
        with patch.object(native.ambient,'curves_for',return_value=[Curve()]):
            native.bridge_handles(None,lambda *args:0.)

    def test_native_capture_precedes_freeze_and_cache_validation_precedes_sampling(self):
        import build_gameon_refinement as native
        self.assertTrue(callable(getattr(native,'capture_source',None)))
        tree=ast.parse(Path(native.__file__).read_text())
        main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
        text=ast.unparse(main)
        self.assertLess(text.index('h.validate_cache('),text.index('capture_source('))
        self.assertLess(text.index('capture_source('),text.index('ambient.freeze('))
        capture=ast.unparse(next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='capture_source'))
        self.assertIn('h.CACHE_KNOTS',capture)
        self.assertIn('h.validate_cache',capture)
        self.assertIn('h.source_clock',capture)
        self.assertIn('native.geometry_state',capture)
        self.assertIn('ambient.camera_state',capture)
        self.assertNotIn('native.extend_action',ast.unparse(next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='add_arrival')))

    def test_native_builder_import_is_safe_and_has_no_execution_escape(self):
        import build_gameon_refinement as native
        self.assertTrue(callable(native.verify_prepared))
        source=Path(native.__file__).read_text();tree=ast.parse(source)
        calls=[ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n,ast.Call)]
        self.assertFalse(any('ops.render' in c or 'ptcache' in c or 'subprocess' in c or 'handlers.' in c for c in calls))
        self.assertNotIn('load_inputs(',source)
        self.assertNotIn('resolution_x=',source)
        self.assertNotIn('cycles.samples=',source)
        # Ordering is consequential: inspecting a disabled modifier yields rolled geometry.
        main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
        calls=[ast.unparse(n.func) for n in ast.walk(main) if isinstance(n,ast.Call)]
        self.assertIn('h.validate_cache',calls)
        self.assertIn('ambient.freeze',calls)


if __name__=='__main__':unittest.main()
