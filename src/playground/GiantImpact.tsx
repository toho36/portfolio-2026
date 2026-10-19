import { useEffect, useRef, useState } from 'react'
import type { GiantImpactOptions, GiantImpactRuntime } from './giantImpact/main.js'

type RuntimeModule = { createGiantImpact: (options: GiantImpactOptions) => GiantImpactRuntime }

// Own one import and one renderer per effect, including StrictMode's canceled first mount.
export function mountGiantImpact(options: GiantImpactOptions, load: () => Promise<RuntimeModule> = () => import('./giantImpact/main.js')) {
  let canceled = false
  let runtime: GiantImpactRuntime | undefined
  void load().then((module) => {
    if (canceled) return
    runtime = module.createGiantImpact(options)
    if (canceled) runtime.dispose()
  }).catch((error: unknown) => { if (!canceled) options.onFailure?.(error) })
  return () => {
    if (canceled) return
    canceled = true
    runtime?.dispose()
  }
}

export function GiantImpact() {
  const stage = useRef<HTMLDivElement>(null)
  const fallback = useRef<SVGSVGElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const pause = useRef<HTMLButtonElement>(null)
  const replay = useRef<HTMLButtonElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!stage.current || !fallback.current || !controls.current || !pause.current || !replay.current) return
    setFailed(false)
    return mountGiantImpact({
      stage: stage.current, fallback: fallback.current, controls: controls.current,
      pause: pause.current, replay: replay.current, onFailure: () => setFailed(true),
    })
  }, [])

  return (
    <article className="giant-impact" aria-label="Giant Impact experiment">
      <div ref={stage} className="giant-impact-stage" aria-label="Stylized Theia impact and Moon formation">
        <svg ref={fallback} className="giant-impact-fallback" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Static final state: blue Earth and a separate Moon in orbit">
          <rect width="1600" height="900" fill="#0b0705" />
          <circle cx="1092" cy="529" r="259" fill="#1f4f86" />
          <path d="M900 470c60-40 120-20 170 10s120 10 160-30M960 600c80 30 160 0 230-40" stroke="#e9eef2" strokeOpacity=".55" strokeWidth="18" fill="none" strokeLinecap="round" />
          <circle cx="753" cy="321" r="45" fill="#9a948c" />
        </svg>
      </div>
      <div ref={controls} className="giant-impact-controls" hidden>
        <button ref={pause} type="button" aria-pressed="false">Pause</button>
        <button ref={replay} type="button">Replay</button>
      </div>
      {failed && <p role="status">Animation unavailable. Showing the static final state.</p>}
      <p className="giant-impact-note">An artistic study of a giant impact and Moon formation. Capture, mass formation and compressed time are artistic choices, not validated scientific physics. Reduced motion shows the final state.</p>
      <p className="giant-impact-credits">
        Earth, Moon and cloud maps © <a className="target-link" href="https://www.solarsystemscope.com/textures/">Solar System Scope / INOVE</a>, <a className="target-link" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Moon and cloud maps resized to 1024 pixels wide and recompressed as JPEG; maps used in a stylized derivative artwork. Rock texture: <a className="target-link" href="https://polyhaven.com/a/rock_face">Rock Face by Poly Haven</a>, <a className="target-link" href="https://polyhaven.com/license">CC0</a>.
      </p>
    </article>
  )
}
