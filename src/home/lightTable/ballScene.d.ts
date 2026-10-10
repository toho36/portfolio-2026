import type { BallSpin } from './ballMotion.js'
import type { BallAffine, BallChoreography, BallOrientation, BallPose } from './ballFlow.js'

export interface BallSource {
  width: number
  height: number
  aspect?: number
  origin: BallAffine
  contact: BallChoreography
  viewport?: { width: number; height: number }
  fanBottom?: number
  fanBounds?: { left: number; right: number; top: number; bottom: number }
  fanBasis?: BallFanBasis
}
export interface BallFanBasis {
  origin: number[]
  x: number[]
  y: number[]
  cardWorld?: number[][]
  bounds: { left: number; right: number; top: number; bottom: number }
}
export interface BallFanFrame extends BallAffine {
  translation: { x: number; y: number }
  bottom: number
  exitTime: number
  span: number
  orientationP: number
  plane: { a: number; b: number; c: number; d: number }
  basis: BallFanBasis
}
export interface BallSceneEntry {
  choreography?: BallChoreography
  orientation?: BallOrientation
  pose?: BallPose
  clockVelocity?: number
}
export function ballContactLayout(source: BallSource, width: number, height: number): { scale: number; x: number; y: number }
export function ballContactShift(source: BallSource, width: number, height: number, age: number): { x: number; y: number }
export function ballEntryFrame(source: BallSource, width: number, height: number, progress: number, age?: number): BallAffine
export function ballFanFrame(source: BallSource, width: number, height: number, age: number): BallFanFrame
export function ballEntryPresentation(source: BallSource, width: number, height: number, age: number, pose?: BallPose): {
  x: number
  y: number
  diameter: number
  span: number
  p: number
  orientationP: number
  affine: BallAffine
  fan: Omit<BallFanFrame, 'span' | 'orientationP' | 'plane' | 'basis'>
  fanTranslation: number[]
  cardBasis?: number[][]
  cardWorld?: number[][]
}
export interface VolleyballView {
  resize(width?: number, height?: number): void
  extend(width: number, height: number, source: BallSource): void
  resizeEntry(width: number, height: number): void
  projectEntry(point: number[]): { x: number; y: number }
  paint(x: number, y: number, time?: number, spin?: BallSpin): void
  paintEntry(age: number, x: number, y: number, time: number, spin?: BallSpin, entry?: BallSceneEntry): void
  destroy(): void
  readonly frame: { width: number; height: number; padX: number; padY: number }
  readonly entryProjection: { source: BallSource | null; affine: BallAffine | null; choreography?: BallChoreography; fanFrame: Omit<BallFanFrame, 'span' | 'orientationP' | 'plane' | 'basis'> | null; cardAffine: BallAffine | null | undefined }
  snapshotPose(): string
  snapshot(x?: number, y?: number, time?: number, spin?: BallSpin): string
  alphaCorners(): number[]
}
export function createVolleyball(three: unknown, host: HTMLElement, surface?: HTMLElement): VolleyballView
