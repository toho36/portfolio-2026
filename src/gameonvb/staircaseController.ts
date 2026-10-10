import { createBall, launchBall, stepBall, constrainPosition, surfaceAt, RADIUS, TREADS, clamp, type StairBall, type LandingIndex } from './stairBall'
import { STORY_CHAPTERS } from './stairStory'
import { loadStaircaseView } from './loadStaircaseView'
import { createStaircaseView, type StaircaseView } from './staircaseView'

type Drag = { id: number; offsetX: number; offsetY: number; time: number; vx: number; vy: number; moved: boolean; saved: StairBall }

export function mountStaircase(root: HTMLElement, onLanding: (index: LandingIndex) => void) {
  const document = root.ownerDocument
  const window = document.defaultView!
  const stage = root.querySelector<HTMLElement>('[data-stair-stage]')!
  const handle = root.querySelector<HTMLButtonElement>('[data-stair-ball]')!
  const release = root.querySelector<HTMLButtonElement>('[data-stair-release]')!
  const reset = root.querySelector<HTMLButtonElement>('[data-stair-reset]')!
  const status = root.querySelector<HTMLElement>('[data-stair-status]')!
  const capability = root.querySelector<HTMLElement>('[data-stair-capability]')!
  const fallbackBall = root.querySelector<SVGElement>('[data-stair-fallback-ball]')!
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const ballLabel = handle.getAttribute('aria-label')!
  const removers: (() => void)[] = []
  let ball = createBall(), drag: Drag | null = null, view: StaircaseView | null = null
  let frame = 0, previous = 0, energy = 0, generation = 0, frames = 0
  let destroyed = false, unavailable = false, loading = false, suppressClick = false
  let placement: LandingIndex = 0, highlight: LandingIndex = 0
  let width = stage.clientWidth, height = stage.clientHeight
  const bounds = stage.getBoundingClientRect()
  let inView = bounds.bottom > 0 && bounds.top < window.innerHeight

  function listen<E extends Event>(target: EventTarget, name: string, handler: (event: E) => void, capture = false) {
    const listener = handler as EventListener
    target.addEventListener(name, listener, capture)
    removers.push(() => target.removeEventListener(name, listener, capture))
  }
  function announce(text: string) { status.textContent = text }
  function mode(value: string) { root.dataset.mode = value }
  function select(index: LandingIndex) {
    root.dataset.chapter = String(index)
    if (highlight === index) return
    highlight = index
    onLanding(index)
  }
  function stop() {
    window.cancelAnimationFrame(frame)
    frame = 0; previous = 0; energy = 0
    root.dataset.pendingFrame = 'false'
    const held = drag
    drag = null
    if (held && stage.hasPointerCapture(held.id)) stage.releasePointerCapture(held.id)
    ball = { ...ball, vx: 0, vy: 0, resting: true }
    mode('idle')
  }
  function paint() {
    if (destroyed) return
    let projection: { x: number; y: number; diameter: number }
    if (view) projection = view.paint(ball, energy)
    else {
      const poses = [[260, 235], [425, 370], [620, 520]]
      const [x, y] = poses[placement]
      fallbackBall.setAttribute('transform', `translate(${x} ${y})`)
      const scale = Math.min(stage.clientWidth / 900, stage.clientHeight / 650)
      projection = { x: (stage.clientWidth - 900 * scale) / 2 + x * scale, y: (stage.clientHeight - 650 * scale) / 2 + y * scale, diameter: 180 * scale }
    }
    const size = Math.max(44, projection.diameter)
    handle.style.width = `${size}px`; handle.style.height = `${size}px`
    handle.style.left = `${projection.x - size / 2}px`; handle.style.top = `${projection.y - size / 2}px`
    root.dataset.landing = String(view ? ball.landing : placement)
    root.dataset.contacts = String(ball.contacts)
    root.dataset.floorContacts = String(ball.floorContacts)
    root.dataset.x = String(ball.x); root.dataset.y = String(ball.y)
    root.dataset.pendingFrame = String(Boolean(frame))
    root.dataset.frames = String(++frames)
  }
  function schedule() {
    if (!frame && !destroyed && !document.hidden && inView) {
      frame = window.requestAnimationFrame(tick)
      root.dataset.pendingFrame = 'true'
    }
  }
  function tick(now: number) {
    frame = 0
    if (destroyed || document.hidden || !inView || reduced.matches) return
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 60
    previous = now
    const before = ball.floorContacts
    if (!drag) ball = stepBall(ball, dt)
    if (ball.floorContacts !== before) {
      energy = 1
      select(ball.landing)
      announce(`Landing ${ball.landing + 1} highlights ${STORY_CHAPTERS[ball.landing].title}. Catch it again, or let gravity finish.`)
    }
    energy = Math.max(0, energy - dt * 2.8)
    if (!ball.resting || energy > 0) schedule()
    else { previous = 0; mode('idle'); announce('At rest. A little push goes a long way.') }
    paint()
  }
  function placeNext() {
    placement = ((placement + 1) % TREADS.length) as LandingIndex
    const tread = TREADS[placement]
    ball = { ...ball, x: (tread.left + tread.right) / 2, y: tread.y + RADIUS, landing: placement }
    select(placement)
    announce(`Placed on step ${placement + 1}. Static mode, no simulated impact.`)
    paint()
  }
  function launch(vx = 3.8, vy = 1.2) {
    stop()
    if (!view || reduced.matches) { placeNext(); return }
    if (document.hidden || !inView) { announce('Paused while the scene is out of view.'); return }
    ball = launchBall(ball, vx, vy)
    mode('flight'); announce('In motion. You can catch it at any time.'); schedule()
  }
  function restart() {
    stop(); ball = createBall(); placement = 0; select(0); paint()
    announce(view ? 'Back at the top. Catch, pull, let go.' : 'Back at the top. Place the ball on the next step.')
  }
  function cancelCatch(restore = true) {
    if (!drag) return
    const saved = restore ? drag.saved : { ...ball }
    suppressClick = true
    stop(); ball = { ...saved, vx: 0, vy: 0, resting: true }; paint()
    announce(restore ? 'Catch cancelled. The ball is paused where you caught it.' : 'Gesture interrupted. The ball stays where you placed it.')
  }
  function pointerDown(event: PointerEvent) {
    if (!view || reduced.matches || event.button !== 0 || !event.isPrimary) return

    const point = view.point(event.clientX, event.clientY), saved = { ...ball }
    stop(); suppressClick = false
    drag = { id: event.pointerId, offsetX: point.x - ball.x, offsetY: point.y - ball.y, time: performance.now(), vx: 0, vy: 0, moved: false, saved }
    stage.setPointerCapture(event.pointerId)
    mode('held'); announce('Got it. Pull and release. Escape cancels.')
  }
  function pointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id || !view) return
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) { cancelCatch(false); return }
    const point = view.point(event.clientX, event.clientY), now = performance.now()
    const dt = Math.max((now - drag.time) / 1000, .008)
    const { x, y } = constrainPosition(ball, point.x - drag.offsetX, point.y - drag.offsetY)
    drag.vx = clamp((x - ball.x) / dt, -6, 6); drag.vy = clamp((y - ball.y) / dt, -8, 8)
    drag.moved ||= Math.hypot(x - drag.saved.x, y - drag.saved.y) > .05
    ball = { ...ball, x, y, angle: ball.angle - (x - ball.x) / RADIUS, landing: surfaceAt(x).index }
    drag.time = now; paint()
  }
  function pointerUp(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return
    const held = drag
    suppressClick = true; stop()
    if (held.moved) {
      const fresh = performance.now() - held.time < 120
      launch(fresh ? held.vx : 0, fresh ? held.vy : 0)
    } else launch()
  }
  function fallback(reason: string) {
    generation++; loading = false; stop()
    const oldView = view
    view = null
    if (oldView) placement = highlight
    oldView?.destroy()
    root.dataset.runtime = 'static'
    capability.hidden = false; capability.textContent = reason
    handle.setAttribute('aria-label', 'Volleyball. Enter or tap to place on the next step.')
    release.firstChild!.textContent = 'Place on next step '
    handle.disabled = release.disabled = reset.disabled = false
    announce('Static mode. The steps remain available.'); select(placement); paint()
  }
  async function initialize() {
    if (destroyed || unavailable || loading || view || !inView) return
    if (reduced.matches) { fallback('Reduced motion is on. Instant placement, no animation or WebGL load.'); return }
    loading = true
    const current = ++generation
    const result = await loadStaircaseView({
      isCanceled: () => destroyed || current !== generation || reduced.matches || !inView || !root.isConnected,
      createView: three => createStaircaseView(three, stage),
    })
    if (destroyed || current !== generation) {
      if (result.status === 'created') result.view.destroy()
      return
    }
    loading = false
    if (result.status === 'canceled') return
    if (result.status === 'failed') {
      unavailable = true
      fallback('3D is unavailable. Static placement and the complete story remain available.')
      return
    }
    view = result.view
    root.dataset.runtime = 'webgl'
    capability.hidden = true
    handle.setAttribute('aria-label', ballLabel)
    release.firstChild!.textContent = 'Release the ball '
    handle.disabled = release.disabled = reset.disabled = false
    mode('idle'); select(ball.landing); paint()
    announce('Your move. Catch the ball, or give it a little push.')
  }
  listen(release, 'click', () => launch())
  listen(reset, 'click', restart)
  listen(handle, 'pointerdown', pointerDown)
  listen(document, 'pointermove', pointerMove)
  listen(document, 'pointerup', pointerUp)
  listen<PointerEvent>(document, 'pointercancel', event => { if (drag?.id === event.pointerId) cancelCatch(false) })
  listen<MouseEvent>(handle, 'click', event => {
    if (event.detail > 0 && suppressClick) { suppressClick = false; return }
    launch()
  })
  listen<KeyboardEvent>(document, 'keydown', event => { if (event.key === 'Escape') cancelCatch() })
  listen(window, 'blur', () => { if (drag) cancelCatch(false) })
  listen(document, 'visibilitychange', () => { if (document.hidden) { stop(); paint(); announce('Paused. Release the ball when you return.') } })
  listen(stage, 'webglcontextlost', event => {
    if (!view || event.target !== view.canvas) return
    event.preventDefault(); unavailable = true
    fallback('3D context lost. Static placement and the complete story remain available.')
  }, true)
  listen(reduced, 'change', () => {
    if (reduced.matches) fallback('Reduced motion is on. Instant placement, no animation.')
    else void initialize()
  })
  const observer = new ResizeObserver(() => {
    const nextWidth = stage.clientWidth, nextHeight = stage.clientHeight
    if (nextWidth !== width || nextHeight !== height) {
      if (drag) cancelCatch(false)
      width = nextWidth; height = nextHeight; view?.resize()
    }
    paint()
  })
  observer.observe(stage)
  const visibility = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting
    if (!inView) { stop(); paint() }
    else void initialize()
  })
  visibility.observe(stage)
  root.dataset.runtime = 'loading'
  root.dataset.chapter = '0'
  handle.disabled = release.disabled = reset.disabled = false
  paint()
  if (reduced.matches) fallback('Reduced motion is on. Instant placement, no animation or WebGL load.')
  else void initialize()

  return { destroy() {
    if (destroyed) return
    stop(); destroyed = true; generation++
    observer.disconnect(); visibility.disconnect(); removers.forEach(remove => remove())
    const oldView = view; view = null; oldView?.destroy()
    root.dataset.mode = 'disposed'; root.dataset.pendingFrame = 'false'
  } }
}
