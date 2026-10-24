import { flushSync } from 'react-dom'
import type { MouseEvent } from 'react'

export function isHomeFragment(hash: string) {
  return hash === '#contact' || hash === '#introduction'
}

// The deck and supporting sections are deliberately inert until the outgoing
// presentation has landed. Its ready event retries focus after that commit.
export function focusHomeFragment(doc: Document, hash: string) {
  if (!isHomeFragment(hash)) return
  const target = doc.getElementById(hash.slice(1))
  if (!target || target.closest('[inert]') || doc.querySelector('.ball-entry[open], .goal-entry[open]')) return
  doc.dispatchEvent?.(new Event('homefragmentfocus'))
  const header = doc.querySelector('.site-header')
  target.style.scrollMarginTop = `${Math.ceil(header?.getBoundingClientRect().height ?? 0) + 16}px`
  target.tabIndex = -1
  target.focus({ preventScroll: true })
  target.scrollIntoView({ behavior: 'instant', block: 'start' })
}

// A late transition callback must yield to a newer click, anchor or history event.
let navigationGeneration = 0
export function beginNavigation() {
  cancelNavigationCue()
  const ticket = ++navigationGeneration
  return () => ticket === navigationGeneration
}

// One nonspatial cue for menu routes, history and anchors. Card flights bypass it.
let activeSwitch: { cancel: () => void } | undefined
export function crossFadeProjects(update: () => void, doc: Document) {
  const reduced = doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches
  const root = doc.documentElement
  activeSwitch?.cancel()
  let transition: ViewTransition | undefined
  let animation: Animation | undefined
  const scope = { cancel: () => { transition?.skipTransition?.(); animation?.cancel(); done() } }
  const done = () => {
    if (activeSwitch !== scope) return
    activeSwitch = undefined
    if (root) delete root.dataset.projectSwitch
  }
  activeSwitch = scope
  if (root) root.dataset.projectSwitch = 'true'
  if (!doc.startViewTransition || doc.visibilityState !== 'visible') {
    flushSync(update)
    animation = doc.getElementById?.('main-content')?.animate?.([{ opacity: .65 }, { opacity: 1 }], { duration: reduced ? 90 : 200, easing: 'ease-out' })
    if (animation) animation.finished.then(done, done)
    else done()
    return
  }
  transition = doc.startViewTransition(() => flushSync(update))
  transition.ready?.catch(() => {})
  transition.finished.then(done, done)
}


export function cancelNavigationCue() {
  activeSwitch?.cancel()
}

export function navigateSection(event: MouseEvent<HTMLAnchorElement>) {
  const anchor = event.currentTarget
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
  const target = anchor.hash ? document.getElementById(anchor.hash.slice(1)) : null
  if (!target) return
  event.preventDefault()
  const current = beginNavigation()
  crossFadeProjects(() => {
    if (!current()) return
    target.tabIndex = -1
    target.focus({ preventScroll: true })
    target.scrollIntoView({ behavior: 'instant', block: 'start' })
    if (location.hash !== anchor.hash) history.replaceState(history.state, '', anchor.hash)
  }, document)
}
