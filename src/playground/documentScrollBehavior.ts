export const RELAY_SCROLL_OWNER_CLASS = 'relay-scroll-owner'

export interface DocumentScrollBehaviorOwner {
  readonly added: boolean
  destroy(): void
}

/** Owns only the observable class token this route adds. */
export function installDocumentScrollBehavior(
  root: HTMLElement,
): DocumentScrollBehaviorOwner {
  const added = !root.classList.contains(RELAY_SCROLL_OWNER_CLASS)
  let destroyed = false

  if (added) root.classList.add(RELAY_SCROLL_OWNER_CLASS)

  return Object.freeze({
    added,
    destroy() {
      if (destroyed) return
      destroyed = true
      if (added) root.classList.remove(RELAY_SCROLL_OWNER_CLASS)
    },
  })
}
