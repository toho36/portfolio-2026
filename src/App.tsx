import { CARTRIDGE_IDENTITIES } from './content/cartridges'
import { MachineBoundary } from './machine/MachineBoundary'
import { projectElementId } from './machine/consoleAdapter'
import { useMachineConsole } from './machine/useMachineConsole'

export default function App() {
  const console = useMachineConsole()
  const { state } = console
  const selected = CARTRIDGE_IDENTITIES[state.selectedCartridge]
  const isSkipped = state.pauseCauses.skip
  const isUserPaused = state.pauseCauses.user
  const isSeated = state.assembly.seated

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#machine-console" aria-label="Vitek Machine home">
          <span className="brand-mark" aria-hidden="true">VM</span>
          <span>
            <strong>Vitek Machine</strong>
            <small>Portfolio service console</small>
          </span>
        </a>
        <p className="header-note">Four projects. One mechanical index.</p>
      </header>

      <a
        className="skip-link"
        href="#cartridge-list"
        onClick={console.skipMachine}
        onKeyDown={console.onConsoleKeyDown}
      >
        Skip to projects <span aria-hidden="true">↓</span>
      </a>

      <main>
        <section
          id="machine-console"
          className="service-console"
          aria-labelledby="machine-title"
          tabIndex={-1}
          onKeyDown={console.onConsoleKeyDown}
        >
          <div className="console-heading">
            <div>
              <p className="eyebrow">Workshop unit 01 / online</p>
              <h1 id="machine-title">The Vitek Machine</h1>
            </div>
            <p className="console-intro">
              Select a cartridge, seat it in the machine, or move directly to
              the native project index.
            </p>
          </div>

          <div className="machine-chassis">
            <MachineBoundary
              selectedCartridge={state.selectedCartridge}
              selectedName={selected.name}
              seated={isSeated}
              effectivelyPaused={console.effectivelyPaused}
              reducedMotion={state.reducedMotion}
            />

            <div className="status-ribbon" aria-label="Machine status">
              <div className="status-primary">
                <span className="status-code">{isSeated ? 'LOCKED' : 'READY'}</span>
                <span>
                  <strong>{selected.name}</strong>
                  <small>
                    {isSeated
                      ? 'Cartridge seated'
                      : 'Selected for service'}
                  </small>
                </span>
              </div>
              <div className="status-actions">
                {isSkipped && (
                  <button
                    className="resume-control"
                    type="button"
                    onClick={console.resumeFromSkip}
                  >
                    Resume machine
                  </button>
                )}
                <button
                  className="pause-control"
                  type="button"
                  aria-pressed={isUserPaused}
                  onClick={console.toggleUserPause}
                >
                  {isUserPaused ? 'Resume motion' : 'Pause motion'}
                </button>
              </div>
            </div>

            <div className="cartridge-dock" aria-labelledby="dock-title">
              <div className="dock-label">
                <p className="eyebrow">Physical project rail</p>
                <h2 id="dock-title">Cartridge dock</h2>
                <p>Choose one of four modules.</p>
              </div>

              <div className="cartridge-slots">
                {CARTRIDGE_IDENTITIES.map((cartridge) => {
                  const isSelected = cartridge.index === state.selectedCartridge
                  return (
                    <button
                      className="cartridge-selector"
                      type="button"
                      key={cartridge.slug}
                      aria-pressed={isSelected}
                      onClick={() => console.selectCartridge(cartridge.index)}
                    >
                      <span className="cartridge-number" aria-hidden="true">
                        {String(cartridge.index + 1).padStart(2, '0')}
                      </span>
                      <span className="cartridge-name">{cartridge.name}</span>
                      <span className="cartridge-contact" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>

              <button
                id="cartridge-handle"
                className={`seat-control${isSeated ? ' is-seated' : ''}`}
                type="button"
                data-machine-key-zone="cartridge-handle"
                aria-pressed={isSeated}
                aria-describedby="handle-help"
                onClick={console.activateModule}
              >
                <span className="handle-grip" aria-hidden="true" />
                <span>
                  <strong>{isSeated ? 'Eject' : 'Seat'}</strong>
                  <small>{selected.name}</small>
                </span>
              </button>
              <p id="handle-help" className="handle-help">
                Handle: arrow keys position; Enter or Space operates. Escape
                exits to projects.
              </p>
            </div>
          </div>

          <section
            id="cartridge-list"
            className="project-register"
            aria-labelledby="project-register-title"
            tabIndex={-1}
          >
            <div className="register-heading">
              <p className="eyebrow">Native access / always available</p>
              <h2 id="project-register-title">Project cartridges</h2>
              <p>Standard links remain available in every machine state.</p>
            </div>

            <div className="project-list">
              {CARTRIDGE_IDENTITIES.map((cartridge) => (
                <article
                  id={projectElementId(cartridge.index)}
                  className="project-entry"
                  key={cartridge.slug}
                  tabIndex={-1}
                >
                  <span className="project-index" aria-hidden="true">
                    {String(cartridge.index + 1).padStart(2, '0')}
                  </span>
                  <h3>{cartridge.name}</h3>
                  <a
                    href={cartridge.hash}
                    onClick={() => console.openProject(cartridge.index)}
                  >
                    Open project entry <span aria-hidden="true">↗</span>
                  </a>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>

      <footer>
        <span>Vitek Machine / service console</span>
        <a href="#machine-console">Return to machine</a>
      </footer>
    </>
  )
}
