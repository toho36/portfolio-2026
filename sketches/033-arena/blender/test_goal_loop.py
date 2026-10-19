"""Pure geometry/timeline checks; does not import or start Blender."""
import math
import ast
import hashlib
from pathlib import Path
import unittest

import goal_loop as goal


class GoalLoopTests(unittest.TestCase):
    def test_closed_loop_and_station_order(self):
        self.assertEqual(goal.track(0), goal.track(goal.LENGTH))
        for distance, point in zip(goal.STATIONS, [(-2.5, -2.1), (2.5, -2.1), (2.5, 2.1), (-2.5, 2.1)]):
            x, y, _ = goal.track(distance)
            self.assertAlmostEqual(x, point[0])
            self.assertAlmostEqual(y, point[1])

    def test_failure_takes_the_loop_before_repair_and_exit(self):
        self.assertFalse(goal.piece_state(303)['cracked'])
        self.assertTrue(goal.piece_state(304)['cracked'])
        self.assertTrue(goal.piece_state(379)['cracked'])
        self.assertFalse(goal.piece_state(388)['cracked'])
        for frame in range(229, 449):
            self.assertLessEqual(abs(goal.piece_pose(frame)[1]), 2.1 + 1e-8)
        self.assertEqual(goal.piece_pose(228), goal.piece_pose(229))
        self.assertAlmostEqual(goal.piece_pose(354)[0], -2.5)
        self.assertAlmostEqual(goal.piece_pose(380)[0], 2.5)
        self.assertGreater(goal.piece_pose(464)[1] - .03, goal.WALL_Y + .12)
        self.assertEqual(goal.piece_pose(464), goal.piece_pose(468))
        self.assertEqual(goal.piece_state(468)['glass'], 1)
        self.assertLess(1.2, goal.HOLE_WIDTH)
        self.assertLess(.8, goal.HOLE_HEIGHT)

    def test_motion_is_bounded_and_settles_at_stops(self):
        for mobile in (False, True):
            self.assertEqual(goal.camera_pose(228, mobile), goal.camera_pose(229, mobile))
            self.assertEqual(goal.camera_pose(464, mobile), goal.camera_pose(468, mobile))
            for frame in range(169, 468):
                a, _, _ = goal.camera_pose(frame, mobile)
                b, _, _ = goal.camera_pose(frame + 1, mobile)
                self.assertLess(math.dist(a, b), 1.0 if mobile else .75)
        for frame in range(229, 468):
            a, b = goal.piece_pose(frame), goal.piece_pose(frame + 1)
            self.assertLess(math.dist(a[:2], b[:2]), .8)
            self.assertLess(abs(a[2]-b[2]), .3)

    def test_cobots_keep_rigid_links_and_tools_fit_the_slab(self):
        for frame in range(169,469):
            for station,base in enumerate(goal.ARM_BASES):
                a,b,c = goal.arm_points(base,goal.tool_pose(frame,station))
                self.assertAlmostEqual(math.dist(a,b),1.0)
                self.assertAlmostEqual(math.dist(b,c),1.0)
        self.assertAlmostEqual(goal.tool_pose(303,2)[2],goal.PIECE_Z+.4)
        self.assertAlmostEqual(goal.tool_pose(420,2)[2],goal.PIECE_Z+.4)
        self.assertAlmostEqual(goal.tool_pose(442,3)[2]-.8,goal.PIECE_Z)
        self.assertGreater(goal.piece_pose(330)[1]-goal.tool_pose(330,3)[1],.3)
        self.assertAlmostEqual(goal.tool_pose(442,3)[1],goal.track(goal.STATIONS[3])[1])
        self.assertLess(goal.CARRIER_WIDTH,goal.HOLE_WIDTH-2*goal.GAUGE_TAB)

    def test_entry_fills_both_frusta(self):
        for mobile,aspect in ((False,16/9),(True,9/16)):
            pos,target,lens = goal.camera_pose(169,mobile)
            self.assertEqual(pos[0],target[0])
            self.assertEqual(pos[2],target[2])
            half_width = (-7.06-pos[1])*18/lens
            self.assertLess(half_width,2)
            self.assertLess(half_width/aspect,min(pos[2],3.5-pos[2]))

    def test_overview_occupies_frame_and_keeps_robots_visible(self):
        for mobile,aspect in ((False,16/9),(True,9/16)):
            for frame in (200,228,346):
                pos,target,lens = goal.camera_pose(frame,mobile)
                points = []
                for i in range(160):
                    x,y,angle = goal.track(goal.LENGTH*i/160)
                    for side in (-1,1):
                        points.append((goal.ORIGIN_X+x-side*.57*math.sin(angle),
                                       y+side*.57*math.cos(angle),.62))
                uv = [project(p,pos,target,lens,aspect) for p in points]
                width = max(x for x,y in uv)-min(x for x,y in uv)
                self.assertGreaterEqual(width,.70)
                self.assertLessEqual(width,.82)
                elevation = math.degrees(math.atan2(pos[2]-target[2],math.dist(pos[:2],target[:2])))
                self.assertGreaterEqual(elevation,35)
                self.assertLessEqual(elevation,45 if mobile else 40)
                for station,base in enumerate(goal.ARM_BASES):
                    for p in (*goal.arm_points(base,goal.tool_pose(frame,station)),(*base,.1)):
                        u,v = project((p[0]+goal.ORIGIN_X,*p[1:]),pos,target,lens,aspect)
                        self.assertTrue(.025<u<.975 and .025<v<.975,(mobile,frame,station,u,v))
                    # Include the enlarged joint housings and the full plinth footprint.
                    body = []
                    for p,r in zip(goal.arm_points(base,goal.tool_pose(frame,station)),(.288,.256,.192)):
                        for axis in range(3):
                            for side in (-1,1):
                                q = list(p); q[axis] += side*r; body.append(q)
                    body += [(base[0]+dx,base[1]+dy,.1) for dx in (-.32,.32) for dy in (-.32,.32)]
                    for p in body:
                        u,v = project((p[0]+goal.ORIGIN_X,*p[1:]),pos,target,lens,aspect)
                        self.assertTrue(0<u<1 and 0<v<1,(mobile,frame,station,u,v))

    def test_review_and_exit_are_medium_shots_outside_the_gauge(self):
        for mobile,aspect in ((False,16/9),(True,9/16)):
            for frame in range(420,469):
                pos,target,lens = goal.camera_pose(frame,mobile)
                x,y,angle = goal.piece_pose(frame)
                corners = [project((goal.ORIGIN_X+x+side*.6*math.cos(angle),y+side*.6*math.sin(angle),goal.PIECE_Z+height),
                                   pos,target,lens,aspect) for side in (-1,1) for height in (-.4,.4)]
                self.assertGreater(min(u for u,v in corners),.05)
                self.assertLess(max(u for u,v in corners),.95)
                self.assertGreater(min(v for u,v in corners),.05)
                self.assertLess(max(v for u,v in corners),.95)
                # At least 70 px wide, even in a 360 px portrait preview.
                self.assertGreater((max(u for u,v in corners)-min(u for u,v in corners))*(360 if mobile else 640),70)
            pos,target,lens = goal.camera_pose(468,mobile)
            x,y,_ = goal.piece_pose(468)
            angle = math.degrees(math.atan2(abs(pos[0]-(goal.ORIGIN_X+x)),goal.WALL_Y-pos[1]))
            self.assertTrue(10<angle<35)
            # Most of the emerged face remains visible through BOTH wall faces.
            visible = 0
            for i in range(21):
                for j in range(15):
                    sx = goal.ORIGIN_X+x-.6+1.2*i/20
                    sz = goal.PIECE_Z-.4+.8*j/14
                    rays = []
                    for face in (-.12,.12):
                        t = (goal.WALL_Y+face-pos[1])/(y-pos[1])
                        rx = pos[0]+(sx-pos[0])*t
                        rz = pos[2]+(sz-pos[2])*t
                        rays.append(abs(rx-(goal.ORIGIN_X-2.5))<goal.HOLE_WIDTH/2 and
                                    abs(rz-goal.PIECE_Z)<goal.HOLE_HEIGHT/2)
                    visible += all(rays)
            self.assertGreater(visible/(21*15),.8)

    def test_signal_heads_are_readable_in_overview_and_medium_shots(self):
        for mobile,aspect in ((False,16/9),(True,9/16)):
            for frame,station in ((304,2),(420,2)):
                pos,target,lens = goal.camera_pose(frame,mobile)
                x,y = goal.STATUS_POSTS[station]
                u,v = project((goal.ORIGIN_X+x,y,goal.STATUS_HEAD_Z),pos,target,lens,aspect)
                self.assertTrue(.06<u<.94 and .06<v<.94,(mobile,frame,u,v))
                # Conservative diameter using Euclidean distance rather than camera depth.
                pixels = 2*goal.STATUS_RADIUS*lens/36/math.dist(pos,(goal.ORIGIN_X+x,y,goal.STATUS_HEAD_Z))*(360 if mobile else 640)
                self.assertGreater(pixels,5)
        self.assertEqual(goal.piece_state(304)['check'],'red')
        self.assertEqual(goal.piece_state(420)['check'],'green')
        self.assertTrue(goal.piece_state(446)['review'])

    def test_event_medium_shots_and_return_to_overview(self):
        for mobile,aspect in ((False,16/9),(True,9/16)):
            overview = goal.camera_pose(228,mobile)
            self.assertEqual(goal.camera_pose(338,mobile),overview)
            self.assertEqual(goal.camera_pose(346,mobile),overview)
            for frame in (300,304,386,420):
                pos,target,lens = goal.camera_pose(frame,mobile)
                x,y,angle = goal.piece_pose(frame)
                corners = [project((600+x+side*.6*math.cos(angle),y+side*.6*math.sin(angle),1.1+h),
                                   pos,target,lens,aspect) for side in (-1,1) for h in (-.4,.4)]
                self.assertTrue(all(.05<u<.95 and .05<v<.95 for u,v in corners))
                width = max(u for u,v in corners)-min(u for u,v in corners)
                self.assertGreater(width,.19)
                if frame in (300,304,420):
                    sx,sy = goal.STATUS_POSTS[2]
                    lamp = [project((600+sx+dx,sy,goal.STATUS_HEAD_Z+dz),pos,target,lens,aspect)
                            for dx in (-goal.STATUS_RADIUS,goal.STATUS_RADIUS) for dz in (-goal.STATUS_RADIUS,goal.STATUS_RADIUS)]
                    tx,ty,tz = goal.tool_pose(frame,2)
                    weight = [project((600+tx+dx,ty+dy,tz+dz),pos,target,lens,aspect)
                              for dx in (-.47,.47) for dy in (-.15,.15) for dz in (0,.22)]
                    group = corners+lamp+weight
                    self.assertTrue(all(.04<u<.96 and .04<v<.96 for u,v in group))
                    self.assertTrue(.32<max(u for u,v in group)-min(u for u,v in group)<.52)
            self.assertEqual(goal.piece_state(304)['failure_flash'],1)
            self.assertEqual(goal.piece_state(320)['failure_flash'],0)
            self.assertEqual(goal.piece_state(386)['repair'],1)

    def test_ending_frustum_excludes_robot_bodies_and_tools(self):
        # Exact support of cylinders/boxes against the five camera half spaces.
        # This catches foreground silhouettes anywhere in the image, including plinths.
        for mobile,aspect in ((False,16/9),(True,9/16)):
            for frame in range(446,469):
                pos,target,lens = goal.camera_pose(frame,mobile)
                pos = (pos[0]-600,*pos[1:]); target = (target[0]-600,*target[1:])
                f = unit(sub(target,pos)); r = unit((f[1],-f[0],0)); u = cross(r,f)
                planes = [f]+[add(scale(f,tangent),scale(axis,side))
                              for axis,tangent in ((r,18/lens),(u,18/lens/aspect)) for side in (-1,1)]
                def cylinder(a,b,radius):
                    axis = unit(sub(b,a)); centre = goal.mix(a,b,.5); half = math.dist(a,b)/2
                    return any(dot(n,sub(centre,pos))+abs(dot(n,axis))*half+
                               radius*math.sqrt(max(0,dot(n,n)-dot(n,axis)**2))<0 for n in planes)
                def box(centre,half):
                    return any(dot(n,sub(centre,pos))+sum(abs(v)*h for v,h in zip(n,half))<0 for n in planes)
                for station,base in enumerate(goal.ARM_BASES):
                    tool = goal.tool_pose(frame,station); a,b,c = goal.arm_points(base,tool)
                    axis = unit((-(tool[1]-base[1]),tool[0]-base[0],0))
                    bodies = [(a,b,.168),(b,c,.144),((*base,.09),(*base,1.33),.25),((*base,0),(*base,.12),.28)]
                    for centre,radius,depth,direction in zip((a,b,c),(.252,.232,.172),(.30,.28,.24),(axis,axis,(0,0,1))):
                        bodies.append((add(centre,scale(direction,-depth/2)),add(centre,scale(direction,depth/2)),radius))
                    bodies.append((add(tool,(0,0,.02)),add(tool,(0,0,.384)),.13))
                    self.assertTrue(all(cylinder(*body) for body in bodies),(mobile,frame,station,'robot'))
                    boxes = [(add(tool,(side*.11,0,.24 if station==2 else .03)),(.0225,.045,.09)) for side in (-1,1)]
                    if station==0: boxes.append((add(tool,(0,0,-.02)),(.035,.035,.05)))
                    if station==1: boxes.append((add(tool,(0,0,-.02)),(.21,.09,.05)))
                    if station==2: boxes.append((add(tool,(0,0,.11)),(.47,.15,.11)))
                    if station==3:
                        boxes.append((add(tool,(0,0,-.17)),(.03,.04,.17)))
                        for side in (-1,1):
                            boxes.append((add(tool,(side*.64,0,-.8)),(.02,.06,.46)))
                            boxes.append((add(tool,(side*(goal.HOLE_WIDTH/2-goal.GAUGE_TAB/2),0,-1.24)),(.07,.06,.02)))
                        boxes.append((add(tool,(0,0,-.36)),(.62,.06,.02)))
                    self.assertTrue(all(box(*body) for body in boxes),(mobile,frame,station,'tool/gauge'))
                # The wall aperture stays centred throughout the portrait ending.
                hole = project((600-2.5,goal.WALL_Y,goal.PIECE_Z),goal.camera_pose(frame,mobile)[0],
                               goal.camera_pose(frame,mobile)[1],lens,aspect)
                self.assertAlmostEqual(hole[0],.5); self.assertAlmostEqual(hole[1],.5)

    def test_final_glass_edges_have_air_inside_both_reveals(self):
        for mobile in (False, True):
            pos,_,_ = goal.camera_pose(468,mobile)
            x,y,angle = goal.piece_pose(468)
            for side in (-1,1):
                for depth in (-.03,.03):
                    for height in (-.4,.4):
                        sx = goal.ORIGIN_X+x+side*.6*math.cos(angle)-depth*math.sin(angle)
                        sy = y+side*.6*math.sin(angle)+depth*math.cos(angle)
                        sz = goal.PIECE_Z+height
                        for face in (-.12,.12):
                            t = (goal.WALL_Y+face-pos[1])/(sy-pos[1])
                            rx = pos[0]+(sx-pos[0])*t
                            rz = pos[2]+(sz-pos[2])*t
                            self.assertLess(abs(rx-(goal.ORIGIN_X-2.5)),goal.HOLE_WIDTH/2-.035)
                            self.assertLess(abs(rz-goal.PIECE_Z),goal.HOLE_HEIGHT/2-.035)
            # Lateral alignment starts only after the complete pane clears the wall.
            for frame in range(448,469):
                x,y,_ = goal.piece_pose(frame)
                if abs(x+2.5)>.00001:
                    self.assertGreater(y-.03,goal.WALL_Y+.12)

    def test_parked_carrier_cannot_overlap_exit_belt_surface(self):
        # Evaluate the actual scene placement without importing bpy.
        tree = ast.parse(Path(__file__).with_name('build_scene.py').read_text())
        lab = next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='build_goal_loop')
        placement = next(n.value for n in ast.walk(lab) if isinstance(n,ast.Assign)
                         and any(ast.unparse(t)=='carrier.location' for t in n.targets))
        belt = next(n for n in ast.walk(lab) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name)
                    and n.func.id=='cube' and ast.literal_eval(n.args[0])=='exit belt')
        belt_bottom = ast.literal_eval(belt.args[1])[2]-ast.literal_eval(belt.args[2])[2]/2
        for frame in range(458,469):
            _,_,z = eval(compile(ast.Expression(placement),'<carrier placement>','eval'),
                         {'point':lambda p:p,'goal':goal,'cx':-2.5,'cy':2.1,'frame':frame})
            self.assertLessEqual(z+.04,belt_bottom-.01)

    def test_receiver_supports_glass_with_backdrop_behind_it(self):
        tree = ast.parse(Path(__file__).with_name('build_scene.py').read_text())
        lab = next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='build_goal_loop')
        boxes = {ast.literal_eval(n.args[0]):(ast.literal_eval(n.args[1]),ast.literal_eval(n.args[2]))
                 for n in ast.walk(lab) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name)
                 and n.func.id=='cube' and isinstance(n.args[0],ast.Constant)
                 and ast.literal_eval(n.args[0]) in ('exit belt','receiving belt','far side dark backdrop')}
        (a,ad),(b,bd),(back,backd) = (boxes[n] for n in ('exit belt','receiving belt','far side dark backdrop'))
        # Adjacent rectangles share an edge, never overlapping coplanar faces.
        self.assertAlmostEqual(a[1]+ad[1]/2,b[1]-bd[1]/2)
        self.assertAlmostEqual(a[2]+ad[2]/2,b[2]+bd[2]/2)
        x,y,_ = goal.piece_pose(468)
        self.assertGreaterEqual(x-.6,b[0]-bd[0]/2)
        self.assertLessEqual(x+.6,b[0]+bd[0]/2)
        self.assertGreaterEqual(y-.03,b[1]-bd[1]/2)
        self.assertLessEqual(y+.03,b[1]+bd[1]/2)
        self.assertAlmostEqual(goal.PIECE_Z-.4,b[2]+bd[2]/2)
        self.assertGreater(back[1]-backd[1]/2,y+.03+.5)

    def test_two_piece_budget_is_consumed_by_a_visible_insertion(self):
        self.assertEqual(goal.piece_state(169)['repairs_left'],2)
        self.assertEqual(goal.piece_state(376)['repairs_left'],2)
        self.assertEqual(goal.piece_state(380)['repairs_left'],1)
        for f in range(380,469):
            self.assertEqual(goal.piece_state(f)['repairs_left'],1)
        self.assertNotEqual(goal.joiner_pose(382),goal.joiner_pose(378))
        self.assertTrue(goal.piece_state(384)['cracked'])
        self.assertFalse(goal.piece_state(388)['cracked'])
        self.assertLess(goal.piece_state(320)['crack_glow'],.05)
        self.assertGreater(goal.piece_state(320)['gap'],0)
        self.assertEqual(goal.piece_state(388)['gap'],0)
        # The consumed joiner stays fixed to the same corner even beyond the wall.
        for f in (388,420,448,458,468):
            x,y,angle = goal.piece_pose(f)
            jx,jy,jz = goal.joiner_pose(f)
            self.assertAlmostEqual(jx,x+.37*math.cos(angle)+.055*math.sin(angle))
            self.assertAlmostEqual(jy,y+.37*math.sin(angle)-.055*math.cos(angle))
            self.assertAlmostEqual(jz,goal.PIECE_Z+.26)
        self.assertEqual(goal.tool_pose(303,2),goal.tool_pose(420,2))

    def test_material_change_then_eight_frame_glass_hold_then_pass(self):
        self.assertTrue(goal.piece_state(446)['review'])
        self.assertEqual(goal.piece_state(446)['glass'],0)
        self.assertEqual(goal.piece_state(448)['glass'],1)
        for f in range(448,457):
            self.assertEqual(goal.piece_pose(f),goal.piece_pose(448))
        self.assertGreater(goal.piece_pose(458)[1],goal.piece_pose(456)[1])
        self.assertGreater(goal.piece_pose(464)[1]-.03,goal.WALL_Y+.12)

    def test_camera_is_stationary_during_all_contacts(self):
        for mobile in (False,True):
            for start,end in ((300,310),(374,392),(416,426),(438,442),(464,468)):
                for f in range(start,end+1):
                    self.assertEqual(goal.camera_pose(start,mobile),goal.camera_pose(f,mobile),(mobile,start,f))

    def test_mobile_overview_frames_hole_plan_and_calm_top(self):
        for f in (200,228,338,346):
            pos,target,lens=goal.camera_pose(f,True)
            for x,y,w,h in ((-2.5,goal.WALL_Y,goal.HOLE_WIDTH,goal.HOLE_HEIGHT),(-2.5,-2.1,1.2,.8)):
                uv=[project((600+x+dx,y,goal.PIECE_Z+dz),pos,target,lens,9/16)
                    for dx in (-w/2,w/2) for dz in (-h/2,h/2)]
                self.assertTrue(all(.04<u<.96 and .04<v<.7 for u,v in uv),(f,uv))
                self.assertGreater((max(u for u,v in uv)-min(u for u,v in uv))*360,12)
            # A front-facing goal opening, rather than its thin edge.
            self.assertGreater(goal.WALL_Y-pos[1],6)

    def test_repair_tray_and_consumed_joiner_stay_visible_without_a_spin(self):
        tree=ast.parse(Path(__file__).with_name('build_scene.py').read_text())
        assignment=next(n.value for n in ast.walk(tree) if isinstance(n,ast.Assign)
                        and any(ast.unparse(t)=='consumed.rotation_euler.z' for t in n.targets))
        previous=0
        for f in range(169,469):
            angle=goal.piece_pose(f)[2]
            yaw=eval(compile(ast.Expression(assignment),'<joiner yaw>','eval'),{'angle':angle,'frame':f,'math':math})
            self.assertLess(abs(yaw-previous),.3)
            previous=yaw
        for mobile,aspect in ((False,16/9),(True,9/16)):
            for f in (228,374,378,382,386,388):
                pos,target,lens=goal.camera_pose(f,mobile)
                for x,y,z in (goal.joiner_pose(f),goal.TRAY_SLOTS[1]):
                    u,v=project((600+x,y,z),pos,target,lens,aspect)
                    self.assertTrue(.04<u<.96 and .04<v<.7,(mobile,f,u,v))

    def test_lab_entry_edge_is_visible_by_frame_174(self):
        # Intersect camera rays with the actual moving panel's front plane.
        for mobile,aspect in ((False,16/9),(True,9/16)):
            pos,target,lens=goal.camera_pose(174,mobile)
            f=unit(sub(target,pos)); r=unit((f[1],-f[0],0)); u=cross(r,f)
            panel_z=1.75+(-.2-1.75)*5/6
            covered=[]
            for sx in (-1,1):
                for sy in (-1,1):
                    ray=add(f,add(scale(r,sx*18/lens),scale(u,sy*18/lens/aspect)))
                    t=(-7.06-pos[1])/ray[1]
                    p=add(pos,scale(ray,t))
                    covered.append(t>0 and abs(p[0]-600)<=2 and abs(p[2]-panel_z)<=1.75)
            self.assertFalse(all(covered))
            visible_belt=0
            for i in range(160):
                x,y,_=goal.track(goal.LENGTH*i/160)
                p=(600+x,y,.62)
                pu,pv=project(p,pos,target,lens,aspect)
                t=(-7.06-pos[1])/(p[1]-pos[1]); crossing=goal.mix(pos,p,t)
                behind_panel=0<t<1 and abs(crossing[0]-600)<2 and abs(crossing[2]-panel_z)<1.75
                visible_belt += 0<pu<1 and 0<pv<1 and not behind_panel
            self.assertGreater(visible_belt,20)
            # The moving panel itself has an edge crossing the visible frustum.
            a=project((598,-7.06,panel_z+1.75),pos,target,lens,aspect)
            b=project((602,-7.06,panel_z+1.75),pos,target,lens,aspect)
            self.assertTrue(any(0<a[0]+(b[0]-a[0])*t<1 and 0<a[1]+(b[1]-a[1])*t<1
                                for t in (i/100 for i in range(101))))

    def test_narrow_strip_reflects_in_glass_inside_the_goal(self):
        tree=ast.parse(Path(__file__).with_name('build_scene.py').read_text())
        strip=next(n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name)
                   and n.func.id=='light' and isinstance(n.args[0],ast.Constant)
                   and n.args[0].value=='Lab narrow glass edge strip')
        light=ast.literal_eval(strip.args[1].args[0])
        cam=goal.camera_pose(468)[0]; cam=(cam[0]-600,*cam[1:])
        x,y,_=goal.piece_pose(468); face=y-.03
        virtual=(cam[0],2*face-cam[1],cam[2])
        t=(face-virtual[1])/(light[1]-virtual[1])
        reflection=goal.mix(virtual,light,t)
        self.assertLess(abs(reflection[0]-x),.6)
        self.assertTrue(goal.PIECE_Z+.2<reflection[2]<goal.PIECE_Z+.4)
        t=(goal.WALL_Y-face)/(light[1]-face)
        crossing=goal.mix(reflection,light,t)
        self.assertLess(abs(crossing[0]+2.5),goal.HOLE_WIDTH/2)
        self.assertLess(abs(crossing[2]-goal.PIECE_Z),goal.HOLE_HEIGHT/2)

    def test_accepted_arena_source_is_byte_identical(self):
        source = Path(__file__).with_name('build_scene.py').read_bytes()
        accepted = source.split(b'def material(',1)[1].split(b'# The accepted arena cameras above',1)[0]
        self.assertEqual(hashlib.sha256(accepted).hexdigest(), '8113aeab07af737e499ecf833a8992aadb8ac755ae301297eef9c4a25dcf652f')


def dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def add(a,b):
    return tuple(x+y for x,y in zip(a,b))


def sub(a,b):
    return tuple(x-y for x,y in zip(a,b))


def scale(a,t):
    return tuple(x*t for x in a)


def unit(a):
    return scale(a,1/math.sqrt(dot(a,a)))


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def project(point,pos,target,lens,aspect):
    """Blender HORIZONTAL sensor fit, no Blender runtime required."""
    forward = [b-a for a,b in zip(pos,target)]
    length = math.sqrt(sum(x*x for x in forward)); forward = [x/length for x in forward]
    right = [forward[1],-forward[0],0]
    length = math.hypot(*right[:2]); right = [x/length for x in right]
    up = [right[1]*forward[2],-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]]
    delta = [a-b for a,b in zip(point,pos)]
    depth = sum(x*y for x,y in zip(delta,forward))
    return (.5+sum(x*y for x,y in zip(delta,right))*lens/(36*depth),
            .5+sum(x*y for x,y in zip(delta,up))*lens*aspect/(36*depth))


if __name__ == '__main__':
    unittest.main()
