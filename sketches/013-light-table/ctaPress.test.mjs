import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { transformWithOxc } from 'vite'

// Exercise the actual mapped CTA handlers without starting a browser or renderer.
const source=readFileSync(new URL('./study.jsx',import.meta.url),'utf8')
const anchor=source.match(/<a className="sheet-cta"[\s\S]*?<\/a>/)[0]
const {code}=await transformWithOxc(`const link=(sheet,index,position,enter)=>(${anchor})`,'cta.jsx',{jsx:{runtime:'classic'}})
const link=new Function('React',`${code};return link`)(React)

test('all three CTAs press only for the primary button and clear on every exit without taking over input',()=>{
  for(const [index,id] of ['goal-loop','gameonvb','intro'].entries()){
    const enter=()=>{},href=index<2?`#${id}`:`/${id}`
    const {props}=link({href},index,index,enter)
    assert.equal(props.href,href)
    assert.equal(props.onClick,index<2?enter:undefined)
    const currentTarget={dataset:{},setPointerCapture(){assert.fail('pointer captured')}}
    const event={currentTarget,isPrimary:true,button:0,preventDefault(){assert.fail('native input prevented')}}
    assert.equal(typeof props.onPointerDown,'function','explicit press handler missing')
    for(const ignored of [{isPrimary:false,button:0},{isPrimary:true,button:1},{isPrimary:true,button:2}]){
      props.onPointerDown({...event,...ignored})
      assert.equal(currentTarget.dataset.pressed,undefined)
    }
    for(const exit of ['onPointerUp','onPointerCancel','onPointerLeave','onBlur']){
      props.onPointerDown(event)
      assert.equal(currentTarget.dataset.pressed,'true')
      props[exit](event)
      assert.equal(currentTarget.dataset.pressed,undefined,`${id}: stuck after ${exit}`)
    }
  }
})

test('GameOnVB enters its native prototype hash and exposes a separate production link',()=>{
  assert.match(source,/id: 'gameonvb'[\s\S]*?href: '#gameonvb'/)
  assert.match(source,/<dialog className="ball-entry"/)
  assert.ok(source.indexOf('<dialog className="goal-entry"')<source.indexOf('<dialog className="ball-entry"'),'goal dialog must remain first')
  assert.match(source,/href="http:\/\/127\.0\.0\.1:5181\/gameonvb"/)
})
