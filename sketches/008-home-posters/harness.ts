import { loadPosterRuntime } from '../../src/home/loadPosterRuntime'
import { createPosterRuntime, type PosterRuntime } from '../../src/home/posterRuntime'

const strip = document.querySelector<HTMLElement>('#strip')!
const status = document.querySelector<HTMLOutputElement>('#status')!
const slots = [...document.querySelectorAll<HTMLElement>('.poster-visual')]
const accents = [...document.querySelectorAll<HTMLElement>('.poster')].map((el) => el.style.getPropertyValue('--accent'))
let runtime: PosterRuntime | undefined
let lastScroll = 0, lastTime = performance.now(), active = -1
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

function sync() {
  if (!runtime) return
  const now = performance.now()
  const index = Math.round(strip.scrollLeft / strip.clientWidth)
  const dt = Math.max(1, now-lastTime)
  const velocity = (strip.scrollLeft-lastScroll)/dt
  if (index !== active) { active=index; runtime.setActive(index) }
  runtime.setBend(Math.max(-.35,Math.min(.35,velocity*.15)))
  lastScroll=strip.scrollLeft
  lastTime=now
  status.textContent = `${String(active).padStart(2,'0')} / 05 · ${Math.round(velocity*100)/100} px/ms`
}

strip.addEventListener('scroll',sync,{passive:true})
window.addEventListener('pagehide', () => runtime?.destroy(), {once:true})

void loadPosterRuntime({
  isCanceled: () => false,
  onProgress: (p) => { status.textContent = `Loading ${p}%` },
  createRuntime: (three) => createPosterRuntime(three, {
    host: document.body, slots, accents, reducedMotion,
    onFirstFrame: () => { status.textContent = 'Ready' },
  }),
}).then((result) => {
  if (result.status === 'created') { runtime=result.runtime; sync() }
  else status.textContent = result.status === 'failed' ? `WebGL unavailable: ${String(result.error)}` : 'Canceled'
})

Object.assign(window, { posterHarness: {
  goTo(index: number) { strip.scrollTo({left:index*strip.clientWidth,behavior:'instant'}); sync() },
  bend(amount: number) { runtime?.setBend(amount) },
  state() { return {active,scrollLeft:strip.scrollLeft,ready:!!runtime,reducedMotion} },
} })
