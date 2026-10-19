export interface GiantImpactOptions {
  stage: HTMLDivElement
  fallback: SVGSVGElement
  controls: HTMLDivElement
  pause: HTMLButtonElement
  replay: HTMLButtonElement
  onFailure?: (error: unknown) => void
}

export interface GiantImpactRuntime {
  dispose(): void
}

export function createGiantImpact(options: GiantImpactOptions): GiantImpactRuntime
