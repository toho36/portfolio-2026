/** Scroll choreography for the approved GameOnVB story, including dialog scroll. */
export function mountGameOnVbMotion(root: HTMLElement): () => void {
  const doc = root.ownerDocument
  const view = doc.defaultView!
  const viewport = root.closest('dialog')
  const media = view.matchMedia('(prefers-reduced-motion: reduce)')
  const band = root.querySelector<HTMLElement>('[data-band]')!
  const track = root.querySelector<HTMLElement>('[data-track]')!
  const won = root.querySelector<HTMLElement>('[data-won]')!
  const scoreLabel = root.querySelector<HTMLElement>('[data-score-label]')
  const scoreText = { beaten: scoreLabel?.textContent ?? '', set: root.dataset.scoreSet ?? 'Set' }
  const pips = [...root.querySelectorAll<HTMLElement>('.pips i')]
  const steps = [...root.querySelectorAll<HTMLElement>('[data-step]')]
  const screens = [...root.querySelectorAll<HTMLElement>('[data-screen]')]
  const bandBall = root.querySelector<HTMLElement>('[data-band-ball]')!
  const stepBall = root.querySelector<HTMLElement>('[data-step-ball]')!
  const reveals = [...root.querySelectorAll<HTMLElement>('.reveal')]
  let pending = 0
  let ballStep = -1
  let ballAt: { x: number; y: number } | null = null
  let hopAnimation: Animation | undefined
  let disposed = false

  root.dataset.motion = 'active'
  const seen = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in')
        seen.unobserve(entry.target)
      }
    })
  }, { root: viewport, threshold: .3 })
  reveals.forEach(element => seen.observe(element))

  const hop = (index: number) => {
    const number = steps[index].querySelector<HTMLElement>('.n')!
    const to = { x: number.offsetLeft + number.offsetWidth - 64, y: number.offsetTop + number.offsetHeight - 60 }
    hopAnimation?.cancel()
    stepBall.style.transform = `translate(${to.x}px, ${to.y}px)`
    if (ballAt && !media.matches) {
      const from = ballAt
      const peak = Math.min(from.y, to.y) - 90
      const turn = (to.y - from.y) / 2
      hopAnimation = stepBall.animate([
        { transform: `translate(${from.x}px, ${from.y}px) rotate(0deg)` },
        { transform: `translate(${(from.x + to.x) / 2}px, ${peak}px) rotate(${turn}deg)`, offset: .45, easing: 'ease-in' },
        { transform: `translate(${to.x}px, ${to.y}px) rotate(${turn * 2}deg) scale(1.12,.86)`, offset: .82, easing: 'ease-out' },
        { transform: `translate(${to.x}px, ${to.y - 14}px) rotate(${turn * 2}deg)`, offset: .92 },
        { transform: `translate(${to.x}px, ${to.y}px) rotate(${turn * 2}deg)` },
      ], { duration: 650, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'forwards' })
    }
    ballAt = to
  }

  const frame = () => {
    pending = 0
    if (disposed) return
    const reduced = media.matches
    const height = viewport?.clientHeight || view.innerHeight
    const width = root.clientWidth || view.innerWidth
    // Phones swipe the cards natively; wider screens drive the band from vertical scroll.
    const swipe = view.innerWidth <= 820
    const rect = band.getBoundingClientRect()
    const progress = swipe
      ? track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth)
      : Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - height)))
    const b = reduced && !swipe ? 1 : progress
    if (swipe) track.style.removeProperty('transform')
    else track.style.transform = `translateX(${-b * (reduced ? 0 : Math.max(0, track.scrollWidth - width + 48))}px)`
    const count = reduced ? 4 : swipe ? Math.min(4, Math.round(progress * 4) + 1) : Math.min(4, Math.floor(b * 5.2))
    // Avoid announcing the same score on every scroll event.
    if (won.textContent !== String(count)) won.textContent = String(count)
    // While swiping, the numbered cards show their position; the last card shows the result.
    const label = swipe && !reduced && progress < .95 ? scoreText.set : scoreText.beaten
    if (scoreLabel && scoreLabel.textContent !== label) scoreLabel.textContent = label
    pips.forEach((pip, index) => pip.classList.toggle('on', index < count))

    const mid = height / 2
    let active = 0
    let distance = Infinity
    steps.forEach((step, index) => {
      const bounds = step.getBoundingClientRect()
      const next = Math.abs(bounds.top + bounds.height / 2 - mid)
      if (next < distance) { distance = next; active = index }
    })
    screens.forEach((screen, index) => {
      screen.classList.toggle('on', index === active)
      screen.classList.toggle('past', index < active)
    })
    steps.forEach((step, index) => step.classList.toggle('on', index === active))

    const pin = bandBall.parentElement!.getBoundingClientRect()
    const top = track.getBoundingClientRect().top - pin.top - 56
    const x = 24 + (reduced && !swipe ? 0 : progress) * (pin.width - 56 - 72)
    bandBall.style.transform = `translate(${x}px, ${top}px) rotate(${x / 28}rad)`
    if (active !== ballStep) { ballStep = active; hop(active) }
  }
  const schedule = () => {
    if (!disposed && !pending) pending = view.requestAnimationFrame(frame)
  }
  const resize = () => {
    hopAnimation?.cancel()
    ballAt = null
    ballStep = -1
    schedule()
  }
  const resized = new ResizeObserver(resize)
  resized.observe(root)
  resized.observe(track)
  doc.addEventListener('scroll', schedule, { capture: true, passive: true })
  view.addEventListener('resize', resize)
  media.addEventListener('change', resize)
  frame()

  return () => {
    if (disposed) return
    disposed = true
    doc.removeEventListener('scroll', schedule, true)
    view.removeEventListener('resize', resize)
    media.removeEventListener('change', resize)
    seen.disconnect()
    resized.disconnect()
    if (pending) view.cancelAnimationFrame(pending)
    hopAnimation?.cancel()
    delete root.dataset.motion
    if (scoreLabel) scoreLabel.textContent = scoreText.beaten
    root.getAnimations({ subtree: true }).forEach(animation => animation.cancel())
    reveals.forEach(element => element.classList.remove('in'))
    for (const element of [track, bandBall, stepBall]) element.style.removeProperty('transform')
  }
}
