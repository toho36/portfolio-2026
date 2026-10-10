import type { P1Content } from '../shared/types'

export const HERO_HEADLINE = 'I build web platforms and the systems behind them.'
export const HERO_INTRODUCTION = 'At SolidPixels, I work across CMS, frontend, backend and third-party integrations; GameOnVB is my own full-stack product.'
export const P1_CONTENT: P1Content = {
  steps: ['Event opens', 'Player registers', 'Payment matched', 'Attendance resolved'],
  reconstructionLabel: 'Reconstruction with demo data',
  bankInputLabel: 'Simulated bank input',
}
export const STEP_DETAILS = [
  { description: 'The organizer saves an event with capacity and an open registration state; the change is written to the audit log.', before: 'No event', after: '22 Oct 2026, 19:00 · Capacity 12 · Open' },
  { description: 'Registration holds a place immediately and the public page updates occupancy.', before: '0 / 12 places held', after: '1 / 12 · Demo Player · Awaiting payment' },
  { description: 'An incoming bank transaction is matched to the registration by variable symbol and amount; the registration is confirmed.', before: 'No incoming payment · Awaiting payment', after: '150 Kč · VS 1000000002 · Matched · Confirmed' },
  { description: 'The organizer records attendance against the same registration, with an audit entry.', before: '0 arrivals', after: '1 arrival · Demo Player · Attendance saved' },
] as const
