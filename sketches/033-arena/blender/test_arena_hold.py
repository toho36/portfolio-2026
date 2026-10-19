"""Worker-safe contracts. Run python3 -B -m unittest test_arena_hold.py.

No bpy imports, image generation or native execution. Real admission is optional:
ARENA_HOLD_INPUTS=/absolute/inputs.json enables all 170 recorded camera rows.
"""
import contextlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import tempfile
import unittest

try:
    import arena_hold as hold
except ModuleNotFoundError:
    hold = None


class HoldContracts(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(hold, 'arena_hold pure implementation is required')

    def test_exact_budget_and_unique_samples(self):
        self.assertEqual(hold.FRAMES, tuple(range(84, 132)))
        self.assertEqual((hold.CLOSE_FRAME, hold.FPS, hold.SAMPLES), (132, 24, 8))
        self.assertEqual(hold.SIZE, {'desktop': (320, 180), 'mobile': (180, 320)})
        self.assertEqual(len({hold.coefficients(f) for f in hold.FRAMES}), 48)

    def test_pose_and_velocity_close_and_top_is_pinned(self):
        for uv in ((0, 0), (.3, .7), (1, 1)):
            self.assertEqual(hold.flutter(uv, 84), (0., 0., 0.))
            self.assertEqual(hold.flutter(uv, 84), hold.flutter(uv, 132))
            eps = 1e-4
            velocities = [tuple((b-a)/(2*eps) for a, b in zip(
                hold.flutter(uv, f-eps), hold.flutter(uv, f+eps))) for f in (84,132)]
            self.assertLess(math.dist(*velocities), 1e-8)
        for f in range(840, 1321):
            for u in (0, .3, .9, 1):
                self.assertEqual(hold.flutter((u,1),f/10), (0.,0.,0.))
                for v in (0,.2,.8):
                    self.assertLessEqual(math.dist((0,0,0),hold.flutter((u,v),f/10)), .1)

    def test_projection_is_upright_and_registration_exact(self):
        row = {'uv_bottom_origin': [[.2,.2,2],[.3,.8,3],[.7,.8,3],[.8,.2,2]]}
        quad = hold.screen_quad(row)
        self.assertEqual(quad, ((.3,1-.8),(.7,1-.8),(.8,1-.2),(.2,1-.2)))
        h = hold.homography(hold.UNIT, quad)
        hold.validate_mapping(h, hold.UNIT)
        for a,b in zip(hold.UNIT,quad):
            self.assertLess(math.dist(hold.project(h,a),b), 1e-12)
        with self.assertRaises(ValueError):
            hold.homography(hold.UNIT, ((0,0),(1,1),(1,0),(0,1)))

    def test_roi_contain_is_uniform_and_preserves_all_four_edges(self):
        a, box = hold.roi_fit((900,1600),(0,540,900,1320))
        pts = [hold.project(a,p) for p in ((0,540/1600),(1,540/1600),(1,1320/1600),(0,1320/1600))]
        self.assertTrue(all(-1e-12 <= x <= 1+1e-12 and -1e-12 <= y <= 1+1e-12 for x,y in pts))
        self.assertAlmostEqual((pts[1][0]-pts[0][0])*640/900,
                               (pts[2][1]-pts[1][1])*360/780)
        self.assertAlmostEqual(box[3],360)

    def test_actual_recorded_rows_have_no_poles_or_flips_and_exact_landing(self):
        path = os.environ.get('ARENA_HOLD_INPUTS')
        if not path:
            self.skipTest('set ARENA_HOLD_INPUTS for actual native projection evidence')
        inputs = json.loads(Path(path).read_text())
        for name, variant in inputs['variants'].items():
            size = hold.png_size(variant['lab_frame228'])
            rows = variant['native_projection_table']
            self.assertEqual([r['frame'] for r in rows], list(range(84,169)))
            for row in rows:
                quad = hold.screen_quad(row)
                h, progress = hold.entry_mapping(row, size, variant['lab_roi'])
                hold.validate_mapping(h, hold.UNIT)
                self.assertTrue(all(abs(v)<10000 for p in hold.UNIT for v in hold.project(h,p)))
                if row['frame'] == 84:
                    a,_ = hold.roi_fit(size,variant['lab_roi'])
                    base = hold.matmul(hold.homography(hold.UNIT,quad),a)
                    for p in hold.UNIT:
                        self.assertLess(math.dist(hold.project(h,p),hold.project(base,p)),1e-8)
                if row['frame'] == 168:
                    self.assertEqual(progress,1)
                    self.assertTrue(hold.encloses_viewport(quad))
                    for p in hold.UNIT:
                        self.assertLess(math.dist(hold.project(h,p),p),1e-10)

    def test_preview_cli_refuses_override_unknown_and_missing_consent(self):
        base=['--preview-motion','--camera','desktop','--source','x.blend','--inputs','inputs.json','--out','fresh']
        self.assertEqual(hold.parse_args(base).camera,'desktop')
        for args in (base+['--final'],base+['--samples','16'],base[1:],base+['--frames','1:200']):
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                hold.parse_args(args)

    def test_source_and_fresh_output_guards(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder).resolve(); source=root/'original.blend'; source.write_bytes(b'original')
            data={'native_source':str(source),'native_source_sha256':hold.sha256(source)}
            hold.validate_source(source,data)
            with self.assertRaises(ValueError): hold.validate_source(source.with_name('other'),data)
            source.write_bytes(b'changed')
            with self.assertRaises(ValueError): hold.validate_source(source,data)
            with self.assertRaises(ValueError): hold.fresh_output(root)
            with self.assertRaises(ValueError): hold.fresh_output(source)
            self.assertEqual(hold.fresh_output(root/'new'),root/'new')

    def test_builder_has_no_simulation_or_handler_and_freezes_camera(self):
        source=Path(__file__).with_name('build_arena_hold.py').read_text()
        self.assertNotIn('bpy.ops.ptcache',source)
        self.assertNotIn('handlers.frame_change_pre.append',source)
        self.assertNotIn('handlers.frame_change_post.append',source)
        self.assertIn('animation_data_clear()',source)
        self.assertIn('timeline_markers',source)
        self.assertIn('hold.FRAMES',source)
        self.assertIn('is_baked',source)
        self.assertIn('5130',source)

    def test_input_budget_rejects_total_size_or_sample_escalation(self):
        path=os.environ.get('ARENA_HOLD_INPUTS')
        if not path:
            self.skipTest('set ARENA_HOLD_INPUTS for admission checks')
        original=json.loads(Path(path).read_text())
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'inputs.json'
            for key,value in (('native_frames_total',97),('samples',16),('desktop_size',[1920,1080])):
                changed=json.loads(json.dumps(original));changed['budget'][key]=value
                file.write_text(json.dumps(changed))
                with self.assertRaises(ValueError):hold.load_inputs(file)
        for variant in original['variants'].values():
            # This reads source bytes only, never opens a native scene or imports bpy.
            hold.validate_source(variant['native_source'],variant)

    def test_cpu_inverse_registers_pixels_without_pillow_or_image_generation(self):
        path=Path(__file__).parents[1]/'scripts'/'compose_arena_hold.py'
        spec=importlib.util.spec_from_file_location('hold_compositor',path)
        compose=importlib.util.module_from_spec(spec);spec.loader.exec_module(compose)
        h=hold.homography(hold.UNIT,((.2,.3),(.8,.25),(.9,.9),(.1,.8)))
        for p in (*hold.UNIT,(.2,.3),(.9,.1)):
            self.assertLess(math.dist(hold.project(compose.inverse(h),hold.project(h,p)),p),1e-12)
        self.assertNotIn('bpy',compose.__dict__)


if __name__ == '__main__':
    unittest.main()
