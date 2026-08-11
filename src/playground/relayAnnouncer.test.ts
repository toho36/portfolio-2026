import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createRelayAnnouncer,
  relayAnnouncement,
  RELAY_ACTION_LABELS,
  RELAY_BEAT_TITLES,
  RELAY_LIVE_REGION_ATTRIBUTES,
  type RelayAnnouncerHost,
} from './relayAnnouncer'

function manualScheduler() {
  const tasks: Array<{
    readonly task: () => void
    canceled: boolean
    ran: boolean
  }> = []
  let cancels = 0
  let schedules = 0

  return {
    schedule(task: () => void) {
      const entry = { task, canceled: false, ran: false }
      tasks.push(entry)
      schedules += 1

      return () => {
        if (entry.canceled || entry.ran) return
        entry.canceled = true
        cancels += 1
      }
    },
    runNext() {
      const entry = tasks.find(({ canceled, ran }) => !canceled && !ran)
      if (!entry) return false
      entry.ran = true
      entry.task()
      return true
    },
    runCanceled() {
      const entry = tasks.find(({ canceled, ran }) => canceled && !ran)
      if (!entry) return false
      entry.ran = true
      entry.task()
      return true
    },
    runAll() {
      while (this.runNext()) {
        // Drain tasks scheduled by earlier tasks as well.
      }
    },
    get cancels() {
      return cancels
    },
    get pending() {
      return tasks.filter(({ canceled, ran }) => !canceled && !ran).length
    },
    get schedules() {
      return schedules
    },
  }
}

function fakeRegion(
  attributes: Record<string, string> = RELAY_LIVE_REGION_ATTRIBUTES,
  onWrite?: (value: string) => void,
) {
  const writes: string[] = []
  let value = 'unchanged'

  const host: RelayAnnouncerHost = {
    get textContent() {
      return value
    },
    set textContent(nextValue) {
      value = nextValue
      writes.push(nextValue)
      onWrite?.(nextValue)
    },
    getAttribute(name) {
      return attributes[name] ?? null
    },
  }

  return { host, writes }
}

describe('relay announcer', () => {
  it('preserves three identical actions queued before the first flush', () => {
    const scheduler = manualScheduler()
    const region = fakeRegion()
    const announcer = createRelayAnnouncer({
      host: region.host,
      schedule: scheduler.schedule,
    })

    announcer.announceAction('next', 'relay-fold')
    announcer.announceAction('next', 'relay-fold')
    announcer.announceAction('next', 'relay-fold')
    scheduler.runAll()

    expect(region.writes).toEqual([
      '',
      'Next beat: FOLD',
      '',
      'Next beat: FOLD',
      '',
      'Next beat: FOLD',
    ])
    expect(region.writes.filter(Boolean)).toEqual([
      'Next beat: FOLD',
      'Next beat: FOLD',
      'Next beat: FOLD',
    ])
  })

  it('drains mixed actions in FIFO order with an empty reset per item', () => {
    const scheduler = manualScheduler()
    const region = fakeRegion()
    const announcer = createRelayAnnouncer({
      host: region.host,
      schedule: scheduler.schedule,
    })

    announcer.announceAction('next', 'relay-fold')
    announcer.announceAction('previous', 'relay-input')
    announcer.announceAction('replay', 'relay-input')
    scheduler.runAll()

    expect(region.writes).toEqual([
      '',
      'Next beat: FOLD',
      '',
      'Previous beat: FLAT',
      '',
      'Replay field: FLAT',
    ])
  })

  it('appends actions enqueued during a drain without a second owner', () => {
    const scheduler = manualScheduler()
    let announcer: ReturnType<typeof createRelayAnnouncer>
    let appended = false
    const region = fakeRegion(undefined, (value) => {
      if (value === '' && !appended) {
        appended = true
        announcer.announceAction('previous', 'relay-input')
      }
    })
    announcer = createRelayAnnouncer({
      host: region.host,
      schedule: scheduler.schedule,
    })

    announcer.announceAction('next', 'relay-fold')
    while (scheduler.runNext()) {
      expect(scheduler.pending).toBeLessThanOrEqual(1)
    }

    expect(region.writes).toEqual([
      '',
      'Next beat: FOLD',
      '',
      'Previous beat: FLAT',
    ])
  })

  it('keeps scrub silent before and between queued actions', () => {
    const scheduler = manualScheduler()
    const region = fakeRegion()
    const announcer = createRelayAnnouncer({
      host: region.host,
      schedule: scheduler.schedule,
    })

    for (let index = 0; index < 200; index += 1) {
      announcer.observeScrub()
    }
    expect(scheduler.schedules).toBe(0)
    expect(region.writes).toEqual([])

    announcer.announceAction('next', 'relay-feedback')
    announcer.observeScrub()
    announcer.announceAction('replay', 'relay-input')
    const schedulesBeforeDrain = scheduler.schedules
    announcer.observeScrub()

    expect(scheduler.schedules).toBe(schedulesBeforeDrain)
    scheduler.runAll()
    expect(region.writes).toEqual([
      '',
      'Next beat: TUNNEL',
      '',
      'Replay field: FLAT',
    ])
  })

  it('cancels all work before the first drain and rejects stale execution', () => {
    const scheduler = manualScheduler()
    const region = fakeRegion()
    const announcer = createRelayAnnouncer({
      host: region.host,
      schedule: scheduler.schedule,
    })

    announcer.announceAction('next', 'relay-fold')
    announcer.announceAction('next', 'relay-feedback')
    announcer.destroy()

    expect(scheduler.cancels).toBe(1)
    expect(scheduler.runCanceled()).toBe(true)
    scheduler.runAll()
    expect(region.writes).toEqual([])
    expect(scheduler.pending).toBe(0)
  })

  it('cancels the queue between completed drains', () => {
    const scheduler = manualScheduler()
    const region = fakeRegion()
    const announcer = createRelayAnnouncer({
      host: region.host,
      schedule: scheduler.schedule,
    })

    announcer.announceAction('next', 'relay-fold')
    announcer.announceAction('next', 'relay-feedback')
    announcer.announceAction('next', 'relay-closed')
    expect(scheduler.runNext()).toBe(true)
    expect(scheduler.runNext()).toBe(true)
    expect(region.writes).toEqual(['', 'Next beat: FOLD'])

    announcer.destroy()
    expect(scheduler.cancels).toBe(1)
    expect(scheduler.runCanceled()).toBe(true)
    scheduler.runAll()
    expect(region.writes).toEqual(['', 'Next beat: FOLD'])
  })

  it('is terminal and idempotent after destroy', () => {
    const scheduler = manualScheduler()
    const region = fakeRegion()
    const announcer = createRelayAnnouncer({
      host: region.host,
      schedule: scheduler.schedule,
    })

    expect(() => {
      announcer.destroy()
      announcer.destroy()
    }).not.toThrow()
    announcer.announceAction('next', 'relay-fold')

    expect(scheduler.cancels).toBe(0)
    expect(scheduler.schedules).toBe(0)
    expect(region.writes).toEqual([])
  })

  it('requires a polite atomic nonfocusable host without an alert role', () => {
    expect(() =>
      createRelayAnnouncer({
        host: fakeRegion({
          'aria-live': 'assertive',
          'aria-atomic': 'true',
        }).host,
        schedule: manualScheduler().schedule,
      }),
    ).toThrow(new Error('Relay live region must be polite.'))
    expect(() =>
      createRelayAnnouncer({
        host: fakeRegion({ 'aria-live': 'polite' }).host,
        schedule: manualScheduler().schedule,
      }),
    ).toThrow(new Error('Relay live region must be atomic.'))
    expect(() =>
      createRelayAnnouncer({
        host: fakeRegion({
          'aria-live': 'polite',
          'aria-atomic': 'false',
        }).host,
        schedule: manualScheduler().schedule,
      }),
    ).toThrow(new Error('Relay live region must be atomic.'))
    expect(() =>
      createRelayAnnouncer({
        host: fakeRegion({
          'aria-live': 'polite',
          'aria-atomic': 'true',
          role: 'status alert',
        }).host,
        schedule: manualScheduler().schedule,
      }),
    ).toThrow(new Error('Relay live region must not use the alert role.'))
    expect(() =>
      createRelayAnnouncer({
        host: fakeRegion({
          'aria-live': 'polite',
          'aria-atomic': 'true',
          tabindex: '0',
        }).host,
        schedule: manualScheduler().schedule,
      }),
    ).toThrow(new Error('Relay live region must not be focusable.'))

    expect(() =>
      createRelayAnnouncer({
        host: fakeRegion().host,
        schedule: manualScheduler().schedule,
      }),
    ).not.toThrow()
    expect(RELAY_LIVE_REGION_ATTRIBUTES).toEqual({
      'aria-live': 'polite',
      'aria-atomic': 'true',
    })
  })

  it('exposes exactly the twelve unchanged canonical messages', () => {
    const messages = Object.keys(RELAY_ACTION_LABELS).flatMap((action) =>
      Object.keys(RELAY_BEAT_TITLES).map((beatId) =>
        relayAnnouncement(
          action as keyof typeof RELAY_ACTION_LABELS,
          beatId as keyof typeof RELAY_BEAT_TITLES,
        ),
      ),
    )

    expect(new Set(messages).size).toBe(12)
    expect(messages).toHaveLength(12)
    for (const message of messages) {
      expect(message).toMatch(/^[A-Za-z ]+: [A-Z]+$/)
      expect(message).not.toMatch(/[\d()\u200B-\u200D\uFEFF]/u)
    }
  })

  it('keeps the production module pure and scheduler-injected', () => {
    const source = readFileSync(
      new URL('./relayAnnouncer.ts', import.meta.url),
      'utf8',
    )

    expect(source).not.toMatch(/^\s*import\b/m)
    expect(source).not.toMatch(
      /\b(?:document|window|setTimeout|requestAnimationFrame|assertive)\b/,
    )
    expect(source).not.toMatch(/[\u200B-\u200D\uFEFF]/u)
  })

  it('leaves canonical page copy, focus controls, and beat order for T5', () => {
    const source = readFileSync(
      new URL('../pages/Playground.tsx', import.meta.url),
      'utf8',
    )
    let priorIndex = -1

    for (const label of Object.values(RELAY_ACTION_LABELS)) {
      expect(source).toContain(`>${label}</BeatLink>`)
    }
    for (const [beatId, title] of Object.entries(RELAY_BEAT_TITLES)) {
      const index = source.indexOf(`id="${beatId}"`)
      expect(index).toBeGreaterThan(priorIndex)
      expect(source).toContain(`id="${beatId}-title">${title}<`)
      priorIndex = index
    }
    expect(source).not.toMatch(/(?:from\s+|import\s*\()['"].*relayAnnouncer/)
  })
})
