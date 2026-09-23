import { createInitialRun, stepRun, type RunModel, type RunScenario } from './runModel'

export function mountShapeAndHole(root: HTMLElement): () => void {
const doc = root.ownerDocument
const win = doc.defaultView!
const el = <T extends Element>(id: string) => root.querySelector<T>(`#${id}`)!
const scene = el<HTMLElement>('scene')
const drawing = el<SVGSVGElement>('drawing')
const send = el<HTMLButtonElement>('send')
const repair = el<HTMLButtonElement>('repair')
const retry = el<HTMLButtonElement>('retry')
const resetButton = el<HTMLButtonElement>('reset')
const motion = win.matchMedia('(prefers-reduced-motion: reduce)')
const scenarios: RunScenario[] = ['full-story', 'clean']
type Source = 'plan' | 'check' | 'review' | null
type Phase = 'ready' | 'drawing' | 'inspect-plan' | 'critiquing' | 'build-pending' | 'building' | 'built' | 'checking' | 'check-impact' | 'compare-pending' | 'reviewing' | 'review-contact' | 'returning' | 'returned' | 'fixing' | 'dragging' | 'pass-aligned' | 'passing' | 'pass-through' | 'passed' | 'blocked' | 'paused'
type Job = { duration: number; elapsed: number; last: number | null; update: (p: number) => void; done: () => void }
type Point = { x: number; y: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const ease = (value: number) => value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2
let scenarioIndex = 0
let run: RunModel = createInitialRun(scenarios[0])
let phase: Phase = 'ready'
let resumePhase: Phase = 'ready'
let source: Source = null
let outlineAmount = 0
let fillAmount = 0
let topFix = 0
let crackFix = 0
let rightFix = 0
let travel = 0
let weight = 0
let chipTravel = 0
let passDepth = 0
let squash = 0
let wallShake = 0
let job: Job | null = null
let frame = 0
let dragging: { id: number; start: Point; target: Point; moved: boolean } | null = null
let suppressClick = false
let layout = { table: { x: 310, y: 335 }, wall: { x: 750, y: 290 }, narrow: false }

function star(cx = 0, cy = 0, top = 0, right = 0, broken = 0) {
  const points: Point[] = []
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5
    const radius = index % 2 ? 36 : 82
    const point = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
    if (index === 0) point.x += top
    if (index === 2) { point.x -= right; point.y += right * .24 }
    if (index === 6) { point.x -= 6 * broken; point.y += 4 * broken }
    points.push(point)
  }
  return `M${points.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L')} Z`
}
function at(point: Point) {
  const matrix = drawing.getScreenCTM()
  return matrix ? new DOMPoint(point.x, point.y).matrixTransform(matrix) : new DOMPoint(point.x, point.y)
}
function put(node: HTMLElement, point: Point) {
  const value = at(point)
  const bounds = scene.getBoundingClientRect()
  node.style.left = `${value.x - bounds.left}px`
  node.style.top = `${value.y - bounds.top}px`
}
function place() {
  const narrow = win.innerWidth <= 760
  layout = narrow
    ? { table: { x: 250, y: 350 }, wall: { x: 250, y: 130 }, narrow }
    : { table: { x: 310, y: 335 }, wall: { x: 750, y: 290 }, narrow }
  drawing.setAttribute('viewBox', narrow ? '0 0 500 520' : '0 0 1000 500')
  el('wall-board').setAttribute('x', String(narrow ? 95 : 620))
  el('wall-board').setAttribute('y', String(narrow ? 15 : 150))
  el('wall-board').setAttribute('width', String(narrow ? 310 : 260))
  el('wall-board').setAttribute('height', String(narrow ? 230 : 285))
  for (const attribute of ['x', 'y', 'width', 'height']) el('wall-front-board').setAttribute(attribute, el('wall-board').getAttribute(attribute)!)
  el('wall-tag').setAttribute('x', String(narrow ? 250 : 750))
  el('wall-tag').setAttribute('y', String(narrow ? 264 : 459))
  el('table').setAttribute('x', String(narrow ? 72 : 100))
  el('table').setAttribute('y', String(narrow ? 444 : 420))
  el('table').setAttribute('width', String(narrow ? 356 : 425))
  el('repair-caption').setAttribute('x', String(narrow ? 250 : 310))
  el('repair-caption').setAttribute('y', String(narrow ? 473 : 456))
  const hole = star(layout.wall.x, layout.wall.y)
  el('hole-mask').setAttribute('d', hole)
  el('hole-rim').setAttribute('d', hole)
  el('hole-front-rim').setAttribute('d', hole)
  el('wall-glow').setAttribute('d', hole)
  draw()
}
function draw() {
  const { table, wall, narrow } = layout
  const position = {
    x: table.x + (wall.x - table.x) * travel,
    y: table.y + (wall.y - table.y) * travel,
  }
  const plan = star(0, 0, run.planFault ? 34 * (1 - topFix) : 0)
  const solid = star(0, 0, 0, run.fault === 'review' ? 42 * (1 - rightFix) : 0, run.fault === 'check' ? 1 - crackFix : 0)
  const outline = el<SVGPathElement>('outline')
  outline.setAttribute('d', plan)
  outline.setAttribute('stroke-dasharray', `${outlineAmount * 610} 610`)
  const inset = el<SVGPathElement>('outline-inset')
  inset.setAttribute('d', plan)
  inset.setAttribute('stroke-dasharray', `${outlineAmount * 3} 6`)
  for (const id of ['solid', 'solid-shadow']) el(id).setAttribute('d', solid)
  el('fill-height').setAttribute('y', String(85 - 170 * fillAmount))
  el('fill-height').setAttribute('height', String(170 * fillAmount))
  el('solid').setAttribute('clip-path', fillAmount >= 1 ? 'none' : 'url(#build-clip)')
  const planVisible = run.stage < 2 || phase === 'building' || phase === 'build-pending' || (run.verdict === 'blocked' && source === 'plan')
  outline.style.opacity = planVisible ? '1' : '0'
  inset.style.opacity = planVisible ? '.8' : '0'
  el('solid-shadow').setAttribute('opacity', fillAmount > 0 && run.stage >= 2 ? String(.42 * fillAmount) : '0')
  el('solid').setAttribute('visibility', fillAmount > 0 && run.stage >= 2 ? 'visible' : 'hidden')
  el('face').setAttribute('opacity', fillAmount >= 1 && run.stage >= 2 ? '1' : '0')
  const crackVisible = run.fault === 'check' && crackFix < 1 && fillAmount >= 1 && (source === 'check' || phase === 'checking' || phase === 'check-impact' || phase === 'blocked')
  for (const id of ['crack-gap', 'crack']) {
    el(id).setAttribute('d', 'M-36 10 -25 18 -32 25 -17 39')
    el(id).setAttribute('opacity', crackVisible ? String(1 - crackFix) : '0')
  }
  const size = 1 - .38 * passDepth
  el('artifact').setAttribute('transform', `translate(${position.x.toFixed(1)} ${position.y.toFixed(1)}) scale(${(size * (1 - .12 * squash)).toFixed(3)} ${(size * (1 + .06 * squash)).toFixed(3)})`)
  for (const id of ['wall', 'wall-front', 'hole-rim', 'hole-front-rim', 'wall-glow', 'hole-mask']) el(id).setAttribute('transform', `translate(${wallShake} 0)`)
  const inWall = fillAmount >= 1 && travel > .65
  el('wall-front').setAttribute('visibility', inWall ? 'visible' : 'hidden')
  el('hole-front-rim').setAttribute('visibility', inWall ? 'visible' : 'hidden')
  el('weight').setAttribute('transform', `translate(${table.x} ${table.y - 120 + 75 * weight})`)
  el('weight').setAttribute('opacity', phase === 'checking' || phase === 'check-impact' || (phase === 'paused' && (resumePhase === 'checking' || resumePhase === 'check-impact')) ? '1' : '0')
  const faultPoint = source === 'plan' ? { x: position.x + 34 * (1 - topFix), y: position.y - 82 }
    : source === 'review' ? { x: position.x + 36 + 42 * rightFix, y: position.y - 15 }
      : { x: position.x - 28, y: position.y + 23 }
  const atWall = travel > .8
  const marker = source === 'check' ? { x: faultPoint.x - 35, y: faultPoint.y + 4 } : faultPoint
  const label = source === 'review' && atWall
    ? { x: wall.x + (narrow ? 135 : 105), y: wall.y + (narrow ? 100 : 120) }
    : source === 'review'
      ? { x: position.x + 240, y: position.y - 45 }
      : source === 'plan' && atWall
        ? { x: wall.x - 80, y: wall.y + (narrow ? 100 : 120) }
        : { x: position.x - 140, y: position.y - 55 }
  const leaderEnd = source === 'review' && atWall
    ? { x: label.x - 65, y: label.y - 16 }
    : source === 'review'
      ? { x: label.x - 153, y: label.y - 5 }
      : { x: label.x + 50, y: label.y - 5 }
  el('finding').setAttribute('transform', `translate(${marker.x} ${marker.y})`)
  el('finding-point').setAttribute('d', source === 'check' ? `M0 0 L${faultPoint.x - marker.x} ${faultPoint.y - marker.y}` : '')
  el('finding-leader').setAttribute('d', `M0 0 L${leaderEnd.x - marker.x} ${leaderEnd.y - marker.y}`)
  const findingText = el<SVGTextElement>('finding-text')
  findingText.setAttribute('x', String(label.x - marker.x))
  findingText.setAttribute('y', String(label.y - marker.y))
  findingText.setAttribute('text-anchor', source === 'review' ? 'end' : 'middle')
  const handle = source === 'check'
    ? { x: position.x - 115, y: position.y + 20 }
    : { x: position.x + 118, y: position.y + 30 }
  const repairTarget = source === 'plan' ? { x: position.x, y: position.y - 82 }
    : source === 'review' ? { x: position.x + 78, y: position.y - 24 }
      : faultPoint
  const repairProgress = source === 'plan' ? topFix : source === 'review' ? rightFix : crackFix
  put(repair, phase === 'dragging' ? { x: handle.x + (repairTarget.x - handle.x) * repairProgress, y: handle.y + (repairTarget.y - handle.y) * repairProgress } : handle)
  const chipBase = narrow ? [{ x: 100, y: 405 }, { x: 397, y: 405 }] : [{ x: 128, y: 390 }, { x: 492, y: 390 }]
  let piecesOnTable = 0
  for (const [index, id] of ['chip-1', 'chip-2'].entries()) {
    const spent = run.repairs > index && (run.verdict === 'blocked' || (index === 0 ? run.fault !== 'check' : run.fault === 'none'))
    const active = run.repairs === index + 1 && source === (index === 0 ? 'check' : 'review') && run.verdict === 'active'
    const base = chipBase[index]
    const away = active && chipTravel > .05
    const onTable = !spent && !away
    if (onTable) piecesOnTable += 1
    const chipPosition = active ? { x: base.x + (handle.x - base.x) * chipTravel, y: base.y + (handle.y - base.y) * chipTravel } : base
    el(id).setAttribute('transform', `translate(${chipPosition.x} ${chipPosition.y})`)
    el(id).setAttribute('opacity', spent || (active && phase !== 'returning' && chipTravel >= 1) ? '0' : '1')
    el(`slot-${index + 1}`).setAttribute('transform', `translate(${base.x} ${base.y})`)
    el(`slot-${index + 1}`).setAttribute('opacity', spent || away ? '1' : '0')
  }
  el('repair-caption').setAttribute('visibility', piecesOnTable ? 'visible' : 'hidden')
  el('mouth').setAttribute('d', source && phase !== 'passed' ? 'M-10 23 Q0 10 11 23' : 'M-10 17 Q0 26 11 17')
  root.dataset.travel = travel.toFixed(4)
  root.dataset.weight = weight.toFixed(4)
  root.dataset.passDepth = passDepth.toFixed(4)
  root.dataset.wallShake = String(wallShake)
}
function render() {
  root.dataset.stage = String(run.stage)
  root.dataset.state = phase
  root.dataset.scenario = scenarios[scenarioIndex]
  root.dataset.verdict = run.verdict
  root.dataset.repairs = String(run.repairs)
  root.dataset.revisions = String(run.planRevisions)
  root.dataset.finding = source ?? ''
  const returned = phase === 'returned' || phase === 'dragging'
  if (!returned && doc.activeElement === repair) send.focus({ preventScroll: true })
  if (!returned && doc.activeElement === retry) send.focus({ preventScroll: true })
  repair.hidden = !returned
  repair.setAttribute('aria-label', source === 'plan' ? 'Fix the plan' : source === 'check' ? 'Fill the crack' : 'Match the brief')
  repair.dataset.kind = source ?? 'plan'
  repair.querySelector('span')!.textContent = source === 'check' ? '01' : source === 'review' ? '02' : '↗'
  retry.hidden = !returned
  retry.textContent = source === 'plan' ? 'Try the same plan' : 'Try without fixing'
  resetButton.hidden = phase === 'ready'
  const labels: Record<Phase, string> = {
    ready: 'Make it fit', drawing: 'Pause', 'inspect-plan': 'Check the plan', critiquing: 'Pause', 'build-pending': 'Build it', building: 'Pause', built: run.repairs ? 'Test the repair' : 'Test it', checking: 'Pause', 'check-impact': motion.matches ? 'Read the result' : 'Pause', 'compare-pending': 'Compare with the brief', reviewing: 'Pause', 'review-contact': motion.matches ? 'Read the finding' : 'Pause', returning: 'Pause', returned: source === 'plan' ? 'Fix the plan' : source === 'check' ? 'Fill the crack' : 'Match the brief', fixing: 'Pause', dragging: 'Keep moving', 'pass-aligned': motion.matches ? 'Pass through' : 'Pause', passing: 'Pause', 'pass-through': motion.matches ? 'See the verdict' : 'Pause', passed: 'Another run', blocked: 'Reset this run', paused: 'Resume',
  }
  el('send-label').textContent = labels[phase]
  const stageNames = ['PLAN', 'CRITIQUE', 'BUILD', 'CHECK', 'REVIEW', run.verdict === 'passed' ? 'VERDICT · PASS' : 'VERDICT · BLOCK']
  el('state-label').textContent = phase === 'paused' ? 'PAUSED' : phase === 'ready' ? 'READY' : phase === 'compare-pending' ? 'CHECK' : phase === 'build-pending' ? 'CRITIQUE' : (phase === 'returned' || phase === 'returning' || phase === 'dragging') && source ? source === 'plan' ? 'CRITIQUE' : source.toUpperCase() : phase === 'review-contact' ? 'REVIEW' : phase === 'pass-aligned' ? 'REVIEW' : stageNames[run.stage]
  const copy: Record<Phase, string> = {
    ready: 'The wall is the brief. Make a shape that fits.',
    drawing: 'Plan: draw what we will build.',
    'inspect-plan': 'Plan: the light outline is ready for Critique.',
    critiquing: 'Critique: compare the light plan with the opening.',
    'build-pending': 'Critique: the corrected plan fits the opening.',
    building: 'Build: make the planned shape real.',
    built: run.repairs ? 'Build: only the marked place changed. Test it again.' : 'Build: the solid shape is ready. Test its strength.',
    checking: 'Check: a weight tests the object on the table.',
    'check-impact': 'Check: the weight lands on the object at the table.',
    'compare-pending': 'Check: it holds. Now compare it with the brief.',
    reviewing: 'Review: bring the solid object to the opening.',
    'review-contact': 'Review: the short right tip does not match the opening.',
    returning: source === 'plan' ? 'Critique: the plan misses here.' : source === 'check' ? 'Check: it breaks here.' : 'Review: it holds, but it is not the shape we asked for.',
    returned: source === 'plan' ? 'Critique: the plan misses here.' : source === 'check' ? 'Check: it breaks here.' : 'Review: it holds, but it is not the shape we asked for.',
    fixing: source === 'plan' ? 'Plan: straighten only the marked tip.' : source === 'check' ? 'Build: fill only the cracked joint.' : 'Build: extend only the short tip.',
    dragging: 'Move the repair to the marked place.',
    'pass-aligned': 'Review: the object matches the opening exactly.',
    passing: 'Verdict: the object fits through the opening.',
    'pass-through': 'Verdict: the object clicks through the opening.',
    passed: 'PASS · It fits the brief.',
    blocked: source === 'plan' ? 'BLOCK · The plan never matched the brief.' : 'BLOCK · Out of repairs. The flaw stays visible.',
    paused: 'Paused. Resume to continue this run.',
  }
  el('feedback').textContent = copy[phase]
  el('budget').textContent = `${2 - run.repairs} repair pieces remain.`
  el('finding-text').textContent = source === 'plan' ? 'OFF HERE' : source === 'check' ? 'CRACKED HERE' : 'NOT WHAT WAS ASKED'
  draw()
}
function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; job = null }
function tick(time: number) {
  frame = 0
  const current = job
  if (!current || phase === 'paused') return
  if (current.last !== null) current.elapsed += Math.min(40, time - current.last)
  current.last = time
  const amount = clamp(current.elapsed / current.duration)
  current.update(ease(amount))
  draw()
  if (amount >= 1) { job = null; current.done() }
  else if (job === current) frame = requestAnimationFrame(tick)
}
function animate(duration: number, update: (p: number) => void, done: () => void) {
  stop()
  if (motion.matches) { update(1); draw(); done(); return }
  job = { duration, elapsed: 0, last: null, update, done }
  frame = requestAnimationFrame(tick)
}
function returnToTable() {
  const from = travel
  phase = 'returning'; render()
  animate(650, p => { travel = from * (1 - p); chipTravel = p }, () => { travel = 0; chipTravel = 1; phase = 'returned'; render() })
}
function critique() {
  run = stepRun(run, { type: 'next' })
  phase = 'critiquing'; source = null; render()
  animate(1250, p => { travel = p }, () => {
    run = stepRun(run, { type: 'next' })
    if (run.verdict === 'blocked') { source = 'plan'; phase = 'blocked'; render(); return }
    if (run.returnFrom === 'critique') { source = 'plan'; returnToTable(); return }
    animate(650, p => { travel = 1 - p }, () => {
      travel = 0
      if (motion.matches) { phase = 'build-pending'; render() }
      else build()
    })
  })
}
function startPlan() {
  phase = 'drawing'; render()
  animate(1150, p => { outlineAmount = p }, () => {
    outlineAmount = 1
    if (motion.matches) { phase = 'inspect-plan'; render() }
    else critique()
  })
}
function build() {
  phase = 'building'; source = null; render()
  animate(1150, p => { fillAmount = p }, () => { fillAmount = 1; phase = 'built'; render() })
}
function settlePass() {
  passDepth = 1; squash = 0; wallShake = 0; phase = 'passed'; render()
}
function passThrough() {
  phase = 'passing'; render()
  if (motion.matches) { passDepth = .65; phase = 'pass-through'; render(); return }
  animate(320, p => { squash = p }, () => {
    passDepth = .55; wallShake = 2; phase = 'pass-through'; render()
    animate(650, p => {
      passDepth = .55 + .45 * p
      squash = 1 - p
      wallShake = p < .4 ? 2 : p < .65 ? -2 : 0
    }, settlePass)
  })
}
function finishReview() {
  if (run.verdict === 'blocked') { phase = 'blocked'; render() }
  else returnToTable()
}
function review() {
  phase = 'reviewing'; source = null; render()
  animate(1350, p => { travel = p }, () => {
    travel = 1
    run = stepRun(run, { type: 'next' })
    if (run.verdict === 'passed') {
      phase = 'pass-aligned'; render()
      if (!motion.matches) animate(950, () => {}, passThrough)
      return
    }
    source = 'review'; phase = 'review-contact'; render()
    if (!motion.matches) animate(950, () => {}, finishReview)
  })
}
function afterImpact() {
  run = stepRun(run, { type: 'next' })
  if (run.verdict === 'blocked') { source = 'check'; phase = 'blocked'; render(); return }
  if (run.returnFrom === 'checks') {
    source = 'check'; chipTravel = 0; phase = 'returning'; render()
    animate(450, p => { chipTravel = p }, () => { chipTravel = 1; phase = 'returned'; render() })
    return
  }
  weight = 0
  phase = 'compare-pending'; render()
  if (!motion.matches) animate(650, () => {}, review)
}
function check() {
  if (run.stage === 2) run = stepRun(run, { type: 'next' })
  if (run.stage !== 3 || run.verdict !== 'active') return
  source = null; weight = 0; phase = 'checking'; render()
  animate(850, p => { weight = p }, () => {
    weight = 1; phase = 'check-impact'; render()
    if (!motion.matches) animate(700, () => {}, afterImpact)
  })
}
function fix() {
  if (phase !== 'returned' || !source) return
  const what = source
  phase = 'fixing'; render()
  const before = what === 'plan' ? topFix : what === 'check' ? crackFix : rightFix
  animate(480, p => {
    const value = before + (1 - before) * p
    if (what === 'plan') topFix = value
    else if (what === 'check') crackFix = value
    else rightFix = value
  }, () => {
    if (what === 'plan') {
      topFix = 1; run = stepRun(run, { type: 'revise' }); source = null
      if (motion.matches) { phase = 'inspect-plan'; render() }
      else critique()
      return
    }
    if (what === 'check') crackFix = 1
    else rightFix = 1
    run = stepRun(run, { type: 'repair' })
    source = null; chipTravel = 0; phase = 'built'; render()
  })
}
function cancelDrag() {
  if (!dragging) return
  if (repair.hasPointerCapture(dragging.id)) repair.releasePointerCapture(dragging.id)
  dragging = null; suppressClick = true
  topFix = run.planFault ? 0 : topFix
  crackFix = run.fault === 'check' ? 0 : crackFix
  rightFix = run.fault === 'review' ? 0 : rightFix
  phase = 'returned'; render()
}
function reset(next = false) {
  cancelDrag(); stop()
  if (next) scenarioIndex = (scenarioIndex + 1) % scenarios.length
  run = createInitialRun(scenarios[scenarioIndex])
  phase = 'ready'; source = null; outlineAmount = 0; fillAmount = 0; topFix = 0; crackFix = 0; rightFix = 0; travel = 0; weight = 0; chipTravel = 0; passDepth = 0; squash = 0; wallShake = 0
  render()
}
function pause() {
  if (!job || phase === 'paused') return
  resumePhase = phase; phase = 'paused'
  if (frame) cancelAnimationFrame(frame)
  frame = 0; job.last = null; render()
}
function resume() {
  if (!job || doc.hidden) return
  phase = resumePhase; job.last = null; render(); frame = requestAnimationFrame(tick)
}
send.addEventListener('click', () => {
  if (phase === 'dragging') return
  if (phase === 'paused') { resume(); return }
  if (phase === 'check-impact' && job) { stop(); afterImpact(); return }
  if (phase === 'review-contact' && job) { stop(); finishReview(); return }
  if (phase === 'pass-aligned' && job) { stop(); passThrough(); return }
  if (phase === 'compare-pending' && job) { stop(); review(); return }
  if (job) { pause(); return }
  if (phase === 'passed' || phase === 'blocked') { reset(phase === 'passed'); return }
  if (phase === 'returned') { fix(); return }
  if (phase === 'ready') startPlan()
  else if (phase === 'inspect-plan') critique()
  else if (phase === 'build-pending') build()
  else if (phase === 'built') check()
  else if (phase === 'check-impact') afterImpact()
  else if (phase === 'compare-pending') review()
  else if (phase === 'review-contact') finishReview()
  else if (phase === 'pass-aligned') passThrough()
  else if (phase === 'pass-through') settlePass()
})
retry.addEventListener('click', () => {
  if (phase !== 'returned') return
  send.focus({ preventScroll: true })
  if (source === 'plan') { source = null; critique() }
  else { source = null; check() }
})
resetButton.addEventListener('click', () => { send.focus({ preventScroll: true }); reset() })
repair.addEventListener('pointerdown', event => {
  if (phase !== 'returned' || event.button !== 0) return
  suppressClick = false
  const { table } = layout
  const target = source === 'plan' ? { x: table.x, y: table.y - 82 }
    : source === 'review' ? { x: table.x + 78, y: table.y - 24 }
      : { x: table.x - 28, y: table.y + 23 }
  const screen = at(target)
  dragging = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, target: { x: screen.x, y: screen.y }, moved: false }
  repair.setPointerCapture(event.pointerId)
  phase = 'dragging'; render()
})
repair.addEventListener('pointermove', event => {
  if (!dragging || event.pointerId !== dragging.id || !source) return
  const start = dragging.start
  dragging.moved ||= Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5
  if (!dragging.moved) return
  const dx = dragging.target.x - start.x
  const dy = dragging.target.y - start.y
  const value = clamp(((event.clientX - start.x) * dx + (event.clientY - start.y) * dy) / (dx * dx + dy * dy))
  if (source === 'plan') topFix = value
  else if (source === 'check') crackFix = value
  else rightFix = value
  draw()
})
repair.addEventListener('pointerup', event => {
  if (!dragging || event.pointerId !== dragging.id) return
  const moved = dragging.moved
  dragging = null
  if (repair.hasPointerCapture(event.pointerId)) repair.releasePointerCapture(event.pointerId)
  phase = 'returned'
  if (moved) {
    if ((source === 'plan' ? topFix : source === 'check' ? crackFix : rightFix) >= .82) { suppressClick = false; fix(); return }
    suppressClick = true
    topFix = run.planFault ? 0 : topFix
    crackFix = run.fault === 'check' ? 0 : crackFix
    rightFix = run.fault === 'review' ? 0 : rightFix
  }
  render()
})
repair.addEventListener('pointercancel', cancelDrag)
repair.addEventListener('click', event => {
  if (event.detail > 0 && suppressClick) { suppressClick = false; return }
  if (phase === 'returned') fix()
})
const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { cancelDrag(); pause() } }
const onVisibility = () => { if (doc.hidden) { cancelDrag(); pause() } }
const onResize = () => { cancelDrag(); place() }
const onMotion = () => { if (job) pause(); place() }
const onPagehide = () => { cancelDrag(); stop() }
doc.addEventListener('keydown', onKeydown)
doc.addEventListener('visibilitychange', onVisibility)
win.addEventListener('resize', onResize)
motion.addEventListener('change', onMotion)
win.addEventListener('pagehide', onPagehide)
place(); render()
return () => {
  stop()
  if (dragging && repair.hasPointerCapture(dragging.id)) repair.releasePointerCapture(dragging.id)
  doc.removeEventListener('keydown', onKeydown)
  doc.removeEventListener('visibilitychange', onVisibility)
  win.removeEventListener('resize', onResize)
  motion.removeEventListener('change', onMotion)
  win.removeEventListener('pagehide', onPagehide)
}
}
