import { describe, expect, it } from 'vitest'
import {
  beginAuthoredSeek,
  createScrollOwnershipLedger,
  observeScrollPosition,
  recordAuthoredWrite,
  type ScrollOwnershipLedger,
} from './scrollOwnership'

function liveLedgerWithWrites(
  positions: readonly number[],
): ScrollOwnershipLedger {
  let ledger = beginAuthoredSeek(createScrollOwnershipLedger())

  for (const position of positions) {
    ledger = recordAuthoredWrite(ledger, position)
  }

  return ledger
}

describe('authored scroll ownership ledger', () => {
  it('owns authored writes observed in order', () => {
    let ledger = liveLedgerWithWrites([100, 160, 220])

    expect(ledger.pending).toEqual([
      { sequence: 1, position: 100 },
      { sequence: 2, position: 160 },
      { sequence: 3, position: 220 },
    ])

    for (const [position, cursorSequence] of [
      [100, 1],
      [160, 2],
      [220, 3],
    ] as const) {
      const observation = observeScrollPosition(ledger, position)

      expect(observation.ownership).toBe('authored')
      expect(observation.killSeek).toBe(false)
      expect(observation.interrupted).toBe(false)
      expect(observation.ledger.cursorSequence).toBe(cursorSequence)
      ledger = observation.ledger
    }
  })

  it('owns a delayed 160 observation before a later 220 observation', () => {
    let ledger = liveLedgerWithWrites([100, 160, 220])
    const delayed = observeScrollPosition(ledger, 160)

    expect(delayed.ownership).toBe('authored')
    expect(delayed.ledger.cursorSequence).toBe(2)

    ledger = delayed.ledger
    const latest = observeScrollPosition(ledger, 220)

    expect(latest.ownership).toBe('authored')
    expect(latest.killSeek).toBe(false)
    expect(latest.ledger.cursorSequence).toBe(3)
  })

  it('owns a coalesced latest observation and retires skipped writes', () => {
    const observation = observeScrollPosition(
      liveLedgerWithWrites([100, 160, 220]),
      220,
    )

    expect(observation.ownership).toBe('authored')
    expect(observation.killSeek).toBe(false)
    expect(observation.ledger.cursorSequence).toBe(3)
    expect(observation.ledger.pending).toEqual([
      { sequence: 3, position: 220 },
    ])
  })

  it('classifies reversal to a retired authored position as human', () => {
    const atEnd = observeScrollPosition(
      liveLedgerWithWrites([100, 160, 220]),
      220,
    )
    const reversal = observeScrollPosition(atEnd.ledger, 160)

    expect(reversal.ownership).toBe('human')
    expect(reversal.killSeek).toBe(true)
    expect(reversal.interrupted).toBe(true)
    expect(reversal.ledger.phase).toBe('interrupted')
  })

  it('classifies an observation behind the consumed cursor as human', () => {
    const atMiddle = observeScrollPosition(
      liveLedgerWithWrites([100, 160, 220]),
      160,
    )
    const behind = observeScrollPosition(atMiddle.ledger, 100)

    expect(behind.ownership).toBe('human')
    expect(behind.killSeek).toBe(true)
    expect(behind.interrupted).toBe(true)
  })

  it('interrupts a live seek with no pending authored writes', () => {
    const observation = observeScrollPosition(
      beginAuthoredSeek(createScrollOwnershipLedger()),
      100,
    )

    expect(observation.ownership).toBe('human')
    expect(observation.killSeek).toBe(true)
    expect(observation.ledger.phase).toBe('interrupted')
  })

  it('classifies idle observations as human without a seek to kill', () => {
    const observation = observeScrollPosition(
      createScrollOwnershipLedger(),
      100,
    )

    expect(observation.ownership).toBe('human')
    expect(observation.killSeek).toBe(false)
    expect(observation.interrupted).toBe(false)
    expect(observation.ledger.phase).toBe('idle')
  })

  it('mirrors ordered, coalesced, and reversal behavior while descending', () => {
    let orderedLedger = liveLedgerWithWrites([220, 160, 100])

    for (const position of [220, 160, 100]) {
      const observation = observeScrollPosition(orderedLedger, position)

      expect(observation.ownership).toBe('authored')
      orderedLedger = observation.ledger
    }

    const coalesced = observeScrollPosition(
      liveLedgerWithWrites([220, 160, 100]),
      100,
    )
    expect(coalesced.ownership).toBe('authored')
    expect(coalesced.ledger.pending).toEqual([
      { sequence: 3, position: 100 },
    ])

    const reversal = observeScrollPosition(coalesced.ledger, 160)
    expect(reversal.ownership).toBe('human')
    expect(reversal.killSeek).toBe(true)
  })

  it('uses observation chronology when an authored seek revisits a position', () => {
    let ledger = liveLedgerWithWrites([100])
    const firstVisit = observeScrollPosition(ledger, 100)

    ledger = recordAuthoredWrite(firstVisit.ledger, 160)
    ledger = recordAuthoredWrite(ledger, 100)

    const secondVisit = observeScrollPosition(ledger, 100)
    expect(secondVisit.ownership).toBe('authored')
    expect(secondVisit.ledger.cursorSequence).toBe(3)
    expect(secondVisit.ledger.pending).toEqual([
      { sequence: 3, position: 100 },
    ])
  })

  it('attributes a coalesced repeated position to its newest pending write', () => {
    const finalVisit = observeScrollPosition(
      liveLedgerWithWrites([100, 160, 100]),
      100,
    )

    expect(finalVisit.ownership).toBe('authored')
    expect(finalVisit.ledger.cursorSequence).toBe(3)
    expect(finalVisit.ledger.pending).toEqual([
      { sequence: 3, position: 100 },
    ])

    const retiredMiddle = observeScrollPosition(finalVisit.ledger, 160)
    expect(retiredMiddle.ownership).toBe('human')
    expect(retiredMiddle.killSeek).toBe(true)
  })

  it('advances consecutive identical writes to the newest sequence', () => {
    const observation = observeScrollPosition(
      liveLedgerWithWrites([100, 100, 100]),
      100,
    )

    expect(observation.ownership).toBe('authored')
    expect(observation.ledger.cursorSequence).toBe(3)
    expect(observation.ledger.pending).toEqual([
      { sequence: 3, position: 100 },
    ])
  })

  it('kills once and keeps interruption latched', () => {
    let ledger = liveLedgerWithWrites([100])
    const killSignals: boolean[] = []

    for (const position of [90, 80, 70]) {
      const observation = observeScrollPosition(ledger, position)

      expect(observation.ownership).toBe('human')
      expect(observation.interrupted).toBe(true)
      killSignals.push(observation.killSeek)
      ledger = observation.ledger
    }

    expect(killSignals).toEqual([true, false, false])
  })

  it('ignores dying-tween writes while interrupted', () => {
    const interrupted = observeScrollPosition(
      liveLedgerWithWrites([100]),
      90,
    ).ledger
    const afterWrite = recordAuthoredWrite(interrupted, 160)

    expect(afterWrite).toBe(interrupted)

    const observation = observeScrollPosition(afterWrite, 160)
    expect(observation.ownership).toBe('human')
    expect(observation.killSeek).toBe(false)
    expect(observation.ledger).toBe(interrupted)
  })

  it('re-arms only through an explicit new authored seek', () => {
    const interrupted = observeScrollPosition(
      liveLedgerWithWrites([100]),
      90,
    ).ledger
    let ledger = beginAuthoredSeek(interrupted)

    expect(ledger.phase).toBe('live')
    expect(ledger.pending).toEqual([])
    expect(ledger.cursorSequence).toBe(0)

    ledger = recordAuthoredWrite(ledger, 160)
    expect(ledger.pending[0].sequence).toBe(2)

    const observation = observeScrollPosition(ledger, 160)
    expect(observation.ownership).toBe('authored')
    expect(observation.killSeek).toBe(false)
  })

  it('rejects beginning another seek while one is already live', () => {
    const live = beginAuthoredSeek(createScrollOwnershipLedger())

    expect(() => beginAuthoredSeek(live)).toThrow(
      new Error('An authored scroll seek is already live.'),
    )
  })

  it('returns new transition ledgers without mutating their inputs', () => {
    const live = liveLedgerWithWrites([100, 160])
    const snapshot = {
      ...live,
      pending: live.pending.map((write) => ({ ...write })),
    }
    const recorded = recordAuthoredWrite(live, 220)
    const observed = observeScrollPosition(live, 160).ledger

    expect(live).toEqual(snapshot)
    expect(recorded).not.toBe(live)
    expect(recorded.pending).not.toBe(live.pending)
    expect(observed).not.toBe(live)
    expect(observed.pending).not.toBe(live.pending)
  })

  it('validates authored writes and treats non-finite observations as human', () => {
    const idle = createScrollOwnershipLedger()

    expect(() => recordAuthoredWrite(idle, 100)).toThrow(
      new Error('Authored scroll writes require a live seek.'),
    )

    for (const position of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const live = beginAuthoredSeek(idle)

      expect(() => recordAuthoredWrite(live, position)).toThrow(
        new Error('Authored scroll writes must be finite.'),
      )

      const observation = observeScrollPosition(live, position)
      expect(observation.ownership).toBe('human')
      expect(observation.killSeek).toBe(true)
    }
  })
})
