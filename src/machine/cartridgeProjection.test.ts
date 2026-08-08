import { describe, expect, it } from 'vitest'
import {
  Euler,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Ray,
  Raycaster,
  Vector3,
} from 'three'
import { SLOT, isInsideSlot } from '../loops/assembly/model'
import {
  PARALLEL_DENOMINATOR_EPSILON,
  RAIL_BOUNDS,
  assemblyPointToRailLocal,
  assemblyPointToWorld,
  clampAssemblyPoint,
  createRailInteractionPlane,
  grabbedWorldHitToAssemblyPoint,
  intersectClientWithRailPlane,
  intersectRayWithPlane,
  railLocalToAssemblyPoint,
  worldPointToClient,
  worldToAssemblyPoint,
  type CanvasRect,
} from './cartridgeProjection'

function createRailMatrix(): Matrix4 {
  return new Matrix4().compose(
    new Vector3(0.2, -0.1, 0.15),
    new Quaternion().setFromEuler(new Euler(0.18, -0.35, 0.07)),
    new Vector3(1.08, 0.93, 1),
  )
}

function createCamera(rect: CanvasRect): PerspectiveCamera {
  const camera = new PerspectiveCamera(42, rect.width / rect.height, 0.1, 100)
  camera.position.set(0, 1.2, 6.5)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

describe('cartridge rail projection', () => {
  it('intersects a real perspective-camera ray with the explicit rail plane', () => {
    const rect = { left: 40, top: 20, width: 960, height: 420 }
    const camera = createCamera(rect)
    const matrix = createRailMatrix()
    const plane = createRailInteractionPlane(matrix)
    const expected = assemblyPointToWorld({ x: 0.37, y: 0.62 }, matrix)
    const client = worldPointToClient(expected, rect, camera)

    const hit = intersectClientWithRailPlane(
      client,
      rect,
      camera,
      plane,
      new Raycaster(),
    )

    expect(hit).not.toBeNull()
    expect(hit!.distanceTo(expected)).toBeLessThan(1e-9)
  })

  it('rejects near-parallel and behind-origin ray intersections', () => {
    const plane = new Plane(new Vector3(0, 0, 1), 0)
    const parallel = new Ray(
      new Vector3(0, 0, 1),
      new Vector3(1, 0, PARALLEL_DENOMINATOR_EPSILON),
    )
    const justIntersecting = new Ray(
      new Vector3(0, 0, 1),
      new Vector3(1, 0, -(PARALLEL_DENOMINATOR_EPSILON * 1.01)).normalize(),
    )
    const behind = new Ray(new Vector3(0, 0, 1), new Vector3(0, 0, 1))

    expect(intersectRayWithPlane(parallel, plane)).toBeNull()
    expect(intersectRayWithPlane(justIntersecting, plane)).not.toBeNull()
    expect(intersectRayWithPlane(behind, plane)).toBeNull()
  })

  it('round-trips normalized points through local and transformed world rail space', () => {
    const matrix = createRailMatrix()

    for (const point of [
      { x: 0, y: 0 },
      { x: 0.12, y: 0.5 },
      { x: 0.78, y: 0.5 },
      { x: 1, y: 1 },
    ]) {
      const localRoundTrip = railLocalToAssemblyPoint(
        assemblyPointToRailLocal(point),
      )
      expect(localRoundTrip.x).toBeCloseTo(point.x, 12)
      expect(localRoundTrip.y).toBeCloseTo(point.y, 12)
      const worldRoundTrip = worldToAssemblyPoint(
        assemblyPointToWorld(point, matrix),
        matrix,
      )
      expect(worldRoundTrip.x).toBeCloseTo(point.x, 12)
      expect(worldRoundTrip.y).toBeCloseTo(point.y, 12)
    }
  })

  it('round-trips through CSS pixels within half a pixel at desktop and mobile sizes', () => {
    const matrix = createRailMatrix()

    for (const rect of [
      { left: 16, top: 120, width: 1120, height: 392 },
      { left: 12, top: 148, width: 366, height: 128 },
    ]) {
      const camera = createCamera(rect)
      const plane = createRailInteractionPlane(matrix)
      for (const point of [
        { x: 0.04, y: 0.86 },
        SLOT.center,
        { x: 0.96, y: 0.08 },
      ]) {
        const world = assemblyPointToWorld(point, matrix)
        const client = worldPointToClient(world, rect, camera)
        const hit = intersectClientWithRailPlane(client, rect, camera, plane)
        expect(hit).not.toBeNull()
        const reprojection = worldPointToClient(hit!, rect, camera)
        expect(
          Math.hypot(
            reprojection.x - client.x,
            reprojection.y - client.y,
          ),
        ).toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('preserves the pointer grab offset and clamps visible centers to rail bounds', () => {
    const matrix = createRailMatrix()
    const visible = assemblyPointToWorld({ x: 0.2, y: 0.65 }, matrix)
    const offset = new Vector3(0.14, -0.07, 0)
    const downHit = visible.clone().add(offset)

    expect(grabbedWorldHitToAssemblyPoint(downHit, offset, matrix)).toEqual({
      x: expect.closeTo(0.2, 12),
      y: expect.closeTo(0.65, 12),
    })

    expect(clampAssemblyPoint({ x: -0.4, y: 1.8 })).toEqual({ x: 0, y: 1 })
    const outsideWorld = new Vector3(
      RAIL_BOUNDS.right + 4,
      RAIL_BOUNDS.bottom - 4,
      RAIL_BOUNDS.z,
    ).applyMatrix4(matrix)
    expect(
      grabbedWorldHitToAssemblyPoint(outsideWorld, new Vector3(), matrix),
    ).toEqual({ x: 1, y: 1 })
  })

  it('keeps the rendered rail conversion at canonical inclusive SLOT boundaries', () => {
    const matrix = createRailMatrix()
    for (const point of [
      { x: SLOT.left, y: SLOT.top },
      { x: SLOT.right, y: SLOT.bottom },
      SLOT.center,
    ]) {
      const visiblePoint = worldToAssemblyPoint(
        assemblyPointToWorld(point, matrix),
        matrix,
      )
      expect(isInsideSlot(visiblePoint)).toBe(true)
    }

    const miss = { x: SLOT.left - 0.0001, y: SLOT.center.y }
    const visibleMiss = worldToAssemblyPoint(
      assemblyPointToWorld(miss, matrix),
      matrix,
    )
    expect(isInsideSlot(visibleMiss)).toBe(false)
  })
})
