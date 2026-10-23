import type { BallSpin } from './ballMotion.js'
export { ballQuaternionMultiply } from './ballMotion.js'

export const BALL_DURATION: number
export interface BallPose { x: number; y: number; time: number; spin?: BallSpin; radius?: number }
export interface BallAffine { a: number; b: number; c: number; d: number; x: number; y: number }
export interface BallCard {
  support: number[]
  corner: number[]
  affine?: BallAffine
  width?: number
  height?: number
  supportScreen?: { x: number; y: number }
  cornerScreen?: { x: number; y: number }
  tangentScreen?: number[]
  normalScreen?: number[]
}
export interface BallChoreography {
  anchor: number[]
  support: number[]
  corner: number[]
  source: number[]
  tangent: number[]
  normal: number[]
  axis: number[]
  distance: number
  initialSpeed: number
  acceleration: number
  rollSpeed: number
  exitSpeed: number
  theta: number
  exitVelocity: number[]
  exit: number[]
  radius: number
  sourceRadius: number
  card: BallCard
}
export interface BallOrientation {
  quaternion: number[]
  angularVelocity: number[]
  residual: number[]
  age?: number
  clockVelocity?: number
  reopen?: { velocity: number[]; elapsed: number }
}
export interface BallFlowState { time: number; velocity: number }
export function ballEase(progress: number): number
export function createBallChoreography(card: BallCard, pose: BallPose): BallChoreography
export function ballFlight(time: number, choreography: BallChoreography, pose?: BallPose): {
  phase: 'pop' | 'settle' | 'rolling' | 'corner' | 'freefall' | 'landing' | 'rest'
  position: number[]
  velocity: number[]
  ambientVelocity: number[]
  vy: number
  radius: number
  support: number[] | null
  distance: number
  speed: number
  rollingAngle: number
  rebound: boolean
  angularVelocity: number[]
}
export function ballPoseQuaternion(pose: BallPose): number[]
export function captureBallOrientation(pose: BallPose): BallOrientation
export function bridgeBallSpin(pose: BallPose, orientation: BallOrientation): BallSpin
export function advanceBallOrientation(entry: { choreography: BallChoreography; orientation: BallOrientation }, age: number, dt: number, clockVelocity: number): void
export function stepBallFlow(state: BallFlowState, target: number | boolean, dt: number): BallFlowState
export function createBallFlow(paint: (state: BallFlowState, dt: number) => boolean | void, land: (target: number) => void, initial?: BallFlowState): {
  set(want: number | boolean, reduced?: boolean): void
  wake(): void
  pause(): void
  resume(): void
  destroy(): void
  readonly state: BallFlowState
  readonly pending: boolean
}
export function firstBallPose(entry: { started?: boolean; pose: BallPose }, age: number): BallPose | null
