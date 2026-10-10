export interface WatchView {
  resize(): boolean
  paint(time?: number, open?: number): void
  proximity(x: number, y: number): number
  faceProjection(): { x: number; y: number }
  destroy(): void
  readonly pose: { time: number; open: number }
  snapshotPose(): string
  geometry(): {
    balanceSpokes: number
    balanceAngle: number
    strap: unknown
    bezelLift: number
    glassZ: number
    rotation: [number, number, number, string]
    projectedBounds: { minX: number; minY: number; maxX: number; maxY: number }
  }
  snapshot(open?: number): string
}
export function createWatch(three: unknown, host: HTMLElement, surface?: HTMLElement): WatchView
