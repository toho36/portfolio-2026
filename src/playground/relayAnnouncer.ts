export type RelayAnnouncementAction = 'previous' | 'next' | 'replay'

export const RELAY_ACTION_LABELS = {
  previous: 'Previous beat',
  next: 'Next beat',
  replay: 'Replay field',
} as const

export const RELAY_BEAT_TITLES = {
  'relay-input': 'FLAT',
  'relay-fold': 'FOLD',
  'relay-feedback': 'TUNNEL',
  'relay-closed': 'FEEDBACK',
} as const

export type RelayBeatId = keyof typeof RELAY_BEAT_TITLES

export const RELAY_LIVE_REGION_ATTRIBUTES = {
  'aria-live': 'polite',
  'aria-atomic': 'true',
} as const

export interface RelayAnnouncerHost {
  textContent: string
  getAttribute(name: string): string | null
}

export interface RelayAnnouncerOptions {
  readonly host: RelayAnnouncerHost
  readonly schedule: (task: () => void) => () => void
}

export interface RelayAnnouncer {
  announceAction(
    action: RelayAnnouncementAction,
    beatId: RelayBeatId,
  ): void
  observeScrub(): void
  destroy(): void
}

export function relayAnnouncement(
  action: RelayAnnouncementAction,
  beatId: RelayBeatId,
): string {
  return `${RELAY_ACTION_LABELS[action]}: ${RELAY_BEAT_TITLES[beatId]}`
}

function validateHost(host: RelayAnnouncerHost) {
  if (host.getAttribute('aria-live') !== 'polite') {
    throw new Error('Relay live region must be polite.')
  }

  if (host.getAttribute('aria-atomic') !== 'true') {
    throw new Error('Relay live region must be atomic.')
  }

  const roles = host.getAttribute('role')?.toLowerCase().split(/\s+/) ?? []

  if (roles.includes('alert')) {
    throw new Error('Relay live region must not use the alert role.')
  }

  if (host.getAttribute('tabindex') !== null) {
    throw new Error('Relay live region must not be focusable.')
  }
}

/**
 * Preserves every discrete action in one FIFO queue. Each item receives a
 * separate empty tick before its canonical copy tick so repeated copy remains
 * observable. Scrub is silent, and destroy permanently invalidates all work.
 */
export function createRelayAnnouncer(
  options: RelayAnnouncerOptions,
): RelayAnnouncer {
  validateHost(options.host)

  const queue: string[] = []
  let current: string | null = null
  let scheduledToken: object | null = null
  let pendingCancel: (() => void) | null = null
  let destroyed = false

  function scheduleOwned(task: () => void) {
    if (destroyed || scheduledToken !== null) return

    const token = {}
    scheduledToken = token
    const cancel = options.schedule(() => {
      if (scheduledToken !== token) return

      scheduledToken = null
      pendingCancel = null

      if (!destroyed) task()
    })

    // An injected scheduler may run immediately. Do not overwrite work that
    // the completed callback scheduled synchronously.
    if (scheduledToken === token) pendingCancel = cancel
  }

  function drainNext() {
    if (
      destroyed ||
      scheduledToken !== null ||
      current !== null ||
      queue.length === 0
    ) {
      return
    }

    current = queue.shift() ?? null

    scheduleOwned(() => {
      options.host.textContent = ''

      scheduleOwned(() => {
        if (current === null) return

        options.host.textContent = current
        current = null
        drainNext()
      })
    })
  }

  return Object.freeze({
    announceAction(
      action: RelayAnnouncementAction,
      beatId: RelayBeatId,
    ) {
      if (destroyed) return

      queue.push(relayAnnouncement(action, beatId))
      drainNext()
    },
    observeScrub() {},
    destroy() {
      if (destroyed) return

      destroyed = true
      queue.length = 0
      current = null
      scheduledToken = null

      const cancel = pendingCancel
      pendingCancel = null
      cancel?.()
    },
  })
}
