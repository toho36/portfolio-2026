import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { deriveRendererPresentation, type RendererPhase } from './consoleAdapter'
import type { CartridgeIndex } from '../content/cartridges'

class MachineModuleLoadError extends Error {
  constructor(cause: unknown) {
    super('The machine preview module could not be loaded', { cause })
    this.name = 'MachineModuleLoadError'
  }
}

const MachineCanvas = lazy(async () => {
  try {
    return await import('./MachineCanvas')
  } catch (error) {
    throw new MachineModuleLoadError(error)
  }
})

interface ErrorBoundaryProps {
  readonly children: ReactNode
  readonly onFailure: (phase: 'lazy-error' | 'render-error') => void
}

interface ErrorBoundaryState {
  readonly failed: boolean
}

class MachineErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onFailure(
      error instanceof MachineModuleLoadError ? 'lazy-error' : 'render-error',
    )
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export interface MachineBoundaryProps {
  readonly selectedCartridge: CartridgeIndex
  readonly selectedName: string
  readonly seated: boolean
  readonly effectivelyPaused: boolean
  readonly reducedMotion: boolean
}

export function MachineBoundary({
  selectedCartridge,
  selectedName,
  seated,
  effectivelyPaused,
  reducedMotion,
}: MachineBoundaryProps) {
  const [phase, setPhase] = useState<RendererPhase>('checking')

  useEffect(() => {
    setPhase(supportsWebGL() ? 'loading' : 'no-webgl')
  }, [])

  const handleRendererReady = useCallback(() => {
    setPhase((currentPhase) =>
      currentPhase === 'loading' ? 'ready' : currentPhase,
    )
  }, [])
  const handleRendererFailure = useCallback(() => {
    setPhase('render-error')
  }, [])

  const presentation = deriveRendererPresentation(
    phase,
    effectivelyPaused,
    reducedMotion,
  )
  const showCanvas =
    phase !== 'checking' &&
    phase !== 'no-webgl' &&
    phase !== 'lazy-error' &&
    phase !== 'render-error'

  return (
    <div className="machine-viewport" data-renderer-phase={phase}>
      <div className="viewport-fasteners" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="viewport-screen">
        <img
          className="machine-poster"
          src="/assets/machine/machine-fallback.webp"
          alt="Vitek Machine workshop preview"
        />
        {showCanvas && (
          <div className="machine-canvas-layer" aria-hidden="true">
            <MachineErrorBoundary onFailure={setPhase}>
              <Suspense fallback={null}>
                <MachineCanvas
                  selectedCartridge={selectedCartridge}
                  seated={seated}
                  paused={effectivelyPaused}
                  reducedMotion={reducedMotion}
                  onReady={handleRendererReady}
                  onFailure={handleRendererFailure}
                />
              </Suspense>
            </MachineErrorBoundary>
          </div>
        )}

        <div className="viewport-identity" aria-hidden="true">
          <span>{String(selectedCartridge + 1).padStart(2, '0')}</span>
          <strong>{selectedName}</strong>
        </div>
      </div>

      <div
        className={`renderer-readout is-${presentation.tone}`}
        role="status"
        aria-live="polite"
      >
        <span className="status-lamp" aria-hidden="true" />
        <span>
          <strong>{presentation.label}</strong>
          <small>{presentation.detail}</small>
        </span>
      </div>
    </div>
  )
}
