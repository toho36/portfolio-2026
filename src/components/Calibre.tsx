import { useEffect, useId, useRef } from 'react'
import { PARTS } from '../goal-loop/calibre/model'
import type { CalibreMount } from '../goal-loop/calibre/controller.js'
import './Calibre.css'

export function Calibre({ titleId }: { readonly titleId?: string }) {
  const root = useRef<HTMLElement>(null)
  const id = useId()
  useEffect(() => {
    const element = root.current
    if (!element) return
    let canceled = false
    let mounted: CalibreMount | undefined
    void import('../goal-loop/calibre/controller.js').then(({ mountCalibre }) => {
      if (!canceled && element.isConnected) mounted = mountCalibre(element)
    }).catch(() => {
      if (canceled) return
      const capability = element.querySelector<HTMLElement>('[data-calibre="capability"]')
      if (capability) { capability.hidden = false; capability.textContent = 'Interaction unavailable. The complete case study remains below.' }
    })
    return () => { canceled = true; mounted?.dispose() }
  }, [])
  return (
    <section className="calibre" ref={root} data-silver={`${id}-silver`} data-brass={`${id}-brass`} aria-labelledby={titleId ?? `${id}-title`}>
      <div className="calibre-layout">
        <aside className="calibre-intro">
          <p className="calibre-eyebrow">A system, made visible.</p>
          <h1 id={titleId ?? `${id}-title`}>Precision,<br />in motion.</h1>
          <p className="calibre-lede">An anatomy to look into.<br />No task to complete.</p>
          <div className="calibre-main-controls">
            <button data-calibre="open" type="button" aria-pressed="false">Open movement <span aria-hidden="true">↗</span></button>
            <button data-calibre="motion" type="button" aria-pressed="true">Pause motion</button>
          </div>
        </aside>
        <div className="calibre-exhibit">
          <div className="calibre-stage" data-calibre="stage" tabIndex={0} role="group" aria-label="Interactive clockwork exhibit. Drag to orbit, wheel or pinch to zoom. Arrow keys rotate; plus and minus zoom." data-runtime="static" data-ready="false">
            <svg data-calibre="fallback" viewBox="0 0 720 560" role="img" aria-label="Static explorable calibre anatomy">
              <defs>
                <linearGradient id={`${id}-silver`}><stop stopColor="#f3f3ea" /><stop offset=".45" stopColor="#9da6a5" /><stop offset="1" stopColor="#d8dcd7" /></linearGradient>
                <linearGradient id={`${id}-brass`}><stop stopColor="#e3cd96" /><stop offset=".6" stopColor="#bba466" /><stop offset="1" stopColor="#8c7948" /></linearGradient>
              </defs>
              <g data-calibre="static-plate"><ellipse cx="365" cy="410" rx="225" ry="42" fill="#8d918a" opacity=".12" /><ellipse cx="365" cy="303" rx="220" ry="165" fill={`url(#${id}-silver)`} stroke="#87938d" strokeWidth="4" /><ellipse cx="365" cy="293" rx="207" ry="155" fill="#c8ceca" stroke="#e1e4dc" strokeWidth="3" /></g>
              <g data-calibre="static-barrel" /><g data-calibre="static-train" /><g data-calibre="static-balance" /><g data-calibre="static-bridges" />
            </svg>
          </div>
          <div className="calibre-view-strip"><span>Drag to orbit · wheel / pinch to look closer</span><label htmlFor={`${id}-part`}>Inspect<select id={`${id}-part`} data-calibre="part" defaultValue=""><option value="">Whole movement</option>{PARTS.map(part => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label></div>
          <div className="calibre-part-card" data-calibre="part-card" role="status" aria-live="polite"><h2 data-calibre="part-name">A living anatomy.</h2><p data-calibre="part-text">One recognisable whole, opened into its working parts.</p></div>
          <details className="calibre-access"><summary>Keyboard / view controls</summary><div>
            <button data-orbit="-.18" type="button">Rotate left</button><button data-orbit=".18" type="button">Rotate right</button><button data-zoom="1.15" type="button">Zoom in</button><button data-zoom=".87" type="button">Zoom out</button><button data-calibre="reset" type="button">Reset view</button>
            <label><input data-calibre="labels" type="checkbox" defaultChecked />Part information</label>
          </div></details>
          <p className="calibre-capability" data-calibre="capability" hidden />
        </div>
      </div>
      <p className="calibre-disclaimer">Illustration, not a live Goal Loop run. No agents, project tests or deployments execute.</p>
    </section>
  )
}
