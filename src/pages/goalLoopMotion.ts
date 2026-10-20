import { GOAL_LOOP_HISTORY, GOAL_LOOP_KITCHEN } from '../content/goalLoop'

const PLATE = '<g class="k-food"><path class="mound" d="M-32 2C-32-16-16-26 0-26S32-16 32 2Z"/><path class="strand" d="M-24-5C-14-13-4-3 6-11S20-9 26-5M-17-15C-8-21 4-13 14-19"/><path class="sauce" d="M-15-21C-17-30-4-34 4-32C14-34 19-24 10-19C3-15-10-15-15-21Z"/><path class="leaf" d="M2-31C-3-41 9-46 12-38C12-34 7-31 2-31Z"/><path class="leaf2" d="M4-31C10-40 21-38 19-32C15-29 9-29 4-31Z"/></g><g class="k-dishware"><path class="foot" d="M-30 13L-26 19H26L30 13Z"/><path class="rim" d="M-56 2H56C52 10 40 14 0 14S-52 10-56 2Z"/></g>'

/** Kitchen choreography measured against the scrolling project dialog. */
export function mountGoalLoopMotion(root: HTMLElement): () => void {
  const doc = root.ownerDocument
  const view = doc.defaultView!
  const viewport = root.closest('dialog')
  const media = view.matchMedia('(prefers-reduced-motion: reduce)')
  const pass = root.querySelector<HTMLElement>('[data-pass]')!
  const stations = [...pass.querySelectorAll<HTMLElement>('.k-stations li')]
  const panes = [...pass.querySelectorAll<HTMLElement>('.k-pane')]
  const mover = pass.querySelector<HTMLElement>('.k-mover')!
  const reveals = [...root.querySelectorAll<HTMLElement>('.reveal, .k-race')]
  const plates = [...root.querySelectorAll<SVGElement>('[data-plate]')]
  const down = root.querySelector<HTMLElement>('[data-down]')!
  const wait = root.querySelector<HTMLElement>('.k-wait')!
  const metric = GOAL_LOOP_HISTORY.metrics[0]
  const before = Math.round(metric.before / 6) / 10
  const after = Math.round(metric.after / 6) / 10
  let scrollFrame = 0
  let countFrame = 0
  let disposed = false
  let measured = false
  plates.forEach(plate => { plate.innerHTML = PLATE })
  root.dataset.motion = 'active'

  const frame = () => {
    scrollFrame = 0
    if (disposed) return
    const rect = pass.getBoundingClientRect()
    const height = viewport?.clientHeight || view.innerHeight
    const top = viewport?.getBoundingClientRect().top || 0
    const progress = Math.min(1, Math.max(0, (top - rect.top) / Math.max(1, rect.height - height)))
    const stage = media.matches ? 4 : Math.min(4, Math.floor(progress * 5))
    pass.dataset.stage = String(stage)
    stations.forEach((station, index) => {
      station.classList.toggle('lit', index <= stage)
      station.classList.toggle('now', index === stage)
    })
    panes.forEach((pane, index) => {
      const visible = media.matches || index === stage
      pane.classList.toggle('on', visible)
    })
    const station = stations[stage]
    const x = station.offsetLeft + station.offsetWidth / 2 - mover.offsetWidth / 2
    mover.style.transform = `translateX(${Math.max(0, Math.min(x, mover.parentElement!.clientWidth - mover.offsetWidth))}px)`
  }
  const schedule = () => {
    if (!disposed && !scrollFrame) scrollFrame = view.requestAnimationFrame(frame)
  }
  const finish = () => {
    if (countFrame) view.cancelAnimationFrame(countFrame)
    countFrame = 0
    down.textContent = GOAL_LOOP_KITCHEN.measurement.final
    wait.classList.add('in', 'done')
  }
  const seen = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in')
        seen.unobserve(entry.target)
      }
    })
  }, { root: viewport, threshold: .3 })
  reveals.forEach(element => seen.observe(element))

  const measurement = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || measured || disposed) return
    measured = true
    measurement.disconnect()
    wait.classList.add('in')
    if (media.matches) { finish(); return }
    const start = view.performance.now()
    const tick = (time: number) => {
      countFrame = 0
      if (disposed) return
      const progress = Math.min(1, Math.max(0, (time - start - 300) / 2200))
      const ease = 1 - Math.pow(1 - progress, 3)
      down.textContent = `${(before - (before - after) * ease).toFixed(1)} min`
      if (progress < 1) countFrame = view.requestAnimationFrame(tick)
      else finish()
    }
    countFrame = view.requestAnimationFrame(tick)
  }, { root: viewport, threshold: .4 })
  measurement.observe(wait)
  const preference = () => {
    if (media.matches) {
      reveals.forEach(element => element.classList.add('in'))
      measured = true
      measurement.disconnect()
      finish()
    }
    frame()
  }
  const resized = new ResizeObserver(schedule)
  resized.observe(root)
  doc.addEventListener('scroll', schedule, { capture: true, passive: true })
  view.addEventListener('resize', schedule)
  media.addEventListener('change', preference)
  preference()

  return () => {
    if (disposed) return
    disposed = true
    doc.removeEventListener('scroll', schedule, true)
    view.removeEventListener('resize', schedule)
    media.removeEventListener('change', preference)
    seen.disconnect()
    measurement.disconnect()
    resized.disconnect()
    if (scrollFrame) view.cancelAnimationFrame(scrollFrame)
    if (countFrame) view.cancelAnimationFrame(countFrame)
    delete root.dataset.motion
    pass.dataset.stage = '0'
    stations.forEach(station => station.classList.remove('lit', 'now'))
    panes.forEach((pane, index) => pane.classList.toggle('on', index === 0))
    reveals.forEach(element => element.classList.remove('in'))
    wait.classList.remove('done')
    down.textContent = GOAL_LOOP_KITCHEN.measurement.initial
    mover.style.removeProperty('transform')
    plates.forEach(plate => { plate.innerHTML = '' })
  }
}
