import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { staticLanding } from './ballSteps.js'

const css=readFileSync(new URL('./study.css',import.meta.url),'utf8')
const rules=[...css.matchAll(/\.ball-entry-caption \{([^}]+)\}/g)].map(([,body])=>Object.fromEntries(body.split(';').filter(s=>s.includes(':')).map(s=>s.trim().split(/:\s*/))))

test('caption is bounded at bottom-left away from the settled ball in all requested viewports',()=>{
  // A conservative 130px caption envelope, not a claim about native font pixels.
  for(const [width,height] of [[1440,1000],[1000,900],[768,1024],[390,844],[320,780]]){
    const style={...rules[0],...(width<=760?rules[1]:{})}
    assert.equal(style.top,'auto','caption still occupies the ball landing lane')
    assert.ok(style.right,'caption must be constrained on narrow viewports')
    const bottom=parseFloat(style.bottom),top=height-bottom-130,pose=staticLanding(width/height)
    assert.ok(Number.isFinite(bottom)&&bottom>=18)
    assert.ok(top>pose.ball.y*height+pose.ball.diameter*height/2+24,`${width}x${height}: caption envelope intersects projected ball`)
  }
})
