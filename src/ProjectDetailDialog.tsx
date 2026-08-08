import {
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react'
import {
  CARTRIDGE_STORIES,
  type CartridgeIdentity,
  type CartridgeSlug,
} from './content/cartridges'
import type { ProjectDiscoveryState } from './content/projectDiscovery'
import { gsap } from './motion/gsap'

export interface DetailActivation {
  readonly identity: CartridgeIdentity
  readonly sequence: number
}

interface ProjectDetailDialogProps {
  readonly dialogRef: RefObject<HTMLDialogElement | null>
  readonly activeDetail: DetailActivation | null
  readonly discovery: ProjectDiscoveryState
  readonly reducedMotion: boolean
  readonly onClose: () => void
}

function DiscoveryMechanism({
  slug,
  label,
  reward,
}: {
  readonly slug: CartridgeSlug
  readonly label: string
  readonly reward: string
}) {
  const accessibleLabel = `${label}: ${reward}`

  if (slug === 'gameonvb') {
    return (
      <div
        className="discovery-mechanism event-dial"
        role="img"
        aria-label={accessibleLabel}
      >
        <span className="dial-ring" aria-hidden="true">
          <i />
        </span>
        <span className="mechanism-track" aria-hidden="true" />
      </div>
    )
  }

  if (slug === 'suburbs') {
    return (
      <div
        className="discovery-mechanism deck-flip"
        role="img"
        aria-label={accessibleLabel}
      >
        <span className="deck-surface" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    )
  }

  if (slug === 'screen-switch') {
    return (
      <div
        className="discovery-mechanism display-swap"
        role="img"
        aria-label={accessibleLabel}
      >
        <span className="display-plate display-plate-a" aria-hidden="true" />
        <span className="display-plate display-plate-b" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div
      className="discovery-mechanism ledger-gate"
      role="img"
      aria-label={accessibleLabel}
    >
      <span className="ledger-token" aria-hidden="true" />
      <span className="gate-rails" aria-hidden="true">
        <i />
        <i />
      </span>
    </div>
  )
}

export function ProjectDetailDialog({
  dialogRef,
  activeDetail,
  discovery,
  reducedMotion,
  onClose,
}: ProjectDetailDialogProps) {
  const detailRootRef = useRef<HTMLDivElement | null>(null)
  const activeStory = activeDetail
    ? CARTRIDGE_STORIES[activeDetail.identity.slug]
    : null

  useLayoutEffect(() => {
    const detailRoot = detailRootRef.current
    if (!detailRoot || !activeDetail) return

    let timeline: ReturnType<typeof gsap.timeline> | null = null
    const context = gsap.context(() => {
      const completionTarget = discovery.completion
        ? '.circuit-complete'
        : null

      if (reducedMotion) {
        if (activeDetail.identity.slug === 'gameonvb') {
          gsap.set('.dial-ring', { rotate: 0 })
        } else if (activeDetail.identity.slug === 'suburbs') {
          gsap.set('.deck-surface', { rotateX: 0 })
        } else if (activeDetail.identity.slug === 'screen-switch') {
          gsap.set('.display-plate-a, .display-plate-b', { x: 0 })
        } else {
          gsap.set('.ledger-token', { x: 0 })
        }

        if (completionTarget) {
          gsap.set(completionTarget, { y: 0, letterSpacing: '0.1em' })
        }
        return
      }

      timeline = gsap.timeline({ defaults: { ease: 'power2.out' } })

      if (activeDetail.identity.slug === 'gameonvb') {
        timeline.fromTo(
          '.dial-ring',
          { rotate: -115 },
          { rotate: 0, duration: 0.42 },
          0,
        )
      } else if (activeDetail.identity.slug === 'suburbs') {
        timeline.fromTo(
          '.deck-surface',
          { rotateX: 78 },
          { rotateX: 0, duration: 0.48 },
          0,
        )
      } else if (activeDetail.identity.slug === 'screen-switch') {
        timeline.fromTo(
          '.display-plate-a',
          { x: 'calc(100% + clamp(0.75rem, 7vw, 3rem))' },
          { x: 0, duration: 0.44 },
          0,
        )
        timeline.fromTo(
          '.display-plate-b',
          { x: 'calc(-100% - clamp(0.75rem, 7vw, 3rem))' },
          { x: 0, duration: 0.44 },
          0,
        )
      } else {
        timeline.fromTo(
          '.ledger-token',
          { x: '-12rem' },
          { x: 0, duration: 0.46 },
          0,
        )
      }

      if (completionTarget) {
        timeline.fromTo(
          completionTarget,
          { y: '0.2rem', letterSpacing: '0.14em' },
          { y: 0, letterSpacing: '0.1em', duration: 0.42 },
          0,
        )
      }
    }, detailRoot)

    return () => {
      timeline?.kill()
      context.revert()
    }
  }, [activeDetail?.sequence, reducedMotion])

  return (
    <dialog
      ref={dialogRef}
      className="project-dialog"
      aria-labelledby="project-detail-title"
      onClose={onClose}
    >
      {activeDetail && activeStory && (
        <div
          ref={detailRootRef}
          className="project-detail"
          data-project={activeDetail.identity.slug}
          key={activeDetail.sequence}
        >
          <header className="project-detail-header">
            <div>
              <p className="eyebrow">Cartridge discovery</p>
              <h2 id="project-detail-title" tabIndex={-1}>
                {activeDetail.identity.name}
              </h2>
            </div>
            <form method="dialog">
              <button className="dialog-close" type="submit">
                Close detail <span aria-hidden="true">×</span>
              </button>
            </form>
          </header>

          <p className="project-detail-preview">{activeStory.preview}</p>

          <DiscoveryMechanism
            slug={activeDetail.identity.slug}
            label={activeStory.discovery.label}
            reward={activeStory.discovery.immediateReward}
          />
          <p className="discovery-readout" role="status">
            <strong>
              {discovery.latest?.kind === 'replay' ? 'Replay' : 'Discovery'}
            </strong>
            <span>{activeStory.discovery.label}</span>
            <span>{activeStory.discovery.immediateReward}</span>
          </p>

          <dl className="project-story">
            <div>
              <dt>Role</dt>
              <dd>{activeStory.role}</dd>
            </div>
            <div>
              <dt>Constraint</dt>
              <dd>{activeStory.constraint}</dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>{activeStory.decision}</dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>{activeStory.evidence}</dd>
            </div>
          </dl>

          <div className="project-detail-footer">
            {activeStory.verifiedUrl && (
              <a href={activeStory.verifiedUrl}>
                Visit verified project <span aria-hidden="true">↗</span>
              </a>
            )}
            {discovery.completion && (
              <p className="circuit-complete" role="status">
                {discovery.completion}
              </p>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
