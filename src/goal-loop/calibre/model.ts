export const PARTS = [
  { id: 'plate', name: 'Main plate', text: 'The fixed support keeps the axes of the movement in relation.' },
  { id: 'barrel', name: 'Winding barrel', text: 'A coiled spring stores energy inside the barrel.' },
  { id: 'train', name: 'Gear train', text: 'A connected series of wheels transfers the movement at different rates.' },
  { id: 'balance', name: 'Balance and escapement', text: 'The balance oscillates while the escapement meters the movement.' },
  { id: 'bridges', name: 'Bridges', text: 'Machined supports hold the pivots and expose the mechanism beneath.' },
]
export const GEARS = [
  { x: -.12, y: .62, radius: .65, teeth: 36, speed: -.16 },
  { x: .55, y: 1.6, radius: .54, teeth: 30, speed: .192 },
  { x: 1.6, y: .75, radius: .75, teeth: 42, speed: -.137 },
  { x: -.75, y: -.73, radius: .60, teeth: 34, speed: .17 },
]
export function approachOpen(value: number, target: number, dt: number, reduced: boolean) {
  if (reduced) return target
  if (!Number.isFinite(dt) || dt < 0) return value
  const next = value + (target - value) * (1 - Math.exp(-Math.min(dt, .1) / .18))
  return Math.abs(target - next) < .0005 ? target : next
}
export function layers(open: number) {
  const p = Math.max(0, Math.min(1, open))
  return { plate: 0, barrel: .17 + p * .30, train: .27 + p * .82, balance: .40 + p * 1.16, bridges: .50 + p * 1.82 }
}
export function gearOutline(radius: number, teeth: number) {
  const points: [number, number][] = []
  for (let i = 0; i < teeth; i++) for (const [fraction, r] of [[.05, radius - .035], [.25, radius + .05], [.75, radius + .05], [.95, radius - .035]]) {
    const angle = (i + fraction) / teeth * Math.PI * 2
    points.push([Math.cos(angle) * r, Math.sin(angle) * r])
  }
  return points
}
