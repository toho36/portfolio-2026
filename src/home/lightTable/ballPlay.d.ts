export function screenToWorld(project: (point: number[]) => { x: number; y: number }, x: number, y: number): { x: number; y: number }
export function createBallPlay(surface: HTMLElement, options: { view: () => any; entry: () => any; wake: () => void }): {
  step(state: { time: number; velocity: number }, dt: number): void
  readonly moving: boolean
  destroy(): void
}
