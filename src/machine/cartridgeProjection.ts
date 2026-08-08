import {
  Matrix4,
  PerspectiveCamera,
  Plane,
  Ray,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import type { Point } from '../loops/assembly/model'

export const RAIL_BOUNDS = {
  left: -1.45,
  right: 1.45,
  top: 0.45,
  bottom: -0.35,
  z: 1.06,
} as const

export const PARALLEL_DENOMINATOR_EPSILON = 1e-9

export interface ClientPoint {
  readonly x: number
  readonly y: number
}

export interface CanvasRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export function clampAssemblyPoint(point: Point): Point {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  }
}

export function assemblyPointToRailLocal(
  point: Point,
  target = new Vector3(),
): Vector3 {
  return target.set(
    RAIL_BOUNDS.left + point.x * (RAIL_BOUNDS.right - RAIL_BOUNDS.left),
    RAIL_BOUNDS.top + point.y * (RAIL_BOUNDS.bottom - RAIL_BOUNDS.top),
    RAIL_BOUNDS.z,
  )
}

export function railLocalToAssemblyPoint(point: Vector3): Point {
  return {
    x:
      (point.x - RAIL_BOUNDS.left) /
      (RAIL_BOUNDS.right - RAIL_BOUNDS.left),
    y:
      (point.y - RAIL_BOUNDS.top) /
      (RAIL_BOUNDS.bottom - RAIL_BOUNDS.top),
  }
}

export function assemblyPointToWorld(
  point: Point,
  railMatrixWorld: Matrix4,
  target = new Vector3(),
): Vector3 {
  return assemblyPointToRailLocal(point, target).applyMatrix4(railMatrixWorld)
}

export function worldToAssemblyPoint(
  point: Vector3,
  railMatrixWorld: Matrix4,
): Point {
  const inverse = railMatrixWorld.clone().invert()
  return railLocalToAssemblyPoint(point.clone().applyMatrix4(inverse))
}

export function grabbedWorldHitToAssemblyPoint(
  hit: Vector3,
  grabOffset: Vector3,
  railMatrixWorld: Matrix4,
): Point {
  return clampAssemblyPoint(
    worldToAssemblyPoint(hit.clone().sub(grabOffset), railMatrixWorld),
  )
}

export function createRailInteractionPlane(
  railMatrixWorld: Matrix4,
  target = new Plane(),
): Plane {
  const origin = new Vector3(0, 0, RAIL_BOUNDS.z).applyMatrix4(
    railMatrixWorld,
  )
  const xPoint = new Vector3(1, 0, RAIL_BOUNDS.z).applyMatrix4(
    railMatrixWorld,
  )
  const yPoint = new Vector3(0, 1, RAIL_BOUNDS.z).applyMatrix4(
    railMatrixWorld,
  )
  return target.setFromCoplanarPoints(origin, xPoint, yPoint)
}

export function clientPointToNdc(
  client: ClientPoint,
  rect: CanvasRect,
  target = new Vector2(),
): Vector2 {
  return target.set(
    ((client.x - rect.left) / rect.width) * 2 - 1,
    1 - ((client.y - rect.top) / rect.height) * 2,
  )
}

export function intersectRayWithPlane(
  ray: Ray,
  plane: Plane,
  target = new Vector3(),
): Vector3 | null {
  const denominator = ray.direction.dot(plane.normal)
  if (Math.abs(denominator) <= PARALLEL_DENOMINATOR_EPSILON) return null

  const distance =
    -(ray.origin.dot(plane.normal) + plane.constant) / denominator
  if (distance < 0) return null
  return ray.at(distance, target)
}

export function intersectClientWithRailPlane(
  client: ClientPoint,
  rect: CanvasRect,
  camera: PerspectiveCamera,
  plane: Plane,
  raycaster = new Raycaster(),
  target = new Vector3(),
): Vector3 | null {
  raycaster.setFromCamera(clientPointToNdc(client, rect), camera)
  return intersectRayWithPlane(raycaster.ray, plane, target)
}

export function worldPointToClient(
  point: Vector3,
  rect: CanvasRect,
  camera: PerspectiveCamera,
): ClientPoint {
  const projected = point.clone().project(camera)
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  }
}
