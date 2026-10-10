export interface CalibreCamera {
  position: number[]
  zoom: number
  polar: number
  azimuth: number
}
export interface CalibreFrame {
  moving: boolean
  bounds: { x: number; y: number; width: number; height: number }
  triangles: number
  balanceAngle: number
  trainAngles: number[]
}
export interface CalibreView {
  destroy(): void
  resize(): void
  pick(x: number, y: number): string | null
  cameraState(): CalibreCamera
  restoreCamera(snapshot: CalibreCamera): void
  zoomBy(amount: number): void
  orbitBy(angle: number): void
  reset(): void
  atZoomLimit(delta: number): boolean
  render(time: number, open: number, selected: string | null, trainTime: number): CalibreFrame | null
}
export function createCalibre(three: unknown, orbit: unknown, stage: HTMLElement, changed: () => void): CalibreView
