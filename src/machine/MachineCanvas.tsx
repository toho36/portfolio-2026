import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  type MutableRefObject,
} from 'react'
import {
  Group,
  type MeshBasicMaterial,
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
  areCartridgeSettlePointsEqual,
  cartridgeSettlePolicy,
  type CartridgeSettleKind,
} from './cartridgeSettle'
import {
  RAIL_BOUNDS,
  assemblyPointToRailLocal,
  assemblyPointToWorld,
  createRailInteractionPlane,
  grabbedWorldHitToAssemblyPoint,
  intersectClientWithRailPlane,
} from './cartridgeProjection'
import {
  bindAdaptiveDprActivity,
  controlledDprAfterManagerReport,
  createAdaptiveDprController,
  createResumeActivityGate,
  type AdaptiveDprController,
  type ResumeActivityGate,
} from './adaptiveDpr'
import type { ManipulationTerminalCallback } from './manipulation'
import { deriveMachineGroupChoreography } from './machineChoreography'
import {
  cylinderSegmentsForDpr,
  deriveCartridgeSettleFeedback,
} from './rendererFeedback'
import type { PresentationBridge } from './scrollIntegration'

const CARTRIDGE_SIGNALS = ['#ff5a1f', '#42e8ff', '#d8d1c4', '#ff7a45'] as const

interface RendererHandshakeProps {
  readonly selectedCartridge: CartridgeIndex
  readonly assembly: AssemblyState
  readonly onManipulationOutcome: ManipulationTerminalCallback
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly presentationBridge: PresentationBridge
  readonly resumeGate: ResumeActivityGate
  readonly cylinderSegments: number
}

function RendererHandshake({
  selectedCartridge,
  assembly,
  onManipulationOutcome,
  paused,
  reducedMotion,
  presentationBridge,
  resumeGate,
  cylinderSegments,
}: RendererHandshakeProps) {
  const presentationRef = useRef<Group>(null)
  const railRef = useRef<Group>(null)
  const cartridgeRef = useRef<Group>(null)
  const slotMaterialRef = useRef<MeshBasicMaterial>(null)
  const gestureRef = useRef<CartridgeGesture | null>(null)
  const visiblePointRef = useRef<Point>({ x: assembly.x, y: assembly.y })
  const committedPointRef = useRef<Point>({ x: assembly.x, y: assembly.y })
  const settleTweenRef = useRef<{
    readonly tween: ReturnType<typeof gsap.to>
    readonly target: Point
  } | null>(null)
  const seatedRef = useRef(assembly.seated)
  const outcomeRef = useRef(onManipulationOutcome)
  const pausedRef = useRef(paused)
  const reducedMotionRef = useRef(reducedMotion)
  const committedPausedRef = useRef(paused)
  const committedReducedMotionRef = useRef(reducedMotion)
  const raycasterRef = useRef(new Raycaster())
  const planeRef = useRef(new Plane())
  const hitRef = useRef(new Vector3())
  const { camera, gl, invalidate } = useThree()

  pausedRef.current = paused
  reducedMotionRef.current = reducedMotion

  useLayoutEffect(
    () =>
      presentationBridge.attach({
        apply(values) {
          const group = presentationRef.current
          if (!group || pausedRef.current) return
          const choreography = deriveMachineGroupChoreography({
            ...values,
            reducedMotion,
          })
          group.position.x = choreography.positionX
          group.position.y = choreography.positionY
          group.rotation.x = choreography.rotationX
          group.rotation.y = choreography.rotationY
          group.scale.setScalar(choreography.scale)
          if (!resumeGate.isBlocked()) invalidate()
        },
      }),
    [invalidate, presentationBridge, reducedMotion, resumeGate],
  )

  useLayoutEffect(() => {
    const wasPaused = committedPausedRef.current
    committedPausedRef.current = paused
    const settleTween = settleTweenRef.current?.tween
    if (paused) settleTween?.pause()
    if (wasPaused && !paused) {
      settleTween?.resume()
      presentationBridge.replay()
    }
  }, [paused, presentationBridge])

  const applyVisiblePoint = useCallback(
    (point: Point) => {
      if (pausedRef.current) return
      visiblePointRef.current = { ...point }
      if (cartridgeRef.current) {
        cartridgeRef.current.position.copy(assemblyPointToRailLocal(point))
      }
      if (!resumeGate.isBlocked()) invalidate()
    },
    [invalidate, resumeGate],
  )

  const resetSettleFeedback = useCallback(() => {
    cartridgeRef.current?.scale.set(1, 1, 1)
    if (slotMaterialRef.current) slotMaterialRef.current.opacity = 0.3
  }, [])

  const applySettleFeedback = useCallback(
    (kind: CartridgeSettleKind, progress: number) => {
      const feedback = deriveCartridgeSettleFeedback(
        kind,
        progress,
        reducedMotionRef.current,
      )
      cartridgeRef.current?.scale.set(
        feedback.scaleX,
        feedback.scaleY,
        feedback.scaleZ,
      )
      if (slotMaterialRef.current) {
        slotMaterialRef.current.opacity = feedback.slotOpacity
      }
    },
    [],
  )

  const killSettleTween = useCallback(() => {
    const active = settleTweenRef.current
    if (active) {
      if (settleTweenRef.current === active) settleTweenRef.current = null
      active.tween.kill()
    }
    resetSettleFeedback()
  }, [resetSettleFeedback])

  const settleVisiblePoint = useCallback(
    (target: Point, kind: CartridgeSettleKind) => {
      const active = settleTweenRef.current
      if (
        active &&
        active.target.x === target.x &&
        active.target.y === target.y
      ) {
        return
      }

      killSettleTween()

      const exactTarget = { ...target }
      const from = visiblePointRef.current
      const policy = cartridgeSettlePolicy(kind, reducedMotionRef.current)
      if (
        policy.duration === 0 ||
        areCartridgeSettlePointsEqual(from, exactTarget)
      ) {
        applyVisiblePoint(exactTarget)
        return
      }

      const driver = { x: from.x, y: from.y }
      let tween: ReturnType<typeof gsap.to>
      tween = gsap.to(driver, {
        x: exactTarget.x,
        y: exactTarget.y,
        duration: policy.duration,
        ease: policy.ease,
        paused: true,
        onUpdate: () => {
          if (settleTweenRef.current?.tween !== tween) return
          applySettleFeedback(kind, tween.progress())
          applyVisiblePoint(driver)
        },
        onComplete: () => {
          if (settleTweenRef.current?.tween !== tween) return
          settleTweenRef.current = null
          resetSettleFeedback()
          applyVisiblePoint(exactTarget)
        },
      })
      settleTweenRef.current = { tween, target: exactTarget }
      if (!pausedRef.current) tween.play()
    },
    [
      applySettleFeedback,
      applyVisiblePoint,
      killSettleTween,
      resetSettleFeedback,
    ],
  )

  useLayoutEffect(() => {
    const point = { x: assembly.x, y: assembly.y }
    committedPointRef.current = point
    seatedRef.current = assembly.seated
    const idlePoint = assemblyPointForIdleReconciliation(
      gestureRef.current,
      point,
    )
    if (idlePoint) {
      settleVisiblePoint(idlePoint, assembly.seated ? 'seat' : 'return')
    }
  }, [assembly.seated, assembly.x, assembly.y, paused, settleVisiblePoint])

  useLayoutEffect(() => {
    const previousReducedMotion = committedReducedMotionRef.current
    committedReducedMotionRef.current = reducedMotion
    if (previousReducedMotion === reducedMotion) return
    killSettleTween()
    applyVisiblePoint(committedPointRef.current)
  }, [applyVisiblePoint, killSettleTween, reducedMotion])

  useLayoutEffect(() => () => killSettleTween(), [killSettleTween])

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
        pausedRef.current ||
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

      killSettleTween()
      applyVisiblePoint(visiblePointRef.current)
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
      if (terminalPoint) settleVisiblePoint(terminalPoint, 'return')
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
  }, [applyVisiblePoint, camera, gl, killSettleTween, settleVisiblePoint])

  const slotCenter = assemblyPointToRailLocal(SLOT.center)
  const slotWidth =
    (SLOT.right - SLOT.left) * (RAIL_BOUNDS.right - RAIL_BOUNDS.left)
  const slotHeight =
    (SLOT.bottom - SLOT.top) * (RAIL_BOUNDS.top - RAIL_BOUNDS.bottom)

  return (
    <group ref={presentationRef}>
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
          <meshBasicMaterial
            ref={slotMaterialRef}
            color="#42e8ff"
            opacity={0.3}
            transparent
            wireframe
          />
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
          <cylinderGeometry args={[0.55, 0.55, 0.35, cylinderSegments]} />
          <meshStandardMaterial color="#42e8ff" metalness={0.55} roughness={0.25} />
        </mesh>
      </group>
    </group>
  )
}

interface AdaptiveDprManagerProps {
  readonly dpr: number
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly resumeGate: ResumeActivityGate
  readonly activityReporterRef: MutableRefObject<(() => void) | null>
  readonly reportDpr: (dpr: number) => void
}

function AdaptiveDprManager({
  dpr,
  paused,
  reducedMotion,
  resumeGate,
  activityReporterRef,
  reportDpr,
}: AdaptiveDprManagerProps) {
  const { invalidate, performance: rendererPerformance } = useThree()
  const performanceRef = useRef(rendererPerformance)
  const invalidateRef = useRef(invalidate)
  const reportDprRef = useRef(reportDpr)
  const controllerRef = useRef<AdaptiveDprController | null>(null)

  performanceRef.current = rendererPerformance
  invalidateRef.current = invalidate
  reportDprRef.current = reportDpr

  useLayoutEffect(() => {
    const controller = createAdaptiveDprController({
      initialDpr: dpr,
      initiallyPaused: paused || resumeGate.isBlocked(),
      initiallyReducedMotion: reducedMotion,
      gate: resumeGate,
      now: () => globalThis.performance?.now() ?? Date.now(),
      timer: {
        set: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
        clear: (handle) =>
          globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
      },
      regress: () => performanceRef.current.regress(),
      invalidate: () => invalidateRef.current(),
      reportDpr: (nextDpr) => reportDprRef.current(nextDpr),
    })
    const reporter = () => controller.recordActivity()
    controllerRef.current = controller
    activityReporterRef.current = reporter
    return () => {
      if (activityReporterRef.current === reporter) {
        activityReporterRef.current = null
      }
      if (controllerRef.current === controller) controllerRef.current = null
      controller.destroy()
    }
  }, [activityReporterRef, resumeGate])

  useLayoutEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    controller.acknowledgeDpr(dpr)
    controller.setPaused(paused)
    controller.setReducedMotion(reducedMotion, rendererPerformance)
  }, [dpr, paused, reducedMotion, rendererPerformance])

  useFrame((state, delta) =>
    controllerRef.current?.sample(delta, state.performance),
  )

  return null
}

export interface MachineCanvasProps {
  readonly selectedCartridge: CartridgeIndex
  readonly assembly: AssemblyState
  readonly onManipulationOutcome: ManipulationTerminalCallback
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly presentationBridge: PresentationBridge
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
  presentationBridge,
  onReady,
  onFailure,
}: MachineCanvasProps) {
  const removeContextListeners = useRef<() => void>(() => {})
  const resumeGateRef = useRef<ResumeActivityGate | null>(null)
  const committedPausedRef = useRef(paused)
  const activityReporterRef = useRef<(() => void) | null>(null)
  const [dpr, reportDpr] = useReducer(
    controlledDprAfterManagerReport,
    reducedMotion ? 1 : 1.5,
  )

  if (resumeGateRef.current === null) {
    resumeGateRef.current = createResumeActivityGate()
  }
  const resumeGate = resumeGateRef.current
  if (committedPausedRef.current && !paused) resumeGate.arm()

  const reportActivity = useCallback(() => {
    activityReporterRef.current?.()
  }, [])

  useLayoutEffect(() => {
    committedPausedRef.current = paused
    if (!paused && resumeGate.isBlocked()) resumeGate.beginSettlement()
  }, [paused, resumeGate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    return bindAdaptiveDprActivity(window, resumeGate, reportActivity)
  }, [reportActivity, resumeGate])

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
      dpr={dpr}
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
      <AdaptiveDprManager
        dpr={dpr}
        paused={paused}
        reducedMotion={reducedMotion}
        resumeGate={resumeGate}
        activityReporterRef={activityReporterRef}
        reportDpr={reportDpr}
      />
      <RendererHandshake
        selectedCartridge={selectedCartridge}
        assembly={assembly}
        onManipulationOutcome={onManipulationOutcome}
        paused={paused}
        reducedMotion={reducedMotion}
        presentationBridge={presentationBridge}
        resumeGate={resumeGate}
        cylinderSegments={cylinderSegmentsForDpr(dpr)}
      />
    </Canvas>
  )
}
