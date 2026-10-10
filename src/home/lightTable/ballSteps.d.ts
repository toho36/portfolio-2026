export interface StaticLanding {
  blocks: number[][][][]
  ball: { x: number; y: number; diameter: number }
}
export function createBallSteps(three: unknown, document: Document, own: <T extends { dispose(): void }>(resource: T) => T): { group: unknown; reveal(progress: number): void }
export function staticLanding(aspect: number, screenWidth?: number): StaticLanding
export function staticStepImage(pose: StaticLanding): string
