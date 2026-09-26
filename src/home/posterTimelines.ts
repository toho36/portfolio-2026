export const CMS_DURATION = 3600
export const CMS_BLOCKS = [
  { delay: 100, x: -2.38, y: 1.02, w: 4.76, h: .27, fromX: -6, fromY: 1.4, color: '#1557ff' },
  { delay: 320, x: -2.38, y: -.02, w: 2.86, h: .91, fromX: -5, fromY: .3, color: '#eae9e3' },
  { delay: 540, x: .59, y: -.02, w: 1.79, h: .91, fromX: 5, fromY: 1.4, color: '#1557ff' },
  { delay: 760, x: -2.38, y: -.99, w: 2.28, h: .82, fromX: -5, fromY: -2, color: '#d6d8db' },
  { delay: 980, x: .02, y: -.99, w: 2.36, h: .82, fromX: 5, fromY: -1.8, color: '#eae9e3' },
  { delay: 1200, x: -2.38, y: -1.33, w: 4.76, h: .2, fromX: 5, fromY: -2.1, color: '#1557ff' },
] as const

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
function cmsEase(time: number) {
  const progress = clamp01(time)
  let t = progress
  for (let i = 0; i < 6; i++) {
    const u = 1 - t
    const x = .48 * u * u * t + .9 * u * t * t + t * t * t
    const slope = .48 * u * u + .84 * u * t + 2.1 * t * t
    t = clamp01(t - (x - progress) / slope)
  }
  return 1 - (1 - t) ** 3 // cubic-bezier(.16, 1, .3, 1)
}

export function sampleCmsBlock(index: number, age: number) {
  const block = CMS_BLOCKS[index]
  const t = clamp01((age - block.delay) / 700)
  const arrival = cmsEase(t)
  const overshoot = .04 * Math.sin(Math.PI * t) ** 2
  return {
    visible: age >= block.delay,
    landed: t === 1,
    x: block.x + block.fromX * (1 - arrival),
    y: block.y + block.fromY * (1 - arrival),
    rotation: (index % 2 ? -1 : 1) * Math.PI / 60 * (1 - arrival),
    scale: 1 + overshoot - .04 * (1 - arrival),
    lines: clamp01((age - block.delay - 700) / 400),
    cursor: clamp01((age - 2400) / 300),
    progress: clamp01((age - 2300) / 900),
    published: clamp01((age - 3200) / 300),
  }
}

export const GOAL_DURATION = 3200
export const GOAL_EVENTS = [
  { at: 360, kind: 'pass', gate: 0 },
  { at: 680, kind: 'pass', gate: 1 },
  { at: 1000, kind: 'pass', gate: 2 },
  { at: 1320, kind: 'reject', gate: 3 },
  { at: 2160, kind: 'check-pass', gate: 3 },
  { at: 2540, kind: 'pass', gate: 4 },
  { at: 3200, kind: 'verdict', gate: 5 },
] as const

const path = [
  { at: 0, position: 0, side: 0 },
  { at: 360, position: 0, side: 0 },
  { at: 680, position: 1, side: 0 },
  { at: 1000, position: 2, side: 0 },
  { at: 1320, position: 3, side: 0 },
  { at: 1510, position: 2.5, side: -1 },
  { at: 1700, position: 2, side: 0 },
  { at: 1890, position: 2, side: 0 },
  { at: 2160, position: 3, side: 0 },
  { at: 2540, position: 4, side: 0 },
  { at: 3000, position: 5, side: 0 },
  { at: 3200, position: 5, side: 0 },
] as const

export function sampleGoalLoop(age: number) {
  const time = Math.min(GOAL_DURATION, Math.max(0, age))
  const next = path.findIndex((key) => key.at >= time)
  const a = path[Math.max(0, next - 1)]
  const b = path[next < 0 ? path.length - 1 : next]
  const t = a === b ? 1 : clamp01((time - a.at) / (b.at - a.at))
  const smooth = t * t * (3 - 2 * t)
  return {
    position: a.position + (b.position - a.position) * smooth,
    side: a.side + (b.side - a.side) * smooth,
    rejected: time >= 1320 && time < 2160,
    repair: clamp01((time - 1700) / 190),
    returned: time >= 1320,
    checkPassed: time >= 2160,
    lit: [360, 680, 1000, 2160, 2540].map((at) => time >= at),
    verdict: time >= GOAL_DURATION,
  }
}
