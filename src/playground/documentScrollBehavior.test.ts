import { describe, expect, it } from 'vitest'
import {
  RELAY_SCROLL_OWNER_CLASS,
  installDocumentScrollBehavior,
} from './documentScrollBehavior'

function classRoot(...tokens: string[]) {
  const classes = new Set(tokens)

  return {
    root: {
      classList: {
        add(token: string) {
          classes.add(token)
        },
        contains(token: string) {
          return classes.has(token)
        },
        remove(token: string) {
          classes.delete(token)
        },
      },
    } as HTMLElement,
    classes,
  }
}

describe('document scroll behavior owner', () => {
  it('adds and removes only its route class', () => {
    const { root, classes } = classRoot('foreign', 'motion-ready')
    const owner = installDocumentScrollBehavior(root)

    expect([...classes]).toEqual([
      'foreign',
      'motion-ready',
      RELAY_SCROLL_OWNER_CLASS,
    ])

    owner.destroy()
    owner.destroy()
    expect([...classes]).toEqual(['foreign', 'motion-ready'])
  })

  it('does not claim or remove a class that already existed', () => {
    const { root, classes } = classRoot(RELAY_SCROLL_OWNER_CLASS, 'foreign')
    const owner = installDocumentScrollBehavior(root)

    expect(owner.added).toBe(false)
    owner.destroy()
    expect(classes.has(RELAY_SCROLL_OWNER_CLASS)).toBe(true)
    expect(classes.has('foreign')).toBe(true)
  })
})
