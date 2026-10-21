export function gearOutline(radius: number, teeth: number) {
  const points: [number, number][] = []
  for (let i = 0; i < teeth; i++) for (const [fraction, r] of [[.05, radius - .035], [.25, radius + .05], [.75, radius + .05], [.95, radius - .035]]) {
    const angle = (i + fraction) / teeth * Math.PI * 2
    points.push([Math.cos(angle) * r, Math.sin(angle) * r])
  }
  return points
}
