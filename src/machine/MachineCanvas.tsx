import { Canvas, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  Group,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Vector3,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three'
import { gsap } from '../motion/gsap'
import type { CartridgeIndex } from '../content/cartridges'
import { SLOT, type AssemblyState, type Point } from '../loops/assembly/model'
import {
  assemblyPointAfterGestureTermination,
  assemblyPointForIdleReconciliation,
  beginCartridgeGesture,
  moveCartridgeGesture,
  terminateCartridgeGesture,
  type CartridgeGesture,
} from './cartridgeGesture'
import {
  RAIL_BOUNDS,
  assemblyPointToRailLocal,
  assemblyPointToWorld,
  createRailInteractionPlane,
  grabbedWorldHitToAssemblyPoint,
  intersectClientWithRailPlane,
} from './cartridgeProjection'
import type { ManipulationTerminalCallback } from './manipulation'

const CARTRIDGE_SIGNALS = ['#ff5a1f', '#42e8ff', '#d8d1c4', '#ff7a45'] as const

interface RendererHandshakeProps {
  readonly selectedCartridge: CartridgeIndex
  readonly assembly: AssemblyState
  readonly onManipulationOutcome: ManipulationTerminalCallback
}

function RendererHandshake({
  selectedCartridge,
  assembly,
  onManipulationOutcome,
}: RendererHandshakeProps) {
  const railRef = useRef<Group>(null)
  const cartridgeRef = useRef<Group>(null)
  const gestureRef = useRef<CartridgeGesture | null>(null)
  const visiblePointRef = useRef<Point>({ x: assembly.x, y: assembly.y })
  const committedPointRef = useRef<Point>({ x: assembly.x, y: assembly.y })
  const seatedRef = useRef(assembly.seated)
  const outcomeRef = useRef(onManipulationOutcome)
  const raycasterRef = useRef(new Raycaster())
  const planeRef = useRef(new Plane())
  const hitRef = useRef(new Vector3())
  const { camera, gl, invalidate } = useThree()

  useLayoutEffect(() => {
    const context = gsap.context(() => {})
    return () => context.revert()
  }, [])

  const applyVisiblePoint = useCallback(
    (point: Point) => {
      visiblePointRef.current = { ...point }
      if (cartridgeRef.current) {
        cartridgeRef.current.position.copy(assemblyPointToRailLocal(point))
      }
      invalidate()
    },
    [invalidate],
  )

  useLayoutEffect(() => {
    const point = { x: assembly.x, y: assembly.y }
    committedPointRef.current = point
    seatedRef.current = assembly.seated
    const idlePoint = assemblyPointForIdleReconciliation(
      gestureRef.current,
      point,
    )
    if (idlePoint) applyVisiblePoint(idlePoint)
  }, [applyVisiblePoint, assembly.seated, assembly.x, assembly.y])

  useLayoutEffect(() => {
    outcomeRef.current = onManipulationOutcome
  }, [onManipulationOutcome])

  useEffect(() => {
    const canvas = gl.domElement

    const projectEvent = (event: PointerEvent): Vector3 | null => {
      if (!(camera instanceof PerspectiveCamera) || !railRef.current) return null
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null

      camera.updateMatrixWorld(true)
      railRef.current.updateWorldMatrix(true, true)
      createRailInteractionPlane(
        railRef.current.matrixWorld,
        planeRef.current,
      )
      return intersectClientWithRailPlane(
        { x: event.clientX, y: event.clientY },
        rect,
        camera,
        planeRef.current,
        raycasterRef.current,
        hitRef.current,
      )
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        gestureRef.current ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        !railRef.current ||
        !cartridgeRef.current
      ) {
        return
      }

      const hit = projectEvent(event)
      if (
        !hit ||
        raycasterRef.current.intersectObject(cartridgeRef.current, true)
          .length === 0
      ) {
        return
      }

      const pointerType =
        event.pointerType === 'touch' || event.pointerType === 'pen'
          ? event.pointerType
          : 'mouse'
      const visibleCenter = assemblyPointToWorld(
        visiblePointRef.current,
        railRef.current.matrixWorld,
      )
      const grabOffset = hit.clone().sub(visibleCenter)
      gestureRef.current = beginCartridgeGesture({
        pointerId: event.pointerId,
        pointerType,
        startClient: { x: event.clientX, y: event.clientY },
        committedPoint: committedPointRef.current,
        downPlaneHit: hit,
        grabOffset,
      })
    }

    const processPointerMove = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return

      const hit = projectEvent(event)
      const projectedPoint =
        hit && railRef.current
          ? grabbedWorldHitToAssemblyPoint(
              hit,
              new Vector3(
                gesture.grabOffset.x,
                gesture.grabOffset.y,
                gesture.grabOffset.z,
              ),
              railRef.current.matrixWorld,
            )
          : null
      const result = moveCartridgeGesture(
        gesture,
        event.pointerId,
        { x: event.clientX, y: event.clientY },
        projectedPoint,
      )
      gestureRef.current = result.gesture

      if (result.capture && !canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          // The pointer may have ended between the window event and capture.
        }
      }
      if (result.preventDefault && event.cancelable) event.preventDefault()
      if (result.updateVisual) applyVisiblePoint(result.gesture.visiblePoint)
    }

    const finishPointer = (
      event: PointerEvent,
      reason: 'up' | 'cancel' | 'lost-capture',
    ) => {
      const active = gestureRef.current
      if (!active || event.pointerId !== active.pointerId) return
      if (reason === 'up') processPointerMove(event)

      const current = gestureRef.current
      if (!current || event.pointerId !== current.pointerId) return
      const result = terminateCartridgeGesture(current, event.pointerId, reason)

      // Clear first: releasePointerCapture may synchronously fire lostpointercapture.
      gestureRef.current = result.gesture
      const terminalPoint = assemblyPointAfterGestureTermination(
        result,
        committedPointRef.current,
        seatedRef.current,
      )
      if (terminalPoint) applyVisiblePoint(terminalPoint)
      if (canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.releasePointerCapture(event.pointerId)
        } catch {
          // A browser cancellation may already have released capture.
        }
      }
      if (result.outcome) outcomeRef.current(result.outcome)
    }

    const handlePointerMove = (event: PointerEvent) => processPointerMove(event)
    const handlePointerUp = (event: PointerEvent) =>
      finishPointer(event, 'up')
    const handlePointerCancel = (event: PointerEvent) =>
      finishPointer(event, 'cancel')
    const handleLostPointerCapture = (event: PointerEvent) =>
      finishPointer(event, 'lost-capture')

    canvas.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    canvas.addEventListener('lostpointercapture', handleLostPointerCapture)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      canvas.removeEventListener('lostpointercapture', handleLostPointerCapture)
    }
  }, [applyVisiblePoint, camera, gl])

  const slotCenter = assemblyPointToRailLocal(SLOT.center)
  const slotWidth =
    (SLOT.right - SLOT.left) * (RAIL_BOUNDS.right - RAIL_BOUNDS.left)
  const slotHeight =
    (SLOT.bottom - SLOT.top) * (RAIL_BOUNDS.top - RAIL_BOUNDS.bottom)

  return (
    <group ref={railRef} rotation={[0.18, -0.35, 0]}>
      <mesh position={[0, -0.85, 0]}>
        <boxGeometry args={[4.8, 0.45, 2.4]} />
        <meshStandardMaterial color="#242730" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.8, 1.4, 1.8]} />
        <meshStandardMaterial color="#d8d1c4" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[slotCenter.x, slotCenter.y, RAIL_BOUNDS.z - 0.1]}>
        <boxGeometry args={[slotWidth, slotHeight, 0.025]} />
        <meshBasicMaterial color="#42e8ff" opacity={0.3} transparent wireframe />
      </mesh>
      <group ref={cartridgeRef}>
        <mesh position={[0, 0, -0.11]}>
          <boxGeometry args={[1.25, 0.8, 0.15]} />
          <meshStandardMaterial color="#0a0b0f" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.72, 0.46, 0.08]} />
          <meshStandardMaterial
            color={CARTRIDGE_SIGNALS[selectedCartridge]}
            emissive={CARTRIDGE_SIGNALS[selectedCartridge]}
            emissiveIntensity={assembly.seated ? 0.5 : 0.18}
          />
        </mesh>
      </group>
      <mesh position={[2.05, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.35, 24]} />
        <meshStandardMaterial color="#42e8ff" metalness={0.55} roughness={0.25} />
      </mesh>
    </group>
  )
}

export interface MachineCanvasProps {
  readonly selectedCartridge: CartridgeIndex
  readonly assembly: AssemblyState
  readonly onManipulationOutcome: ManipulationTerminalCallback
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
  assembly,
  onManipulationOutcome,
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
        assembly={assembly}
        onManipulationOutcome={onManipulationOutcome}
      />
    </Canvas>
  )
}
