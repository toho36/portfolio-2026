import { useEffect, useRef } from 'react'
import { BALL_FLIGHT, sampleBallFlight } from './ballFlight'

export function VolleyballMotion() {
  const rootRef = useRef<HTMLElement>(null)
  const positionRef = useRef<SVGGElement>(null)
  const spinRef = useRef<SVGGElement>(null)
  const impactRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const position = positionRef.current
    const spin = spinRef.current
    const impact = impactRef.current
    if (!root || !position || !spin || !impact) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let running = false
    let visible = true
    let startedAt = performance.now()

    const render = (elapsedMs: number) => {
      const sample = sampleBallFlight(elapsedMs)
      position.setAttribute('transform', `translate(${sample.x} ${sample.y})`)
      spin.setAttribute('transform', `rotate(${sample.rotation})`)
      impact.setAttribute('opacity', String(sample.impact))
      impact.setAttribute('r', String(30 + 26 * (1 - sample.impact)))
    }

    const stop = () => {
      cancelAnimationFrame(frame)
      running = false
    }

    const tick = (now: number) => {
      render(now - startedAt)
      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      if (running || !visible || media.matches) return
      running = true
      startedAt = performance.now()
      frame = requestAnimationFrame(tick)
    }

    const applyMotionPreference = () => {
      stop()
      render(media.matches ? BALL_FLIGHT.flightMs / 2 : 0)
      start()
    }

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true
            if (visible) start()
            else stop()
          })

    observer?.observe(root)
    media.addEventListener('change', applyMotionPreference)
    applyMotionPreference()

    return () => {
      stop()
      observer?.disconnect()
      media.removeEventListener('change', applyMotionPreference)
    }
  }, [])

  return (
    <figure
      ref={rootRef}
      className="court-hero-graphic volleyball-motion"
      aria-hidden="true"
    >
      <svg viewBox="0 0 640 500" role="presentation">
        <path className="volleyball-court" d="M32 424H608" />
        <path className="volleyball-flight-guide" d="M72 410Q320 -186 568 424" />
        <g className="volleyball-net">
          <path d="M320 424V204" />
          <path d="M308 424H332M300 204H340" />
          <path d="M300 224H340M300 244H340M300 264H340M300 284H340M300 304H340M300 324H340M300 344H340M300 364H340M300 384H340M300 404H340" />
        </g>
        <circle
          ref={impactRef}
          className="volleyball-impact"
          cx="568"
          cy="424"
          r="56"
          opacity="0"
        />
        <g ref={positionRef} className="volleyball-position" transform="translate(320 114)">
          <g ref={spinRef} className="volleyball-spin">
            <circle className="volleyball-ball" r="32" />
            <path className="volleyball-seam" d="M-30 -5C-12 -2 1 10 5 30" />
            <path className="volleyball-seam" d="M4 -31C7 -12 18 0 31 4" />
            <path className="volleyball-seam" d="M-4 31C-7 12 -18 0 -31 -4" />
          </g>
        </g>
      </svg>
    </figure>
  )
}
