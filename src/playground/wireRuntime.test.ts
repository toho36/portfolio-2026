import { expect, it } from 'vitest'
import { attachWireInput } from './wireRuntime'

it('removes every input listener on detach', () => {
  const target = new EventTarget()
  const seen: string[] = []
  const detach = attachWireInput(target, {
    pointerdown: () => seen.push('down'), pointermove: () => seen.push('move'),
    pointerup: () => seen.push('up'),
  })
  for (const name of ['pointerdown', 'pointermove', 'pointerup']) target.dispatchEvent(new Event(name))
  detach()
  for (const name of ['pointerdown', 'pointermove', 'pointerup']) target.dispatchEvent(new Event(name))
  expect(seen).toEqual(['down', 'move', 'up'])
})
