import { describe, expect, it } from 'vitest'
import { createMachineState, transitionMachine } from './runtime'
import {
  actionForExactProjectHash,
  createConsoleInitialState,
  deriveRendererPresentation,
  elementIdForFocusRequest,
  projectElementId,
  resumePauseAction,
  routeConsoleKey,
  toggleUserPauseAction,
} from './consoleAdapter'

describe('console adapter navigation and focus policy', () => {
  it('initializes hash, reduced motion, and hidden state together', () => {
    const state = createConsoleInitialState({
      hash: '#project-suburbs',
      reducedMotion: true,
      documentHidden: true,
    })

    expect(state.selectedCartridge).toBe(1)
    expect(state.reducedMotion).toBe(true)
    expect(state.pauseCauses.hidden).toBe(true)
  })

  it('accepts only exact canonical project hashes', () => {
    expect(actionForExactProjectHash('#project-screen-switch')).toEqual({
      type: 'direct-project',
      index: 2,
    })
    expect(actionForExactProjectHash('#project-screen')).toBeNull()
    expect(actionForExactProjectHash('#project-screen-switch/more')).toBeNull()
    expect(actionForExactProjectHash('project-screen-switch')).toBeNull()
    expect(actionForExactProjectHash('')).toBeNull()
  })

  it('maps runtime focus requests to stable semantic element IDs', () => {
    expect(elementIdForFocusRequest({ kind: 'cartridge-list' })).toBe(
      'cartridge-list',
    )
    expect(
      elementIdForFocusRequest({ kind: 'project', cartridge: 3 }),
    ).toBe('project-voleyevents')
    expect(projectElementId(0)).toBe('project-gameonvb')
  })
})

describe('console adapter keyboard policy', () => {
  it('routes Escape from every console zone', () => {
    for (const zone of [
      'cartridge-handle',
      'machine-control',
      'native-link',
    ] as const) {
      expect(routeConsoleKey('Escape', zone)).toEqual({
        action: { type: 'skip-machine' },
        preventDefault: true,
      })
    }
  })

  it('routes shared machine keys only from the cartridge handle', () => {
    expect(routeConsoleKey('ArrowRight', 'cartridge-handle')).toEqual({
      action: { type: 'nudge-module', dx: 0.05, dy: 0 },
      preventDefault: true,
    })
    expect(routeConsoleKey('Enter', 'cartridge-handle')).toEqual({
      action: { type: 'activate-module' },
      preventDefault: true,
    })
    expect(routeConsoleKey(' ', 'cartridge-handle')).toEqual({
      action: { type: 'activate-module' },
      preventDefault: true,
    })
    expect(routeConsoleKey('ArrowRight', 'native-link')).toBeNull()
    expect(routeConsoleKey('Enter', 'machine-control')).toBeNull()
    expect(routeConsoleKey(' ', 'machine-control')).toBeNull()
  })
})

describe('console adapter pause and presentation policy', () => {
  it('changes only the requested pause cause', () => {
    let state = createMachineState()
    state = transitionMachine(state, {
      type: 'set-document-hidden',
      hidden: true,
    })
    state = transitionMachine(state, { type: 'skip-machine' })

    const userPaused = transitionMachine(state, toggleUserPauseAction(state))
    expect(userPaused.pauseCauses).toEqual({
      user: true,
      hidden: true,
      skip: true,
    })

    const userResumed = transitionMachine(
      userPaused,
      resumePauseAction('user'),
    )
    expect(userResumed.pauseCauses).toEqual({
      user: false,
      hidden: true,
      skip: true,
    })

    const skipResumed = transitionMachine(
      userResumed,
      resumePauseAction('skip'),
    )
    expect(skipResumed.pauseCauses).toEqual({
      user: false,
      hidden: true,
      skip: false,
    })
  })

  it('derives distinct checking, fallback, paused, reduced, and ready messages', () => {
    expect(
      deriveRendererPresentation('checking', false, false).label,
    ).toBe('Checking renderer')
    expect(
      deriveRendererPresentation('loading', false, false).label,
    ).toBe('Starting viewport')
    expect(
      deriveRendererPresentation('no-webgl', false, false).label,
    ).toBe('Native console active')
    expect(
      deriveRendererPresentation('lazy-error', false, false).detail,
    ).toContain('module')
    expect(
      deriveRendererPresentation('render-error', false, false).detail,
    ).toContain('renderer')
    expect(deriveRendererPresentation('ready', true, false).tone).toBe(
      'paused',
    )
    expect(
      deriveRendererPresentation('ready', false, true).label,
    ).toBe('Reduced motion')
    expect(
      deriveRendererPresentation('ready', false, false).label,
    ).toBe('Renderer ready')
  })
})
