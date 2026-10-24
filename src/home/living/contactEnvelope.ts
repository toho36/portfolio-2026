/** A bounded decorative send. The anchor and receipt never move; navigation owns
 * focus when it interrupts, and reduced motion permanently settles this send. */
export function startContactDeparture(root: HTMLElement, animate = true): () => void {
  if (root.dataset.send === 'settled') return () => {}
  const doc = root.ownerDocument, win = doc.defaultView!
  const media = win.matchMedia('(prefers-reduced-motion: reduce)')
  // Making the moving form inert can already have returned its focus to body.
  const ownedFocus = root.contains(doc.activeElement) || doc.activeElement === doc.body
  let timer: ReturnType<typeof setTimeout> | undefined, finished = false
  const navigation = () => settle(false)
  const linkNavigation = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as Element | null)?.closest?.('a[href]')
    if (anchor && !anchor.hasAttribute('download') && !(anchor as HTMLAnchorElement).target) settle(false)
  }
  const preference = () => { if (media.matches) settle(true) }
  const events = ['homecontactready', 'homefragmentfocus', 'homefragmentnavigate']

  function settle(focus: boolean) {
    if (finished) return
    finished = true
    clearTimeout(timer)
    media.removeEventListener('change', preference)
    events.forEach(event => doc.removeEventListener(event, navigation))
    doc.removeEventListener('click', linkNavigation, true)
    win.removeEventListener('hashchange', navigation); win.removeEventListener('popstate', navigation)
    win.removeEventListener('pagehide', navigation)
    root.dataset.send = 'settled'
    if (focus && ownedFocus && root.isConnected && !root.closest('[inert], [aria-hidden="true"]') &&
      (root.contains(doc.activeElement) || doc.activeElement === doc.body)) {
      root.querySelector<HTMLElement>('[role="status"]')?.focus({ preventScroll: true })
    }
  }

  root.dataset.send = 'wrapping'
  media.addEventListener('change', preference)
  events.forEach(event => doc.addEventListener(event, navigation))
  doc.addEventListener('click', linkNavigation, true)
  win.addEventListener('hashchange', navigation); win.addEventListener('popstate', navigation)
  win.addEventListener('pagehide', navigation)
  if (!animate || media.matches) settle(true)
  else timer = setTimeout(() => settle(true), 2200)
  return () => settle(false)
}
