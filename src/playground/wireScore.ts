export type Mode = 'easy' | 'hard'
export interface Best { bestPercent: number; bestTimeMs: number | null }

const key = (mode: Mode) => `vitek-wire:${mode}`
const fallback = (): Best => ({ bestPercent: 0, bestTimeMs: null })

export function readBest(storage: Pick<Storage, 'getItem'> | null, mode: Mode): Best {
  try {
    const raw = storage?.getItem(key(mode))
    if (!raw) return fallback()
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return fallback()
    const best = value as Record<string, unknown>
    return {
      bestPercent: typeof best.bestPercent === 'number' && Number.isFinite(best.bestPercent)
        ? Math.max(0, Math.min(100, best.bestPercent)) : 0,
      bestTimeMs: typeof best.bestTimeMs === 'number' && Number.isFinite(best.bestTimeMs) && best.bestTimeMs > 0
        ? best.bestTimeMs : null,
    }
  } catch { return fallback() }
}

export function recordRun(storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  mode: Mode, percent: number, timeMs: number | null): Best {
  const previous = readBest(storage, mode)
  const best: Best = {
    bestPercent: Math.max(previous.bestPercent, Math.max(0, Math.min(100, percent))),
    bestTimeMs: timeMs !== null && Number.isFinite(timeMs) && timeMs > 0 && percent >= 100
      ? Math.min(previous.bestTimeMs ?? Infinity, timeMs) : previous.bestTimeMs,
  }
  try { storage?.setItem(key(mode), JSON.stringify(best)) } catch { /* storage may be disabled */ }
  return best
}
