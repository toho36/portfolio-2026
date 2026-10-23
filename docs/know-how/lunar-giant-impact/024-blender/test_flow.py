"""Small evaluated-geometry check; run with Blender --background --python.

-- --old deliberately rejects the retained slab study. No renders or artifacts.
"""
import importlib.util
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def representation(scene):
    slabs = [o.name for o in scene.objects if o.get('role') == 'theia_cell']
    assert not slabs, 'REJECT old capped rigid slab representation: %d cells' % len(slabs)


def kernel_checks(module):
    """Advisory source-math evidence, explicitly not evaluated Blender GREEN."""
    drift, factors, step = 0., [], 0.
    previous = None
    min_slice_jacobian = float('inf')
    bounds = [1.,1.,0.,0.]
    def projection(points):
        nonlocal bounds
        for x,y,z in points:
            px = .5+x/11.5
            py = .5+(2*y+22*z)/math.sqrt(488)/(11.5*360/640)
            bounds = [min(bounds[0],px),min(bounds[1],py),max(bounds[2],px),max(bounds[3],py)]
            assert .02 < px < .98 and .02 < py < .98, ('source-math clipping',px,py)
    for frame in range(1, module.SPLIT+1):
        points, rows, correction = module.bulk(frame)
        assert all(math.isfinite(v) for p in points for v in p)
        assert module.volume(points, module.FACES) > 0
        projection(points)
        for i in range(1,len(module.PARAMS)-2):
            a,b = module.ring(i),module.ring(i+1)
            ca,cb = module.centroid([points[j] for j in a]),module.centroid([points[j] for j in b])
            for j in range(module.SIDES):
                determinant = module.dot(module.sub(cb,ca), module.cross(module.sub(points[a[j]],ca),
                                                module.sub(points[a[(j+1)%module.SIDES]],ca)))
                min_slice_jacobian = min(min_slice_jacobian,determinant)
                assert determinant > 0, ('folded material slice',frame,i)
        for side, inner in enumerate((True, False)):
            verts, faces, _ = module.domain(points, inner, rows)
            error = abs(module.volume(verts, faces)/module.TARGETS[side]-1)
            drift = max(drift, error)
            assert error < .002, ('proxy volume', frame, error)
        if previous:
            step = max(step, max(abs(a-b) for a,b in zip(previous, correction)))
        previous = correction
        factors.extend(correction)
    # Native topology is constant inside each phase; verify closure/winding
    # independently of the radius/volume implementation.
    for faces in (module.FACES, *(d[1] for d in module.SPLIT_DOMAINS)):
        edges = {}
        for face in faces:
            for a,b in zip(face,face[1:]+face[:1]):
                edges.setdefault(tuple(sorted((a,b))),[]).append((a,b))
        assert all(len(e)==2 and e[0]==e[1][::-1] for e in edges.values()), 'kernel open/nonmanifold mesh'
    incoming_angular = module.cross(module.sub(module.HIT, module.EARTH), module.VELOCITY)[1]
    expected_sign = math.copysign(1., incoming_angular)
    angular = []
    minimum_speed = float('inf')
    for inner in (True, False):
        previous = module.centroid(module.remnant(module.SPLIT, inner))
        for frame in range(module.SPLIT+1, module.END+1):
            points = module.remnant(frame, inner)
            projection(points)
            error = abs(module.volume(points,module.SPLIT_DOMAINS[0 if inner else 1][1])/module.TARGETS[0 if inner else 1]-1)
            drift = max(drift,error)
            assert error < .002, ('remnant proxy volume',frame,error)
            centre = module.centroid(points)
            velocity = module.sub(centre, previous)
            minimum_speed = min(minimum_speed, module.length(velocity))
            angular.append(module.cross(module.sub(centre, module.EARTH), velocity)[1])
            previous = centre
    assert min(expected_sign*v for v in angular) > 0, 'return/outer trajectory reverses initial angular-momentum sign'
    assert minimum_speed > .005, 'stalled remnant'
    presplit = [module.cross(module.sub(module.carrier(f), module.EARTH),
                            module.mul(module.sub(module.carrier(f+.01), module.carrier(f-.01)), 50))[1]
                for f in range(module.CONTACT, module.SPLIT)]
    assert min(expected_sign*v for v in presplit) > 0, 'pre-split carrier reverses the prograde sweep'
    left_velocity = module.mul(module.sub(module.carrier(module.SPLIT), module.carrier(module.SPLIT-.01)), 100.)
    retained = module.cross(module.sub(module.carrier(module.SPLIT), module.EARTH), left_velocity)[1]/incoming_angular
    assert retained >= .4, ('lost incoming angular proxy', retained)
    for frame in range(module.CONTACT, module.SPLIT):
        v = module.mul(module.sub(module.carrier(frame+.01), module.carrier(frame-.01)), 50.)
        assert module.dot(v, module.T) > 0, ('incoming tangent rebounds',frame)
    penetration = 0.
    for frame in range(1, module.SPLIT+1):
        points,_,_ = module.bulk(frame)
        gap = min(module.surface_gap(p,frame) for p in points)
        penetration = max(penetration, -gap)
        assert gap >= -.035, ('ghost interpenetration', frame, gap)
        if frame == 43:
            assert gap < .08, ('initial pressure footprint no longer touches bulk',gap)
    assert module.RETURN_CONTACT > module.SPLIT+8, 'return begins before separation'
    actual_contact = next(frame for frame in range(module.SPLIT, module.END+1)
                          if min(module.surface_gap(p,frame) for p in module.remnant(frame,True)) <= 0.)
    assert abs(actual_contact-module.RETURN_CONTACT) <= 1, ('return contact does not drive receiving deformation', actual_contact)
    assert max(module.surface_gap(p,module.END) for p in module.remnant(module.END,True)) < -.025, 'return is not enclosed'
    # Only the two interface-adjacent rings can form the late short thread.
    thread_lengths = []
    for frame in (93,94,95,96):
        points,rows,_ = module.bulk(frame)
        thin = []
        for i in range(1,len(module.PARAMS)-1):
            ring_points = [points[j] for j in module.ring(i)]
            centre = module.centroid(ring_points)
            screen_radius = max(abs(p[2]-centre[2]) for p in ring_points)
            if screen_radius < .055:
                thin.append(i)
        assert thin and set(thin) <= {module.JOINT-1,module.JOINT,module.JOINT+1}, ('extended needle',frame,thin)
        span = module.length(module.sub(rows[max(thin)+1][0],rows[min(thin)-1][0]))
        assert span < .24, ('long thread',frame,span)
        thread_lengths.append(span)
        neck_points = [points[j] for j in module.ring(module.JOINT)]
        neck_centre = module.centroid(neck_points)
        pixels = 2*max(abs(p[2]-neck_centre[2]) for p in neck_points)*360/(11.5*360/640)
        if frame <= 94:
            assert pixels >= 2., ('premature subpixel thread',frame,pixels)
    # Both source and remnant meshes keep exact matched interface positions.
    for side,inner in enumerate((True,False)):
        assert max(module.length(module.sub(a,b)) for a,b in zip(module.SPLIT_DOMAINS[side][0],module.remnant(module.SPLIT,inner))) < 1e-9
    contact_centres = [module.centroid(module.bulk(f)[0]) for f in (module.CONTACT-1,module.CONTACT,module.CONTACT+1)]
    contact_step = module.length(module.sub(module.sub(contact_centres[2],contact_centres[1]),module.sub(contact_centres[1],contact_centres[0])))
    assert contact_step < .015, ('kernel contact velocity jump',contact_step)
    pinch_steps = []
    previous,rows,_ = module.bulk(module.SPLIT-1)
    for inner in (True,False):
        a = module.centroid(module.domain(previous,inner,rows)[0])
        b = module.centroid(module.remnant(module.SPLIT,inner))
        c = module.centroid(module.remnant(module.SPLIT+1,inner))
        pinch_steps.append(module.length(module.sub(module.sub(c,b),module.sub(b,a))))
    assert max(pinch_steps) < .015, ('kernel pinch velocity jump',pinch_steps)
    points,rows,_ = module.bulk(76)
    root,tip = rows[0][0],rows[-1][0]
    middle = rows[module.JOINT][0]
    chord = module.sub(tip,root)
    distance = module.length(module.cross(module.sub(middle,root),chord))/module.length(chord)
    assert distance > .6, ('straight stream',distance)
    assert rows[module.JOINT][3]**2 > 3., 'stream lacks broad thin cross-section'
    outer = module.remnant(module.END,False)
    centre = module.centroid(outer)
    axis = module.mul(module.sub(module.EARTH,centre),1/module.length(module.sub(module.EARTH,centre)))
    extent = lambda direction: max(module.dot(module.sub(p,centre),direction) for p in outer)-min(module.dot(module.sub(p,centre),direction) for p in outer)
    tidal_ratio = extent(axis)/extent(module.B)
    assert 1.07 < tidal_ratio < 1.23, ('outer settles to sphere/excessive stretch',tidal_ratio)
    n = module.RETURN_NORMAL
    compression = module.dot(module.sub(module.earth_point(module.mul(n,module.RE),module.RETURN_CONTACT+3),
                                        module.earth_point(module.mul(n,module.RE),module.RETURN_CONTACT-1)),n)
    accepted = module.dot(module.sub(module.earth_point(module.mul(n,module.RE),module.END),
                                     module.earth_point(module.mul(n,module.RE),module.RETURN_CONTACT-1)),n)
    assert compression < -.10 and accepted > .30, ('receiving compression/bulge missing',compression,accepted)
    return {'proxy_volume_max_drift': drift, 'lobe_redistribution_range': [min(factors), max(factors)],
            'redistribution_max_frame_step': step, 'remnant_min_speed': minimum_speed,
            'remnant_angular_y_min': min(angular), 'minimum_slice_jacobian':min_slice_jacobian,
            'source_math_projected_bounds':bounds, 'pre_split_carrier_angular_y_min':min(presplit),
            'return_contact_frame':module.RETURN_CONTACT, 'actual_radial_contact_frame':actual_contact,
            'incoming_angular_y':incoming_angular, 'retained_angular_proxy_ratio':retained,
            'maximum_radial_penetration':penetration, 'late_thread_spans':thread_lengths,
            'receiving_compression_bulge':[compression,accepted], 'contact_velocity_step':contact_step,
            'pinch_velocity_steps':pinch_steps, 'visible_spine_bend':distance, 'outer_tidal_ratio':tidal_ratio}


def native_checks(module):
    import bpy
    import bmesh
    from mathutils import Vector, Matrix
    from mathutils.bvhtree import BVHTree
    from bpy_extras.object_utils import world_to_camera_view

    scene, bodies, reference = module.build_scene()
    representation(scene)
    for obj in bodies:
        curves = list(module._curves(obj.data.shape_keys.animation_data))
        assert curves and all(p.interpolation == 'BEZIER' for curve in curves
                              if curve.data_path.startswith('key_blocks')
                              for p in curve.keyframe_points), 'visibility step overwrote native cubic shape interpolation'
    assert not bpy.app.handlers.frame_change_pre and not bpy.app.handlers.frame_change_post
    assert scene.camera.data.ortho_scale == 11.5
    assert tuple(scene.camera.location) == (0., -22., 2.)
    assert all(tuple(obj.scale) == (1.,1.,1.) for obj in bodies)
    earth = scene.objects['ReceivingEarth']
    sampled = {1,30,44,60,76,90,95,96,112,128,144}
    drift, min_area, bounds = 0., float('inf'), [1.,1.,0.,0.]
    source_centres, outer_centres, return_centres = {}, {}, {}
    earth_contact_displacement = earth_return_displacement = 0.
    strain_points = None
    contained = None
    swap_delta = 0.
    min_slice_jacobian = float('inf')
    incoming_angular = module.cross(module.sub(module.HIT,module.EARTH),module.VELOCITY)[1]
    expected_sign = math.copysign(1.,incoming_angular)
    max_interbody_penetration = 0.
    evaluated_return_contact = None
    receiving_volumes = {}

    def evaluated(obj):
        depsgraph = bpy.context.evaluated_depsgraph_get()
        value = obj.evaluated_get(depsgraph)
        mesh = value.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
        points = [tuple(value.matrix_world @ v.co) for v in mesh.vertices]
        faces = [tuple(p.vertices) for p in mesh.polygons]
        return value, mesh, points, faces

    def validate(points, faces, intersections):
        nonlocal min_area
        assert all(math.isfinite(v) for p in points for v in p), 'nonfinite geometry'
        edges = {}
        neighbours = [set() for _ in points]
        for face in faces:
            for a,b in zip(face, face[1:]+face[:1]):
                edges.setdefault(tuple(sorted((a,b))), []).append((a,b))
                neighbours[a].add(b)
                neighbours[b].add(a)
        assert all(len(e)==2 and e[0]==e[1][::-1] for e in edges.values()), 'open/nonmanifold/inconsistently wound mesh'
        reached, pending = {0}, [0]
        while pending:
            for vertex in neighbours[pending.pop()]-reached:
                reached.add(vertex)
                pending.append(vertex)
        assert len(reached)==len(points), 'mesh has disconnected shell'
        for a,b,c in module.triangles(faces):
            area = module.length(module.cross(module.sub(points[b],points[a]), module.sub(points[c],points[a])))/2
            min_area = min(min_area, area)
            assert area > 1e-9, 'degenerate neck triangle'
        result = module.volume(points, faces)
        assert result > 1e-6, 'nonpositive signed volume'
        if intersections:
            tree = BVHTree.FromPolygons([Vector(p) for p in points], faces)
            overlaps = [(a,b) for a,b in tree.overlap(tree) if a<b and not set(faces[a])&set(faces[b])]
            assert not overlaps, ('surface self-intersection', overlaps[:3])
        return result

    for frame in range(1, module.END+1):
        scene.frame_set(frame)
        earth_value,earth_mesh,earth_points,earth_faces = evaluated(earth)
        earth_tree = BVHTree.FromPolygons([Vector(p) for p in earth_points],earth_faces)
        receiving_volumes[frame] = module.volume(earth_points,earth_faces)
        earth_value.to_mesh_clear()
        active = [o for o in bodies if not o.hide_render]
        assert len(active)==(1 if frame<module.SPLIT else 2), 'topology/visibility ordering'
        for obj in active:
            value, mesh, points, faces = evaluated(obj)
            try:
                try:
                    measured = validate(points, faces, frame in sampled)
                except AssertionError as error:
                    raise AssertionError((obj.name, frame, error.args)) from error
                attr = mesh.attributes.get('material_rest')
                assert attr is not None and len(attr.data)==len(points), 'lost transported surface coordinates'
                assert all(module.length(module.sub(tuple(a.vector),tuple(b.vector)))<1e-6
                           for a,b in zip(attr.data,obj.data.attributes['material_rest'].data)), 'rest texture swims'
                for p in points:
                    view = world_to_camera_view(scene, scene.camera, Vector(p))
                    bounds = [min(bounds[0],view.x),min(bounds[1],view.y),max(bounds[2],view.x),max(bounds[3],view.y)]
                    assert .02 <= view.x <= .98 and .02 <= view.y <= .98, ('source/wake clipped', frame, tuple(view))
                role = obj['role']
                signed_gap = []
                if role in ('welded_bulk','returning_bulk'):
                    for p in points:
                        nearest,normal,_,distance = earth_tree.find_nearest(Vector(p))
                        signed_gap.append((Vector(p)-nearest).dot(normal))
                if role == 'welded_bulk':
                    penetration = max(0.,-min(signed_gap))
                    max_interbody_penetration = max(max_interbody_penetration,penetration)
                    assert penetration <= .035, ('evaluated ghost penetration',frame,penetration)
                    if frame == 43:
                        assert min(signed_gap) < .08, ('evaluated pressure without contact',min(signed_gap))
                elif role == 'returning_bulk':
                    if min(signed_gap) <= 0. and evaluated_return_contact is None:
                        evaluated_return_contact = frame
                    if frame < module.RETURN_CONTACT-1:
                        assert min(signed_gap) >= -.025, ('premature evaluated return contact',frame,min(signed_gap))
                if role == 'welded_bulk':
                    assert len(points)==len(module.REST)
                    neck_centre = module.centroid([points[i] for i in module.ring(module.JOINT)])
                    rows = module.profile(frame)[0]
                    rows[module.JOINT] = (neck_centre,)+rows[module.JOINT][1:]
                    volumes = [module.volume(*module.domain(points,inner,rows)[:2]) for inner in (True,False)]
                    for observed,target in zip(volumes,module.TARGETS):
                        drift = max(drift,abs(observed/target-1))
                    source_centres[frame] = module.centroid(points)
                    # Material wedges cannot invert while ordered slice planes
                    # remain positively oriented. This checks actual evaluated
                    # positions, not the kernel's factor metadata.
                    for i in range(1,len(module.PARAMS)-2):
                        a,b=module.ring(i),module.ring(i+1)
                        ca,cb=module.centroid([points[j] for j in a]),module.centroid([points[j] for j in b])
                        for j in range(module.SIDES):
                            determinant=module.dot(module.sub(cb,ca),module.cross(module.sub(points[a[j]],ca),
                                                         module.sub(points[a[(j+1)%module.SIDES]],ca)))
                            min_slice_jacobian=min(min_slice_jacobian,determinant)
                            assert determinant>0, ('inverted evaluated material slice',frame,i)
                    if frame == 76:
                        strain_points = points
                else:
                    side = 0 if role=='returning_bulk' else 1
                    drift = max(drift,abs(measured/module.TARGETS[side]-1))
                    centres = return_centres if side==0 else outer_centres
                    centres[frame] = module.centroid(points)
                    if frame == module.SPLIT:
                        native_swap = bodies[0].data.shape_keys.key_blocks['Pose096'].data
                        indices = module.SPLIT_DOMAINS[side][2]
                        swap_delta = max(swap_delta,max(module.length(module.sub(points[i],tuple(native_swap[j].co)))
                                                        for i,j in enumerate(indices)))
                    if frame == module.END and side==0:
                        contained = points
            finally:
                value.to_mesh_clear()
        value, mesh, points, faces = evaluated(earth)
        try:
            validate(points,faces,frame in sampled)
            if frame in (43,module.RETURN_PEAK):
                deltas = [module.length(module.sub(p,tuple(earth.matrix_world @ v.co)))
                          for p,v in zip(points,earth.data.vertices)]
                displacement = max(deltas)
                site = world_to_camera_view(scene,scene.camera,Vector(points[deltas.index(displacement)]))
                assert .02 <= site.x <= .98 and .02 <= site.y <= .98, 'impact response site is clipped'
                if frame==43:
                    earth_contact_displacement = displacement
                else:
                    earth_return_displacement = displacement
            if frame==module.END:
                target_tree = BVHTree.FromPolygons([Vector(p) for p in points],faces)
                signed = []
                for p in contained:
                    nearest, normal, _, distance = target_tree.find_nearest(Vector(p))
                    signed.append((Vector(p)-nearest).dot(normal))
                assert max(signed)<-.025, ('returning bulk outside evaluated Earth', max(signed))
                containment_margin = -max(signed)
        finally:
            value.to_mesh_clear()
    assert drift < .002, ('evaluated proxy drift',drift)
    assert swap_delta < 1e-5, ('topology swap position mismatch',swap_delta)
    assert earth_contact_displacement > .3 and earth_return_displacement > .3, ('Earth has no geometric impact response', earth_contact_displacement, earth_return_displacement)
    assert not bodies[1].hide_render and not bodies[2].hide_render, 'exposed remnant disappears'
    minimum_speed=float('inf')
    angular_y=[]
    for centres in (return_centres,outer_centres):
        for frame in range(module.SPLIT+1,module.END+1):
            velocity=module.sub(centres[frame],centres[frame-1])
            minimum_speed=min(minimum_speed,module.length(velocity))
            angular_y.append(module.cross(module.sub(centres[frame],module.EARTH),velocity)[1])
    assert minimum_speed>.005, 'evaluated remnant stalls'
    assert min(expected_sign*v for v in angular_y)>0, 'evaluated remnant reverses incoming angular-momentum sign'
    assert evaluated_return_contact is not None and evaluated_return_contact > module.SPLIT+8
    assert abs(evaluated_return_contact-module.RETURN_CONTACT) <= 1, ('receiving deformation mistimed',evaluated_return_contact,module.RETURN_CONTACT)
    accepted_volume = receiving_volumes[module.END]-receiving_volumes[module.RETURN_CONTACT-1]
    assert .7*module.TARGETS[0] < accepted_volume < 1.5*module.TARGETS[0], ('receiving positive proxy volume',accepted_volume,module.TARGETS[0])
    contact_v = module.sub(source_centres[module.CONTACT],source_centres[module.CONTACT-1])
    late_v = module.sub(source_centres[module.SPLIT-1],source_centres[module.SPLIT-2])
    initial_proxy = module.cross(module.sub(source_centres[module.CONTACT],module.EARTH),contact_v)[1]
    late_proxy = module.cross(module.sub(source_centres[module.SPLIT-1],module.EARTH),late_v)[1]
    retained_angular = late_proxy/initial_proxy
    assert expected_sign*initial_proxy > 0 and retained_angular >= .4, ('evaluated incoming angular retention',retained_angular)
    for frame in range(module.CONTACT+1,module.SPLIT):
        v = module.sub(source_centres[frame],source_centres[frame-1])
        assert module.dot(v,module.T)>0, ('evaluated tangent rebounds',frame)

    # Fit a full affine transform to transported vertices; a global ellipsoid
    # or rigid transform cannot pass the residual and regional-strain tests.
    rows = [(p[0],p[1],p[2],1.) for p in module.REST]
    normal = Matrix([[sum(r[i]*r[j] for r in rows) for j in range(4)] for i in range(4)])
    inverse = normal.inverted()
    coefficients = [inverse @ Vector([sum(r[i]*p[d] for r,p in zip(rows,strain_points)) for i in range(4)]) for d in range(3)]
    residual = math.sqrt(sum(sum((p[d]-sum(c*r for c,r in zip(coefficients[d],row)))**2 for d in range(3))
                             for p,row in zip(strain_points,rows))/len(rows))
    assert residual > .08, ('affine blob deformation',residual)
    stretches = []
    for lo,hi in ((3,15),(33,45),(57,73)):
        ratios=[]
        for i in range(lo,hi):
            a,b = module.ring(i)[0],module.ring(i+1)[0]
            ratios.append(module.length(module.sub(strain_points[a],strain_points[b]))/
                          module.length(module.sub(module.REST[a],module.REST[b])))
        stretches.append(sum(ratios)/len(ratios))
    assert max(stretches)-min(stretches) > .15, 'no regional strain difference'
    contact_left = module.sub(source_centres[30],source_centres[29])
    contact_right = module.sub(source_centres[31],source_centres[30])
    contact_step = module.length(module.sub(contact_left,contact_right))
    assert contact_step < .015, ('contact velocity jump',contact_step)
    # Native frame positions on either side of split match the source kernel's
    # actual domain motion, not merely custom-property promises.
    pinch_steps=[]
    for side,centres in enumerate((return_centres,outer_centres)):
        points,rows,_=module.bulk(95)
        previous=module.centroid(module.domain(points,side==0,rows)[0])
        left=module.sub(centres[96],previous)
        right=module.sub(centres[97],centres[96])
        pinch_steps.append(module.length(module.sub(left,right)))
    assert max(pinch_steps)<.015, ('pinch velocity jump',pinch_steps)
    def at(obj, frame):
        scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
        value,mesh,points,_=evaluated(obj)
        value.to_mesh_clear()
        return points
    eps=.02
    before=module.centroid(at(bodies[0],module.CONTACT-eps))
    middle=module.centroid(at(bodies[0],module.CONTACT))
    after=module.centroid(at(bodies[0],module.CONTACT+eps))
    c1_contact=module.length(module.sub(module.mul(module.sub(middle,before),1/eps),
                                       module.mul(module.sub(after,middle),1/eps)))
    assert c1_contact<.0005, ('native subframe contact is not C1',c1_contact)
    before=at(bodies[0],module.SPLIT-eps)
    rows=module.profile(module.SPLIT-eps)[0]
    rows[module.JOINT]=(module.centroid([before[i] for i in module.ring(module.JOINT)]),)+rows[module.JOINT][1:]
    c1_pinch=[]
    for side,obj in enumerate(bodies[1:]):
        before_c=module.centroid(module.domain(before,side==0,rows)[0])
        middle=module.centroid(at(obj,module.SPLIT))
        after=module.centroid(at(obj,module.SPLIT+eps))
        step=module.length(module.sub(module.mul(module.sub(middle,before_c),1/eps),
                                      module.mul(module.sub(after,middle),1/eps)))
        c1_pinch.append(step)
    assert max(c1_pinch)<.0005, ('native subframe pinch is not C1',c1_pinch)
    thread_spans=[]
    for frame in (93,94,95,96):
        if frame < module.SPLIT:
            points = at(bodies[0],frame)
        else:
            # Use the active evaluated remnants at the switch, rather than
            # asking the viewport dependency graph for a hidden welded mesh.
            points = [None]*len(module.REST)
            for side,obj in enumerate(bodies[1:]):
                part = at(obj,frame)
                for index,point in zip(module.SPLIT_DOMAINS[side][2],part):
                    if points[index] is not None:
                        assert module.length(module.sub(points[index],point)) < 1e-5
                    points[index] = point
        neck = [points[i] for i in module.ring(module.JOINT)]
        screen = [world_to_camera_view(scene,scene.camera,Vector(p)).y*scene.render.resolution_y for p in neck]
        diameter = max(screen)-min(screen)
        if frame <= 94:
            assert diameter >= 2., ('evaluated premature subpixel thread',frame,diameter)
        if frame == 96:
            neck_pixels = diameter
            assert neck_pixels < 1., ('visible surgical topology switch',diameter)
        thin=[]
        for i in range(1,len(module.PARAMS)-1):
            ring_points=[points[j] for j in module.ring(i)]
            c=module.centroid(ring_points)
            if max(abs(p[2]-c[2]) for p in ring_points)<.055:
                thin.append(i)
        assert thin and set(thin)<={module.JOINT-1,module.JOINT,module.JOINT+1}, ('evaluated long needle',frame,thin)
        a=module.centroid([points[j] for j in module.ring(min(thin)-1)])
        b=module.centroid([points[j] for j in module.ring(max(thin)+1)])
        span=module.length(module.sub(b,a))
        assert span < .24, ('evaluated long thin thread',frame,span)
        thread_spans.append(span)
    scene.frame_set(1)
    return {'status':'GREEN_EVALUATED_GEOMETRY_NOT_ART','blender':bpy.app.version_string,
            'checked_frames':144,'self_intersection_frames':sorted(sampled),'source_proxy_volume':reference,
            'evaluated_proxy_max_drift':drift,'minimum_triangle_area':min_area,'projected_bounds':bounds,
            'affine_fit_residual':residual,'regional_edge_stretches':stretches,
            'contact_velocity_step':contact_step,'pinch_velocity_steps':pinch_steps,
            'native_subframe_c1_contact':c1_contact,'native_subframe_c1_pinch':c1_pinch,
            'minimum_slice_jacobian':min_slice_jacobian,
            'evaluated_remnant_min_speed':minimum_speed,'evaluated_remnant_angular_y_min':min(angular_y),
            'swap_vertex_delta':swap_delta,'neck_diameter_pixels':neck_pixels,'late_thread_spans':thread_spans,
            'earth_displacement_contact_return':[earth_contact_displacement,earth_return_displacement],
            'containment_margin':containment_margin, 'max_interbody_penetration':max_interbody_penetration,
            'evaluated_return_contact':evaluated_return_contact, 'receiving_positive_proxy_volume':accepted_volume,
            'evaluated_incoming_angular_retention':retained_angular, 'render_submitted':False}


if __name__ == '__main__':
    if '--old' in sys.argv:
        scene, _, _ = load('build_scene').build_scene()
        representation(scene)
    elif '--kernel-only' in sys.argv:
        baseline_red = None
        if '--baseline-red' in sys.argv:
            baseline = load('layout-repair-20261006/baseline-002/flow_scene')
            try:
                kernel_checks(baseline)
            except AssertionError as error:
                assert error.args and isinstance(error.args[0],tuple) and error.args[0][0] == 'lost incoming angular proxy', ('unexpected baseline failure',str(error))
                baseline_red = str(error)
            else:
                raise AssertionError('baseline002 incorrectly passes repaired acceptance')
        report = kernel_checks(load('flow_scene'))
        if baseline_red is not None:
            report['baseline002_expected_RED'] = baseline_red
        report['status'] = 'KERNEL_ONLY_NOT_EVALUATED_NOT_ART'
        print(json.dumps(report,sort_keys=True))
    else:
        module = load('flow_scene')
        report = native_checks(module)
        report['kernel'] = kernel_checks(module)
        print(json.dumps(report,sort_keys=True))
