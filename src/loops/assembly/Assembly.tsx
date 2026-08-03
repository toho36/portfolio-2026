import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  initialAssemblyState,
  moveModule,
  nudgeModule,
  releaseModule,
  seatModule,
  type Point,
} from './model'

const KEY_MOVES: Partial<Record<string, Point>> = {
  ArrowLeft: { x: -0.1, y: 0 },
  ArrowRight: { x: 0.1, y: 0 },
  ArrowUp: { x: 0, y: -0.1 },
  ArrowDown: { x: 0, y: 0.1 },
}

export function Assembly() {
  const benchRef = useRef<HTMLDivElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const [state, setState] = useState(initialAssemblyState)
  const [dragging, setDragging] = useState(false)

  const pointFromPointer = (event: PointerEvent): Point | null => {
    const rect = benchRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    }
  }

  const finishPointer = (event: PointerEvent<HTMLDivElement>, snap: boolean) => {
    if (activePointerRef.current !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activePointerRef.current = null
    setDragging(false)
    if (snap) setState((current) => releaseModule(current))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const movement = KEY_MOVES[event.key]
    if (movement) {
      event.preventDefault()
      setState((current) => nudgeModule(current, movement.x, movement.y))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setState(seatModule)
    }
  }

  return (
    <section id="assembly-loop" className="assembly-loop" aria-labelledby="assembly-title">
      <div className="loop-copy">
        <p className="eyebrow">Loop 2 of 3</p>
        <h2 id="assembly-title">Assembly bench</h2>
        <p id="assembly-instructions">
          Drag the module toward the outlined slot and release to snap. Or focus it and use arrow keys to move; Enter, Space, or the action button seats and ejects.
        </p>
        <p className="state-readout" aria-live="polite">
          Current state: {state.seated ? 'seated in slot' : `unseated at x ${Math.round(state.x * 100)}, y ${Math.round(state.y * 100)}`}.
        </p>
      </div>

      <div className="bench" ref={benchRef} aria-describedby="assembly-instructions">
        <div className="bench-slot"><span>Slot</span></div>
        <div
          className={`draggable-module${state.seated ? ' is-seated' : ''}${dragging ? ' is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`${state.seated ? 'Seated' : 'Movable'} module. Use arrow keys to move; Enter or Space to ${state.seated ? 'eject' : 'seat'}.`}
          style={{ left: `${state.x * 100}%`, top: `${state.y * 100}%` }}
          onKeyDown={handleKeyDown}
          onPointerDown={(event) => {
            if (state.seated) return
            event.currentTarget.setPointerCapture(event.pointerId)
            activePointerRef.current = event.pointerId
            setDragging(true)
            const point = pointFromPointer(event)
            if (point) setState((current) => moveModule(current, point))
          }}
          onPointerMove={(event) => {
            if (activePointerRef.current !== event.pointerId) return
            const point = pointFromPointer(event)
            if (point) setState((current) => moveModule(current, point))
          }}
          onPointerUp={(event) => finishPointer(event, true)}
          onPointerCancel={(event) => finishPointer(event, false)}
        >
          <span>Module</span>
        </div>
      </div>

      <div className="controls">
        <button type="button" onClick={() => setState(seatModule)}>
          {state.seated ? 'Eject module' : 'Seat module'}
        </button>
      </div>
    </section>
  )
}
