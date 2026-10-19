"""Pure preview/final contracts. Never imports bpy or executes the native builder."""
import ast
import contextlib
import io
import hashlib
import json
import math
from pathlib import Path
import struct
from types import SimpleNamespace
import unittest
from unittest import mock

import playground as play
import screen_switch as switch
from test_goal_loop import project


class PlaygroundTests(unittest.TestCase):
    def test_exact_boundary_and_native_start_override(self):
        for mobile in (False, True):
            for frame in (660, 661):
                self.assertEqual(play.camera_pose(frame, mobile), switch.camera_pose(660, mobile))
                native = ((596.7, 4.4, 2.9), (596.8, 6.1, 3), 11.37)
                self.assertEqual(play.camera_pose(frame, mobile, native), native)

    def test_one_small_finite_camera_move_then_exact_hold(self):
        for mobile in (False, True):
            previous = play.camera_pose(661, mobile)
            for tick in range(661*4, 804*4+1):
                pose = play.camera_pose(tick/4, mobile)
                pos, target, lens = pose
                self.assertTrue(all(math.isfinite(x) for x in (*pos, *target, lens)))
                self.assertGreater(math.dist(pos, target), .8)
                self.assertLess(math.dist(pos, previous[0]), .025)
                self.assertLess(math.dist(target, previous[1]), .025)
                self.assertLess(abs(lens-previous[2]), .15)
                self.assertGreater(pos[2], switch.DESK_TOP+.8)
                self.assertLess(pos[1], 5.2)  # in front of both monitors, never through the screen
                if tick >= 732*4:
                    self.assertEqual(pose, play.camera_pose(732, mobile))
                previous = pose
            self.assertLess(math.dist(play.camera_pose(661.25, mobile)[0],
                                      play.camera_pose(661, mobile)[0]), 1e-5)
            self.assertLess(math.dist(play.camera_pose(731.75, mobile)[0],
                                      play.camera_pose(732, mobile)[0]), 1e-5)

    def test_entire_image_stays_inside_both_frusta(self):
        for mobile, aspect in ((False, 16/9), (True, 9/16)):
            for tick in range(661*4, 804*4+1):
                pose = play.camera_pose(tick/4, mobile)
                uv = [project(p, *pose, aspect) for p in play.quad_world_vertices()]
                self.assertTrue(all(.025 <= u <= .975 and .025 <= v <= .975
                                    for u, v in uv), (mobile, tick/4, uv))
                if tick >= 732*4:
                    width = max(u for u, v in uv)-min(u for u, v in uv)
                    self.assertGreaterEqual(width, .75)
                    self.assertLessEqual(width, .92)
                    if mobile:
                        self.assertLess(max(v for u, v in uv), .65)
                        centre = sum(v for u, v in uv)/4
                        self.assertTrue(.32 < centre < .48)

    def test_quad_is_inside_document_in_front_of_old_illustration(self):
        vertices = play.quad_local_vertices()
        self.assertEqual(len(vertices), 4)
        self.assertAlmostEqual(max(p[0] for p in vertices)-min(p[0] for p in vertices), 1.1)
        self.assertAlmostEqual(max(p[2] for p in vertices)-min(p[2] for p in vertices), .61875)
        for x, y, z in vertices:
            self.assertLess(abs(x), 1.17/2)
            self.assertTrue(-.38 < z < .31)
            self.assertGreater(y, .0455+.005)
        centre = tuple(sum(p[i] for p in play.quad_world_vertices())/4 for i in range(3))
        self.assertAlmostEqual(centre[0], 596.42)
        self.assertAlmostEqual(centre[1], 5.965)
        self.assertAlmostEqual(centre[2], 2.585)

    def test_uv_is_upright_unmirrored_after_three_pi_parent_rotation(self):
        # World +X is screen right for the final front-facing camera.
        for p, uv in zip(play.quad_world_vertices(), play.QUAD_UV):
            self.assertEqual(uv[0], int(p[0] > 596.42))
            self.assertEqual(uv[1], int(p[2] > 2.585))
        a, b, c, _ = play.quad_world_vertices()
        ab, ac = tuple(y-x for x, y in zip(a, b)), tuple(y-x for x, y in zip(a, c))
        self.assertLess(ab[2]*ac[0]-ab[0]*ac[2], 0)  # world normal faces camera (-Y)

    def test_sequence_clamp_and_exact_asset_mapping(self):
        self.assertEqual(play.SEQUENCE_START, 660)
        self.assertEqual(play.SEQUENCE_LENGTH, 145)
        for frame in (1, 660, 661, 684, 732, 743, 744):
            self.assertEqual(play.villa_frame(frame), 156)
        self.assertEqual([play.sequence_frame(f) for f in range(660, 805)], list(range(1, 146)))
        for frame in (780, 804, 999):
            self.assertEqual(play.villa_frame(frame), 192)
        root = Path('/staged/villa-timeline')
        self.assertEqual(play.sequence_path(root, 743), root/'frame-0084.png')
        self.assertEqual(play.sequence_path(root, 756), root/'frame-0097.png')
        self.assertEqual(play.sequence_path(root, 804), root/'frame-0145.png')

    def test_native_positive_index_and_original_photo_clock_are_separate(self):
        frames = (660, 662, 743, 744, 756, 780, 781, 804)
        self.assertEqual([play.sequence_frame(f) for f in frames], [1, 3, 84, 85, 97, 121, 122, 145])
        self.assertEqual([play.villa_frame(f) for f in frames], [156, 156, 156, 156, 168, 192, 192, 192])
        self.assertFalse(hasattr(play, 'sequence_offset'))
        for tick in range(660*4, play.END*4+1):
            frame = tick/4
            native_frame = math.floor(frame)-660+1
            self.assertEqual(native_frame, play.sequence_frame(frame), frame)
            self.assertEqual(play.sequence_path('/staged', frame).name,
                             f'frame-{native_frame:04d}.png')

    def test_native_sequence_is_static_unpacked_and_guarded_before_save(self):
        tree = ast.parse(Path(__file__).with_name('build_playground.py').read_text())
        source = ast.unparse(tree)
        offsets = [n for n in ast.walk(tree) if isinstance(n, ast.Assign)
                   and any(ast.unparse(t) == 'image_user.frame_offset' for t in n.targets)]
        self.assertEqual([ast.unparse(n.value) for n in offsets], ['0'])
        self.assertIn('image_user.frame_start = motion.SEQUENCE_START', source)
        self.assertIn('image_user.frame_duration = motion.SEQUENCE_LENGTH', source)
        self.assertNotIn('image_user.keyframe_insert', source)
        self.assertNotIn('motion.sequence_offset', source)
        self.assertIn("point.interpolation = 'LINEAR'", source)
        main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main')
        save = next(n for n in ast.walk(main) if isinstance(n, ast.Call)
                    and ast.unparse(n.func) == 'bpy.ops.wm.save_as_mainfile')
        guards = [n for n in ast.walk(main) if isinstance(n, ast.If)
                  and any(isinstance(c, ast.Raise) for c in ast.walk(n)) and n.lineno < save.lineno]
        guard_source = '\n'.join(ast.unparse(n) for n in guards)
        for check in ('image.packed_file', 'image.packed_files', 'image.source', 'image.filepath',
                      'sequence_settings', 'curve.data_path', 'frame_offset', 'is_file()'):
            self.assertIn(check, guard_source)

    def test_prepare_only_writes_manifest_and_returns_before_any_still(self):
        required = ['--preview', '--stills', '--source', 'accepted.blend', '--out', 'preview-desktop',
                    '--camera', 'desktop', '--frames-root', 'villa-timeline']
        defaults = play.parse_render_args(required)
        self.assertIn('prepare_only', vars(defaults))
        self.assertFalse(defaults.prepare_only)
        self.assertTrue(play.parse_render_args(required+['--prepare-only']).prepare_only)
        tree = ast.parse(Path(__file__).with_name('build_playground.py').read_text())
        main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main')
        branch = next(n for n in main.body if isinstance(n, ast.If)
                      and ast.unparse(n.test) == 'args.prepare_only')
        self.assertIsInstance(branch.body[-1], ast.Return)
        self.assertIn('write_manifest()', ast.unparse(branch))
        self.assertIn('prepared_pending_reload', ast.unparse(main))
        save = next(n for n in ast.walk(main) if isinstance(n, ast.Call)
                    and ast.unparse(n.func) == 'bpy.ops.wm.save_as_mainfile')
        render = next(n for n in ast.walk(main) if isinstance(n, ast.Call)
                      and ast.unparse(n.func) == 'bpy.ops.render.render')
        self.assertLess(save.lineno, branch.lineno)
        self.assertLess(branch.end_lineno, render.lineno)

    def test_verified_inputs_checks_real_timeline_and_original_provenance_without_bpy(self):
        # Execute only the builder's pure input checks, never import its bpy module.
        tree = ast.parse(Path(__file__).with_name('build_playground.py').read_text())
        pure = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef)
                               and n.name in ('sha256', 'verified_inputs')], type_ignores=[])
        namespace = dict(Path=Path, hashlib=hashlib, json=json, struct=struct, motion=play)
        exec(compile(pure, '<pure input verification>', 'exec'), namespace)
        root = Path('/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena/playground')
        native = json.loads((root/'native-inputs.json').read_text())
        args = SimpleNamespace(source=Path(native['desktop']['path']),
                               frames_root=root/'villa-timeline', camera='desktop')
        try:
            source, timeline, digest, hashes = namespace['verified_inputs'](args)
        except RuntimeError as exc:
            self.fail('The staged 145-file timeline must validate: '+str(exc))
        self.assertEqual(source, args.source)
        self.assertEqual(timeline, args.frames_root)
        self.assertEqual(digest, native['desktop']['sha256'])
        for index in range(1, 146):
            self.assertIn(timeline/f'frame-{index:04d}.png', hashes)
        for index in range(1, 38):
            self.assertIn(root/'villa-input'/f'frame-{index:04d}.png', hashes)
        for entry in native.values():
            self.assertEqual(hashes[Path(entry['path'])], entry['sha256'])

        original_read = Path.read_text
        for field, bad_value in (('scene_frame', 659), ('original_frame', 192),
                                 ('png_sha256', '0'*64), ('source_png_sha256', '0'*64),
                                 ('source_sha256', '0'*64), ('source_png', str(root/'villa-input/frame-0037.png'))):
            def altered_manifest(path, *a, **kw):
                content = original_read(path, *a, **kw)
                if path.name == 'villa-timeline-manifest.json':
                    data = json.loads(content)
                    data['files'][0][field] = bad_value
                    return json.dumps(data)
                return content
            with self.subTest(field=field), mock.patch.object(Path, 'read_text', altered_manifest):
                with self.assertRaises(RuntimeError):
                    namespace['verified_inputs'](args)

    def test_quiet_reveal_preserves_both_boundary_frames(self):
        for frame in (1, 660, 661, 662):
            self.assertEqual(play.reveal(frame), 0)
        self.assertEqual(play.reveal(684), 1)
        self.assertEqual(play.reveal(804), 1)
        values = [play.reveal(f/4) for f in range(661*4, 685*4)]
        self.assertTrue(all(a <= b for a, b in zip(values, values[1:])))

    def test_explicit_bounded_preview_cli(self):
        required = ['--source', 'accepted.blend', '--out', 'preview-desktop',
                    '--camera', 'desktop', '--frames-root', 'villa-input']
        args = play.parse_render_args(required+['--preview', '--stills'])
        self.assertEqual(args.frames, (660, 684, 708, 732, 744, 756, 780, 804))
        self.assertEqual(args.size, (640, 360))
        self.assertEqual(args.samples, 8)
        mobile = required.copy()
        mobile[mobile.index('desktop')] = 'mobile'
        mobile[mobile.index('preview-desktop')] = 'preview-mobile'
        self.assertEqual(play.parse_render_args(mobile+['--preview', '--stills']).size, (360, 640))
        self.assertEqual(play.parse_frames('660-661'), (660, 661))
        for value in ('659', '805', '804-660', '660,660', '684,660', '660-804', '', 'nan'):
            with self.assertRaises(ValueError):
                play.parse_frames(value)
        for tail in ([], ['--preview'], ['--stills'],
                     ['--preview', '--stills', '--final'],
                     ['--preview', '--stills', '--samples', '32'],
                     ['--preview', '--stills', '--size', '1600x900'],
                     ['--preview', '--stills', '--frames', '660-804']):
            with self.subTest(tail=tail), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    play.parse_render_args(required+tail)

    def test_final_cli_is_explicit_bounded_and_prepare_only_is_available(self):
        required = ['--source', 'accepted.blend', '--out', 'final-desktop',
                    '--camera', 'desktop', '--frames-root', 'villa-timeline']
        args = play.parse_render_args(required+['--final'])
        self.assertFalse(args.preview)
        self.assertTrue(args.final)
        self.assertFalse(args.prepare_only)
        self.assertEqual(args.frames, tuple(range(661, 805)))
        self.assertEqual(args.size, (1600, 900))
        self.assertEqual(args.samples, 32)
        mobile = required.copy()
        mobile[mobile.index('desktop')] = 'mobile'
        mobile[mobile.index('final-desktop')] = 'final-mobile'
        prepared = play.parse_render_args(mobile+['--final', '--prepare-only'])
        self.assertTrue(prepared.prepare_only)
        self.assertEqual(prepared.size, (900, 1600))
        self.assertEqual(play.parse_render_args(required+['--final', '--frames', '661,732,804']).frames,
                         (661, 732, 804))
        self.assertEqual(play.parse_render_args(required+['--final', '--frames', '661-804']).frames,
                         tuple(range(661, 805)))
        for tail in ([], ['--stills'], ['--final', '--stills'], ['--preview', '--final'],
                     ['--final', '--samples', '8'], ['--final', '--size', '640x360']):
            with self.subTest(tail=tail), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    play.parse_render_args(required+tail)
        for value in ('660', '805', '804-661', '661,661', '804,661', '', 'nan',
                      '1-999999999999999999999999999', '661-9999999999999999999999999',
                      '661,'*10000+'804'):
            with self.subTest(value=value[:60]), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    play.parse_render_args(required+['--final', '--frames', value])

    def test_final_output_requires_fresh_camera_basename_and_preserves_containment(self):
        source = Path(__file__).resolve()
        root = source.parent
        for camera in ('desktop', 'mobile'):
            out = Path('/private/tmp/playground-contract-uncreated')/('final-'+camera)
            self.assertEqual(play.validate_output(source, out, root, camera, final=True),
                             out/'playground.blend')
            with mock.patch.object(Path, 'exists', return_value=True):
                with self.assertRaises(ValueError):
                    play.validate_output(source, out, root, camera, final=True)
            for bad_out, bad_root in ((root/out.name, out), (out, out.parent),
                                      (out, out/'inputs'), (out.parent/('preview-'+camera), root),
                                      (out.parent/('final-'+('mobile' if camera == 'desktop' else 'desktop')), root)):
                with self.assertRaises(ValueError):
                    play.validate_output(source, bad_out, bad_root, camera, final=True)

    def test_final_render_settings_inherit_blur_and_color_and_manifest_reports_actuals(self):
        tree = ast.parse(Path(__file__).with_name('build_playground.py').read_text())
        main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main')
        start = next(i for i, n in enumerate(main.body) if isinstance(n, ast.Assign)
                     and ast.unparse(n.targets[0]) == 'scene.frame_end')
        end = next(i for i, n in enumerate(main.body) if isinstance(n, ast.Assign)
                   and ast.unparse(n.targets[0]) == 'backend')
        settings = ast.Module(body=main.body[start:end], type_ignores=[])
        manifest = next(n.value for n in main.body if isinstance(n, ast.Assign)
                        and ast.unparse(n.targets[0]) == 'manifest')
        fields = dict(zip((ast.literal_eval(k) for k in manifest.keys), manifest.values))
        for preview in (True, False):
            for legacy_blur in (False, True):
                render = SimpleNamespace(image_settings=SimpleNamespace(), motion_blur_shutter=.35,
                                         fps=24)
                cycles = SimpleNamespace(use_motion_blur=True)
                if not legacy_blur:
                    render.use_motion_blur = True
                scene = SimpleNamespace(render=render, cycles=cycles, frame_start=1,
                                        view_settings=SimpleNamespace(view_transform='AgX',
                                                                      look='AgX - Medium High Contrast', exposure=.35))
                args = SimpleNamespace(preview=preview, final=not preview, prepare_only=True,
                                       size=(640, 360) if preview else (1600, 900),
                                       samples=8 if preview else 32,
                                       frames=(684,) if preview else tuple(range(661, 805)))
                ns = dict(scene=scene, args=args, motion=play)
                exec(compile(settings, '<render settings only>', 'exec'), ns)
                self.assertEqual(ns['blur_settings'].use_motion_blur, not preview)
                self.assertEqual(render.motion_blur_shutter, .35)
                self.assertEqual(vars(scene.view_settings), dict(view_transform='AgX', look='AgX - Medium High Contrast', exposure=.35))
                for field, expected in (('mode', 'preview' if preview else 'final'), ('preview_only', preview),
                                        ('size', list(args.size)), ('samples', args.samples),
                                        ('motion_blur', not preview), ('motion_blur_shutter', .35),
                                        ('frames', list(args.frames)), ('rendered_frames', []),
                                        ('render_status', 'prepared_pending_reload')):
                    self.assertIn(field, fields)
                    self.assertEqual(eval(compile(ast.Expression(fields[field]), '<manifest field>', 'eval'), ns), expected)

    def test_fresh_output_guard_without_creating_any_files(self):
        source = Path(__file__).resolve()
        fresh = Path('/private/tmp/playground-contract-uncreated/preview-desktop')
        self.assertFalse(fresh.exists())
        self.assertEqual(play.validate_output(source, fresh, source.parent, 'desktop'),
                         fresh/'playground.blend')
        with mock.patch.object(Path, 'exists', return_value=True):
            with self.assertRaises(ValueError):
                play.validate_output(source, fresh, source.parent, 'desktop')
        for out, root in ((source.parent, fresh), (source, fresh),
                          (source.parent/'preview-desktop', fresh),
                          (fresh, fresh.parent), (fresh.parent/'preview-mobile', source.parent)):
            with self.assertRaises(ValueError):
                play.validate_output(source, out, root, 'desktop')

    def test_native_builder_syntax_and_safety_contract_without_import(self):
        source = Path(__file__).with_name('build_playground.py').read_text()
        tree = ast.parse(source)
        self.assertIn('use_scripts=False', source)
        self.assertIn('validate_output(', source)
        self.assertIn('source_sha256', source)
        self.assertIn('native-inputs.json', source)
        self.assertIn('villa-input-manifest.json', source)
        self.assertIn('frame_change_pre', source)
        self.assertIn('frame_change_post', source)
        self.assertIn('image.source = \'SEQUENCE\'', source)
        self.assertIn('image_user.use_cyclic = False', source)
        self.assertIn('image_user.use_auto_refresh = True', source)
        self.assertIn('1, 169, 468, 660, 661', source)
        self.assertIn('frame <= 660', source)
        self.assertNotIn('save_userpref', source)
        self.assertNotIn('animation_data_clear', source)
        self.assertNotIn('frame_change_post.append', source)
        self.assertNotIn('frame_change_pre.append', source)
        self.assertNotIn('bpy.ops.render.render(animation=', source)
        calls = [ast.unparse(n.func) for n in ast.walk(tree) if isinstance(n, ast.Call)]
        self.assertEqual(calls.count('bpy.data.objects.new'), 1)
        self.assertEqual(calls.count('bpy.ops.wm.open_mainfile'), 1)
        self.assertEqual(calls.count('bpy.ops.wm.save_as_mainfile'), 1)


if __name__ == '__main__':
    unittest.main()
