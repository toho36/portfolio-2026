import { duration, type DominantMotion } from '../shared/landingMotion'
import type { P1Step } from '../shared/types'

export const READ_MS = 2500
export type PlaybackState = { step: P1Step; status: 'idle' | 'playing' | 'paused' | 'done'; transitioning: boolean }

/** Each resumed step gets a fresh read interval; no timer survives pause/cancel. */
export function createPlayback(coordinator: DominantMotion, changed: (state: PlaybackState) => void) {
  let state: PlaybackState = { step: 0, status: 'idle', transitioning: false }
  let timer: ReturnType<typeof setTimeout> | undefined
  let visible = true
  let disposed = false
  const update = (patch: Partial<PlaybackState>) => { state = { ...state, ...patch }; changed(state) }
  const clear = () => { clearTimeout(timer); timer = undefined }
  const pause = () => {
    clear()
    coordinator.stop('p1')
    update({ status: state.status === 'playing' ? 'paused' : state.status, transitioning: false })
  }
  const read = () => {
    timer = setTimeout(() => {
      timer = undefined
      if (state.step === 3) {
        coordinator.stop('p1')
        update({ status: 'done' })
      } else switchStep((state.step + 1) as P1Step)
    }, READ_MS)
  }
  const switchStep = (step: P1Step) => {
    const ms = duration('P1_STEP')
    update({ step, transitioning: ms > 0 })
    if (!ms) {
      if (state.status === 'playing') read()
      else coordinator.stop('p1')
      return
    }
    timer = setTimeout(() => {
      timer = undefined
      update({ transitioning: false })
      if (state.status === 'playing') read()
      else coordinator.stop('p1')
    }, ms)
  }
  return {
    state: () => state,
    play() {
      if (disposed || !visible || state.status === 'playing') return
      if (!coordinator.start('p1', pause, pause)) return
      clear()
      update({ step: state.status === 'done' ? 0 : state.step, status: 'playing', transitioning: false })
      read()
    },
    pause,
    select(step: P1Step) {
      if (disposed) return
      clear(); coordinator.stop('p1')
      update({ status: 'idle', transitioning: false })
      if (visible && coordinator.start('p1', pause, pause)) switchStep(step)
      else update({ step })
    },
    setVisible(value: boolean) { visible = value; if (!value) pause() },
    dispose() { disposed = true; clear(); coordinator.stop('p1') },
  }
}
