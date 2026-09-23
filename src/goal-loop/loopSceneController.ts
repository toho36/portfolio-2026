export interface SceneEpoch {
  issue(): number
  isCurrent(value: number): boolean
  cancel(): void
}

export function createSceneEpoch(): SceneEpoch {
  let current = 0
  let canceled = false
  return {
    issue() {
      canceled = false
      current += 1
      return current
    },
    isCurrent(value) {
      return !canceled && value === current
    },
    cancel() {
      canceled = true
      current += 1
    },
  }
}

import {
  loadRelayRuntime,
  type RelayMotionFacade,
} from '../playground/loadRelayRuntime'
import { loadSystemFieldRuntime } from '../playground/loadSystemFieldRuntime'
import { createLoopScene, type LoopSceneRuntime, type LoopSceneThree } from './loopScene'
import { interpolatePose, IDLE_POSE, type LoopScenePose } from './staticPoses'

interface TimelineLike {
  kill(): void
  pause(): void
  play(): void
  resume(): unknown
  to(target: object, vars: object): TimelineLike
}

export interface LoopSceneControllerOptions {
  readonly wrapper: HTMLElement
  readonly stage: HTMLElement
  readonly media: MediaQueryList
  readonly window: Window
  readonly document: Document
  readonly onReady: () => void
  readonly onFallback: () => void
  readonly onPause: () => void
  readonly importThree?: () => Promise<unknown>
  readonly importMotion?: () => Promise<RelayMotionFacade>
  /** Node-test seam; production always creates the route-local Three scene. */
  readonly createScene?: typeof createLoopScene
}

export interface LoopSceneController {
  animate(
    from: LoopScenePose,
    to: LoopScenePose,
    duration: number,
    onComplete: () => void,
  ): boolean
  setPose(pose: LoopScenePose): void
  replay(
    from: LoopScenePose,
    to: LoopScenePose,
    restore: LoopScenePose,
    onComplete: () => void,
  ): boolean
  pause(): void
  resume(): boolean
  skip(): void
  destroy(): void
}

export function createLoopSceneController(
  options: LoopSceneControllerOptions,
): LoopSceneController {
  const { document: doc, media, stage, window: win, wrapper } = options
  const loadEpoch = createSceneEpoch()
  const animationEpoch = createSceneEpoch()
  let runtime: LoopSceneRuntime | null = null
  let motion: RelayMotionFacade | null = null
  let timeline: TimelineLike | null = null
  let destroyed = false
  let currentPose = IDLE_POSE
  let targetPose: LoopScenePose | null = null
  let replayRestore: LoopScenePose | null = null
  let completion: (() => void) | null = null
  let observer: IntersectionObserver | null = null
  let isIntersecting = true

  const environmentVisible = () => {
    if (doc.hidden || !isIntersecting) return false
    if (typeof wrapper.getBoundingClientRect !== 'function') return true
    const rect = wrapper.getBoundingClientRect()
    return rect.bottom > 0 && rect.right > 0 && rect.top < win.innerHeight && rect.left < win.innerWidth
  }

  function clearTimeline() {
    animationEpoch.cancel()
    timeline?.kill()
    if (replayRestore) {
      currentPose = replayRestore
      runtime?.setPose(replayRestore, true)
    }
    timeline = null
    targetPose = null
    replayRestore = null
    completion = null
  }

  function restoreFallback() {
    const fallbackPose = replayRestore ?? targetPose ?? currentPose
    clearTimeline()
    currentPose = fallbackPose
    runtime?.destroy()
    runtime = null
    motion = null
    wrapper.dataset.scene = 'static'
  }

  function failToFallback() {
    if (destroyed) return
    loadEpoch.cancel()
    restoreFallback()
    options.onFallback()
  }

  function requestRuntime() {
    if (destroyed || media.matches) return
    const generation = loadEpoch.issue()
    wrapper.dataset.scene = 'loading'

    const threeRequest = loadSystemFieldRuntime({
      generation,
      isCurrent: loadEpoch.isCurrent,
      isCanceled: () => destroyed || media.matches,
      importThree: options.importThree,
      createRuntime: (module) => module,
    })
    const motionRequest = options.importMotion
      ? loadRelayRuntime({
          generation,
          isCurrent: loadEpoch.isCurrent,
          isCanceled: () => destroyed || media.matches,
          importMotion: options.importMotion,
          createRuntime: (module) => module,
        })
      : loadRelayRuntime({
          generation,
          isCurrent: loadEpoch.isCurrent,
          isCanceled: () => destroyed || media.matches,
          createRuntime: (module) => module,
        })

    void Promise.all([threeRequest, motionRequest]).then(([threeResult, motionResult]) => {
      if (
        destroyed ||
        !loadEpoch.isCurrent(generation) ||
        threeResult.status !== 'created' ||
        motionResult.status !== 'created'
      ) return

      const scene = (options.createScene ?? createLoopScene)({
        three: threeResult.runtime as LoopSceneThree,
        stage,
        wrapper,
        window: win,
        onContextLoss: failToFallback,
      })
      if (destroyed || !loadEpoch.isCurrent(generation) || media.matches) {
        scene.destroy()
        return
      }
      runtime = scene
      motion = motionResult.runtime
      runtime.setPose(currentPose)
      wrapper.dataset.scene = 'webgl'
      options.onReady()
    }).catch(failToFallback)
  }

  function settleTarget(pauseAfter: boolean) {
    if (!targetPose) return
    const finalPose = replayRestore ?? targetPose
    const callback = completion
    const epoch = animationEpoch.issue()
    timeline?.kill()
    timeline = null
    targetPose = null
    replayRestore = null
    completion = null
    currentPose = finalPose
    runtime?.setPose(finalPose, true)
    if (!pauseAfter && animationEpoch.isCurrent(epoch)) callback?.()
  }

  function pauseForEnvironment() {
    if (!timeline) return
    timeline.pause()
    options.onPause()
  }

  const handleVisibility = () => {
    if (doc.hidden) pauseForEnvironment()
  }
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') pauseForEnvironment()
  }
  const handleResize = () => {
    if (!runtime) return
    if (timeline) {
      settleTarget(true)
      options.onPause()
    }
    runtime.resize()
    runtime.setPose(currentPose)
  }
  const handlePreference = () => {
    loadEpoch.cancel()
    restoreFallback()
    if (media.matches) options.onFallback()
    else requestRuntime()
  }

  doc.addEventListener('visibilitychange', handleVisibility)
  doc.addEventListener('keydown', handleKeydown)
  win.addEventListener('resize', handleResize)
  media.addEventListener('change', handlePreference)
  if ('IntersectionObserver' in win) {
    observer = new IntersectionObserver(([entry]) => {
      isIntersecting = entry?.isIntersecting ?? false
      if (!isIntersecting) pauseForEnvironment()
    }, { threshold: 0.01 })
    observer.observe(wrapper)
  }

  if (media.matches) {
    wrapper.dataset.scene = 'static'
    options.onFallback()
  } else {
    requestRuntime()
  }

  function animate(
    from: LoopScenePose,
    to: LoopScenePose,
    duration: number,
    onComplete: () => void,
  ) {
    if (destroyed || !runtime || !motion || !environmentVisible()) return false
    clearTimeline()
    const epoch = animationEpoch.issue()
    const driver = { progress: 0 }
    currentPose = from
    targetPose = to
    completion = onComplete
    runtime.setPose(from, false)
    timeline = motion.gsap.timeline({ paused: true }) as unknown as TimelineLike
    timeline.to(driver, {
      progress: 1,
      duration: duration / 1000,
      ease: 'power3.inOut',
      onUpdate: () => {
        if (!animationEpoch.isCurrent(epoch)) return
        runtime?.setPose(interpolatePose(from, to, driver.progress), false)
      },
      onComplete: () => {
        if (!animationEpoch.isCurrent(epoch)) return
        currentPose = to
        runtime?.setPose(to, true)
        timeline = null
        targetPose = null
        completion = null
        onComplete()
      },
    }).play()
    return true
  }

  return Object.freeze<LoopSceneController>({
    animate,
    setPose(pose) {
      clearTimeline()
      currentPose = pose
      runtime?.setPose(pose, true)
    },
    replay(from, to, restore, onComplete) {
      if (!animate(from, to, 620, () => {
        replayRestore = null
        currentPose = restore
        runtime?.setPose(restore, true)
        onComplete()
      })) return false
      replayRestore = restore
      currentPose = restore
      return true
    },
    pause() {
      timeline?.pause()
    },
    resume() {
      if (!timeline || !environmentVisible()) return false
      timeline.resume()
      return true
    },
    skip() {
      settleTarget(false)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      loadEpoch.cancel()
      clearTimeline()
      observer?.disconnect()
      observer = null
      doc.removeEventListener('visibilitychange', handleVisibility)
      doc.removeEventListener('keydown', handleKeydown)
      win.removeEventListener('resize', handleResize)
      media.removeEventListener('change', handlePreference)
      runtime?.destroy()
      runtime = null
      motion = null
      delete wrapper.dataset.scene
    },
  })
}
