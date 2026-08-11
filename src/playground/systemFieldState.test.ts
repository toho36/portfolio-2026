import { describe, expect, it } from 'vitest'
import {
  appendSystemFieldWave,
  liveSystemFieldWaves,
  normalizeSystemFieldProgress,
  SYSTEM_FIELD_MAX_WAVES,
  SYSTEM_FIELD_NODE_COUNT,
  SYSTEM_FIELD_SIZE,
  SYSTEM_FIELD_WAVE_LIFETIME,
  systemFieldNodeState,
} from './systemFieldState'

describe('System Field state', () => {
  it('defines one 32 by 32 field and clamps progress', () => {
    expect(SYSTEM_FIELD_SIZE).toBe(32)
    expect(SYSTEM_FIELD_NODE_COUNT).toBe(1024)
    expect(normalizeSystemFieldProgress(-1)).toBe(0)
    expect(normalizeSystemFieldProgress(2)).toBe(1)
  })

  it('maps flat, fold, tunnel and return reversibly', () => {
    const index = 8 * SYSTEM_FIELD_SIZE + 4
    const flat = systemFieldNodeState(index, 0, [], 100)
    const fold = systemFieldNodeState(index, 0.32, [], 100)
    const tunnel = systemFieldNodeState(index, 0.7, [], 100)
    const feedback = systemFieldNodeState(index, 0.94, [], 100)

    expect(fold.z).toBeLessThan(flat.z)
    expect(tunnel.x).not.toBe(flat.x)
    expect(feedback).not.toEqual(tunnel)
    expect(systemFieldNodeState(index, 0.32, [], 900)).toEqual(fold)
    expect(systemFieldNodeState(index, 0, [], 900)).toEqual(flat)
  })

  it('bounds waves and expires them without changing authored geometry', () => {
    let waves = [] as ReturnType<typeof appendSystemFieldWave>
    for (let index = 0; index < SYSTEM_FIELD_MAX_WAVES + 4; index += 1) {
      waves = appendSystemFieldWave(waves, {
        x: index,
        y: -index,
        startedAt: index * 10,
      })
    }

    expect(waves).toHaveLength(SYSTEM_FIELD_MAX_WAVES)
    expect(waves.every(({ x, y }) => x <= 1 && y >= -1)).toBe(true)
    expect(liveSystemFieldWaves(waves, SYSTEM_FIELD_WAVE_LIFETIME + 100))
      .toHaveLength(0)
  })

  it('keeps pointer waves visible but restrained', () => {
    const wave = [{ x: 0, y: 0, startedAt: 0 }]
    let peakLift = 0
    let peakScale = 0

    for (let index = 0; index < SYSTEM_FIELD_NODE_COUNT; index += 1) {
      const flat = systemFieldNodeState(index, 0, [], 360)
      const active = systemFieldNodeState(index, 0, wave, 360)
      peakLift = Math.max(peakLift, active.y - flat.y)
      peakScale = Math.max(peakScale, active.scale)
    }

    expect(peakLift).toBeGreaterThan(0.05)
    expect(peakLift).toBeLessThan(0.2)
    expect(peakScale).toBeLessThan(1.05)
  })
})
