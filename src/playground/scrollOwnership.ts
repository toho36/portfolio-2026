export interface AuthoredScrollWrite {
  readonly sequence: number
  readonly position: number
}

export type ScrollSeekPhase = 'idle' | 'live' | 'interrupted'

export interface ScrollOwnershipLedger {
  readonly phase: ScrollSeekPhase
  readonly pending: readonly AuthoredScrollWrite[]
  readonly cursorSequence: number
  readonly nextSequence: number
}

export type ScrollOwnership = 'authored' | 'human'

export interface ScrollObservation {
  readonly ledger: ScrollOwnershipLedger
  readonly ownership: ScrollOwnership
  readonly killSeek: boolean
  readonly interrupted: boolean
}

/**
 * Tracks authored scroll writes by sequence rather than by direction or input
 * device. An owned observation advances a forward-only cursor, retiring every
 * older write; when positions repeat, the newest matching pending write wins
 * so a coalesced final event cannot leave skipped chronology attributable.
 *
 * State transitions return new ledgers without mutating their inputs. Latched
 * no-ops deliberately reuse the interrupted ledger until a new seek re-arms it.
 */
export function createScrollOwnershipLedger(): ScrollOwnershipLedger {
  return {
    phase: 'idle',
    pending: [],
    cursorSequence: 0,
    nextSequence: 1,
  }
}

export function beginAuthoredSeek(
  ledger: ScrollOwnershipLedger,
): ScrollOwnershipLedger {
  if (ledger.phase === 'live') {
    throw new Error('An authored scroll seek is already live.')
  }

  return {
    phase: 'live',
    pending: [],
    cursorSequence: 0,
    nextSequence: ledger.nextSequence,
  }
}

export function recordAuthoredWrite(
  ledger: ScrollOwnershipLedger,
  position: number,
): ScrollOwnershipLedger {
  if (ledger.phase === 'interrupted') return ledger

  if (!Number.isFinite(position)) {
    throw new Error('Authored scroll writes must be finite.')
  }

  if (ledger.phase !== 'live') {
    throw new Error('Authored scroll writes require a live seek.')
  }

  return {
    ...ledger,
    pending: [
      ...ledger.pending,
      { sequence: ledger.nextSequence, position },
    ],
    nextSequence: ledger.nextSequence + 1,
  }
}

export function observeScrollPosition(
  ledger: ScrollOwnershipLedger,
  position: number,
): ScrollObservation {
  if (ledger.phase === 'interrupted') {
    return {
      ledger,
      ownership: 'human',
      killSeek: false,
      interrupted: true,
    }
  }

  let matchIndex = -1

  for (let index = ledger.pending.length - 1; index >= 0; index -= 1) {
    if (Object.is(ledger.pending[index].position, position)) {
      matchIndex = index
      break
    }
  }

  if (matchIndex >= 0) {
    const matchedWrite = ledger.pending[matchIndex]
    const nextLedger: ScrollOwnershipLedger = {
      ...ledger,
      pending: ledger.pending.slice(matchIndex),
      cursorSequence: matchedWrite.sequence,
    }

    return {
      ledger: nextLedger,
      ownership: 'authored',
      killSeek: false,
      interrupted: false,
    }
  }

  if (ledger.phase === 'live') {
    return {
      ledger: {
        ...ledger,
        phase: 'interrupted',
        pending: [],
      },
      ownership: 'human',
      killSeek: true,
      interrupted: true,
    }
  }

  return {
    ledger,
    ownership: 'human',
    killSeek: false,
    interrupted: false,
  }
}
