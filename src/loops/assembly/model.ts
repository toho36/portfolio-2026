import { clamp } from '../../motion'

export interface Point {
  x: number
  y: number
}

export interface AssemblyState extends Point {
  seated: boolean
}

export const HOME: Point = { x: 0.12, y: 0.5 }
export const SLOT = {
  left: 0.68,
  right: 0.88,
  top: 0.35,
  bottom: 0.65,
  center: { x: 0.78, y: 0.5 },
} as const

export const initialAssemblyState: AssemblyState = { ...HOME, seated: false }

export function moveModule(state: AssemblyState, point: Point): AssemblyState {
  if (state.seated) return state
  return { x: clamp(point.x), y: clamp(point.y), seated: false }
}

export function nudgeModule(
  state: AssemblyState,
  dx: number,
  dy: number,
): AssemblyState {
  return moveModule(state, { x: state.x + dx, y: state.y + dy })
}

export function isInsideSlot(point: Point): boolean {
  return (
    point.x >= SLOT.left &&
    point.x <= SLOT.right &&
    point.y >= SLOT.top &&
    point.y <= SLOT.bottom
  )
}

export function releaseModule(state: AssemblyState): AssemblyState {
  return isInsideSlot(state)
    ? { ...SLOT.center, seated: true }
    : state
}

export function seatModule(state: AssemblyState): AssemblyState {
  return state.seated
    ? { ...HOME, seated: false }
    : { ...SLOT.center, seated: true }
}
