import { useRef } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { CARTRIDGES, conveyorIndex, conveyorStop } from './model'

export function Conveyor() {
  const trackRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const { progress, mode, scrollToProgress } = useScrollProgress(
    trackRef,
    CARTRIDGES.length,
    reducedMotion,
  )
  const activeIndex = conveyorIndex(progress)

  return (
    <section
      id="conveyor-track"
      className="scroll-track conveyor-track"
      ref={trackRef}
      aria-labelledby="conveyor-title"
    >
      <div className="sticky-machine">
        <div className="loop-copy">
          <p className="eyebrow">Loop 1 of 3</p>
          <h2 id="conveyor-title">Conveyor / rewind instrument</h2>
          <p id="conveyor-instructions">
            Scroll forward to advance cartridges; reverse scroll rewinds the same mechanism. Previous and next move to the same exact track stops.
          </p>
          <p className="state-readout" aria-live="polite">
            Current state: {CARTRIDGES[activeIndex]}, stop {activeIndex + 1} of {CARTRIDGES.length}; {mode} motion.
          </p>
        </div>

        <div className="machine-window" aria-describedby="conveyor-instructions">
          <div className="machine-slot" aria-hidden="true" />
          <div className="conveyor-belt">
            {CARTRIDGES.map((name, index) => (
              <div
                className={`cartridge conveyor-cartridge${index === activeIndex ? ' is-active' : ''}`}
                key={name}
                style={{ transform: `translateX(${(index - progress * (CARTRIDGES.length - 1)) * 125}%)` }}
              >
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="controls" aria-label="Conveyor stops">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => scrollToProgress(conveyorStop(activeIndex - 1))}
          >
            Previous cartridge
          </button>
          <button
            type="button"
            disabled={activeIndex === CARTRIDGES.length - 1}
            onClick={() => scrollToProgress(conveyorStop(activeIndex + 1))}
          >
            Next cartridge
          </button>
        </div>
      </div>
    </section>
  )
}
