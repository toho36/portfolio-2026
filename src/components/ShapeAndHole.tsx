import { useEffect, useRef } from 'react'
import { mountShapeAndHole } from '../goal-loop/shapeAndHole'
import './shapeAndHole.css'

export function ShapeAndHole() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (root.current) return mountShapeAndHole(root.current)
  }, [])

  return (
    <section ref={root} className="shape-and-hole" data-stage="0" data-state="ready" aria-label="Interactive Goal Loop illustration">
      <div className="shape-intro">
        <p className="shape-eyebrow">ONE BRIEF. ONE SHAPE. TWO REPAIRS.</p>
        <h1 id="goal-loop-title">Make it<br /><em>fit.</em></h1>
        <p className="shape-invitation">The wall is the brief.</p>
      </div>
      <div id="scene" className="shape-scene">
        <svg id="drawing" viewBox="0 0 1000 500" aria-hidden="true">
          <defs>
            <linearGradient id="object-tone" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff7247" /><stop offset="1" stopColor="#ed4828" /></linearGradient>
            <mask id="wall-cut"><rect x="0" y="0" width="1000" height="520" fill="white" /><path id="hole-mask" fill="black" /></mask>
            <clipPath id="build-clip"><rect id="fill-height" x="-100" y="85" width="200" height="0" /></clipPath>
          </defs>
          <path id="wall-glow" className="wall-glow" />
          <g id="wall" mask="url(#wall-cut)"><rect id="wall-board" x="620" y="150" width="260" height="285" rx="8" /></g>
          <path id="hole-rim" className="hole-rim" />
          <text id="wall-tag" className="scene-tag" x="750" y="459" textAnchor="middle">THE BRIEF · THE OPENING NEVER MOVES</text>
          <rect id="table" x="100" y="420" width="425" height="10" rx="5" />
          <text id="repair-caption" className="scene-tag" x="310" y="456" textAnchor="middle">REPAIR PIECES</text>
          <g id="slots"><g id="slot-1"><path d="M-20 12 -9 -12 13 -13 22 7 7 16Z" /><text y="5" textAnchor="middle">01</text></g><g id="slot-2"><path d="M-20 12 -9 -12 13 -13 22 7 7 16Z" /><text y="5" textAnchor="middle">02</text></g></g>
          <g id="chips"><g id="chip-1"><path d="M-20 12 -9 -12 13 -13 22 7 7 16Z" /><text y="5" textAnchor="middle">01</text></g><g id="chip-2"><path d="M-20 12 -9 -12 13 -13 22 7 7 16Z" /><text y="5" textAnchor="middle">02</text></g></g>
          <g id="weight" opacity="0"><line x1="-60" y1="-75" x2="60" y2="-75" /><rect x="-48" y="-68" width="96" height="34" rx="4" /><text y="-45" textAnchor="middle">CHECK</text></g>
          <g id="artifact"><path id="outline" /><path id="outline-inset" /><path id="solid-shadow" /><path id="solid" clipPath="url(#build-clip)" /><path id="crack-gap" opacity="0" /><path id="crack" opacity="0" /><g id="face" opacity="0"><circle cx="-15" cy="0" r="4" /><circle cx="16" cy="0" r="4" /><path id="mouth" d="M-10 17 Q0 26 11 17" /></g></g>
          <g id="wall-front" mask="url(#wall-cut)" visibility="hidden"><rect id="wall-front-board" x="620" y="150" width="260" height="285" rx="8" /></g>
          <path id="hole-front-rim" className="hole-rim" visibility="hidden" />
          <g id="finding"><path id="finding-point" /><path id="finding-leader" /><circle r="13" /><path d="M-5 -5 5 5 M5 -5 -5 5" /><text id="finding-text" x="0" y="0" textAnchor="middle">OFF HERE</text></g>
        </svg>
        <button id="repair" className="shape-repair" type="button" hidden><span aria-hidden="true">↗</span></button>
      </div>
      <div className="shape-control-deck">
        <div className="shape-status"><span id="state-label" className="shape-state-label">READY</span><p id="feedback" role="status" aria-live="polite">The wall is the brief. Make a shape that fits.</p><span id="budget" className="shape-sr-only">Two repair pieces are available.</span></div>
        <div className="shape-actions"><button id="send" className="shape-send" type="button"><span id="send-label">Make it fit</span><span aria-hidden="true">↗</span></button><button id="retry" className="shape-quiet" type="button" hidden>Try without fixing</button><button id="reset" className="shape-quiet" type="button" hidden>Reset</button></div>
      </div>
      <p className="shape-disclaimer">Interactive metaphor, not a live run. No agents, project tests or deployments execute.</p>
    </section>
  )
}
