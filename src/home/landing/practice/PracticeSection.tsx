import { useEffect, useRef } from 'react'
import type { PracticeProps } from '../shared/types'
import { mountGateReveal } from './gateReveal'
import './practice.css'

export function PracticeSection({ introduction, gates, coordinator }: PracticeProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!sectionRef.current || !railRef.current) return
    return mountGateReveal(sectionRef.current, railRef.current, coordinator)
  }, [coordinator])

  return <section className="landing-approach landing-section landing-practice" id="approach" aria-labelledby="landing-approach-title" ref={sectionRef}>
    <div className="landing-section-heading"><h2 id="landing-approach-title"><span className="landing-section-number">02</span>How I work</h2><a className="target-link" href="/goal-loop">Goal Loop <span aria-hidden="true">↗</span></a></div>
    <p>{introduction}</p>
    <div className="landing-practice-gates">
      <span className="landing-practice-rail" aria-hidden="true"><span ref={railRef} /></span>
      <ol aria-label="Goal Loop verification gates">{gates.map((gate, index) => <li key={gate.id}><span className="landing-kicker" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="landing-practice-gate-label">{gate.label}</span>{gate.evidence && <span className="landing-practice-evidence">{gate.evidence}</span>}</li>)}</ol>
    </div>
  </section>
}
