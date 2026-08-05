import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'

const MachineCanvas = lazy(() => import('./MachineCanvas'))

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

class MachineErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.failed) {
      return <p role="status">3D preview unavailable. Portfolio content remains available below.</p>
    }
    return this.props.children
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

export function MachineBoundary() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(true)

  useEffect(() => setSupported(supportsWebGL()), [])

  return (
    <section className="machine-foundation" aria-labelledby="machine-foundation-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Renderer foundation</p>
          <h2 id="machine-foundation-title">Machine bay</h2>
        </div>
        {supported && (
          <button type="button" onClick={() => setMounted((value) => !value)}>
            {mounted ? 'Hide 3D preview' : 'Show 3D preview'}
          </button>
        )}
      </div>

      <div className={`machine-canvas-shell${supported === false || (supported && !mounted) ? ' is-compact' : ''}`}>
        {supported === null && <p role="status">Checking 3D support…</p>}
        {supported === false && <p role="status">3D preview unavailable. Portfolio content remains available below.</p>}
        {supported && !mounted && <p role="status">3D preview paused.</p>}
        {supported && mounted && (
          <MachineErrorBoundary>
            <Suspense fallback={<p role="status">Loading 3D preview…</p>}>
              <MachineCanvas />
            </Suspense>
          </MachineErrorBoundary>
        )}
      </div>
      <p className="foundation-note">Procedural renderer handshake only. Final machine geometry comes next.</p>
    </section>
  )
}
