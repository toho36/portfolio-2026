import { deckPosition, settleSheet, settleEase, coastPosition } from './model.js'

export function createDeckAssist(root,isReduced) {
  let frame=0,timer=0,lastY=scrollY,lastTime=performance.now(),velocity=0,direction=0,programmatic=false,pointerDown=false,touchHeld=false
  let coast=null,lastInput=-Infinity,inputDirection=0,edge=null
  let sampleFrame=0,paintTime=performance.now()
  function sample(now){paintTime=now;sampleFrame=requestAnimationFrame(sample)}
  sampleFrame=requestAnimationFrame(sample)
  const allowed=()=>!document.hidden&&!document.querySelector('dialog[open]')&&scrollY>=0&&scrollY<=innerHeight*1.7+2
  function cancel(){clearTimeout(timer);timer=0;cancelAnimationFrame(frame);frame=0;coast=null;programmatic=false;root.dataset.settling='false'}
  function move(index,assisted=false){
    cancel();if(document.hidden||document.querySelector('dialog[open]')||(assisted&&!allowed()))return
    const target=Math.max(0,Math.min(2,index))*innerHeight*.85,from=scrollY
    if(Math.abs(target-from)<1)return
    if(isReduced()){window.scrollTo({top:target,behavior:'instant'});lastY=scrollY;return}
    programmatic=true;root.dataset.settling='true'
    const start=performance.now(),duration=650
    function tick(now){
      if(document.hidden||document.querySelector('dialog[open]')){cancel();return}
      const p=Math.min(1,(now-start)/duration)
      window.scrollTo({top:from+(target-from)*settleEase(p),behavior:'instant'})
      lastY=scrollY;lastTime=now
      if(p<1)frame=requestAnimationFrame(tick)
      else{frame=0;programmatic=false;lastY=scrollY;root.dataset.settling='false'}
    }
    frame=requestAnimationFrame(tick)
  }
  function follow(now){
    frame=0
    if(!allowed()||pointerDown||touchHeld||isReduced()){cancel();return}
    const current=scrollY,delta=current-lastY,step=innerHeight*.85
    if(delta){
      velocity=delta/Math.max(1,now-lastTime);direction=Math.sign(delta)
      const index=direction>0?Math.ceil(current/step):Math.floor(current/step)
      // Only a new native sample can pass the frozen destination; own writes update lastY.
      if(edge!==null&&(current-edge*step)*direction>0)edge=Math.max(0,Math.min(2,index))
      const target=(edge??Math.max(0,Math.min(2,index)))*step
      coast={from:current,target,velocity,start:now}
      lastY=current;lastTime=now
      root.dataset.settling='false'
    }else if(coast){
      const {from,target,velocity,start}=coast
      if((target-from)*velocity<=0){cancel();return}
      const next=coastPosition(from,target,velocity,now-start)
      root.dataset.settling='true'
      window.scrollTo({top:next,behavior:'instant'})
      lastY=scrollY;lastTime=now
      if(next===target){cancel();return}
    }else{return}
    frame=requestAnimationFrame(follow)
  }
  function quiet(){
    if(!allowed()||programmatic||pointerDown||touchHeld)return
    if(isReduced()){clearTimeout(timer);timer=window.setTimeout(()=>{if(allowed()&&!pointerDown&&!touchHeld)move(settleSheet(deckPosition(scrollY,innerHeight*.85),direction),true)},260);return}
    if(!frame)frame=requestAnimationFrame(follow)
  }
  function scroll(){
    if(scrollY===lastY||programmatic)return
    if(!allowed()){cancel();lastY=scrollY;lastTime=performance.now();velocity=0;return}
    if(isReduced()){direction=Math.sign(scrollY-lastY);lastY=scrollY;quiet();return}
    if(pointerDown||touchHeld){const now=performance.now();velocity=(scrollY-lastY)/Math.max(1,now-lastTime);direction=Math.sign(velocity);lastY=scrollY;lastTime=now;return}
    quiet()
  }
  function input(event){
    const now=performance.now(),sign=Math.sign(event.deltaY)
    if(!sign)return
    if(now-lastInput>260||sign!==inputDirection){const p=scrollY/(innerHeight*.85);edge=Math.max(0,Math.min(2,sign>0?Math.floor(p)+1:Math.ceil(p)-1))}
    lastInput=now;inputDirection=sign
    cancel();if(now-lastTime>80)lastTime=paintTime
  }
  function down(event){if(event.type==='touchstart')touchHeld=true;else if(event.pointerType!=='touch')pointerDown=true;cancel();edge=null;lastY=scrollY;lastTime=performance.now();velocity=0}
  function up(event){
    if(event.type==='touchend'||event.type==='touchcancel')touchHeld=Boolean(event.touches?.length);else if(event.pointerType!=='touch')pointerDown=false
    if(pointerDown||touchHeld||!allowed())return
    if(performance.now()-lastTime>80||!velocity){move(settleSheet(deckPosition(scrollY,innerHeight*.85),direction),true);return}
    const step=innerHeight*.85,target=(velocity>0?Math.ceil(scrollY/step):Math.floor(scrollY/step))*step
    coast={from:scrollY,target,velocity,start:performance.now()};quiet()
  }
  function key(event){if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)){cancel();edge=null;lastTime=performance.now();velocity=0}}
  function visibility(){if(document.hidden){cancel();cancelAnimationFrame(sampleFrame);sampleFrame=0}else if(!sampleFrame){lastY=scrollY;lastTime=paintTime=performance.now();sampleFrame=requestAnimationFrame(sample)}}
  addEventListener('scroll',scroll,{passive:true});addEventListener('wheel',input,{passive:true});addEventListener('touchstart',down,{passive:true});addEventListener('touchend',up,{passive:true});addEventListener('touchcancel',up);addEventListener('pointerdown',down);addEventListener('pointerup',up);addEventListener('pointercancel',up);addEventListener('keydown',key);addEventListener('resize',cancel);document.addEventListener('visibilitychange',visibility)
  return {move,cancel,destroy(){cancel();cancelAnimationFrame(sampleFrame);removeEventListener('scroll',scroll);removeEventListener('wheel',input);removeEventListener('touchstart',down);removeEventListener('touchend',up);removeEventListener('touchcancel',up);removeEventListener('pointerdown',down);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);removeEventListener('keydown',key);removeEventListener('resize',cancel);document.removeEventListener('visibilitychange',visibility)}}
}
