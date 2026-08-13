import { describe, expect, it } from 'vitest'
import {
  RALLY_TIER_PROFILES,
  createRallyQualityController,
  resolveRallyCapability,
  type RallyQualityInputs,
} from './rallyQuality'

interface RallyBudgetModule {
  readonly BUDGETS: {
    readonly sharedRegressionGzipBytes: number
    readonly coldRallyRuntimeGzipBytes: number
    readonly visualAssetsBytes: number
  }
  collectManifestAttribution(manifest: unknown): {
    readonly sharedFiles: readonly string[]
    readonly routeFiles: readonly string[]
  }
  enforceBudgets(
    totals: { sharedGzipBytes: number; routeGzipBytes: number; visualBytes: number },
    baselineBytes: number,
  ): number
  validateFrozenBaseline(
    baseline: unknown,
    nodeVersion?: string,
    zlibVersion?: string,
  ): unknown
  validateTransitionTrace(trace: unknown, traceName?: string): unknown
  validateForcedTransitionTrace(trace: unknown): unknown
}

async function rallyBudgetModule() {
  const moduleUrl = new URL('../../scripts/check-voleyevents-rally-budget.mjs', import.meta.url)
  return await import(/* @vite-ignore */ moduleUrl.href) as unknown as RallyBudgetModule
}

const HIGH_INPUTS: RallyQualityInputs = {
  reducedMotion: false,
  webglAvailable: true,
  webgl2Available: true,
  contextLost: false,
  pointerFine: true,
  viewportWidth: 1280,
  deviceMemory: 8,
  hardwareConcurrency: 8,
}

function capability(overrides: Partial<RallyQualityInputs> = {}) {
  return resolveRallyCapability({ ...HIGH_INPUTS, ...overrides })
}

function closeWindow(
  controller: ReturnType<typeof createRallyQualityController>,
  start: number,
  frameMs: number,
) {
  controller.sample(frameMs, start)
  return controller.sample(frameMs, start + 2_000)
}

describe('rally capability ceiling', () => {
  it.each([
    [{ reducedMotion: true }, false],
    [{ webglAvailable: false }, false],
    [{ contextLost: true }, false],
  ] as const)('gives no-runtime precedence for %o', (overrides, runtime) => {
    expect(capability(overrides).runtime).toBe(runtime)
  })

  it.each([
    [{ pointerFine: false }, 'Low'],
    [{ viewportWidth: 767 }, 'Low'],
    [{ viewportWidth: 768 }, 'Medium'],
    [{ deviceMemory: 4 }, 'Low'],
    [{ deviceMemory: 5 }, 'Medium'],
    [{ hardwareConcurrency: 4 }, 'Low'],
    [{ hardwareConcurrency: 5 }, 'Medium'],
    [{ viewportWidth: 1279 }, 'Medium'],
    [{ viewportWidth: 1280 }, 'High'],
    [{ deviceMemory: 7 }, 'Medium'],
    [{ deviceMemory: 8 }, 'High'],
    [{ hardwareConcurrency: 7 }, 'Medium'],
    [{ hardwareConcurrency: 8 }, 'High'],
    [{ webgl2Available: false }, 'Medium'],
    [{ viewportWidth: Number.NaN }, 'Medium'],
    [{ deviceMemory: Number.POSITIVE_INFINITY }, 'Medium'],
  ] as const)('uses the exact first-match boundary %o', (overrides, ceiling) => {
    expect(capability(overrides)).toMatchObject({ runtime: true, ceiling })
  })

  it.each(Object.keys(HIGH_INPUTS) as Array<keyof RallyQualityInputs>)(
    'treats unavailable %s as Medium without coercing it to Low',
    (field) => {
      expect(capability({ [field]: undefined })).toMatchObject({
        runtime: true,
        ceiling: 'Medium',
        start: 'Medium',
      })
    },
  )

  it('starts a High ceiling at Medium and honors earlier Low matches', () => {
    expect(capability()).toMatchObject({ ceiling: 'High', start: 'Medium' })
    expect(capability({ pointerFine: false, webgl2Available: false })).toMatchObject({
      ceiling: 'Low',
      start: 'Low',
    })
  })

  it('freezes contract profiles including the final Medium one-wave cap', () => {
    expect(RALLY_TIER_PROFILES).toEqual({
      High: expect.objectContaining({ dpr: 1.5, waves: 2, drawCalls: 18, triangles: 30_000 }),
      Medium: expect.objectContaining({ dpr: 1.25, waves: 1, drawCalls: 14, triangles: 20_000 }),
      Low: expect.objectContaining({ dpr: 1, waves: 1, drawCalls: 10, triangles: 12_000 }),
    })
    expect(Object.isFrozen(RALLY_TIER_PROFILES)).toBe(true)
  })
})

describe('rally quality windows', () => {
  it('uses non-overlapping nearest-rank p95 windows and strict thresholds', () => {
    const controller = createRallyQualityController({
      capability: capability(),
      target: 18,
      recovery: 14,
    })
    for (const [index, value] of [1, 2, 3, 4, 100].entries()) {
      controller.sample(value, index)
    }
    expect(controller.sample(18, 2_000).window).toMatchObject({
      startedAt: 0,
      endedAt: 2_000,
      p95: 100,
      samples: 6,
    })
    expect(closeWindow(controller, 2_000, 18).tier).toBe('Medium')
    expect(closeWindow(controller, 4_000, 14).tier).toBe('Medium')
  })

  it('downgrades after two misses, resets the streak, and never counts a Medium miss as Low', () => {
    const controller = createRallyQualityController({
      capability: capability(), target: 18, recovery: 14,
    })
    expect(closeWindow(controller, 0, 19).tier).toBe('Medium')
    expect(closeWindow(controller, 2_000, 19)).toMatchObject({ tier: 'Low', surrender: false })
    expect(closeWindow(controller, 4_000, 19)).toMatchObject({ tier: 'Low', surrender: false })
    expect(closeWindow(controller, 6_000, 18)).toMatchObject({ tier: 'Low', surrender: false })
    expect(closeWindow(controller, 8_000, 19)).toMatchObject({ tier: 'Low', surrender: false })
    expect(closeWindow(controller, 10_000, 19).surrender).toBe(true)
  })

  it('surrenders only for consecutive Low misses and an intervening pass resets', () => {
    const controller = createRallyQualityController({
      capability: capability({ pointerFine: false }), target: 25, recovery: 19,
    })
    expect(closeWindow(controller, 0, 26).surrender).toBe(false)
    expect(closeWindow(controller, 2_000, 25).surrender).toBe(false)
    expect(closeWindow(controller, 4_000, 26).surrender).toBe(false)
    expect(closeWindow(controller, 6_000, 26).surrender).toBe(true)
    expect(closeWindow(controller, 8_000, 1).surrender).toBe(true)
  })

  it('upgrades after five continuous seconds below R, respects ceiling and change lockout', () => {
    const controller = createRallyQualityController({
      capability: capability(), target: 18, recovery: 14,
    })
    expect(closeWindow(controller, 0, 13).tier).toBe('Medium')
    expect(closeWindow(controller, 2_000, 13).tier).toBe('Medium')
    expect(closeWindow(controller, 4_000, 13).tier).toBe('High')
    expect(closeWindow(controller, 6_000, 19).tier).toBe('High')
    expect(closeWindow(controller, 8_000, 19).tier).toBe('Medium')
    expect(closeWindow(controller, 10_000, 13).tier).toBe('Medium')
    expect(closeWindow(controller, 12_000, 13).tier).toBe('Medium')
    expect(closeWindow(controller, 14_000, 13).tier).toBe('High')

    const medium = createRallyQualityController({
      capability: capability({ viewportWidth: 1279 }), target: 18, recovery: 14,
    })
    for (const start of [0, 2_000, 4_000, 6_000]) closeWindow(medium, start, 1)
    expect(medium.snapshot().tier).toBe('Medium')
  })

  it('breaks recovery across empty, inactive, and non-monotonic time', () => {
    const controller = createRallyQualityController({
      capability: capability(), target: 18, recovery: 14,
    })
    closeWindow(controller, 0, 10)
    controller.sample(10, 6_001)
    expect(controller.sample(10, 8_000).tier).toBe('Medium')
    controller.resetSampling(8_100)
    closeWindow(controller, 8_000, 10)
    controller.sample(10, 5)
    expect(controller.snapshot().tier).toBe('Medium')
  })

  it('uses mobile thresholds from the injected coarse capability', () => {
    const controller = createRallyQualityController({
      capability: capability({ pointerFine: false }),
    })
    closeWindow(controller, 0, 20)
    expect(closeWindow(controller, 2_000, 20).surrender).toBe(false)
    expect(controller.snapshot().transitions).toHaveLength(0)
  })
})

describe('rally manifest budget attribution', () => {
  it('walks recursive dynamic closure and attributes duplicate chunks once', async () => {
    const budget = await rallyBudgetModule()
    const attribution = budget.collectManifestAttribution({
      'src/main.tsx': {
        file: 'assets/index.js',
        isEntry: true,
        imports: ['shared'],
        dynamicImports: ['src/voleyevents/loadRallyRuntime.ts'],
      },
      shared: { file: 'assets/shared.js' },
      'src/voleyevents/loadRallyRuntime.ts': {
        file: 'assets/rally.js',
        src: 'src/voleyevents/loadRallyRuntime.ts',
        isDynamicEntry: true,
        imports: ['shared'],
        dynamicImports: ['gsap', 'three'],
      },
      gsap: { file: 'assets/gsap.js', dynamicImports: ['nested'] },
      three: { file: 'assets/three.js', imports: ['nested'] },
      nested: { file: 'assets/nested.js' },
    })
    expect(attribution.sharedFiles).toEqual(['assets/index.js', 'assets/shared.js'])
    expect(attribution.routeFiles).toEqual([
      'assets/gsap.js',
      'assets/nested.js',
      'assets/rally.js',
      'assets/three.js',
    ])
  })

  it('fails closed for missing/malformed manifests and an absent frozen baseline', async () => {
    const budget = await rallyBudgetModule()
    expect(() => budget.collectManifestAttribution(undefined)).toThrow('MANIFEST_MALFORMED')
    expect(() => budget.collectManifestAttribution({
      index: { file: 'index.js', isEntry: true, imports: ['missing'] },
      rally: {
        file: 'rally.js',
        src: 'src/voleyevents/loadRallyRuntime.ts',
        isDynamicEntry: true,
      },
    })).toThrow('MANIFEST_MALFORMED')
    expect(() => budget.validateFrozenBaseline({}, 'v-test', 'z-test'))
      .toThrow('BASELINE_INVALID')
  })

  it.each([
    ['SHARED_INITIAL_BUDGET', { sharedGzipBytes: 9_193, routeGzipBytes: 0, visualBytes: 0 }],
    ['COLD_RALLY_RUNTIME_BUDGET', { sharedGzipBytes: 1_000, routeGzipBytes: 250_881, visualBytes: 0 }],
    ['VISUAL_ASSET_BUDGET', { sharedGzipBytes: 1_000, routeGzipBytes: 0, visualBytes: 122_881 }],
  ] as const)('names the %s breach', async (name, totals) => {
    const budget = await rallyBudgetModule()
    expect(() => budget.enforceBudgets(totals, 1_000)).toThrow(name)
  })

  it('replays exact forced hysteresis and rejects reason-only transition claims', async () => {
    const budget = await rallyBudgetModule()
    const window = (startedAt: number, p95: number, tier: 'Low' | 'Medium') => ({
      startedAt,
      endedAt: startedAt + 2_000,
      p95,
      samples: 120,
      tier,
    })
    const trace = {
      platform: 'desktop',
      targetMs: 18,
      recoveryMs: 14,
      ceiling: 'High',
      startTier: 'Medium',
      windows: [
        window(0, 19, 'Medium'),
        window(2_000, 19, 'Medium'),
        window(4_000, 13, 'Low'),
        window(6_000, 13, 'Low'),
        window(8_000, 13, 'Low'),
        window(10_000, 19, 'Medium'),
        window(12_000, 19, 'Medium'),
        window(14_000, 19, 'Low'),
        window(16_000, 18, 'Low'),
        window(18_000, 19, 'Low'),
        window(20_000, 19, 'Low'),
      ],
      transitions: [
        { at: 4_000, from: 'Medium', to: 'Low', reason: 'miss' },
        { at: 10_000, from: 'Low', to: 'Medium', reason: 'recovery' },
        { at: 14_000, from: 'Medium', to: 'Low', reason: 'miss' },
        { at: 22_000, from: 'Low', to: 'Static', reason: 'surrender' },
      ],
    }
    expect(() => budget.validateForcedTransitionTrace(trace)).not.toThrow()
    expect(() => budget.validateForcedTransitionTrace({
      ...trace,
      windows: [],
      transitions: trace.transitions.map(({ reason }) => ({ reason })),
    })).toThrow('TRANSITION_EVIDENCE_INVALID')
    expect(() => budget.validateTransitionTrace({
      ...trace,
      transitions: trace.transitions.map((entry, index) =>
        index === 0 ? { ...entry, at: 4_001 } : entry),
    }, 'forced')).toThrow('TRANSITION_EVIDENCE_INVALID')
    expect(() => budget.validateForcedTransitionTrace({
      ...trace,
      windows: trace.windows.filter(({ startedAt }) => startedAt !== 16_000),
    })).toThrow('TRANSITION_EVIDENCE_INVALID')
  })
})
