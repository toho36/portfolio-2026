import { duration, EASING, type DominantMotion } from '../shared/landingMotion'

export const STICKY_QUERY = '(min-width: 1001px) and (min-height: 760px)'
export const isStickyPreview = (width: number, height: number) => width > 1000 && height >= 760

export function handleWorkKey(key: string, index: number, buttons: readonly Pick<HTMLButtonElement, 'focus' | 'click'>[], preventDefault: () => void): boolean {
  if (!buttons.length) return false
  if (key === 'Enter') {
    preventDefault(); buttons[index]?.click(); return true
  }
  const next = key === 'ArrowDown' || key === 'ArrowRight' ? (index + 1) % buttons.length
    : key === 'ArrowUp' || key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length
    : key === 'Home' ? 0 : key === 'End' ? buttons.length - 1 : undefined
  if (next === undefined) return false
  preventDefault(); buttons[next]?.focus(); return true
}

/** Adapter: the shared coordinator owns cancellation; WAAPI supplies the single mask. */
export function createAttachmentSwap(coordinator: DominantMotion, id: string) {
  let active: Animation | undefined
  const cancel = () => {
    const previous = active
    active = undefined
    if (previous) { previous.onfinish = null; previous.cancel() }
    coordinator.stop(id)
  }
  return {
    play(el: HTMLElement, visible: boolean) {
      cancel()
      const ms = duration('INDEX_SWAP')
      if (!visible || !ms || typeof el.animate !== 'function' || !coordinator.start(id, cancel)) return
      active = el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: ms, easing: EASING })
      const animation = active
      animation.onfinish = () => {
        if (active !== animation) return
        active = undefined
        coordinator.stop(id)
      }
    },
    dispose: cancel,
  }
}
