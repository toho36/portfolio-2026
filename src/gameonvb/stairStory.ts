import { VOLEYEVENTS } from '../content/voleyevents'

export const STORY_CHAPTERS = [
  { id: 'story-entry', title: 'Event & registration', stages: VOLEYEVENTS.lifecycle.slice(0, 2) },
  { id: 'story-payment', title: 'Payment & audit', stages: VOLEYEVENTS.lifecycle.slice(2, 3) },
  { id: 'story-resolution', title: 'Attendance & resolution', stages: VOLEYEVENTS.lifecycle.slice(3) },
] as const
