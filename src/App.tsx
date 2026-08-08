import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import {
  CARTRIDGE_IDENTITIES,
  CARTRIDGE_STORIES,
  cartridgeByHash,
  type CartridgeIdentity,
} from './content/cartridges'
import {
  createProjectDiscovery,
  visitProject,
} from './content/projectDiscovery'
import { MachineBoundary } from './machine/MachineBoundary'
import { projectElementId } from './machine/consoleAdapter'
import { useMachineConsole } from './machine/useMachineConsole'
import {
  ProjectDetailDialog,
  type DetailActivation,
} from './ProjectDetailDialog'

interface PendingOrigin {
  readonly fromHash: string
  readonly hash: string
  readonly link: HTMLAnchorElement
}

interface DetailSyncRequest {
  readonly hash: string
  readonly origin: HTMLAnchorElement | null
}

function hashFromUrl(url: string): string {
  return new URL(url).hash
}

function isOrdinaryActivation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (!event.currentTarget.target || event.currentTarget.target === '_self')
  )
}

export default function App() {
  const console = useMachineConsole()
  const { state } = console
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const detailFrameRef = useRef<number | null>(null)
  const detailSyncQueueRef = useRef<DetailSyncRequest[]>([])
  const focusFrameRef = useRef<number | null>(null)
  const sequenceRef = useRef(0)
  const activeDetailRef = useRef<DetailActivation | null>(null)
  const originRef = useRef<HTMLAnchorElement | null>(null)
  const pendingOriginRef = useRef<PendingOrigin[]>([])
  const hashCloseIntentRef = useRef(false)
  const hashCloseEventRef = useRef(false)
  const [activeDetail, setActiveDetail] = useState<DetailActivation | null>(null)
  const [discovery, setDiscovery] = useState(createProjectDiscovery)
  const selected = CARTRIDGE_IDENTITIES[state.selectedCartridge]
  const isSkipped = state.pauseCauses.skip
  const isUserPaused = state.pauseCauses.user
  const isSeated = state.assembly.seated

  activeDetailRef.current = activeDetail

  const cancelFocusReturn = useCallback(() => {
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current)
      focusFrameRef.current = null
    }
  }, [])

  const scheduleHashDestinationFocus = useCallback(() => {
    cancelFocusReturn()
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null
      const encodedId = window.location.hash.slice(1)
      let target: HTMLElement | null = null

      if (encodedId) {
        try {
          target = document.getElementById(decodeURIComponent(encodedId))
        } catch {
          target = document.getElementById(encodedId)
        }
      }

      if (target) {
        target.focus({ preventScroll: true })
      }
      if (
        document.activeElement !== target &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur()
      }
    })
  }, [cancelFocusReturn])

  const scheduleDetailSync = useCallback(
    (hash: string, origin: HTMLAnchorElement | null) => {
      detailSyncQueueRef.current.push({ hash, origin })
      cancelFocusReturn()

      if (detailFrameRef.current !== null) return

      detailFrameRef.current = window.requestAnimationFrame(() => {
        detailFrameRef.current = null
        const requests = detailSyncQueueRef.current.splice(0)
        let nextDetail: DetailActivation | null = null
        let nextOrigin: HTMLAnchorElement | null = null

        setDiscovery((current) =>
          requests.reduce((nextDiscovery, request) => {
            const identity = cartridgeByHash(request.hash)
            return identity
              ? visitProject(nextDiscovery, identity.slug)
              : nextDiscovery
          }, current),
        )

        for (const request of requests) {
          const identity = cartridgeByHash(request.hash)

          if (!identity) {
            nextDetail = null
            nextOrigin = null
            continue
          }

          sequenceRef.current += 1
          nextDetail = { identity, sequence: sequenceRef.current }
          nextOrigin = request.origin?.isConnected
            ? request.origin
            : document.querySelector<HTMLAnchorElement>(
                `.project-entry a[href="${identity.hash}"]`,
              )
        }

        hashCloseIntentRef.current = nextDetail === null
        originRef.current = nextOrigin
        setActiveDetail(nextDetail)
      })
    },
    [cancelFocusReturn],
  )

  useLayoutEffect(() => {
    scheduleDetailSync(window.location.hash, null)

    const onHashChange = (event: HashChangeEvent) => {
      const fromHash = hashFromUrl(event.oldURL)
      const hash = hashFromUrl(event.newURL)
      const pendingOriginIndex = pendingOriginRef.current.findIndex(
        (pending) =>
          pending.fromHash === fromHash && pending.hash === hash,
      )
      const pendingOrigin =
        pendingOriginIndex >= 0
          ? pendingOriginRef.current[pendingOriginIndex]
          : null
      pendingOriginRef.current = pendingOriginRef.current.filter(
        (pending, index) =>
          index !== pendingOriginIndex && pending.fromHash !== fromHash,
      )

      if (!cartridgeByHash(hash)) {
        originRef.current = null
        if (dialogRef.current?.open) hashCloseIntentRef.current = true
      } else {
        hashCloseIntentRef.current = false
      }
      scheduleDetailSync(hash, pendingOrigin?.link ?? null)
    }
    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener('hashchange', onHashChange)
      if (detailFrameRef.current !== null) {
        window.cancelAnimationFrame(detailFrameRef.current)
        detailFrameRef.current = null
      }
      detailSyncQueueRef.current = []
      pendingOriginRef.current = []
      cancelFocusReturn()
    }
  }, [cancelFocusReturn, scheduleDetailSync])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!activeDetail) {
      if (dialog.open) {
        hashCloseIntentRef.current = false
        hashCloseEventRef.current = true
        dialog.close()
        scheduleHashDestinationFocus()
      }
      return
    }

    if (!dialog.open) dialog.showModal()
    document.getElementById('project-detail-title')?.focus({
      preventScroll: true,
    })
  }, [activeDetail, scheduleHashDestinationFocus])

  const openProjectDetail = useCallback(
    (
      cartridge: CartridgeIdentity,
      event: MouseEvent<HTMLAnchorElement>,
    ) => {
      console.openProject(cartridge.index, event)
      if (!isOrdinaryActivation(event)) return

      const link = event.currentTarget
      if (window.location.hash === cartridge.hash) {
        scheduleDetailSync(cartridge.hash, link)
      } else {
        pendingOriginRef.current.push({
          fromHash: window.location.hash,
          hash: cartridge.hash,
          link,
        })
      }
    },
    [console, scheduleDetailSync],
  )

  const onDetailClose = useCallback(() => {
    if (hashCloseIntentRef.current || hashCloseEventRef.current) {
      hashCloseIntentRef.current = false
      hashCloseEventRef.current = false
      return
    }

    const closedDetail = activeDetailRef.current
    const origin = originRef.current
    originRef.current = null
    activeDetailRef.current = null
    setActiveDetail(null)

    if (
      closedDetail &&
      window.location.hash === closedDetail.identity.hash
    ) {
      window.history.replaceState(
        window.history.state,
        '',
        '#cartridge-list',
      )
    }

    if (origin?.isConnected) {
      cancelFocusReturn()
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = null
        origin.focus({ preventScroll: true })
      })
    }
  }, [cancelFocusReturn])

  return (
    <>
      <a
        className="skip-link"
        href="#cartridge-list"
        onClick={console.skipMachine}
        onKeyDown={console.onConsoleKeyDown}
      >
        Skip to projects <span aria-hidden="true">↓</span>
      </a>

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

      <main>
        <section
          ref={console.runwayRef}
          id="machine-console"
          className="service-console presentation-runway"
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
              assembly={state.assembly}
              onManipulationOutcome={console.onManipulationOutcome}
              effectivelyPaused={console.effectivelyPaused}
              reducedMotion={state.reducedMotion}
              presentationBridge={console.presentationBridge}
            />

            <section className="status-ribbon" aria-label="Machine status">
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
                <button
                  className="pause-control"
                  type="button"
                  disabled={state.stageIntent === 0}
                  onClick={console.previousStage}
                >
                  Previous stage
                </button>
                <button
                  className="pause-control"
                  type="button"
                  disabled={state.stageIntent === 3}
                  onClick={console.nextStage}
                >
                  Next stage
                </button>
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
            </section>

            <section className="cartridge-dock" aria-labelledby="dock-title">
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
            </section>
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
              <ul
                className="operation-cues"
                aria-label="Project entry operation"
              >
                <li>
                  <strong>Desktop</strong><span>Select entry</span>
                </li>
                <li>
                  <strong>Touch</strong><span>Tap entry</span>
                </li>
                <li>
                  <strong>Keyboard</strong><span>Tab + Enter</span>
                </li>
              </ul>
            </div>

            <div className="project-list">
              {CARTRIDGE_IDENTITIES.map((cartridge) => {
                const story = CARTRIDGE_STORIES[cartridge.slug]
                return (
                  <article
                    id={projectElementId(cartridge.index)}
                    className="project-entry"
                    key={cartridge.slug}
                    tabIndex={-1}
                  >
                    <span className="project-index" aria-hidden="true">
                      {String(cartridge.index + 1).padStart(2, '0')}
                    </span>
                    <div className="project-summary">
                      <h3>{cartridge.name}</h3>
                      <p>{story.preview}</p>
                    </div>
                    <a
                      href={cartridge.hash}
                      onClick={(event) =>
                        openProjectDetail(cartridge, event)
                      }
                    >
                      Open project entry <span aria-hidden="true">↗</span>
                    </a>
                  </article>
                )
              })}
            </div>
          </section>
        </section>
      </main>

      <ProjectDetailDialog
        dialogRef={dialogRef}
        activeDetail={activeDetail}
        discovery={discovery}
        reducedMotion={state.reducedMotion}
        onClose={onDetailClose}
      />

      <footer>
        <span>Hoang Viet To / frontend &amp; full-stack developer</span>
        <nav aria-label="Contact and CV">
          <a href="mailto:tohoangviet1998@gmail.com">Email</a>
          <a href="https://github.com/toho36">GitHub</a>
          <a href="https://www.linkedin.com/in/hoangvietto/">LinkedIn</a>
          <a href="/hoang-viet-to-cv-en.docx" download>CV EN</a>
          <a href="/hoang-viet-to-cv-cz.docx" download>CV CZ</a>
        </nav>
        <a href="#machine-console">Return to machine</a>
      </footer>
    </>
  )
}
