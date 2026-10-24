export function deckPosition(scroll: number, step: number, count?: number): number
export function settleSheet(position: number, direction: number, count?: number): number
export function settleEase(progress: number): number
export function coastPosition(from: number, target: number, velocity: number, elapsed: number): number
export function sheetPose(index: number, position: number): { x: number; y: number; rotation: number; scale: number; opacity: number; z: number }
