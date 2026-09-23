import { useEffect, useReducer, useRef, useState } from 'react'
import {
  runToDecision,
  transitionDuration,
} from '../goal-loop/runChoreography'
import {
  createLoopSceneController,
  type LoopSceneController,
} from '../goal-loop/loopSceneController'
import {
  createInitialRun,
  INITIAL_RUN,
  MODEL_REPAIR_LIMIT,
  stepRun,
  type RunAction,
  type RunModel,
  type RunScenario,
} from '../goal-loop/runModel'
import {
  describeRun,
  primaryIntent,
  repairBudgetText,
  RUN_BOUND_TEXT,
  RUN_SCENARIOS,
  type RunPlaybackPhase,
} from '../goal-loop/runPresentation'
import {
  IDLE_POSE,
  staticPoseForRun,
  type LoopScenePose,
} from '../goal-loop/staticPoses'

interface ReturnReplay {
  readonly from: LoopScenePose
  readonly to: LoopScenePose
  readonly source: NonNullable<RunModel['returnFrom']>
}

function StaticWorkbench({ pose }: { readonly pose: LoopScenePose }) {
  const artifactX = 450 + pose.artifactX * 72
  const artifactY = 278 - pose.artifactY * 38

  return (
    <svg
      className="loop-static-scene"
      viewBox="40 0 820 480"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="loop-ceramic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0e8da" />
          <stop offset="0.5" stopColor="#c9bead" />
          <stop offset="1" stopColor="#81796d" />
        </linearGradient>
        <linearGradient id="loop-graphite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#504a43" />
          <stop offset="1" stopColor="#181817" />
        </linearGradient>
        <linearGradient id="loop-amber" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e29a38" stopOpacity="0.82" />
          <stop offset="1" stopColor="#73360d" stopOpacity="0.56" />
        </linearGradient>
        <filter id="loop-shadow" x="-20%" y="-30%" width="150%" height="170%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000" floodOpacity="0.55" />
        </filter>
      </defs>

      <ellipse cx="466" cy="421" rx="340" ry="30" fill="#070707" opacity="0.55" />
      <g filter="url(#loop-shadow)">
        <g data-static-machine="true">
          <path d="M92 384 181 77 328 43 283 397Z" fill="url(#loop-ceramic)" />
          <path d="M126 378 208 118 277 97 238 383Z" fill="url(#loop-graphite)" />
          <path d="M280 397 337 48 690 76 780 389Z" fill="url(#loop-graphite)" />
          <path d="M622 58 771 89 838 375 723 398Z" fill="url(#loop-ceramic)" />
          <path d="M333 67 690 91 643 150 316 137Z" fill="url(#loop-ceramic)" />
          <path d="M291 396 323 342 730 350 780 400Z" fill="#34312e" />
          <path d="M335 160 644 171 693 339 292 333Z" fill="#111110" stroke="#6f665b" strokeWidth="4" />
          <path
            d="M704 139 821 174 799 360 716 335Z"
            fill="url(#loop-ceramic)"
            transform={`translate(${pose.exitOpen * 48} ${pose.exitOpen * 18}) rotate(${-pose.exitOpen * 9} 716 335)`}
          />
        </g>
        {pose.plannerTool > 0 ? <g transform={`translate(0 ${12 - pose.plannerTool * 12})`}>
          <path d="M313 171H607" stroke="#e04b25" strokeWidth="9" />
          <path d="M343 150V300" stroke="#6f665b" strokeWidth="8" />
        </g> : null}
        {pose.criticTool > 0 ? <g transform={`translate(${9 - pose.criticTool * 9} 0)`}>
          <path d="M683 149 533 238" stroke="#6f665b" strokeWidth="17" />
          <path d="m548 218-31 35 44 5Z" fill="#e04b25" />
        </g> : null}
        {pose.implementerTool > 0 ? <g>
          <path d={`M335 ${177 - pose.implementerTool * 12}H651L626 ${201 + pose.implementerTool * 22}H350Z`} fill="url(#loop-ceramic)" />
          <path d={`M325 ${339 + pose.implementerTool * 8}H665L630 ${319 - pose.implementerTool * 20}H348Z`} fill="#49423a" />
        </g> : null}
        {pose.checkTool > 0 ? <g>
          <path d="M325 198v120M657 198v120" stroke="#767068" strokeWidth="24" />
          <path d="M312 198H672" stroke="#e04b25" strokeWidth="7" />
        </g> : null}
        {pose.reviewTool > 0 ? <g transform={`translate(0 ${-2 + pose.reviewTool * 2})`}>
          <path d="m351 165 319 28-24 138-316-29Z" fill="url(#loop-amber)" stroke="#9b7040" strokeWidth="5" />
          <path d="m351 165 319 28M330 302l316 29" stroke="#332e29" strokeWidth="9" />
        </g> : null}
        <g className="loop-repair-tabs" data-tabs-left={Math.round(pose.tabsRemaining)}>
          {pose.tabsRemaining > 0.5 ? <path d="M438 361h32v46h-32Z" fill="#e04b25" /> : null}
          {pose.tabsRemaining > 1.5 ? <path d="M486 361h32v46h-32Z" fill="#e04b25" /> : null}
        </g>
      </g>

      <g
        data-static-artifact="true"
        data-artifact-kind={pose.artifact}
        transform={`translate(${artifactX} ${artifactY})`}
      >
        {pose.candidateVisible ? (
          <g transform={`scale(${pose.candidateScale})`}>
            <path d="M-134-58H134V58H-134Z" fill="#292725" stroke="#776d62" strokeWidth="5" />
            <g transform={`translate(${-pose.checkOpening * 18} ${-pose.checkOpening * 7}) rotate(${-pose.checkOpening * 7})`}>
              <path d="M-122-48H-2V49H-122Z" fill="url(#loop-ceramic)" />
            </g>
            <g transform={`translate(${pose.reviewOpening * 16} ${-pose.reviewOpening * 10}) rotate(${pose.reviewOpening * 7})`}>
              <path d="M2-48H122V49H2Z" fill="#ded3c1" />
            </g>
            <path d="M-13-43H13V43H-13Z" fill="url(#loop-amber)" />
            <path d="M-100 40H101" stroke="#e04b25" strokeWidth="8" />
          </g>
        ) : (
          <g transform="rotate(-2)">
            <path d="M-148-66H148V66H-148Z" fill="url(#loop-amber)" stroke="#c48735" strokeWidth="4" />
            <g transform={`translate(${-pose.planOpening * 12} ${-pose.planOpening * 7}) rotate(${-pose.planOpening * 3})`}>
              <path d="M-126-42H112M-126-7H68M-126 28H94" stroke="#f1c278" strokeWidth="7" opacity="0.7" />
            </g>
            <path d="M-148-66V66" stroke="#e04b25" strokeWidth="9" />
          </g>
        )}
      </g>
    </svg>
  )
}

export function RunInstrument() {
  const [run, dispatch] = useReducer(stepRun, INITIAL_RUN)
  const [scenario, setScenario] = useState<RunScenario>('check-defect')
  const [started, setStarted] = useState(false)
  const [phase, setPhase] = useState<RunPlaybackPhase>('idle')
  const [motionReady, setMotionReady] = useState(false)
  const [stepRunActive, setStepRunActive] = useState(false)
  const [announcement, setAnnouncement] = useState(
    'Check defect illustration selected. Ready to run.',
  )
  const [lastReturn, setLastReturn] = useState<ReturnReplay | null>(null)
  const wrapperRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const controllerRef = useRef<LoopSceneController | null>(null)
  const runRef = useRef(run)
  const phaseRef = useRef(phase)
  const startedRef = useRef(started)
  const stepRunActiveRef = useRef(stepRunActive)
  const inputLockedRef = useRef(false)
  const poseRef = useRef<LoopScenePose>(IDLE_POSE)
  const activeStepMode = started && stepRunActive

  runRef.current = run
  phaseRef.current = phase
  startedRef.current = started
  stepRunActiveRef.current = stepRunActive

  const updatePhase = (next: RunPlaybackPhase) => {
    const disappearing = next === 'playing' || next === 'replay'
      ? '.loop-replay:focus, .loop-retry:focus'
      : next === 'settled'
        ? '.loop-skip:focus'
        : next === 'idle'
          ? '.loop-reset:focus, .loop-replay:focus, .loop-retry:focus, .loop-skip:focus'
          : null
    if (disappearing && wrapperRef.current?.querySelector(disappearing)) {
      primaryRef.current?.focus({ preventScroll: true })
    }
    phaseRef.current = next
    setPhase(next)
  }

  const updateStarted = (next: boolean) => {
    startedRef.current = next
    setStarted(next)
  }

  const updateStepMode = (next: boolean) => {
    stepRunActiveRef.current = next
    setStepRunActive(next)
  }

  const lockInput = () => {
    if (inputLockedRef.current) return false
    inputLockedRef.current = true
    queueMicrotask(() => { inputLockedRef.current = false })
    return true
  }

  const commit = (action: RunAction) => {
    const previous = runRef.current
    const next = stepRun(previous, action)
    if (next !== previous) {
      runRef.current = next
      dispatch(action)
    }
    return next
  }

  const settle = (state: RunModel) => {
    poseRef.current = staticPoseForRun(state)
    updatePhase('settled')
    const copy = describeRun(state)
    setAnnouncement(`${copy.title}. ${copy.detail}`)
  }

  const recordReturn = (from: RunModel, to: RunModel) => {
    if (to.returnFrom === null) return
    setLastReturn({
      from: staticPoseForRun(from),
      to: staticPoseForRun(to),
      source: to.returnFrom,
    })
  }

  const animateSpan = (fromReturn = false) => {
    const from = runRef.current
    if (from.verdict !== 'active' || (from.returnFrom !== null && !fromReturn)) {
      settle(from)
      return
    }
    const next = stepRun(from, { type: 'next' })
    if (next === from) {
      settle(from)
      return
    }
    commit({ type: 'next' })
    recordReturn(from, next)
    const fromPose = poseRef.current
    const toPose = staticPoseForRun(next)
    poseRef.current = toPose
    const animated = controllerRef.current?.animate(
      fromPose,
      toPose,
      transitionDuration(from, next),
      () => {
        if (next.verdict !== 'active' || next.returnFrom !== null) settle(next)
        else animateSpan()
      },
    ) ?? false
    if (!animated) {
      updateStepMode(true)
      controllerRef.current?.setPose(toPose)
      settle(next)
    }
  }

  const startRun = (fresh: RunModel, useSteps: boolean) => {
    updateStarted(true)
    updateStepMode(useSteps)
    poseRef.current = staticPoseForRun(fresh)
    if (useSteps) {
      updatePhase('settled')
      controllerRef.current?.setPose(poseRef.current)
      setAnnouncement('Planner. The goal is held as a bounded plan.')
      return
    }
    updatePhase('playing')
    setAnnouncement('Planner is bounding the goal.')
    const animated = controllerRef.current?.animate(
      IDLE_POSE,
      poseRef.current,
      500,
      animateSpan,
    ) ?? false
    if (!animated) {
      updateStepMode(true)
      updatePhase('settled')
      controllerRef.current?.setPose(poseRef.current)
    }
  }

  const reset = (nextScenario = scenario) => {
    controllerRef.current?.setPose(IDLE_POSE)
    const fresh = commit({ type: 'reset', scenario: nextScenario })
    runRef.current = fresh
    poseRef.current = IDLE_POSE
    updateStarted(false)
    updatePhase('idle')
    updateStepMode(false)
    setLastReturn(null)
    setAnnouncement('Illustration reset. Choose a scenario.')
    return fresh
  }

  const advanceOne = () => {
    const from = runRef.current
    const next = stepRun(from, { type: 'next' })
    if (next === from) return
    commit({ type: 'next' })
    recordReturn(from, next)
    poseRef.current = staticPoseForRun(next)
    controllerRef.current?.setPose(poseRef.current)
    settle(next)
  }

  const correctAndContinue = (action: { readonly type: 'repair' | 'revise' }) => {
    const before = runRef.current
    const corrected = commit(action)
    if (corrected === before) return
    const correctedPose = staticPoseForRun(corrected)
    poseRef.current = correctedPose
    if (startedRef.current && stepRunActiveRef.current) {
      advanceOne()
      return
    }
    updatePhase('playing')
    setAnnouncement(action.type === 'revise' ? 'The plan gap is revised.' : 'The affected candidate layer is repaired.')
    const animated = controllerRef.current?.animate(
      staticPoseForRun(before),
      correctedPose,
      420,
      animateSpan,
    ) ?? false
    if (!animated) {
      updateStepMode(true)
      controllerRef.current?.setPose(correctedPose)
      advanceOne()
    }
  }

  const retryUnchanged = () => {
    if (!lockInput() || runRef.current.returnFrom === null) return
    if (!stepRunActiveRef.current && phaseRef.current !== 'settled') return
    if (startedRef.current && stepRunActiveRef.current) advanceOne()
    else {
      updatePhase('playing')
      setAnnouncement('Retrying the unchanged material through the same gates.')
      animateSpan(true)
    }
    primaryRef.current?.focus()
  }

  const skipSpan = () => {
    if (!lockInput()) return
    controllerRef.current?.setPose(staticPoseForRun(runRef.current))
    let state = runRef.current
    for (const next of runToDecision(state)) {
      recordReturn(state, next)
      commit({ type: 'next' })
      state = next
    }
    poseRef.current = staticPoseForRun(state)
    controllerRef.current?.setPose(poseRef.current)
    settle(state)
    primaryRef.current?.focus()
  }

  const replayReturn = () => {
    if (!lastReturn || !lockInput()) return
    if (!stepRunActiveRef.current && phaseRef.current !== 'settled') return
    if ((startedRef.current && stepRunActiveRef.current) || !motionReady) {
      const canonical = staticPoseForRun(runRef.current)
      poseRef.current = canonical
      controllerRef.current?.setPose(canonical)
      setAnnouncement(`${lastReturn.source} return replayed. Model state and budgets are unchanged.`)
      return
    }
    updatePhase('replay')
    setAnnouncement('Replaying the latest material return. Model state is unchanged.')
    const canonical = staticPoseForRun(runRef.current)
    const animated = controllerRef.current?.replay(lastReturn.from, lastReturn.to, canonical, () => {
      poseRef.current = canonical
      updatePhase('settled')
      setAnnouncement(`${lastReturn.source} return replayed. Model state and budgets are unchanged.`)
    }) ?? false
    if (!animated) {
      poseRef.current = canonical
      controllerRef.current?.setPose(canonical)
      updatePhase('settled')
    }
  }

  useEffect(() => {
    const wrapper = wrapperRef.current
    const stage = stageRef.current
    if (!wrapper || !stage) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const controller = createLoopSceneController({
      wrapper,
      stage,
      media,
      window,
      document,
      onReady() {
        setMotionReady(true)
      },
      onFallback() {
        if (wrapper.querySelector('.loop-skip:focus')) {
          primaryRef.current?.focus({ preventScroll: true })
        }
        setMotionReady(false)
        poseRef.current = startedRef.current ? staticPoseForRun(runRef.current) : IDLE_POSE
        if (startedRef.current) updateStepMode(true)
        if (phaseRef.current === 'playing' || phaseRef.current === 'replay') {
          updatePhase('settled')
        }
      },
      onPause() {
        if (phaseRef.current === 'playing' || phaseRef.current === 'replay') {
          updatePhase('paused')
          setAnnouncement('Illustration paused. Resume explicitly to continue.')
        }
      },
    })
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || wrapper.dataset.scene === 'webgl') return
    const scene = wrapper.querySelector<SVGElement>('.loop-static-scene')
    const artifact = wrapper.querySelector<SVGGraphicsElement>('[data-static-artifact]')
    const machine = wrapper.querySelector<SVGGraphicsElement>('[data-static-machine]')
    if (!scene || !artifact || !machine) return

    const measure = () => {
      const sceneRect = scene.getBoundingClientRect()
      const artifactRect = artifact.getBoundingClientRect()
      const machineRect = machine.getBoundingClientRect()
      wrapper.dataset.artifactPx = Math.max(artifactRect.width, artifactRect.height).toFixed(1)
      wrapper.dataset.machineHeightPx = machineRect.height.toFixed(1)
      wrapper.dataset.artifactLeft = (artifactRect.left - sceneRect.left).toFixed(1)
      wrapper.dataset.artifactTop = (artifactRect.top - sceneRect.top).toFixed(1)
      wrapper.dataset.artifactRight = (artifactRect.right - sceneRect.left).toFixed(1)
      wrapper.dataset.artifactBottom = (artifactRect.bottom - sceneRect.top).toFixed(1)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [run, started, motionReady])

  const returned = run.returnFrom !== null
  const terminal = run.verdict !== 'active'
  const description = started
    ? describeRun(run)
    : {
        role: 'Illustrative workbench',
        title: 'One goal. One evolving artifact.',
        detail: 'Choose a scenario, then run the bounded model.',
      }
  const staticPose = started ? staticPoseForRun(run) : IDLE_POSE
  const intent = primaryIntent(run, started, activeStepMode, phase)
  const stableDecision = returned && (activeStepMode || phase === 'settled')
  const stableTerminal = terminal && (activeStepMode || phase === 'settled')
  const primaryLabel = intent === 'start'
    ? 'Run model'
    : intent === 'pause'
      ? 'Pause'
      : intent === 'resume'
        ? 'Resume'
        : intent === 'correct'
          ? run.returnFrom === 'critique'
            ? 'Revise plan'
            : 'Repair & retry'
          : intent === 'restart'
            ? 'Run again'
            : 'Advance illustration'

  const handlePrimary = () => {
    if (!lockInput()) return
    const currentRun = runRef.current
    const currentStarted = startedRef.current
    const currentStepMode = currentStarted && stepRunActiveRef.current
    const currentIntent = primaryIntent(currentRun, currentStarted, currentStepMode, phaseRef.current)
    if (currentIntent === 'start') {
      startRun(runRef.current, !motionReady)
      return
    }
    if (currentIntent === 'pause') {
      controllerRef.current?.pause()
      updatePhase('paused')
      setAnnouncement('Illustration paused. Resume explicitly to continue.')
      return
    }
    if (currentIntent === 'resume') {
      updatePhase('playing')
      setAnnouncement('Illustration resumed.')
      const resumed = controllerRef.current?.resume() ?? false
      if (!resumed) animateSpan()
      return
    }
    if (currentIntent === 'correct') {
      correctAndContinue({ type: currentRun.returnFrom === 'critique' ? 'revise' : 'repair' })
      return
    }
    if (currentIntent === 'restart') {
      const fresh = reset(scenario)
      startRun(fresh, !motionReady)
      return
    }
    if (currentIntent === 'advance') {
      advanceOne()
    }
  }

  return (
    <section
      ref={wrapperRef}
      className="run-instrument"
      data-run-model="true"
      data-verdict={run.verdict}
      data-stage={started ? ['plan', 'critique', 'implementation', 'checks', 'review', 'outcome'][run.stage] : 'idle'}
      data-fault={run.fault}
      data-returned={returned ? 'true' : 'false'}
      data-playback={activeStepMode ? 'step' : phase}
      aria-label="Interactive delivery illustration"
    >
      <div className="loop-workbench">
        <div ref={stageRef} className="loop-scene" data-pose={staticPose.id}>
          <StaticWorkbench pose={staticPose} />
          <div className="loop-scene-vignette" aria-hidden="true" />
        </div>

        <div className="loop-console">
          <div className="loop-readout">
            <p>{description.role}</p>
            <h2>{description.title}</h2>
            <p>{description.detail}</p>
          </div>

          <div className="loop-budgets" aria-label="Illustration limits">
            <span>Plan revisions: {run.planRevisions} / 1 · {repairBudgetText(run)}</span>
            <span className="loop-tabs-text">Physical repair tabs: {MODEL_REPAIR_LIMIT - run.repairs} remaining</span>
          </div>

          <div className="loop-controls">
            <label className="loop-scenario">
              <span>Illustration</span>
              <select
                aria-label="Illustration"
                value={scenario}
                disabled={started}
                onChange={(event) => {
                  const nextScenario = event.currentTarget.value as RunScenario
                  setScenario(nextScenario)
                  const fresh = createInitialRun(nextScenario)
                  runRef.current = fresh
                  dispatch({ type: 'reset', scenario: nextScenario })
                  setAnnouncement(`${RUN_SCENARIOS.find(({ value }) => value === nextScenario)?.label} illustration selected.`)
                }}
              >
                {RUN_SCENARIOS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <button
              ref={primaryRef}
              type="button"
              className="world-button loop-primary"
              onClick={handlePrimary}
            >
              {primaryLabel}
            </button>

            {started && !activeStepMode && (phase === 'playing' || phase === 'paused' || phase === 'replay') ? (
              <button type="button" className="world-button loop-skip" onClick={skipSpan}>Skip motion</button>
            ) : null}
            {stableDecision ? (
              <button type="button" className="world-button loop-retry" onClick={retryUnchanged}>Retry unchanged</button>
            ) : null}
            {(stableDecision || stableTerminal) && lastReturn ? (
              <button type="button" className="world-button loop-replay" onClick={replayReturn}>Replay return</button>
            ) : null}
            {started ? (
              <button type="button" className="world-button loop-reset" onClick={() => {
                if (!lockInput()) return
                reset()
                primaryRef.current?.focus()
              }}>Reset</button>
            ) : null}
          </div>

          <p className="loop-announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
          <p className="loop-bound-copy">{RUN_BOUND_TEXT}</p>
        </div>
      </div>

      <p className="instrument-disclaimer">
        Illustrative model. No agents, checks or deployments execute here. Plan and repair bounds belong to this illustration.
      </p>
    </section>
  )
}
