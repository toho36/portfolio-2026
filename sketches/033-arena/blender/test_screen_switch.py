"""Pure contracts; run with python3 -B -m unittest test_screen_switch.py."""
import ast
import contextlib
import io
import itertools
import math
from pathlib import Path
import unittest

import goal_loop as goal
import screen_switch as switch
from test_goal_loop import project


def window_bounds(frame, letter):
    # Actual physical extents: rails ±(.614+.014), ±(.414+.014).
    # A includes both original joiner leaves at ±(.055+.0175) in Y;
    # B includes its .014-radius traffic lights and .03-deep rails.
    # Native builder keys every integer frame with LINEAR interpolation.
    start = math.floor(frame)
    p = goal.mix(switch.window_pose(start,letter)[0],
                 switch.window_pose(start+1,letter)[0],frame-start)
    near, far = (-.0725, .0725) if letter == 'A' else (-.063, -.030)
    return ((p[0]-.628, p[1]+near, p[2]-.428),
            (p[0]+.628, p[1]+far, p[2]+.428))


def decor_contract():
    # Read only literal layout data, never import/execute the bpy authoring file.
    source = Path(__file__).with_name('build_screen_switch.py').read_text()
    tree = ast.parse(source)
    names = ('print_layout','plant_origin','pot_profile','leaf_layout','lamp_origin',
             'lamp_base_profile','lamp_shade_profile','practical_keys','background_visibility_keys')
    data = {target.id:ast.literal_eval(node.value) for node in ast.walk(tree)
            if isinstance(node,ast.Assign) for target in node.targets
            if isinstance(target,ast.Name) and target.id in names}
    for node in ast.walk(tree):
        if (isinstance(node,ast.Call) and isinstance(node.func,ast.Name)
                and node.func.id in ('box','stem') and isinstance(node.args[0],ast.Constant)):
            if node.args[0].value == 'architecture continuous upper wall':
                data['wall'] = tuple(ast.literal_eval(arg) for arg in node.args[1:3])
            if node.args[0].value == 'lamp upright':
                data['lamp_upright'] = tuple(ast.literal_eval(arg) for arg in node.args[1:3])
    return source,tree,data


def corners(bounds):
    return list(itertools.product(*zip(*bounds)))


def decor_bounds(data):
    def box_bounds(loc,dims):
        return tuple(tuple(a+sign*b/2 for a,b in zip(loc,dims)) for sign in (-1,1))

    result = {'wall':box_bounds(*data['wall'])}
    for i,(x,y,z,w,h) in enumerate(data['print_layout']):
        result['print '+str(i)] = ((x-w/2,y-.045,z-h/2),(x+w/2,y+.018,z+h/2))
    for name,origin,profile in (('pot',data['plant_origin'],data['pot_profile']),
                                ('lamp base',data['lamp_origin'],data['lamp_base_profile']),
                                ('lamp shade',data['lamp_origin'],data['lamp_shade_profile'])):
        radius = max(r for r,z in profile)
        result[name] = ((origin[0]-radius,origin[1]-radius,origin[2]+min(z for r,z in profile)),
                        (origin[0]+radius,origin[1]+radius,origin[2]+max(z for r,z in profile)))
    origin = data['plant_origin']
    for i,(base,tip,width) in enumerate(data['leaf_layout']):
        # Conservative blade envelope, including cup, arch and solidify/midrib.
        # Unlike a mesh-generator test this can reject an unsafe entire volume.
        result['leaf '+str(i)] = (
            (origin[0]+min(base[0],tip[0])-width/2-.003,
             origin[1]+min(base[1],tip[1])-.052,
             origin[2]+.43+min(base[2],tip[2])-width/2-.003),
            (origin[0]+max(base[0],tip[0])+width/2+.003,
             origin[1]+max(base[1],tip[1])+.003,
             origin[2]+.43+max(base[2],tip[2])+width/2+.028))
        # Petiole stays to the left of the monitor and within its endpoints.
        end = tuple(a+b for a,b in zip(origin,(base[0],base[1],base[2]+.43)))
        start = (origin[0],origin[1]+.015,origin[2]+.42)
        result['stem '+str(i)] = (tuple(min(a,b)-.008 for a,b in zip(start,end)),
                                  tuple(max(a,b)+.008 for a,b in zip(start,end)))
    points,radius = data['lamp_upright']
    # A little extra allowance for the AUTO handles of its shallow bend.
    result['lamp upright'] = (tuple(min(p[a] for p in points)-radius-.008 for a in range(3)),
                              tuple(max(p[a] for p in points)+radius+.008 for a in range(3)))
    return result


def separated(a,b,margin=0):
    return any(a[1][axis]+margin < b[0][axis] or b[1][axis]+margin < a[0][axis]
               for axis in range(3))


def ray_hits(camera,point,bounds):
    near,far = 0,1
    for axis in range(3):
        delta = point[axis]-camera[axis]
        if abs(delta) < 1e-10:
            if not bounds[0][axis] <= camera[axis] <= bounds[1][axis]:
                return False
        else:
            a,b = ((edge[axis]-camera[axis])/delta for edge in bounds)
            near,far = max(near,min(a,b)),min(far,max(a,b))
            if near > far:
                return False
    return near < 1 and far > 0


class ScreenSwitchTests(unittest.TestCase):
    def test_boundary_is_the_accepted_hold(self):
        for frame in (468, 469):
            x, y, angle = goal.piece_pose(468)
            self.assertEqual(switch.pane_pose(frame), ((600+x, y, goal.PIECE_Z), angle))
            self.assertEqual(switch.corner_pose(frame), (600+goal.joiner_pose(468)[0],
                                                        *goal.joiner_pose(468)[1:]))
            for mobile in (False, True):
                self.assertEqual(switch.camera_pose(frame, mobile), goal.camera_pose(468, mobile))

    def test_docking_precedes_one_simultaneous_exchange(self):
        self.assertEqual(switch.swap_progress(switch.SWAP_START), 0)
        self.assertEqual(switch.swap_progress(switch.SWAP_END), 1)
        self.assertLess(switch.DOCK_END, switch.SWAP_START)
        self.assertEqual(switch.window_pose(switch.DOCK_END, 'A')[0], switch.DOCKS[0])
        self.assertEqual(switch.window_pose(switch.DOCK_END, 'B')[0], switch.DOCKS[1])
        self.assertEqual(switch.window_pose(660, 'A')[0], switch.DOCKS[1])
        self.assertEqual(switch.window_pose(660, 'B')[0], switch.DOCKS[0])
        progress = [switch.swap_progress(f/4) for f in range(468*4, 660*4+1)]
        self.assertTrue(all(a <= b for a, b in zip(progress, progress[1:])))
        for f in range(switch.SWAP_START+1, switch.SWAP_END):
            for window in ('A', 'B'):
                self.assertNotEqual(switch.window_pose(f, window), switch.window_pose(f-1, window))

    def test_finite_transforms_and_small_steps(self):
        for mobile in (False, True):
            for i in range(468*4, 660*4+1):
                frame = i/4
                pos, target, lens = switch.camera_pose(frame, mobile)
                self.assertTrue(all(math.isfinite(x) for x in (*pos, *target, lens)))
                self.assertGreater(lens, 8)
                self.assertGreater(math.dist(pos, target), .5)
                self.assertLess(math.dist(pos, switch.camera_pose(frame+.25, mobile)[0]), .08)
                for window in ('A', 'B'):
                    p, angle = switch.window_pose(frame, window)
                    self.assertTrue(all(math.isfinite(x) for x in (*p, angle)))
                    self.assertLess(math.dist(p, switch.window_pose(frame+.25, window)[0]), .08)

    def test_camera_physically_clears_both_wall_faces(self):
        crossed = []
        for i in range(469*16, 577*16):
            p, _, _ = switch.camera_pose(i/16)
            if abs(p[1]-goal.WALL_Y) < .12+.04:
                crossed.append(p)
                self.assertLess(abs(p[0]-(600-2.5))+.04, goal.HOLE_WIDTH/2)
                self.assertLess(abs(p[2]-goal.PIECE_Z)+.04, goal.HOLE_HEIGHT/2)
        self.assertTrue(crossed)
        self.assertGreater(switch.camera_pose(576)[0][1], goal.WALL_Y+.12)

    def test_native_pane_and_corner_stay_in_view(self):
        for mobile, aspect in ((False, 16/9), (True, 9/16)):
            for frame in range(468, 661):
                cam, target, lens = switch.camera_pose(frame, mobile)
                p, _ = switch.pane_pose(frame)
                for q in [(p[0]+dx, p[1]-.03, p[2]+dz)
                          for dx in (-.6, .6) for dz in (-.4, .4)]+[switch.corner_pose(frame)]:
                    u, v = project(q, cam, target, lens, aspect)
                    self.assertTrue(.01 < u < .99 and .01 < v < .99, (mobile, frame, u, v))
                self.assertGreater(1.2*lens/(36*math.dist(cam,p))*(360 if mobile else 640), 65)

    def test_amber_corner_is_not_hidden_by_either_wall_face(self):
        for i in range(468*8, 533*8):
            cam, _, _ = switch.camera_pose(i/8)
            corner = switch.corner_pose(i/8)
            for face in (-.12,.12):
                wall = goal.WALL_Y+face
                if cam[1] < wall < corner[1]:
                    t = (wall-cam[1])/(corner[1]-cam[1])
                    crossing = tuple(a+(b-a)*t for a,b in zip(cam,corner))
                    self.assertLess(abs(crossing[0]-597.5), goal.HOLE_WIDTH/2)
                    self.assertLess(abs(crossing[2]-goal.PIECE_Z), goal.HOLE_HEIGHT/2)

    def test_two_monitors_fit_and_leave_upper_reading_area(self):
        for mobile, aspect in ((False, 16/9), (True, 9/16)):
            cam, target, lens = switch.camera_pose(576, mobile)
            for p in switch.DOCKS:
                uv = [project((p[0]+dx, switch.SCREEN_Y, p[2]+dz), cam, target, lens, aspect)
                      for dx in (-switch.MONITOR_WIDTH/2, switch.MONITOR_WIDTH/2)
                      for dz in (-switch.MONITOR_HEIGHT/2, switch.MONITOR_HEIGHT/2)]
                self.assertTrue(all(.025<u<.975 and .02<v<.70 for u,v in uv), (mobile, uv))
                self.assertGreater((max(u for u,v in uv)-min(u for u,v in uv))*(360 if mobile else 640), 110)

    def test_windows_never_intersect_monitors_desk_or_each_other(self):
        for i in range(switch.DOCK_END*8, 660*8+1):
            frame = i/8
            a, b = (window_bounds(frame, letter) for letter in ('A','B'))
            for low, high in (a, b):
                self.assertLess(high[1], 6.141)  # actual menu-bar/symbol front
                self.assertGreater(low[2], switch.DESK_TOP+.12, (frame, low))
                self.assertLess(high[1], 6.325)  # original backdrop front
                self.assertTrue(594.5 < low[0] < high[0] < 600.5)
                self.assertLess(high[2], 3.6)  # original receiving niche height
            self.assertTrue(any(a[1][axis]+.02 < b[0][axis]
                                or b[1][axis]+.02 < a[0][axis] for axis in range(3)),
                            (frame, a, b))

    def test_both_complete_windows_keep_frame_margin_through_exchange(self):
        for mobile, aspect in ((False,16/9), (True,9/16)):
            for i in range(switch.DOCK_END*8, 660*8+1):
                frame = i/8
                cam, target, lens = switch.camera_pose(frame, mobile)
                for letter in ('A','B'):
                    low, high = window_bounds(frame, letter)
                    for x in (low[0],high[0]):
                        for y in (low[1],high[1]):
                            for z in (low[2],high[2]):
                                u,v = project((x,y,z),cam,target,lens,aspect)
                                self.assertTrue(.025 < u < .975 and .025 < v < .975,
                                                (mobile,frame,letter,u,v))

    def test_rise_clears_front_edge_of_desk(self):
        for i in range(469*8, switch.DOCK_END*8+1):
            p, _ = switch.pane_pose(i/8)
            self.assertTrue(p[1]+.09 < switch.DESK_FRONT or p[2]-.44 > switch.DESK_TOP)

    def test_new_monitor_geometry_is_above_initial_aperture_rays(self):
        # A ray through the upper reveal is the highest point visible at the desk.
        cam, _, _ = goal.camera_pose(468)
        top = goal.PIECE_Z+goal.HOLE_HEIGHT/2
        max_z = max(cam[2]+(top-cam[2])*(y-cam[1])/(goal.WALL_Y+face-cam[1])
                    for face in (-.12,.12) for y in (switch.DESK_FRONT, 6.31))
        self.assertGreater(switch.DESK_TOP-.045, max_z)

    def test_final_is_a_hold_and_camera_holds_during_exchange(self):
        for frame in range(switch.SWAP_END, 661):
            for window in ('A','B'):
                self.assertEqual(switch.window_pose(frame, window), switch.window_pose(660, window))
        for mobile in (False, True):
            for frame in range(switch.DOCK_END, 661):
                self.assertEqual(switch.camera_pose(frame, mobile), switch.camera_pose(660, mobile))

    def test_window_size_and_normalized_position_are_preserved_at_destinations(self):
        for letter, start, end in (('A',0,1),('B',1,0)):
            old,_ = switch.window_pose(switch.SWAP_START,letter)
            new,_ = switch.window_pose(660,letter)
            self.assertEqual(tuple(a-b for a,b in zip(old,switch.DOCKS[start])), (0,0,0))
            self.assertEqual(tuple(a-b for a,b in zip(new,switch.DOCKS[end])), (0,0,0))
            # No scale channel exists in pure window poses; the original pane
            # keeps 1.2 x .8 dimensions relative to equal-sized monitor faces.
            self.assertLess(1.2, switch.MONITOR_WIDTH)
            self.assertLess(.8, switch.MONITOR_HEIGHT)

    def test_contents_reveal_only_during_visible_docking(self):
        self.assertEqual(switch.content_reveal(552), 0)
        self.assertEqual(switch.content_reveal(switch.DOCK_END), 1)
        self.assertEqual(switch.pane_pose(switch.DOCK_END), switch.window_pose(switch.DOCK_END,'A'))

    def test_new_content_clears_original_joiner_during_entire_reveal(self):
        # Read the actual authoring calls as data; never import the bpy builder.
        tree = ast.parse(Path(__file__).with_name('build_screen_switch.py').read_text())
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Name) and node.func.id in ('box','content_box')
                 and node.args and (
                     isinstance(node.args[0], ast.Constant)
                     and node.args[0].value in ('native titlebar','editor navigation sidebar')
                     or isinstance(node.args[0], ast.BinOp)
                     and isinstance(node.args[0].left, ast.Constant)
                     and node.args[0].left.value == 'document surface ')]
        self.assertEqual(len(calls), 3)
        # In piece-local coordinates: the ORIGINAL two leaves and top bridge.
        joiner = [((.37,y,.26), goal.JOINER_SIZE) for y in (-.055,.055)]
        joiner.append(((.37,0,.36), (.10,.145,.035)))
        for call in calls:
            loc,dims = (ast.literal_eval(arg) for arg in call.args[1:3])
            boxes = switch.corner_clearance(loc,dims) if call.func.id == 'content_box' else [(loc,dims)]
            for i in range(1,129):
                reveal = i/128
                for centre,size in boxes:
                    centre = (*centre[:2], centre[2]*reveal-.38*(1-reveal))
                    size = (*size[:2],size[2]*reveal)
                    for joint,extent in joiner:
                        gaps = [abs(a-b)-(c+d)/2 for a,b,c,d in zip(centre,joint,size,extent)]
                        self.assertGreater(max(gaps), .002, (call.lineno,reveal,centre,gaps))

    def test_at_least_one_native_menu_icon_remains_unoccluded(self):
        def hit_box(camera, point, bounds):
            near,far = 0,1
            for axis in range(3):
                delta = point[axis]-camera[axis]
                if abs(delta) < 1e-10:
                    if not bounds[0][axis] <= camera[axis] <= bounds[1][axis]:
                        return False
                else:
                    a,b = ((edge[axis]-camera[axis])/delta for edge in bounds)
                    near,far = max(near,min(a,b)),min(far,max(a,b))
                    if near > far:
                        return False
            return near < 1 and far > 0

        for mobile in (False,True):
            for i in range(switch.DOCK_END*8,660*8+1):
                frame = i/8
                cam,_,_ = switch.camera_pose(frame,mobile)
                visible = []
                for p in switch.DOCKS:
                    # Real builder quad: native .043m texture, no enlargement.
                    visible.append(not any(hit_box(cam,(p[0]+.71+x,6.141,p[2]+.568+z),
                                                   window_bounds(frame,letter))
                                           for x in (-.0215,.0215) for z in (-.0215,.0215)
                                           for letter in ('A','B')))
                self.assertTrue(any(visible), (mobile,frame))

    def test_preview_envelope_and_argument_validation(self):
        self.assertEqual(switch.PREVIEW_FRAMES, (520,528,556,564,572,600,612,660))
        self.assertEqual(switch.parse_frames(None, True), switch.PREVIEW_FRAMES)
        self.assertEqual(switch.parse_frames('468-469', True), (468,469))
        self.assertEqual(switch.parse_frames('576,588,612'), (576,588,612))
        for value in ('467','661','660-468','468,468','469-660'):
            with self.assertRaises(ValueError):
                switch.parse_frames(value, True)

    def test_authoring_file_parses_without_executing_bpy(self):
        source = Path(__file__).with_name('build_screen_switch.py').read_text()
        ast.parse(source)
        self.assertNotIn('import build_scene', source)
        self.assertNotIn('animation_data_clear', source)
        self.assertIn('use_scripts=False', source)

    def test_explicit_render_modes_and_bounded_final_frames_without_bpy(self):
        self.assertTrue(callable(getattr(switch, 'parse_render_args', None)))
        required = ['--out','unused-out','--source','unused.blend',
                    '--camera','desktop','--icon','unused.png']
        preview = switch.parse_render_args(required+['--preview','--stills'])
        self.assertEqual(preview.frames, switch.PREVIEW_FRAMES)
        self.assertEqual((preview.size,preview.samples), ((640,360),8))
        mobile = required.copy()
        mobile[mobile.index('desktop')] = 'mobile'
        self.assertEqual(switch.parse_render_args(mobile+['--preview','--stills']).size, (360,640))
        for argv,size in ((required,(1600,900)),(mobile,(900,1600))):
            final = switch.parse_render_args(argv+['--final'])
            self.assertEqual(final.frames, tuple(range(469,661)))
            self.assertEqual((final.size,final.samples), (size,32))
        self.assertEqual(switch.parse_render_args(required+['--final','--frames','469,660']).frames, (469,660))
        self.assertEqual(switch.parse_render_args(required+['--preview','--stills','--frames','468-469']).frames, (468,469))
        invalid = ([],['--preview'],['--stills'],['--final','--preview'],
                   ['--final','--stills'],['--preview','--stills','--frames','469-660'])
        invalid += tuple(['--final','--frames',v] for v in
                         ('468','468-660','661','660-469','469,469','660,469','469-999999999'))
        for flags in invalid:
            with self.subTest(flags=flags), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as exc:
                    switch.parse_render_args(required+flags)
                self.assertEqual(exc.exception.code, 2)

    def test_final_settings_and_manifest_preserve_source_motion_blur(self):
        source = Path(__file__).with_name('build_screen_switch.py').read_text()
        tree = ast.parse(source)
        overrides = [n for n in ast.walk(tree) if isinstance(n,ast.Assign)
                     and any(isinstance(t,ast.Attribute) and t.attr == 'use_motion_blur'
                             for t in n.targets)]
        self.assertEqual(len(overrides), 2)
        previews = [n for n in ast.walk(tree) if isinstance(n,ast.If)
                    and ast.unparse(n.test) == 'args.preview']
        self.assertEqual(len(previews), 1)
        preview = previews[0]
        self.assertTrue(all(n in list(ast.walk(preview)) for n in overrides))
        self.assertNotIn('motion_blur_shutter =', source)
        self.assertIn('scene.cycles.samples = args.samples', source)
        self.assertIn('scene.render.resolution_x, scene.render.resolution_y = args.size', source)
        self.assertIn("'mode':'preview' if args.preview else 'final'", source)
        self.assertIn("'frames':frames", source)
        self.assertIn("'preview_only':args.preview", source)
        self.assertIn("'samples':scene.cycles.samples", source)
        self.assertIn("'motion_blur':", source)
        self.assertIn("'motion_blur_shutter':", source)

    def test_home_office_props_read_inside_both_fixed_final_compositions(self):
        source,tree,data = decor_contract()
        self.assertEqual(len(data['print_layout']), 2)
        self.assertGreaterEqual(len(data['leaf_layout']), 8)
        self.assertTrue(all(width >= .23 and math.dist(base,tip) > .5
                            for base,tip,width in data['leaf_layout']))
        for name in ('plant stoneware pot','plant visible soil','plant broad leaf ',
                     'lamp domed shade','lamp weighted base','warm desk lamp practical'):
            self.assertIn(name,source)
        self.assertNotIn('blue hour',source)
        boxes = decor_bounds(data)
        # Props are static: only hide_render is keyed on the collection;
        # the existing sampled pane/camera transforms remain a separate loop.
        visibility_loop = next(n for n in ast.walk(tree) if isinstance(n,ast.For)
                               and ast.unparse(n.iter) == 'collection.objects')
        self.assertEqual([ast.literal_eval(n.args[1]) for n in ast.walk(visibility_loop)
                          if isinstance(n,ast.Call) and isinstance(n.func,ast.Name)
                          and n.func.id == 'key'], ['hide_render'])
        for mobile,aspect in ((False,16/9),(True,9/16)):
            cam,target,lens = switch.camera_pose(660,mobile)
            self.assertEqual(switch.camera_pose(576,mobile),(cam,target,lens))
            for name in ('print 0','print 1'):
                uv = [project(p,cam,target,lens,aspect) for p in corners(boxes[name])]
                self.assertTrue(all(.50<u<.91 and .53<v<(.65 if mobile else .93)
                                    for u,v in uv),(mobile,name,uv))
                self.assertGreater(max(u for u,v in uv)-min(u for u,v in uv), .13)
                self.assertGreater(max(v for u,v in uv)-min(v for u,v in uv), .07 if mobile else .24)
            # Exact surfaces of revolution: a box overestimates diagonal clipping.
            for name,origin,profile in (('pot',data['plant_origin'],data['pot_profile']),
                                        ('shade',data['lamp_origin'],data['lamp_shade_profile']),
                                        ('base',data['lamp_origin'],data['lamp_base_profile'])):
                uv = [project((origin[0]+r*math.cos(a*math.tau/96),
                               origin[1]+r*math.sin(a*math.tau/96),origin[2]+z),
                              cam,target,lens,aspect)
                      for r,z in profile for a in range(96)]
                self.assertTrue(all(0<u<1 and 0<v<1 for u,v in uv),(mobile,name,uv))
                self.assertGreater(max(u for u,v in uv)-min(u for u,v in uv), .07)
                if name == 'pot':
                    self.assertGreater(max(v for u,v in uv)-min(v for u,v in uv), .05 if mobile else .18)
            # At least seven clear blade tips, not a barely visible label/stick.
            tips = [tuple(a+b for a,b in zip(data['plant_origin'],(tip[0],tip[1],tip[2]+.43)))
                    for base,tip,width in data['leaf_layout']]
            visible = [project(p,cam,target,lens,aspect) for p in tips]
            self.assertGreaterEqual(sum(.01<u<.98 and .05<v<.80 for u,v in visible), 7)
            for name,bounds in boxes.items():
                if name == 'wall':
                    continue
                for p in corners(bounds):
                    u,v = project(p,cam,target,lens,aspect)
                    self.assertLess(v, .65 if mobile else .93,(mobile,name,u,v))
                    self.assertFalse(u<.46 and v>(.64 if mobile else .70),(mobile,name,u,v))

    def test_lower_decor_activates_behind_jambs_and_clears_entire_exchange(self):
        source,tree,data = decor_contract()
        self.assertEqual(data['background_visibility_keys'], ((1,True),(489,True),(490,False)))
        boxes = decor_bounds(data)
        for mobile,aspect in ((False,16/9),(True,9/16)):
            for frame in (490,):
                cam,target,lens = switch.camera_pose(frame,mobile)
                # The projected wall top is a line: check BOTH image edges,
                # not just its centre (portrait has a small diagonal wedge).
                left,right = [project((x,goal.WALL_Y-.11,3.5),cam,target,lens,aspect)
                              for x in (594.5,600.5)]
                for u in (0,1):
                    self.assertGreater(left[1]+(u-left[0])*(right[1]-left[1])/(right[0]-left[0]),1)
                for name,bounds in boxes.items():
                    for face in (-.11,.11):
                        crossings = []
                        for p in corners(bounds):
                            t = (goal.WALL_Y+face-cam[1])/(p[1]-cam[1])
                            crossings.append(tuple(a+(b-a)*t for a,b in zip(cam,p)))
                        # Every volume is hidden ABOVE the aperture or entirely
                        # behind one lateral jamb. Lower props need the latter.
                        self.assertTrue(min(p[2] for p in crossings)>goal.PIECE_Z+goal.HOLE_HEIGHT/2
                                        or max(p[0] for p in crossings)<597.5-goal.HOLE_WIDTH/2
                                        or min(p[0] for p in crossings)>597.5+goal.HOLE_WIDTH/2,
                                        (mobile,frame,name,crossings))
            for i in range(469*4,660*4+1):
                frame = i/4
                cam,_,_ = switch.camera_pose(frame,mobile)
                camera_box = (tuple(v-.04 for v in cam),tuple(v+.04 for v in cam))
                for name,bounds in boxes.items():
                    self.assertTrue(separated(bounds,camera_box,.015),(frame,name,'camera'))
                    for letter in ('A','B'):
                        window = window_bounds(frame,letter)
                        self.assertTrue(separated(bounds,window,.015),(frame,name,letter))
                        for point in corners(window):
                            self.assertFalse(ray_hits(cam,point,bounds),(mobile,frame,name,letter))
        for name,bounds in boxes.items():
            if name == 'wall':
                continue
            self.assertGreaterEqual(bounds[0][2],switch.DESK_TOP-.001)
            for p in switch.DOCKS:
                monitor = ((p[0]-switch.MONITOR_WIDTH/2,6.141,p[2]-switch.MONITOR_HEIGHT/2),
                           (p[0]+switch.MONITOR_WIDTH/2,6.31,p[2]+switch.MONITOR_HEIGHT/2))
                self.assertTrue(separated(bounds,monitor,.015),(name,monitor))

    def test_all_new_light_off_through_469_and_original_native_state_guarded(self):
        source,tree,data = decor_contract()
        self.assertEqual(data['practical_keys'], ((1,0),(469,0),(512,0),(552,7.5)))
        loops = [node for node in ast.walk(tree) if isinstance(node,ast.For)]
        self.assertTrue(any(isinstance(node.iter,ast.Name) and node.iter.id == 'practical_keys'
                            and "key(practical, 'energy', f)" in ast.unparse(node) for node in loops))
        native = next(node for node in loops if ast.unparse(node.iter) == '(1, 169, 468, 469)'
                      and 'new_lights' in ast.unparse(node))
        text = ast.unparse(native)
        for required in ('scene.frame_set(f)','o.hide_render for o in collection.objects',
                         'light.energy != 0 for light in new_lights','for shader in emission_shaders',
                         "shader.inputs['Emission Strength'].default_value != 0",
                         'source_states[f].items()','snapshot(original)'):
            self.assertIn(required,text)
        self.assertIn('emission_shaders.append(shader)',source)
        self.assertIn("if o.type == 'LIGHT'",source)
        self.assertIn('((1,0),(469,0),(552,emission))',source)
        self.assertIn('source_states[f] = snapshot(original)',source)
        self.assertIn('original_keys_before = [accepted_keys(o) for o in original]',source)
        self.assertIn('zip(original, original_keys_before)',source)
        self.assertIn('accepted_keys(obj) != previous_keys',source)
        self.assertIn('hashlib.sha256(source.read_bytes()).hexdigest() != source_hash',source)
        # The source backdrop is neither rekeyed nor replaced; its material
        # only passes to a new wall mesh, with no source material assignment.
        self.assertNotIn("key(backdrop,",source)
        self.assertNotIn('backdrop.hide_render =',source)
        self.assertNotIn('backdrop.data.materials[0] =',source)
        self.assertIn('destination.exists()',source)
        self.assertIn('out.exists() and any(out.iterdir())',source)
        self.assertIn('args = motion.parse_render_args(',source)
        self.assertIn('scene.cycles.samples = args.samples',source)
        self.assertIn('scene.render.resolution_x, scene.render.resolution_y = args.size',source)


if __name__ == '__main__':
    unittest.main()
