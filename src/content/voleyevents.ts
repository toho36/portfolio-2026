import { CARTRIDGE_STORIES } from './cartridges'

const SOURCE = CARTRIDGE_STORIES.voleyevents

export interface VoleyEventsLifecycleStage {
  readonly id:
    | 'event-opens'
    | 'player-registers'
    | 'payment-matches'
    | 'attendance-resolves'
  readonly label: string
  readonly state: string
  readonly body: string
  readonly handles: readonly string[]
}

export const VOLEYEVENTS_LIFECYCLE: readonly VoleyEventsLifecycleStage[] = [
  {
    id: 'event-opens',
    label: 'Event opens',
    state: 'Open',
    body:
      'The recurring event, its capacity and organizer controls enter one operational flow before registration begins.',
    handles: ['Recurring event', 'Capacity', 'Organizer administration'],
  },
  {
    id: 'player-registers',
    label: 'Player registers',
    state: 'Registered',
    body:
      'A player registration joins that flow. If plans change, cancellation credit remains part of the same traceable record.',
    handles: ['Registration', 'Cancellation credit', 'Player status'],
  },
  {
    id: 'payment-matches',
    label: 'Payment matches',
    state: 'Matched',
    body:
      'The QR-bank transfer is matched to the registration, keeping money and audit beside the event operation they explain.',
    handles: ['QR-bank payment matching', 'Money state', 'Audit trail'],
  },
  {
    id: 'attendance-resolves',
    label: 'Attendance resolves',
    state: 'Resolved',
    body:
      'Organizer administration resolves attendance against the registration so the event closes with a coherent, reliable operational record.',
    handles: ['Attendance', 'Admin operations', 'Reliable resolution'],
  },
] as const

/**
 * Public-safe case-study copy derived from owner-maintained VoleyEvents material.
 * It intentionally contains no metrics, currency amounts or attributed quotes.
 */
export const VOLEYEVENTS = {
  hero: {
    eyebrow: 'VoleyEvents / Match operations',
    title:
      'Registration and operations software for recurring recreational volleyball events.',
    lede: SOURCE.preview,
  },
  problem: {
    eyebrow: 'The operational problem',
    title: 'One event creates several connected promises.',
    body:
      'Registration is only the beginning. Player status, capacity, payment, cancellation and organizer action must keep describing the same event.',
  },
  constraints: {
    eyebrow: 'Constraint',
    title: 'Keep every handoff in one understandable flow.',
    body: SOURCE.constraint,
  },
  decisions: {
    eyebrow: 'System decision',
    title: 'Treat operations as lifecycle state, not admin cleanup.',
    body: SOURCE.decision,
  },
  lifecycle: VOLEYEVENTS_LIFECYCLE,
  evidence: {
    eyebrow: 'Evidence boundary',
    title: 'The case study stays inside maintained project material.',
    body: SOURCE.evidence,
  },
  status: {
    eyebrow: 'Current status',
    title: 'An explanatory product story, not a live operations surface.',
    body:
      'The page explains how registration, money, capacity and audit are modelled together. It exposes no live event data or production integration.',
  },
} as const
