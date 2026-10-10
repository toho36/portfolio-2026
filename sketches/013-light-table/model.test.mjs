import test from 'node:test'
import assert from 'node:assert/strict'
import { sheetPose, deckPosition } from './model.js'

test('continuous scroll deals the front sheet and reverses to the identical fan', () => {
  const start=sheetPose(0,0), half=sheetPose(0,.5), end=sheetPose(0,1)
  assert.ok(half.x<start.x && end.x<half.x)
  assert.deepEqual(sheetPose(0,0),start)
  assert.equal(sheetPose(1,1).x,start.x)
  assert.equal(sheetPose(1,1).rotation,start.rotation)
  assert.equal(deckPosition(300,600),.5)
  assert.equal(deckPosition(-20,600),0)
  assert.equal(deckPosition(9999,600),2)
  assert.equal(deckPosition(NaN,0),0)
})
