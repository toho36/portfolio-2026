"""Worker-safe contracts; no bpy, native execution, or image operations."""
import contextlib
import io
import json
import math
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

try:
    import ambient_holds as h
except ModuleNotFoundError:
    h = None


class AmbientContracts(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(h, 'pure ambient implementation required')

    def test_caps(self):
        self.assertEqual(h.FRAMES, tuple(range(1, 49)))
        self.assertEqual((h.CLOSE_FRAME, h.FPS, h.SAMPLES), (49, 24, 8))
        self.assertEqual(h.SIZE, {'desktop': (640, 360), 'mobile': (360, 640)})

    def test_cloth_periodicity_and_c1(self):
        for uv in ((0, 0), (.3, .2), (.8, .9), (1, 1)):
            self.assertLess(math.dist(h.flutter(uv, 1), h.flutter(uv, 49)), 1e-12)
            self.assertLess(math.dist(h.flutter_velocity(uv, 1), h.flutter_velocity(uv, 49)), 1e-12)
            for f in (1, 9.5, 25, 48.9, 49):
                eps = 1e-4
                numeric = tuple((b-a)/(2*eps) for a,b in zip(h.flutter(uv,f-eps),h.flutter(uv,f+eps)))
                self.assertLess(math.dist(numeric,h.flutter_velocity(uv,f)), 1e-8)

    def test_pin_bounds_and_visible_physical_candidate(self):
        normal = vertical = 0
        for f in range(1,50):
            for u in (0,.2,.5,.8,1):
                self.assertEqual(h.flutter((u,1),f), (0.,0.,0.))
                for v in (0,.3,.8,1):
                    x,y,z = h.flutter((u,v),f)
                    self.assertEqual(x,0)
                    self.assertLessEqual(abs(y),.9)
                    self.assertLessEqual(abs(z),.3)
                    normal=max(normal,abs(y));vertical=max(vertical,abs(z))
        self.assertGreater(normal,.4)
        self.assertGreater(vertical,.15)

    def test_lower_edge_has_the_calibrated_visible_vertical_travel(self):
        assert h is not None
        # Native camera calibration: the old sub-.2m travel misses the 3px floor.
        for u in (0,.25,.5,.75,1):
            heights=[h.flutter((u,0),f)[2] for f in h.FRAMES]
            self.assertGreaterEqual(max(heights)-min(heights),.4)
            self.assertLessEqual(max(heights)-min(heights),.6)

    def test_belt_uniform_arc_and_geometry_set_closure(self):
        pitch=h.goal.LENGTH/72
        for f in (1,13,25,37,49):
            distances=[h.belt_distance(i,f) for i in range(72)]
            for a,b in zip(distances,distances[1:]): self.assertAlmostEqual(b-a,pitch)
        for i in range(72):
            a=h.belt_pose(i,49);b=h.belt_pose((i+1)%72,1)
            self.assertLess(math.dist(a[:2],b[:2]),1e-12)
            self.assertAlmostEqual(math.cos(a[2]),math.cos(b[2]))
            self.assertAlmostEqual(math.sin(a[2]),math.sin(b[2]))
            self.assertLess(math.dist(h.belt_velocity(i,49)[:2],h.belt_velocity((i+1)%72,1)[:2]),1e-12)

    def test_tangent_unwraps_at_lap(self):
        before=h.track_unwrapped(h.goal.LENGTH-1e-5)
        after=h.track_unwrapped(h.goal.LENGTH+1e-5)
        self.assertGreater(after[2],before[2])
        self.assertLess(after[2]-before[2],1e-4)

    def test_strict_cli(self):
        base=['--preview-motion','--subject','gameon','--camera','desktop','--inputs','i','--out','o']
        self.assertEqual(h.parse_args(base).subject,'gameon')
        for args in (base[1:],base+['--final'],base+['--samples','16'],base+['--frames','49'],base+['--size','big'],base+['--source','other']):
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):h.parse_args(args)

    def test_source_and_output_guards(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'source.blend';source.write_bytes(b'approved')
            v={'source':str(source),'source_sha256':h.sha256(source)}
            self.assertEqual(h.validate_source(v),source.resolve())
            with self.assertRaises(ValueError):h.fresh_output(root,[])
            with self.assertRaises(ValueError):h.fresh_output(root/'new',[root])
            source.write_bytes(b'changed')
            with self.assertRaises(ValueError):h.validate_source(v)

    def test_correct_camera_and_original_pose_required(self):
        for c in h.SIZE:
            h.validate_identity('goal-loop',c,{'frame':228,'camera':{'name':'Goal Loop '+c},'treads':[{}]*72})
            with self.assertRaises(ValueError):h.validate_identity('goal-loop',c,{'frame':228,'camera':{'name':c},'treads':[{}]*72})

    def test_budget_and_approval_are_exact(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);approval=root/'approval.json';file=root/'inputs.json'
            approval.write_text(json.dumps({'status':'APPROVED','boundary_id':'ambient-holds:P1:v1','budget':h.BUDGET}))
            variants={s:{c:{'frame':84 if s=='gameon' else 228,'camera':{'name':'Frozen approved camera84' if s=='gameon' else 'Goal Loop '+c},
                            'cloth':{'vertices':5130},'treads':[{}]*72} for c in h.SIZE} for s in ('gameon','goal-loop')}
            admission=root/'native-admission.json';admission.write_text(json.dumps(variants))
            data={'approval':str(approval),'approval_sha256':h.sha256(approval),'budget':h.BUDGET,'variants':variants}
            file.write_text(json.dumps(data))
            with patch.object(h,'APPROVAL_SHA256',h.sha256(approval)),patch.object(h,'ADMISSION_SHA256',h.sha256(admission)):
                with patch.object(h,'INPUTS_SHA256',h.sha256(file)):self.assertEqual(h.load_inputs(file)['budget'],h.BUDGET)
                for field,value in (('samples',16),('total_new_native_frames',193),('frames_per_clip',49)):
                    data['budget']={**h.BUDGET,field:value};file.write_text(json.dumps(data))
                    with patch.object(h,'INPUTS_SHA256',h.sha256(file)),self.assertRaisesRegex(ValueError,'budget'):h.load_inputs(file)
                data['budget']=h.BUDGET;file.write_text(json.dumps(data))
                approval.write_text('{}')
                with patch.object(h,'INPUTS_SHA256',h.sha256(file)),self.assertRaisesRegex(ValueError,'approval'):h.load_inputs(file)

    def test_native_entry_is_parent_only_and_never_imported_by_math(self):
        source=Path(__file__).with_name('build_ambient_holds.py').read_text()
        self.assertNotIn('bpy.ops.ptcache',source)
        self.assertNotIn('handlers.frame_change_pre.append',source)
        self.assertIn("'rendered':[]",source)
        self.assertIn('use_animated_seed=False',source)
        self.assertIn('for frame in h.FRAMES:',source)
        self.assertIn('new_from_object',source)

    def test_native_freeze_refuses_unsupported_visible_geometry_and_temporal_images(self):
        import build_ambient_holds as native
        for kind in ('CURVE','FONT','VOLUME','GPENCIL','GREASEPENCIL'):
            obj=SimpleNamespace(name='unsupported',type=kind,hide_render=False,modifiers=[])
            with self.assertRaises(ValueError):native.visible_mesh_state(SimpleNamespace(objects=[obj]),None)
        for kind in ('VERTS','FACES','COLLECTION'):
            obj=SimpleNamespace(name='dupli',type='EMPTY',hide_render=False,modifiers=[],instance_type=kind)
            with self.assertRaises(ValueError):native.visible_mesh_state(SimpleNamespace(objects=[obj]),None)
        for kind in ('PARTICLE_SYSTEM','NODES'):
            obj=SimpleNamespace(name='instanced',type='MESH',hide_render=False,
                modifiers=[SimpleNamespace(type=kind,show_render=True)])
            with self.assertRaises(ValueError):native.visible_mesh_state(SimpleNamespace(objects=[obj]),None)
        for kind in ('SEQUENCE','MOVIE'):
            fake=SimpleNamespace(data=SimpleNamespace(images=[SimpleNamespace(name='dynamic',source=kind)]))
            with self.assertRaises(ValueError):native.image_state(fake)


if __name__ == '__main__':unittest.main()
