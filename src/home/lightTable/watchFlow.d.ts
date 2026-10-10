export interface WatchFlowState { position: number; velocity: number }
export function stepWatchFlow(state: WatchFlowState, target: number, dt: number): WatchFlowState
export function createWatchFlow(paint: (progress: number) => void, land: (target: number) => void, initial?: WatchFlowState): {
  set(want: boolean, reduced?: boolean): void
  pause(): void
  resume(): void
  destroy(): void
  readonly state: WatchFlowState
  readonly pending: boolean
}
