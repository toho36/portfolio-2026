import { useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import {
  MACHINE_STAGES,
  timelineIndex,
  timelineStop,
  toggleLaterStage,
} from './model'

export function Timeline() {
  const trackRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const { progress, mode, scrollToProgress } = useScrollProgress(
    trackRef,
    MACHINE_STAGES.length,
    reducedMotion,
  )
  const [mutated, setMutated] = useState(false)
  const activeIndex = timelineIndex(progress)

  return (
    <section
      id="timeline-track"
      className="scroll-track timeline-track"
      ref={trackRef}
      aria-labelledby="timeline-title"
    >
      <div className="sticky-machine">
        <div className="loop-copy">
          <p className="eyebrow">Loop 3 of 3</p>
          <h2 id="timeline-title">Reversible machine timeline</h2>
          <p id="timeline-instructions">
            Scroll forward and backward to scrub ordered stages. Toggle the later-stage signal; its changed state remains visible at every playhead position.
          </p>
          <p className="state-readout" aria-live="polite">
            Current state: {MACHINE_STAGES[activeIndex]}, stage {activeIndex + 1} of {MACHINE_STAGES.length}; later-stage signal {mutated ? 'changed' : 'unchanged'}; {mode} motion.
          </p>
        </div>

        <ol className="timeline" aria-describedby="timeline-instructions">
          {MACHINE_STAGES.map((stage, index) => {
            const passed = index <= activeIndex
            const mutationStage = index === 2
            return (
              <li
                key={stage}
                className={`${passed ? 'is-passed' : ''}${index === activeIndex ? ' is-current' : ''}${mutationStage && mutated ? ' is-mutated' : ''}`}
                aria-current={index === activeIndex ? 'step' : undefined}
              >
                <span className="stage-number">{index + 1}</span>
                <span>{stage}</span>
                {mutationStage && <strong>Signal: {mutated ? 'changed' : 'unchanged'}</strong>}
              </li>
            )
          })}
        </ol>

        <div className="controls timeline-controls">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => scrollToProgress(timelineStop(activeIndex - 1))}
          >
            Previous stage
          </button>
          <button
            type="button"
            onClick={() => setMutated((current) => toggleLaterStage({ progress, laterStageMutated: current }).laterStageMutated)}
          >
            {mutated ? 'Restore later-stage signal' : 'Change later-stage signal'}
          </button>
          <button
            type="button"
            disabled={activeIndex === MACHINE_STAGES.length - 1}
            onClick={() => scrollToProgress(timelineStop(activeIndex + 1))}
          >
            Next stage
          </button>
        </div>
      </div>
    </section>
  )
}
