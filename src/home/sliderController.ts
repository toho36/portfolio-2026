import { createWheelIntent, indexFromOffset, isClick, overlapState, snapTarget } from './sliderMath'

export interface SliderController {
  goTo(index: number, opts?: { instant?: boolean; focus?: boolean }): void
  readonly index: number
  onChange(cb: (index: number, velocity: number) => void): () => void
  destroy(): void
}

function transitionEase(progress: number): number {
  let low = 0
  let high = 1
  for (let i = 0; i < 12; i++) {
    const t = (low + high) / 2
    const x = 3 * (1 - t) ** 2 * t * .76 + 3 * (1 - t) * t ** 2 * .24 + t ** 3
    if (x < progress) low = t
    else high = t
  }
  const t = (low + high) / 2
  return 3 * (1 - t) * t ** 2 + t ** 3
}

export function createSliderController(track: HTMLElement, opts: { reducedMotion: boolean; announce(text: string): void }): SliderController {
  const posters = Array.from(track.querySelectorAll<HTMLElement>('.poster'))
  const subscribers = new Set<(index: number, velocity: number) => void>()
  const wheelIntent = createWheelIntent()
  const fine = matchMedia('(pointer: fine)').matches
  let index = indexFromOffset(track.scrollLeft, track.clientWidth, posters.length)
  let lastOffset = track.scrollLeft
  let lastTime = performance.now()
  let settleTimer = 0
  let animation = 0
  let pointerStart = 0
  let scrollStart = 0
  let dragDistance = 0
  let pointerSamples: { offset: number; time: number }[] = []
  let dragging = false
  let suppressClick = false

  if (fine) track.classList?.add('is-controlled')

  function emit(velocity: number) {
    const next = indexFromOffset(track.scrollLeft, track.clientWidth, posters.length)
    if (next !== index) {
      index = next
      opts.announce(`${posters[index]?.dataset.index} of 06: ${posters[index]?.dataset.label}`)
    }
    const position = track.scrollLeft / Math.max(track.clientWidth, 1)
    posters.forEach((poster, n) => {
      const state = overlapState(Math.max(0, Math.min(1, position - n)))
      poster.style.setProperty('--out-scale', String(state.outScale))
      poster.style.setProperty('--out-dim', String(state.outDim))
      poster.style.setProperty('--in-x', String(Math.max(0, Math.min(1, n - position))))
    })
    subscribers.forEach((cb) => cb(index, velocity))
  }

  function updatePosition(now: number) {
    if (track.scrollLeft === lastOffset) return
    const velocity = (track.scrollLeft - lastOffset) / Math.max(now - lastTime, 1)
    lastOffset = track.scrollLeft
    lastTime = now
    emit(velocity)
    clearTimeout(settleTimer)
    settleTimer = window.setTimeout(() => emit(0), 100)
  }

  function onScroll() { updatePosition(performance.now()) }

  function goTo(next: number, options: { instant?: boolean; focus?: boolean; duration?: number } = {}) {
    next = Math.max(0, Math.min(posters.length - 1, next))
    cancelAnimationFrame(animation)
    const from = track.scrollLeft
    const target = next * track.clientWidth
    if (options.instant || opts.reducedMotion || Math.abs(target - from) < 1) {
      track.scrollLeft = target
      updatePosition(performance.now())
      emit(0)
    } else {
      const start = performance.now()
      const duration = options.duration ?? 900
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = transitionEase(t)
        track.scrollLeft = t === 1 ? target : from + (target - from) * eased
        updatePosition(now)
        if (t < 1) animation = requestAnimationFrame(step)
        else emit(0)
      }
      animation = requestAnimationFrame(step)
    }
    if (options.focus) posters[next]?.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true })
  }

  function onWheel(event: WheelEvent) {
    if (!fine) return
    const textarea = (event.target as Element | null)?.closest?.('textarea') as HTMLTextAreaElement | null
    if (textarea && (event.deltaY < 0 ? textarea.scrollTop > 0 : textarea.scrollTop + textarea.clientHeight < textarea.scrollHeight)) return
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX) && event.shiftKey) return
    event.preventDefault()
    const direction = wheelIntent(event.deltaY, event.deltaX, performance.now())
    if (direction) goTo(index + direction)
  }

  function onPointerDown(event: PointerEvent) {
    if (!fine || event.button !== 0 || event.pointerType === 'touch' || event.detail > 1) return
    const target = event.target as Element | null
    const switchButton = target?.closest?.('.screen-switch-hit')
    if (target?.closest?.('a, button, input, textarea, select, label') && !switchButton) return
    cancelAnimationFrame(animation)
    if (!switchButton) event.preventDefault()
    dragging = true
    suppressClick = false
    track.classList?.add('is-dragging')
    pointerStart = event.clientX
    scrollStart = track.scrollLeft
    dragDistance = 0
    pointerSamples = [{ offset: scrollStart, time: performance.now() }]
    if (!switchButton) track.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging) return
    dragDistance = Math.max(dragDistance, Math.abs(event.clientX - pointerStart))
    if (dragDistance > 6 && !track.hasPointerCapture(event.pointerId)) track.setPointerCapture(event.pointerId)
    track.scrollLeft = scrollStart + pointerStart - event.clientX
    const now = performance.now()
    pointerSamples.push({ offset: track.scrollLeft, time: now })
    pointerSamples = pointerSamples.filter((sample) => sample.time >= now - 80)
    updatePosition(now)
  }
  function onPointerUp(event: PointerEvent) {
    if (!dragging) return
    if (Number.isFinite(event.clientX)) onPointerMove(event)
    dragging = false
    track.classList?.remove('is-dragging')
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId)
    suppressClick = !isClick(dragDistance)
    const now = performance.now()
    const recent = pointerSamples.filter((sample) => sample.time >= now - 80)
    const first = recent[0]
    const last = recent[recent.length - 1]
    const velocity = first && last && last.time > first.time ? (last.offset - first.offset) / (last.time - first.time) : 0
    const distance = track.scrollLeft - scrollStart
    if (suppressClick) goTo(snapTarget(track.scrollLeft, velocity, track.clientWidth, posters.length, distance), { duration: Math.abs(distance) > track.clientWidth / 2 ? 600 : 900 })
    else goTo(index)
  }
  function onDragStart(event: DragEvent) {
    if ((event.target as Element | null)?.closest?.('img, svg')) event.preventDefault()
  }
  function onClick(event: MouseEvent) {
    if (!suppressClick) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick = false
  }
  function onKeyDown(event: KeyboardEvent) {
    if ((event.target as Element | null)?.closest?.('input, textarea, select, button, label, [contenteditable]')) return
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    goTo(index + direction, { focus: true })
  }
  function onFocusIn(event: FocusEvent) {
    const poster = (event.target as Element).closest<HTMLElement>('.poster')
    if (!poster) return
    goTo(posters.indexOf(poster))
  }
  function onResize() { goTo(index, { instant: true }) }

  track.addEventListener('scroll', onScroll, { passive: true })
  track.addEventListener('wheel', onWheel, { passive: false })
  track.addEventListener('pointerdown', onPointerDown)
  track.addEventListener('pointermove', onPointerMove)
  track.addEventListener('pointerup', onPointerUp)
  track.addEventListener('pointercancel', onPointerUp)
  track.addEventListener('dragstart', onDragStart)
  track.addEventListener('click', onClick, true)
  track.addEventListener('keydown', onKeyDown)
  track.addEventListener('focusin', onFocusIn)
  window.addEventListener('resize', onResize)
  emit(0)

  return {
    goTo,
    get index() { return index },
    onChange(cb) { subscribers.add(cb); return () => subscribers.delete(cb) },
    destroy() {
      cancelAnimationFrame(animation)
      clearTimeout(settleTimer)
      track.removeEventListener('scroll', onScroll)
      track.removeEventListener('wheel', onWheel)
      track.removeEventListener('pointerdown', onPointerDown)
      track.removeEventListener('pointermove', onPointerMove)
      track.removeEventListener('pointerup', onPointerUp)
      track.removeEventListener('pointercancel', onPointerUp)
      track.removeEventListener('dragstart', onDragStart)
      track.removeEventListener('click', onClick, true)
      track.removeEventListener('keydown', onKeyDown)
      track.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('resize', onResize)
      track.classList?.remove('is-controlled', 'is-dragging')
      subscribers.clear()
    },
  }
}
