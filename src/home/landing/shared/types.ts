import type { DominantMotion, Dispose } from './landingMotion'

/** Mount only inside a visible module; dispose on unmount/content replacement. */
export interface LandingModule<Content> {
  mount(el: HTMLElement, content: Content): Dispose
}
export interface MotionProps { coordinator: DominantMotion }
export type P1Step = 0 | 1 | 2 | 3
export interface P1Content {
  steps: readonly [string, string, string, string]
  reconstructionLabel: string
  bankInputLabel: string
}
export interface HeroProps extends MotionProps {
  headline: string
  introduction: string
  lifecycle: P1Content
}
export interface WorkItem {
  id: string
  title: string
  role: string
  context: string
  contribution: string
  evidence: string
  href: string
}
export interface WorkIndexProps extends MotionProps { items: readonly WorkItem[] }
export interface PracticeProps extends MotionProps {
  introduction: string
  gates: readonly { id: string; label: string; evidence: string }[]
}
export interface ScreenSwitchProps extends MotionProps {
  screens: readonly [string, string]
  illustrationLabel: string
  onSwap?: (screens: readonly [string, string]) => void
}
