import { useState } from 'react'
import { Assembly } from './loops/assembly/Assembly'
import { Conveyor } from './loops/conveyor/Conveyor'
import { CARTRIDGES } from './loops/conveyor/model'
import { Timeline } from './loops/timeline/Timeline'

type LoopName = 'conveyor' | 'assembly' | 'timeline'

const LOOP_LABELS: Record<LoopName, string> = {
  conveyor: 'Conveyor / rewind',
  assembly: 'Assembly bench',
  timeline: 'Machine timeline',
}

export default function App() {
  const [selectedLoop, setSelectedLoop] = useState<LoopName>('conveyor')

  const selectLoop = (loop: LoopName) => {
    setSelectedLoop(loop)
    requestAnimationFrame(() => {
      const targetId = loop === 'assembly' ? 'assembly-loop' : `${loop}-track`
      document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }

  return (
    <>
      <header className="site-header">
        <div>
          <p className="eyebrow">Disposable interaction lab</p>
          <h1>The Vitek Machine</h1>
          <p className="lede">A portfolio operated through four placeholder cartridges.</p>
        </div>
        <a className="skip-link" href="#cartridge-list">Skip mechanism; browse cartridges</a>
      </header>

      <main>
        <section id="cartridge-list" className="cartridge-register" aria-labelledby="cartridge-title">
          <div>
            <p className="eyebrow">Cartridge register</p>
            <h2 id="cartridge-title">Four cartridges</h2>
          </div>
          <ul>
            {CARTRIDGES.map((name) => (
              <li key={name}><span className="register-shape" aria-hidden="true" />{name}</li>
            ))}
          </ul>
        </section>

        <nav className="loop-switcher" aria-label="Choose interaction loop">
          <p>Choose one operable loop. Switching aligns the selected loop to its start.</p>
          <div className="controls">
            {(Object.keys(LOOP_LABELS) as LoopName[]).map((loop) => (
              <button
                type="button"
                key={loop}
                aria-pressed={selectedLoop === loop}
                onClick={() => selectLoop(loop)}
              >
                {LOOP_LABELS[loop]}
              </button>
            ))}
          </div>
        </nav>

        {selectedLoop === 'conveyor' && <Conveyor />}
        {selectedLoop === 'assembly' && <Assembly />}
        {selectedLoop === 'timeline' && <Timeline />}
      </main>

      <footer>
        <p>Prototype comparison only. Playtest results: PENDING. Winner: PENDING.</p>
      </footer>
    </>
  )
}
