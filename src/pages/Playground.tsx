import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { loadWireRuntime } from '../playground/loadWireRuntime'
import { createWireRuntime, type WireRuntime } from '../playground/wireRuntime'
import { readBest, recordRun, type Best, type Mode } from '../playground/wireScore'

interface PlaygroundPageProps { readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }
const emptyBest: Best = { bestPercent: 0, bestTimeMs: null }
const formatTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms % 1000 / 100)}`

export function PlaygroundPage({ onNavigate }: PlaygroundPageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<WireRuntime | null>(null)
  const modeRef = useRef<Mode>('easy')
  const soundRef = useRef(true)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [percent, setPercent] = useState(0)
  const [progress, setProgress] = useState(0)
  const [best, setBest] = useState<Best>(emptyBest)
  const [mode, setMode] = useState<Mode>('easy')
  const [sound, setSound] = useState(true)
  const [coarse, setCoarse] = useState(false)
  const [holding, setHolding] = useState(false)
  const [failed, setFailed] = useState(false)
  const [finishMs, setFinishMs] = useState<number | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let canceled = false
    let runtime: WireRuntime | null = null
    let storage: Storage | null = null
    try { storage = window.localStorage } catch { /* private browsing */ }
    setBest(readBest(storage, modeRef.current))
    try { soundRef.current = storage?.getItem('vitek-wire:sound') !== 'off' } catch { soundRef.current = true }
    setSound(soundRef.current)
    setCoarse(window.matchMedia('(pointer: coarse)').matches)
    const probe = document.createElement('canvas')
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) { setState('failed'); return }
    void loadWireRuntime({
      isCanceled: () => canceled,
      onProgress: (p) => { if (!canceled) setPercent(p) },
      createRuntime: (three) => {
        runtime = createWireRuntime(three, {
          host: stage,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          hud: {
            onProgress: (p) => {
              if (canceled) return
              setProgress(p)
              setBest(recordRun(storage, modeRef.current, p, null))
            },
            onFail: () => { if (!canceled) { setFailed(true); setHolding(false) } },
            onFinish: (timeMs) => {
              if (canceled) return
              setFinishMs(timeMs); setHolding(false)
              setBest(recordRun(storage, modeRef.current, 100, timeMs))
            },
            onHold: (on) => { if (!canceled) { setHolding(on); if (on) setFailed(false) } },
          },
          onFirstFrame: () => { if (!canceled) setState('ready') },
        })
        runtimeRef.current = runtime
        runtime.setMode(modeRef.current)
        runtime.setSound(soundRef.current)
        return runtime
      },
    }).then((result) => { if (!canceled && result.status === 'failed') setState('failed') })
    return () => { canceled = true; runtimeRef.current = null; runtime?.destroy() }
  }, [])

  function changeMode(next: Mode) {
    if (next === modeRef.current) return
    modeRef.current = next; setMode(next); setProgress(0); setFailed(false); setFinishMs(null); setHolding(false)
    try { setBest(readBest(window.localStorage, next)) } catch { setBest(emptyBest) }
    runtimeRef.current?.setMode(next)
  }
  function toggleSound() {
    const next = !sound
    soundRef.current = next; setSound(next); runtimeRef.current?.setSound(next)
    try { window.localStorage.setItem('vitek-wire:sound', next ? 'on' : 'off') } catch { /* private browsing */ }
  }
  function restart() { setFinishMs(null); setFailed(false); setProgress(0); runtimeRef.current?.restart() }
  const hint = finishMs !== null ? 'a clean run. go again?'
    : failed ? 'touch the wire. back to start.'
      : holding ? (mode === 'hard' ? 'hold tight · release to reset' : 'steady hands')
        : `${coarse ? 'grab' : 'click'} the handle${mode === 'hard' ? ' · release to reset' : ''}`

  return (
    <article className="playground" data-wire-state={state}>
      <div className="wire-topline"><span>01 / PLAYGROUND</span><span>HOT WIRE — VITEK</span></div>
      <div ref={stageRef} className="wire-stage" data-wire-stage />
      <p className="wire-loader" data-wire-loader aria-live="polite">{percent}<small>LOADING THE WIRE</small></p>
      <div className="wire-fallback" data-wire-fallback hidden={state !== 'failed'}>
        <p>The playground needs WebGL.</p>
        <a className="target-link" href="/" onClick={onNavigate}>Back home</a>
      </div>
      <div className="wire-hud">
        <div className="wire-modes" aria-label="Difficulty">
          {(['easy', 'hard'] as const).map((m) => <button type="button" key={m} aria-pressed={mode === m} onClick={() => changeMode(m)}>{m === 'easy' ? 'Easy' : 'Hard'}</button>)}
        </div>
        <div className="wire-score" aria-live="polite"><strong>{progress} %</strong><span>best {best.bestPercent} %{best.bestTimeMs !== null && ` · ${formatTime(best.bestTimeMs)}`}</span></div>
        <button className="wire-sound" type="button" aria-pressed={sound} onClick={toggleSound}>Sound {sound ? 'on' : 'off'}</button>
      </div>
      <div className="wire-footer"><p className="wire-hint">{hint}</p><div className="wire-minimap" aria-label={`Progress ${progress} percent`}><i style={{ width: `${progress}%` }} /></div></div>
      {finishMs !== null && <div className="wire-result" role="status"><span>WIRE CLEARED</span><strong>{formatTime(finishMs)}</strong><button type="button" onClick={restart}>Play again <span aria-hidden="true">↗</span></button></div>}
    </article>
  )
}
