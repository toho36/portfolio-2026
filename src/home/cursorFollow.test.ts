import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCursorFollow } from './cursorFollow'

describe('cursor follow', () => {
  let frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => { frames = [] })
  const flush = () => { const run = frames; frames = []; run.forEach((cb) => cb(0)) }
  afterEach(() => { frames = [] })

  it('snaps on first move, eases after, then stops the loop', () => {
    const el = { style: { transform: '' } }
    const follow = createCursorFollow(el, () => true)
    follow.move(100, 50)
    expect(el.style.transform).toBe('translate3d(100px, 50px, 0)')
    follow.move(200, 50)
    follow.move(200, 50)
    expect(frames).toHaveLength(1)
    flush()
    expect(el.style.transform).toBe('translate3d(118px, 50px, 0)')
    for (let i = 0; i < 200 && frames.length; i++) flush()
    expect(frames).toHaveLength(0)
    expect(el.style.transform).toBe('translate3d(200px, 50px, 0)')
  })

  it('writes 1:1 without smoothing and re-snaps after stop', () => {
    const el = { style: { transform: '' } }
    let smooth = false
    const follow = createCursorFollow(el, () => smooth)
    follow.move(10, 10)
    follow.move(300, 20)
    expect(el.style.transform).toBe('translate3d(300px, 20px, 0)')
    expect(frames).toHaveLength(0)
    smooth = true
    follow.move(400, 20)
    follow.stop()
    expect(frames).toHaveLength(0)
    follow.move(5, 5)
    expect(el.style.transform).toBe('translate3d(5px, 5px, 0)')
  })
})
