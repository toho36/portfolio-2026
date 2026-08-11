export const SYSTEM_FIELD_SIZE = 32
export const SYSTEM_FIELD_NODE_COUNT = SYSTEM_FIELD_SIZE * SYSTEM_FIELD_SIZE
export const SYSTEM_FIELD_MAX_WAVES = 2
export const SYSTEM_FIELD_WAVE_LIFETIME = 1000

export interface SystemFieldWave {
  readonly x: number
  readonly y: number
  readonly startedAt: number
}

export interface SystemFieldNodeState {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly scale: number
  readonly energy: number
}

function clamp(value: number, minimum = 0, maximum = 1) {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

function smoothstep(start: number, end: number, value: number) {
  const amount = clamp((value - start) / (end - start))
  return amount * amount * (3 - 2 * amount)
}

export function normalizeSystemFieldProgress(value: number) {
  return clamp(value)
}

export function appendSystemFieldWave(
  waves: readonly SystemFieldWave[],
  wave: SystemFieldWave,
): readonly SystemFieldWave[] {
  const next = [...waves, {
    x: clamp(wave.x, -1, 1),
    y: clamp(wave.y, -1, 1),
    startedAt: Number.isFinite(wave.startedAt) ? wave.startedAt : 0,
  }]
  return next.slice(-SYSTEM_FIELD_MAX_WAVES)
}

export function liveSystemFieldWaves(
  waves: readonly SystemFieldWave[],
  now: number,
) {
  return waves.filter(
    (wave) => now - wave.startedAt >= 0 &&
      now - wave.startedAt < SYSTEM_FIELD_WAVE_LIFETIME,
  )
}

/**
 * Pure reversible field mapping. Progress alone owns the flat/fold/tunnel/
 * return shape; waves add a temporary spatial displacement without changing
 * that authored state.
 */
export function systemFieldNodeState(
  index: number,
  progress: number,
  waves: readonly SystemFieldWave[],
  now: number,
): SystemFieldNodeState {
  const boundedIndex = Math.max(
    0,
    Math.min(SYSTEM_FIELD_NODE_COUNT - 1, Math.trunc(index)),
  )
  const column = boundedIndex % SYSTEM_FIELD_SIZE
  const row = Math.floor(boundedIndex / SYSTEM_FIELD_SIZE)
  const unitX = column / (SYSTEM_FIELD_SIZE - 1) * 2 - 1
  const unitY = row / (SYSTEM_FIELD_SIZE - 1) * 2 - 1
  const flatX = unitX * 6.8
  const flatY = unitY * 4.2
  const amount = normalizeSystemFieldProgress(progress)
  const fold = smoothstep(0.12, 0.48, amount)
  const tunnel = smoothstep(0.38, 0.76, amount)
  const angle = unitX * Math.PI * 0.78
  const radius = 3.7
  const foldedZ = -Math.abs(unitX) * 1.8 * fold
  const tunnelX = Math.sin(angle) * radius
  const tunnelZ = Math.cos(angle) * radius - radius

  let waveHeight = 0
  let waveEnergy = 0
  for (const wave of waves) {
    const age = (now - wave.startedAt) / SYSTEM_FIELD_WAVE_LIFETIME
    if (age < 0 || age >= 1) continue
    const distance = Math.hypot(unitX - wave.x, unitY - wave.y)
    const ring = Math.exp(-Math.pow((distance - age * 2.2) / 0.12, 2))
    const energy = ring * (1 - age)
    waveHeight += energy * 0.26
    waveEnergy = Math.max(waveEnergy, energy * 0.65)
  }

  // The final beat sends one bright ring back to the center. Because its
  // radius is derived only from progress, reverse scroll restores every node.
  const returnAmount = smoothstep(0.78, 1, amount)
  const radial = Math.hypot(unitX, unitY)
  const returnRadius = (1 - returnAmount) * 1.35
  const feedbackEnergy = returnAmount > 0
    ? Math.exp(-Math.pow((radial - returnRadius) / 0.09, 2)) * returnAmount
    : 0

  return {
    x: flatX + (tunnelX - flatX) * tunnel,
    y: flatY + waveHeight,
    z: foldedZ + (tunnelZ - foldedZ) * tunnel + waveHeight * 0.24,
    scale: 0.72 + Math.max(waveEnergy, feedbackEnergy) * 0.5,
    energy: Math.max(waveEnergy, feedbackEnergy),
  }
}
