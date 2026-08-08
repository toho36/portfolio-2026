import { Canvas } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useRef } from 'react'
import {
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three'
import { gsap } from '../motion/gsap'
import type { CartridgeIndex } from '../content/cartridges'

const CARTRIDGE_SIGNALS = ['#ff5a1f', '#42e8ff', '#d8d1c4', '#ff7a45'] as const

interface RendererHandshakeProps {
  readonly selectedCartridge: CartridgeIndex
  readonly seated: boolean
}

function RendererHandshake({
  selectedCartridge,
  seated,
}: RendererHandshakeProps) {
  useLayoutEffect(() => {
    const context = gsap.context(() => {})
    return () => context.revert()
  }, [])

  return (
    <group rotation={[0.18, -0.35, 0]}>
      <mesh position={[0, -0.85, 0]}>
        <boxGeometry args={[4.8, 0.45, 2.4]} />
        <meshStandardMaterial color="#242730" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.8, 1.4, 1.8]} />
        <meshStandardMaterial color="#d8d1c4" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 0.95]}>
        <boxGeometry args={[1.25, 0.8, 0.15]} />
        <meshStandardMaterial color="#0a0b0f" />
      </mesh>
      <mesh position={[0, 0.05, 1.06]}>
        <boxGeometry args={[0.72, 0.46, 0.08]} />
        <meshStandardMaterial
          color={CARTRIDGE_SIGNALS[selectedCartridge]}
          emissive={CARTRIDGE_SIGNALS[selectedCartridge]}
          emissiveIntensity={seated ? 0.5 : 0.18}
        />
      </mesh>
      <mesh position={[2.05, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.35, 24]} />
        <meshStandardMaterial color="#42e8ff" metalness={0.55} roughness={0.25} />
      </mesh>
    </group>
  )
}

export interface MachineCanvasProps {
  readonly selectedCartridge: CartridgeIndex
  readonly seated: boolean
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly onReady: () => void
  readonly onFailure: () => void
}

type RendererDefaults = Omit<WebGLRendererParameters, 'canvas'> & {
  readonly canvas: NonNullable<WebGLRendererParameters['canvas']>
}

export default function MachineCanvas({
  selectedCartridge,
  seated,
  paused,
  reducedMotion,
  onReady,
  onFailure,
}: MachineCanvasProps) {
  const removeContextListeners = useRef<() => void>(() => {})

  useLayoutEffect(
    () => () => {
      removeContextListeners.current()
    },
    [],
  )

  const createRenderer = useCallback(
    (defaults: RendererDefaults) => {
      const { canvas, ...rendererOptions } = defaults
      const htmlCanvas =
        typeof HTMLCanvasElement !== 'undefined' &&
        canvas instanceof HTMLCanvasElement
          ? canvas
          : null
      let failed = false

      const reportContextFailure = (event: Event) => {
        if (failed) return
        failed = true
        if (event.type === 'webglcontextlost') event.preventDefault()
        onFailure()
      }
      const cleanup = () => {
        htmlCanvas?.removeEventListener(
          'webglcontextcreationerror',
          reportContextFailure,
        )
        htmlCanvas?.removeEventListener(
          'webglcontextlost',
          reportContextFailure,
        )
      }

      removeContextListeners.current()
      htmlCanvas?.addEventListener(
        'webglcontextcreationerror',
        reportContextFailure,
      )
      htmlCanvas?.addEventListener('webglcontextlost', reportContextFailure)
      removeContextListeners.current = cleanup

      try {
        const renderer = new WebGLRenderer({
          ...rendererOptions,
          canvas,
        })
        if (renderer.getContext().isContextLost()) {
          renderer.dispose()
          reportContextFailure(new Event('webglcontextlost'))
          throw new Error('The WebGL context was lost during renderer setup')
        }
        return renderer
      } catch (error) {
        cleanup()
        if (!failed) {
          failed = true
          onFailure()
        }
        throw error
      }
    },
    [onFailure],
  )

  return (
    <Canvas
      camera={{ position: [0, 1.2, 6.5], fov: 42 }}
      dpr={reducedMotion ? 1 : [1, 1.5]}
      frameloop={paused ? 'never' : 'demand'}
      gl={createRenderer}
      onCreated={({ gl }) => {
        if (gl.getContext().isContextLost()) {
          onFailure()
          return
        }
        onReady()
      }}
    >
      <color attach="background" args={['#0a0b0f']} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 6, 5]} intensity={3.2} />
      <RendererHandshake
        selectedCartridge={selectedCartridge}
        seated={seated}
      />
    </Canvas>
  )
}
