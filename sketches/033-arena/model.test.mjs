import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, transition, finish, mediaVariant, nextSegment, posterName, titles, segments, stopCount, counterLabel } from './model.js';
test('five forward moves complete only after playback; sixth yields native scroll', () => {
 let state = initialState();
 for (const segment of segments) {
  const move = transition(state, 1);
  assert.equal(move.segment, segment);
  assert.equal(move.state.stop, state.stop);
  assert.equal(transition(move.state, -1).action, 'ignore');
  assert.equal(transition(move.state, 1).action, 'ignore');
  state = finish(move.state);
 }
 assert.equal(state.stop, stopCount - 1);
 assert.equal(transition(state, 1).action, 'scroll');
 assert.equal(nextSegment(state.stop), null);
});
test('five previous moves play explicit reverse clips and commit only on finish', () => {
 assert.equal(transition(initialState(), -1).action, 'ignore');
 for (let stop = 5; stop > 0; stop--) {
  const prev = transition({ stop, moving: false, destination: null }, -1);
  assert.equal(prev.action, 'play');
  assert.equal(prev.segment, `${segments[stop-1]}-reverse`);
  assert.equal(prev.state.stop, stop);
  assert.equal(prev.state.destination, stop-1);
  assert.equal(transition(prev.state, 1).action, 'ignore');
  assert.equal(finish(prev.state).stop, stop-1);
 }
});
test('reduced motion switches stills with input gate until fade completes', () => {
 const move = transition(initialState(), 1, true);
 assert.equal(move.action, 'still');
 assert.equal(transition(move.state, 1, true).action, 'ignore');
 assert.equal(finish(move.state).stop, 1);
});
test('orientation, stops and preload mapping', () => {
 assert.equal(mediaVariant(true), 'mobile'); assert.equal(mediaVariant(false), 'desktop');
 assert.deepEqual([0,1,2,3,4,5].map(posterName), ['poster','stop-1','stop-2','stop-3','stop-4','stop-5']);
 assert.deepEqual([0,1,2,3,4,5].map(nextSegment), ['segA','segB','segC','segD','segE',null]);
});

test('every reduced-motion destination and reverse step keeps the input gate', () => {
 let state = initialState();
 for (let stop = 1; stop < stopCount; stop++) {
  const move = transition(state, 1, true);
  assert.equal(move.action, 'still');
  assert.equal(move.state.destination, stop);
  assert.equal(transition(move.state, -1).action, 'ignore');
  state = finish(move.state);
 }
 for (let stop = stopCount - 2; stop >= 0; stop--) {
  const move = transition(state, -1, true);
  assert.equal(move.action, 'still');
  state = finish(move.state);
  assert.equal(state.stop, stop);
 }
 assert.equal(transition(state, -1).action, 'ignore');
});

test('six stops share chapter counts, including both Goal Loop endpoints', () => {
 assert.equal(stopCount, segments.length + 1);
 assert.deepEqual(titles, ['Hoang Viet To', 'GameOnVB', 'Goal Loop', 'Goal Loop', 'Screen Switch', 'Playground']);
 assert.deepEqual(titles.map((_, stop) => counterLabel(stop)), ['01 / 06', '02 / 06', '03 / 06', '04 / 06', '05 / 06', '06 / 06']);
 for (let stop = 0; stop < stopCount; stop++) {
  const state = { stop, moving: false, destination: null };
  assert.equal(finish(state), state);
  assert.equal(transition(state, 0).action, 'ignore');
  if (stop > 0) assert.equal(finish(transition(state, -1).state).stop, stop - 1);
 }
});

// Execute the real event handlers with a small DOM/media boundary; no browser required.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import * as model from './model.js';
function player({ reducedMotion = false, pendingMedia = [], videoFrames = false, onExit = null } = {}) {
 const timers = new Map(), requests = [], decodes = [], nodes = new Map(), plays = [];
 let clock = 0, id = 0;
 function node() {
  return { style: {}, dataset: {}, hidden: false, disabled: false, src: '', srcset: '', textContent: '',
   listeners: {}, classes: new Set(), paused: true, loads: 0, playbackRate: 1, playedSources: [], readyState: 3, seeking: false, currentTime: 0,
   addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
   removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(listener => listener !== fn); },
   fire(type, event = {}) { for (const fn of this.listeners[type] ?? []) fn(event); },
   pause() { this.paused = true; }, play() {
    this.playedSources.push(this.src);
    this.paused = false;
    if (pendingMedia.some(key => nodes.get(key) === this)) return new Promise((resolve,reject) => plays.push({ media: this, resolve, reject }));
    return Promise.resolve();
   },
   load() { this.loads++; (this.loadedSources ??= []).push(this.src); }, removeAttribute(name) { this[name] = ''; },
   getBoundingClientRect() { return { top: 0, bottom: 900, width: 1600, height: 900 }; },
   scrollIntoView() { this.scrolled = true; }, focus() { this.focused = true; },
   decode() { return new Promise((resolve, reject) => decodes.push({ resolve, reject, src: this.src })); },
   closest() { return null; }, tagName: 'DIV',
   classList: { toggle() {} },
  };
 }
 for (const key of ['.hero','#still','#film','img','source','#next','#prev','#skip','#following','#announcement','#error','#count','#finding','#gameon-hold','#ambient','#gameon-peek']) nodes.set(key,node());
 nodes.get('#ambient').loop = true;
 if (videoFrames) for (const key of ['#ambient','#film']) {
  const media=nodes.get(key); media.frames=new Map();
  media.requestVideoFrameCallback=fn=>{ media.frames.set(++id,fn); return id; };
  media.cancelVideoFrameCallback=id=>media.frames.delete(id);
 }
 nodes.get('#gameon-hold').hidden = true;
 nodes.get('#gameon-peek').hidden = true;
 nodes.get('img').src = './media/desktop/poster.webp';
 nodes.get('#still').querySelector = key => nodes.get(key);
 const copies = [0,1,2,3,4,5].map(stop => ({ ...node(), dataset: { stop: String(stop) } }));
 const document = { ...node(), querySelector: key => nodes.get(key), querySelectorAll: () => copies, hidden: false };
 const window = node(), portrait = { ...node(), matches: false }, reduced = { ...node(), matches: reducedMotion };
 class Image { set src(value) { this.url = value; requests.push(value); } get src() { return this.url; } decode() { return node().decode.call(this); } }
 Object.assign(nodes.get('.hero'), { querySelector: key => nodes.get(key), querySelectorAll: () => copies });
 runInNewContext(readFileSync(new URL('../../src/home/arena/player.js',import.meta.url),'utf8').replace(/^import .*?;\n/,'').replace('export function mountArena','function mountArena')
  + "\nmountArena(document.querySelector('.hero'), { following: document.querySelector('#following'), onExit: hostExit });",
  { ...model, document, window, Image, AbortController, hostExit: onExit, performance: { now: () => clock }, innerHeight: 900, matchMedia: query => query.includes('reduced') ? reduced : portrait,
   setTimeout(fn,delay) { timers.set(++id,{ fn, at: clock+delay }); return id; }, clearTimeout(id) { timers.delete(id); } });
 const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
 return { nodes, copies, document, window, reduced, portrait, requests, decodes, plays, flush,
  frame(key, time = nodes.get(key).currentTime) { const media=nodes.get(key); for (const [id,fn] of [...media.frames]) { media.frames.delete(id); fn(clock,{ mediaTime:time }); } },
  async decode(ok = true) { for (const d of decodes.splice(0)) ok ? d.resolve() : d.reject(new Error('missing poster')); await flush(); },
  async tick(ms) { clock += ms; for (const [id,t] of [...timers]) if (t.at <= clock) { timers.delete(id); t.fn(); } await flush(); },
  event(target,type,props={}) { const e = { target: node(), preventDefault() { this.prevented = true; }, ...props }; target.fire(type,e); return e; },
 };
}

test('Skip cancels an active film, loads its next still and focuses following content', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#skip'),'click'); await p.decode();
 assert.equal(p.nodes.get('#film').paused,true);
 assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 assert.equal(p.nodes.get('#following').focused,true);
 assert.equal(p.nodes.get('#following').scrolled,true);
 await p.tick(10000); assert.equal(p.nodes.get('#film').paused,true);
});
test('Escape ends a move at the next still and keeps focus at the hero', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.window,'keydown',{ key: 'Escape' }); await p.decode();
 assert.equal(p.nodes.get('#film').paused,true);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 assert.equal(p.nodes.get('.hero').focused,true);
 assert.equal(p.nodes.get('#following').scrolled,undefined);
});
test('during travel, small gestures are held and one downward gesture lands on the destination', async () => {
 for (const touch of [false,true]) {
  const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  if (touch) p.event(p.nodes.get('.hero'),'touchstart',{ touches: [{ clientY: 200 }] });
  const small = touch ? p.event(p.nodes.get('.hero'),'touchmove',{ touches: [{ clientY: 195 }] }) : p.event(p.window,'wheel',{ deltaY: 4 });
  assert.equal(small.prevented,true); assert.equal(p.nodes.get('#film').paused,false);
  const strong = touch ? p.event(p.nodes.get('.hero'),'touchmove',{ touches: [{ clientY: 100 }] }) : p.event(p.window,'wheel',{ deltaY: 100 });
  await p.decode();
  assert.equal(strong.prevented,true);
  assert.equal(p.nodes.get('#film').paused,true);
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
  assert.equal(p.nodes.get('#count').textContent,'02 / 06');
  assert.equal(p.nodes.get('#following').focused,undefined);
 }
});
test('Next during travel lands on the destination; Skip still leaves the hero', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#next').disabled,false);
 p.event(p.nodes.get('#next'),'click'); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp'); assert.equal(p.copies[1].hidden,false);
 assert.equal(p.nodes.get('#following').focused,undefined);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(p.event(p.window,'keydown',{ key:'ArrowDown' }).prevented,true); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
});
test('a hurried arrival shows the decoded destination still, not the mid-travel frame', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#next'),'click'); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 assert.equal(p.nodes.get('#film').style.visibility,'hidden');
});
test('slow wheel pans add up inside the hero; momentum from below cannot turn a chapter', async () => {
 const p = player(); await p.decode();
 for (let i=0;i<3;i++) assert.equal(p.event(p.window,'wheel',{ deltaY: 3 }).prevented,true);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segA.mp4'); await p.tick(150);
 assert.equal(p.nodes.get('#film').paused,false);
 p.event(p.nodes.get('#film'),'ended'); await p.decode(); await p.tick(300);
 const hero = p.nodes.get('.hero'), rect = hero.getBoundingClientRect;
 hero.getBoundingClientRect = () => ({ top: -400, bottom: 500 });
 p.event(p.window,'wheel',{ deltaY: -40 }); await p.tick(50);
 hero.getBoundingClientRect = rect;
 assert.equal(p.event(p.window,'wheel',{ deltaY: -40 }).prevented,true); await p.tick(150);
 assert.equal(p.nodes.get('#count').textContent,'02 / 06');
});
test('a short first touchmove is held so native scrolling cannot start before the threshold', async () => {
 const p = player(); await p.decode();
 p.event(p.nodes.get('.hero'),'touchstart',{ touches: [{ clientY: 200 }] });
 assert.equal(p.event(p.nodes.get('.hero'),'touchmove',{ touches: [{ clientY: 188 }] }).prevented,true);
 assert.equal(p.nodes.get('#film').paused,true);
});
test('with a host exit, Skip and every forward input at the last stop hand over instead of scrolling', async () => {
 for (const route of ['skip','next','wheel','key','touch']) {
  let exits = 0;
  const p = player({ onExit: () => exits++ });
  if (route === 'skip') { await p.decode(); p.event(p.nodes.get('#skip'),'click'); await p.decode(); }
  else {
   await reachPlayground(p); p.event(p.nodes.get('#film'),'ended'); await p.decode(); await p.tick(300);
   const e = route === 'next' ? p.event(p.nodes.get('#next'),'click')
    : route === 'wheel' ? p.event(p.window,'wheel',{ deltaY: 100 })
    : route === 'key' ? p.event(p.window,'keydown',{ key: 'ArrowDown' })
    : (p.event(p.nodes.get('.hero'),'touchstart',{ touches: [{ clientY: 200 }] }), p.event(p.nodes.get('.hero'),'touchmove',{ touches: [{ clientY: 100 }] }));
   if (route !== 'next') assert.equal(e.prevented,true,route);
  }
  assert.equal(exits,1,route);
  assert.equal(p.nodes.get('#following').focused,undefined); assert.equal(p.nodes.get('#following').scrolled,undefined);
 }
});
test('travel uses its segment rate and resets on each source', () => {
 assert.deepEqual(['segA','segB','segC','segD','segE'].map(model.travelRate),[1.25,1,1.5,1.75,1.5]);
 assert.equal(model.travelRate('segC-reverse'),1.5); assert.equal(model.travelRate(undefined),1);
});
test('poster decode gates video preload, including reduced motion', async () => {
 const p = player(); assert.equal(p.nodes.get('#film').src,''); assert.equal(p.nodes.get('#film').loads,0);
 await p.decode(); assert.equal(p.nodes.get('#film').src,'./media/desktop/segA.mp4');
 const r = player({ reducedMotion: true }); await r.decode(); assert.equal(r.nodes.get('#film').src,'');
});
test('missing destination poster preserves last valid still and matching origin copy', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'ended'); await p.decode(false);
 assert.equal(p.nodes.get('img').src,'./media/desktop/poster.webp');
 assert.equal(p.nodes.get('#error').hidden,false);
 assert.equal(p.copies[0].hidden,false); assert.equal(p.copies[1].hidden,true);
 assert.equal(p.nodes.get('#count').textContent,'01 / 06');
});
test('waiting beyond two seconds and errors decode the destination still; hidden document pauses', async () => {
 for (const event of ['waiting','error']) {
  const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  p.event(p.nodes.get('#film'),event); await p.tick(2001);
  assert.equal(p.nodes.get('#film').paused,true);
  assert.equal(p.nodes.get('img').src,'./media/desktop/poster.webp');
  assert.equal(p.nodes.get('#error').hidden,false);
  await p.decode();
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
  assert.equal(p.nodes.get('#count').textContent,'02 / 06');
  assert.equal(p.nodes.get('#error').hidden,false);
 }
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.document.hidden = true; p.event(p.document,'visibilitychange');
 assert.equal(p.nodes.get('#film').paused,true);
});

test('copy is hidden before playback and restored only after the destination decode', async () => {
 const p = player(); const toggles = [];
 p.nodes.get('.hero').classList.toggle = (...args) => toggles.push(args);
 await p.decode(); p.event(p.nodes.get('#next'),'click');
 assert.ok(toggles.some(([name,value]) => name === 'moving' && value));
 assert.equal(p.nodes.get('#film').paused,true);
 await p.tick(149); assert.equal(p.nodes.get('#film').paused,true);
 await p.tick(1); assert.equal(p.nodes.get('#film').paused,false);
 p.event(p.nodes.get('#film'),'ended');
 assert.equal(toggles.at(-1)[1],true);
 await p.decode(); assert.deepEqual(toggles.at(-1),['moving',false]);
});
test('Skip before the fade finishes cannot start playback later; failed poster keeps current', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click');
 p.event(p.nodes.get('#skip'),'click'); await p.decode(false); await p.tick(5000);
 assert.equal(p.nodes.get('#film').paused,true);
 assert.equal(p.nodes.get('img').src,'./media/desktop/poster.webp');
 assert.equal(p.nodes.get('#following').focused,true);
});
test('a recovered stall does not cancel playback, and a later segment can still time out', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#film'),'waiting'); await p.tick(1000);
 p.event(p.nodes.get('#film'),'playing'); await p.tick(2001);
 assert.equal(p.nodes.get('#film').paused,false);
 p.event(p.nodes.get('#film'),'ended'); await p.decode();
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'waiting'); await p.tick(2001);
 assert.equal(p.nodes.get('#film').paused,true);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 await p.decode(); assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
});
test('captions report completed actions with Actor: finding syntax', () => {
 assert.equal(model.findingAtFrame(303),'');
 assert.equal(model.findingAtFrame(304),'Check: crack found');
 assert.equal(model.findingAtFrame(379),'Build: repair piece taken');
 assert.equal(model.findingAtFrame(388),'Build: crack joined; 1 repair piece left');
 assert.equal(model.findingAtFrame(420),'Check: joint holds');
 assert.equal(model.findingAtFrame(446),'Review: fit confirmed');
});

test('lab paragraph band exceeds 4.5:1 even over pure black; copy preserves owner facts', () => {
 const css = readFileSync(new URL('../../src/home/arena/arena.css',import.meta.url),'utf8');
 const band = css.match(/\.hero\.lab \.copy\{color:#([0-9a-f]{6});background:rgba\(255,255,255,([.0-9]+)\)/);
 assert.ok(band);
 const linear = n => n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4;
 const luminance = rgb => rgb.map(linear).reduce((n,c,i) => n+c*[.2126,.7152,.0722][i],0);
 const text = band[1].match(/../g).map(c => parseInt(c,16)/255);
 const darkestBand = Number(band[2]);
 const ratio = (luminance([darkestBand,darkestBand,darkestBand])+.05)/(luminance(text)+.05);
 assert.ok(ratio >= 4.5,`worst-case band contrast ${ratio}`);
 const html = readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.ok(html.includes('Software delivery, run as a bounded system.'));
 assert.ok(html.includes('One run. Check found a crack, Build used 1 of 2 repair pieces, the same Check passed, Review confirmed the fit.'));
});

test('leaving the hero by native scrolling pauses without stealing focus', async () => {
 const p = player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.nodes.get('.hero').getBoundingClientRect = () => ({ top: -900, bottom: 0 });
 p.event(p.window,'scroll'); await p.flush();
 assert.equal(p.nodes.get('#film').paused,true);
 assert.equal(p.nodes.get('.hero').focused,undefined);
 assert.equal(p.nodes.get('#following').focused,undefined);
});

test('turning reduced motion off cannot preload before the pending destination poster', async () => {
 const p = player({ reducedMotion: true }); await p.decode();
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.reduced.matches = false; p.event(p.reduced,'change');
 assert.equal(p.nodes.get('#film').src,'');
 await p.decode(); assert.equal(p.nodes.get('#film').src,'./media/desktop/segB.mp4');
});
test('momentum from the starting wheel gesture cannot hurry or chain; line deltas are normalized', async () => {
 const p = player(); await p.decode();
 assert.equal(p.event(p.window,'wheel',{ deltaY: 40 }).prevented,true); await p.tick(150);
 for (let i=0;i<20;i++) { assert.equal(p.event(p.window,'wheel',{ deltaY: 30 }).prevented,true); await p.tick(50); }
 assert.equal(p.nodes.get('#film').paused,false); assert.equal(p.nodes.get('#count').textContent,'01 / 06');
 await p.tick(251);
 assert.equal(p.event(p.window,'wheel',{ deltaY: 1, deltaMode: 1 }).prevented,true); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 assert.equal(p.nodes.get('#following').focused,undefined);
});
test('the rest of the swipe that starts a move stays in the hero and cannot hurry it', async () => {
 const p = player(); await p.decode();
 p.event(p.nodes.get('.hero'),'touchstart',{ touches: [{ clientY: 200 }] });
 p.event(p.nodes.get('.hero'),'touchmove',{ touches: [{ clientY: 160 }] }); await p.tick(150);
 const e = p.event(p.nodes.get('.hero'),'touchmove',{ touches: [{ clientY: 80 }] });
 assert.equal(e.prevented,true); assert.equal(p.nodes.get('#film').paused,false);
 assert.equal(p.nodes.get('#following').focused,undefined);
});

async function reachScreenSwitch(p) {
 await p.decode();
 for (const segment of ['segA','segB','segC']) {
  p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  assert.equal(p.nodes.get('#film').src,`./media/desktop/${segment}.mp4`);
  p.event(p.nodes.get('#film'),'ended'); await p.decode();
 }
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-3.webp');
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segD.mp4');
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segD.mp4');
 assert.equal(p.nodes.get('#film').paused,false);
}

test('segD completion decodes stop4, restores factual copy and preloads E; reverse uses stop3', async () => {
 const p = player(); const toggles = [];
 p.nodes.get('.hero').classList.toggle = (...args) => toggles.push(args);
 await reachScreenSwitch(p);
 assert.deepEqual(toggles.at(-1),['moving',true]);
 p.event(p.nodes.get('#film'),'ended');
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-3.webp');
 assert.deepEqual(toggles.at(-1),['moving',true]);
 await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-4.webp');
 assert.match(p.nodes.get('img').alt,/two displays/i);
 assert.deepEqual(toggles.slice(-2),[['lab',true],['moving',false]]);
 assert.equal(p.copies[4].hidden,false);
 assert.ok(p.copies.slice(0,4).every(copy => copy.hidden));
 assert.equal(p.nodes.get('#count').textContent,'05 / 06');
 assert.equal(p.nodes.get('#announcement').textContent,'Screen Switch. Chapter 5 of 6.');
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segD-reverse.mp4');
 assert.equal(p.nodes.get('#film').paused,false);
 p.event(p.nodes.get('#film'),'ended'); await p.decode();
 assert.equal(p.nodes.get('#film').paused,true);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-3.webp');
 assert.equal(p.copies[3].hidden,false);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'ended'); await p.decode();
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segE.mp4');
 assert.equal(p.nodes.get('#following').focused,undefined);
 const html = readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.match(html, /data-stop="4" hidden><h2\b[^>]*>.*?<\/h2><p class="tagline">[^<]+<\/p><p>A native macOS menu-bar utility that exchanges eligible windows between displays\.<\/p>/);
 assert.match(html, /aria-label="Six chapters"/);
 assert.match(html, /<title>[^<]*Screen Switch and Playground<\/title>/);
});

test('Screen Switch heading binds the decorative native icon with fixed, nonshrinking sizing', () => {
 const html = readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const heading = html.match(/<div class="copy" data-stop="4" hidden><h2 class="screen-switch-title">(.*?)<\/h2>/)?.[1];
 assert.ok(heading, 'stop4 owns the icon heading');
 assert.match(heading, /<img src="\.\/media\/screen-switch-icon\.png" alt="" aria-hidden="true" width="32" height="32">/);
 assert.equal(heading.replace(/<[^>]+>/g,'').trim(), 'Screen Switch');
 assert.equal(createHash('sha256').update(readFileSync(new URL('./media/screen-switch-icon.png',import.meta.url))).digest('hex'),
  '2bd68b4971fd3963de4a45d2f360d840317343d5ddbd3ed617fff229533313c5');
 const css = readFileSync(new URL('../../src/home/arena/arena.css',import.meta.url),'utf8');
 const layout = css.match(/\.screen-switch-title\{([^}]+)\}/)?.[1];
 const icon = css.match(/\.screen-switch-title img\{([^}]+)\}/)?.[1];
 const text = css.match(/\.screen-switch-title span\{([^}]+)\}/)?.[1];
 assert.ok(layout && icon && text, 'heading-only layout, icon and wrapping rules');
 for (const rule of ['display:flex','align-items:center','gap:.65rem']) assert.ok(layout.includes(rule));
 for (const rule of ['width:32px','height:32px','flex:0 0 32px','object-fit:contain']) assert.ok(icon.includes(rule));
 for (const rule of ['min-width:0','overflow-wrap:anywhere']) assert.ok(text.includes(rule));
});

test('Skip and Escape during segD stop film, use stop4 and preserve their focus behavior', async () => {
 for (const skip of [true,false]) {
  const p = player(); await reachScreenSwitch(p);
  if (skip) p.event(p.nodes.get('#skip'),'click');
  else p.event(p.window,'keydown',{ key: 'Escape' });
  await p.decode(); await p.tick(5000);
  assert.equal(p.nodes.get('#film').paused,true);
  assert.equal(p.nodes.get('#film').style.visibility,'hidden');
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-4.webp');
  assert.equal(p.copies[4].hidden,false);
  assert.equal(p.nodes.get(skip ? '#following' : '.hero').focused,true);
  assert.equal(p.nodes.get('#following').scrolled,skip ? true : undefined);
 }
});

test('reduced motion reaches Screen Switch without loading any film', async () => {
 const p = player({ reducedMotion: true }); await p.decode();
 for (let stop = 1; stop <= 4; stop++) {
  p.event(p.nodes.get('#next'),'click'); await p.tick(150); await p.decode();
  assert.equal(p.nodes.get('img').src,`./media/desktop/stop-${stop}.webp`);
  assert.equal(p.nodes.get('#film').src,'');
  assert.equal(p.nodes.get('#film').loads,0);
 }
 assert.equal(p.copies[4].hidden,false);
 assert.equal(p.nodes.get('#count').textContent,'05 / 06');
});

test('segD missing poster retains matching origin copy; media error and stall decode Screen Switch', async () => {
 for (const failure of ['poster','error','waiting']) {
  const p = player(); await reachScreenSwitch(p);
  if (failure === 'poster') { p.event(p.nodes.get('#film'),'ended'); await p.decode(false); }
  else { p.event(p.nodes.get('#film'),failure); await p.tick(2001); }
  assert.equal(p.nodes.get('#film').paused,true);
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-3.webp');
  assert.equal(p.nodes.get('#error').hidden,false);
  if(failure!=='poster') await p.decode();
  const stop=failure==='poster'?3:4;
  assert.equal(p.nodes.get('img').src,`./media/desktop/stop-${stop}.webp`);
  assert.equal(p.copies[stop].hidden,false);
  assert.equal(p.copies[stop===3?4:3].hidden,true);
  assert.equal(p.nodes.get('#count').textContent,counterLabel(stop));
  assert.equal(p.nodes.get('#error').hidden,false);
 }
});

test('encoder appends bounded segD and poster660 while retaining accepted A/B/C mappings', () => {
 const source = readFileSync(new URL('./scripts/encode.sh',import.meta.url),'utf8');
 assert.match(source,/frame<=804/);
 for (const mapping of ['1:poster','84:stop-1','228:stop-2','468:stop-3','660:stop-4']) assert.ok(source.includes(`'${mapping}'`));
 for (const mapping of ['A) start=1; count=84; cap=1200000','B) start=85; count=144; cap=1200000',
  'C) start=229; count=240; cap=2000000','D) start=469; count=192; cap=1600000']) assert.ok(source.includes(mapping));
 assert.match(source,/for segment in A B C D/);
 assert.match(source,/for camera in desktop mobile/);
 assert.match(source,/cwebp -quiet -q 80/);
 assert.match(source,/budget=\$\(\(budget \* 8 \/ 10\)\)/);
 assert.match(source,/"\$budget" -ge 300/);
});

async function reachPlayground(p) {
 await reachScreenSwitch(p);
 p.event(p.nodes.get('#film'),'ended');
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segD.mp4');
 await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-4.webp');
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segE.mp4');
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segE.mp4');
 assert.equal(p.nodes.get('#film').paused,false);
}

test('segE completes only after poster5 decode, restores Playground copy, reverses to 4 and exits natively', async () => {
 const p = player(); const toggles = [];
 p.nodes.get('.hero').classList.toggle = (...args) => toggles.push(args);
 await reachPlayground(p);
 const loads = p.nodes.get('#film').loads;
 p.event(p.nodes.get('#film'),'ended');
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-4.webp');
 assert.deepEqual(toggles.at(-1),['moving',true]);
 await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-5.webp');
 assert.match(p.nodes.get('img').alt,/villa.*left.*window/i);
 assert.equal(p.copies[5].hidden,false);
 assert.ok(p.copies.slice(0,5).every(copy => copy.hidden));
 assert.equal(p.nodes.get('#count').textContent,'06 / 06');
 assert.equal(p.nodes.get('#announcement').textContent,'Playground. Chapter 6 of 6.');
 assert.deepEqual(toggles.slice(-2),[['lab',true],['moving',false]]);
 assert.equal(p.nodes.get('#film').loads,loads, 'terminal stop cannot preload another film');
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segE-reverse.mp4');
 p.event(p.nodes.get('#film'),'ended'); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-4.webp');
 assert.equal(p.copies[4].hidden,false);
 assert.equal(p.nodes.get('#film').paused,true);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'ended'); await p.decode();
 assert.equal(p.event(p.window,'wheel',{ deltaY:100 }).prevented,undefined);
 assert.equal(p.event(p.window,'keydown',{ key:'ArrowDown' }).prevented,undefined);
 p.event(p.nodes.get('.hero'),'touchstart',{ touches:[{ clientY:200 }] });
 assert.equal(p.event(p.nodes.get('.hero'),'touchmove',{ touches:[{ clientY:100 }] }).prevented,undefined);
 p.event(p.nodes.get('#next'),'click'); await p.decode();
 assert.equal(p.nodes.get('#following').focused,true);
 assert.equal(p.nodes.get('#following').scrolled,true);
 const html = readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.match(html, /data-stop="5" hidden><h2>Playground<\/h2><p class="tagline">[^<]+<\/p><p>Interactive experiments: Hot Wire and Giant Impact[^<]*<\/p><a class="more" href="\/playground">/);
 assert.match(html, /aria-label="Six chapters"/);
 assert.match(html, /01 \/ 06/);
});

test('Skip and Escape during segE settle poster5 and retain existing focus behavior', async () => {
 for (const skip of [true,false]) {
  const p = player(); await reachPlayground(p);
  if (skip) p.event(p.nodes.get('#skip'),'click');
  else p.event(p.window,'keydown',{ key:'Escape' });
  await p.decode(); await p.tick(5000);
  assert.equal(p.nodes.get('#film').paused,true);
  assert.equal(p.nodes.get('#film').style.visibility,'hidden');
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-5.webp');
  assert.equal(p.copies[5].hidden,false);
  assert.equal(p.nodes.get(skip ? '#following' : '.hero').focused,true);
  assert.equal(p.nodes.get('#following').scrolled,skip ? true : undefined);
 }
});

test('reduced motion reaches Playground without loading film and reverses to Screen Switch', async () => {
 const p = player({ reducedMotion:true }); await p.decode();
 for (let stop=1;stop<=5;stop++) {
  p.event(p.nodes.get('#next'),'click'); await p.tick(150); await p.decode();
  assert.equal(p.nodes.get('img').src,`./media/desktop/stop-${stop}.webp`);
  assert.equal(p.nodes.get('#film').src,'');
  assert.equal(p.nodes.get('#film').loads,0);
 }
 assert.equal(p.copies[5].hidden,false);
 assert.equal(p.nodes.get('#count').textContent,'06 / 06');
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-4.webp');
 assert.equal(p.nodes.get('#film').loads,0);
});

test('segE missing poster retains matching origin copy; media error and stall decode Playground', async () => {
 for (const failure of ['poster','error','waiting']) {
  const p = player(); await reachPlayground(p);
  if (failure === 'poster') { p.event(p.nodes.get('#film'),'ended'); await p.decode(false); }
  else { p.event(p.nodes.get('#film'),failure); await p.tick(2001); }
  assert.equal(p.nodes.get('#film').paused,true);
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-4.webp');
  assert.equal(p.nodes.get('#error').hidden,false);
  if(failure!=='poster') await p.decode();
  const stop=failure==='poster'?4:5;
  assert.equal(p.nodes.get('img').src,`./media/desktop/stop-${stop}.webp`);
  assert.equal(p.copies[stop].hidden,false);
  assert.equal(p.copies[stop===4?5:4].hidden,true);
  assert.equal(p.nodes.get('#count').textContent,counterLabel(stop));
  assert.equal(p.nodes.get('#error').hidden,false);
 }
});

test('encoder adds only the E mapping and poster804 to the A–D contracts', () => {
 const source = readFileSync(new URL('./scripts/encode.sh',import.meta.url),'utf8');
 assert.ok(source.includes('E) start=661; count=144; cap=1200000'));
 assert.ok(source.includes("'804:stop-5'"));
 assert.match(source,/for segment in A B C D E; do/);
 assert.match(source,/-framerate 24/);
 assert.match(source,/-force_key_frames "expr:eq\(n,0\)\+eq\(n,\$last\)"/);
});


async function reachHold(p, { peek = true, ready = peek } = {}) {
 await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#film'),'ended'); await p.decode();
 if (peek) await p.decode();
 if (ready) p.event(p.nodes.get('#ambient'),'playing');
}

test('idle Escape outside the hero preserves native focus and the held chapter', async () => {
 const p=player(); await reachHold(p);
 p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0,width:1600,height:900 });
 p.event(p.window,'scroll');
 const event=p.event(p.window,'keydown',{ key:'Escape' }); await p.flush();
 assert.equal(event.prevented,undefined);
 assert.equal(p.nodes.get('.hero').focused,undefined);
 assert.equal(p.nodes.get('#count').textContent,'02 / 06');
 assert.equal(p.nodes.get('#ambient').paused,true);
});

test('live reduced motion during arrival at GameOn still supplies its static peek', async () => {
 const p=player(); await p.decode(); p.event(p.nodes.get('#next'),'click');
 p.reduced.matches=true; p.event(p.reduced,'change');
 await p.decode(); await p.decode();
 assert.equal(p.copies[1].hidden,false);
 assert.equal(p.nodes.get('#gameon-peek').hidden,false);
 assert.equal(p.nodes.get('#gameon-peek').style.opacity,'1');
 assert.deepEqual(p.nodes.get('#ambient').loadedSources.filter(Boolean),[]);
 assert.equal(p.nodes.get('#ambient').paused,true);
 assert.equal(p.nodes.get('#next').disabled,false);
});

test('stop1 poster resolving in a hidden document does not fetch its decoration', async () => {
 const p=player(); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'ended'); p.document.hidden=true; p.event(p.document,'visibilitychange');
 await p.decode();
 assert.equal(p.nodes.get('#gameon-peek').src,'');
 assert.equal(p.nodes.get('#ambient').loads,0);
 assert.equal(p.nodes.get('#next').disabled,false);
 p.document.hidden=false; p.event(p.document,'visibilitychange'); await p.decode();
 assert.equal(p.nodes.get('#gameon-peek').src,'./media/desktop/gameon-peek.webp');
 assert.equal(p.nodes.get('#gameon-peek').hidden,false);
});

test('GameOn ambient is gated by stop1 poster, loops without advance and fades peek only once', async () => {
 const p = player(); const ambient = p.nodes.get('#ambient'), peek = p.nodes.get('#gameon-peek');
 assert.equal(ambient.loads,0); await p.decode(); assert.equal(ambient.loads,0);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'ended');
 assert.equal(ambient.loads,0); await p.decode(); await p.decode();
 assert.equal(ambient.src,'./media/desktop/gameon-hold.mp4'); assert.equal(ambient.loop,true);
 assert.equal(peek.src,'./media/desktop/gameon-peek.webp'); assert.equal(peek.hidden,false);
 p.event(ambient,'playing'); assert.equal(ambient.style.visibility,'visible');
 await p.tick(1500); assert.equal(peek.style.opacity,'1');
 for (let i=0;i<3;i++) { p.event(ambient,'ended'); p.event(ambient,'timeupdate'); }
 assert.equal(peek.style.opacity,'1'); assert.equal(p.copies[1].hidden,false);
 assert.equal(p.nodes.get('#count').textContent,'02 / 06'); assert.equal(p.nodes.get('#next').disabled,false);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segB.mp4');
});

test('early Next retains the valid hold until actual B playing and cancels late ambient/peek callbacks', async () => {
 const p = player({ pendingMedia: ['#ambient'] }); await reachHold(p,{ peek:false });
 const hold = p.nodes.get('#gameon-hold'), ambient = p.nodes.get('#ambient');
 assert.equal(hold.hidden,false); assert.equal(p.plays.length,1);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(ambient.paused,true); assert.equal(hold.hidden,false);
 await p.decode(); p.event(ambient,'playing');
 p.plays[0].reject(Object.assign(new Error('interrupted'),{ name:'AbortError' })); await p.flush();
 assert.equal(p.nodes.get('#error').hidden,true); assert.equal(hold.hidden,false);
 p.event(p.nodes.get('#film'),'playing'); assert.equal(hold.hidden,false); await p.tick(120); assert.equal(hold.hidden,true);
 assert.equal(p.nodes.get('#film').style.visibility,'visible');
});

test('ambient and reveal pause hidden/offstage, resume with remaining visible fade time', async () => {
 for (const hidden of [true,false]) {
  const p = player(); await reachHold(p); const peek = p.nodes.get('#gameon-peek'), ambient = p.nodes.get('#ambient');
  await p.tick(500);
  if (hidden) p.document.hidden=true;
  else p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0,width:1600,height:900 });
  p.event(hidden?p.document:p.window,hidden?'visibilitychange':'scroll');
  assert.equal(ambient.paused,true); assert.equal(peek.style.animationPlayState,'paused');
  await p.tick(5000); assert.notEqual(peek.style.opacity,'1');
  if (hidden) p.document.hidden=false;
  else p.nodes.get('.hero').getBoundingClientRect=()=>({ top:0,bottom:900,width:1600,height:900 });
  p.event(hidden?p.document:p.window,hidden?'visibilitychange':'scroll');
  assert.equal(ambient.paused,false); await p.tick(999); assert.notEqual(peek.style.opacity,'1');
  await p.tick(1); assert.equal(peek.style.opacity,'1');
 }
});

test('reduced motion reaches static GameOn peek without any ambient or film request', async () => {
 const p=player({ reducedMotion:true }); await p.decode();
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); await p.decode(); await p.decode();
 assert.equal(p.nodes.get('#ambient').loads,0); assert.equal(p.nodes.get('#ambient').src,'');
 assert.equal(p.nodes.get('#film').loads,0); assert.equal(p.nodes.get('#film').src,'');
 assert.equal(p.nodes.get('#gameon-peek').style.opacity,'1'); assert.equal(p.nodes.get('#gameon-peek').hidden,false);
 assert.equal(p.nodes.get('#next').disabled,false);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
});

test('missing stop1 poster prevents decoration; failed peek or ambient never blocks Next', async () => {
 const failedPoster=player(); await failedPoster.decode(); failedPoster.event(failedPoster.nodes.get('#next'),'click');
 await failedPoster.tick(150); failedPoster.event(failedPoster.nodes.get('#film'),'ended'); await failedPoster.decode(false);
 assert.equal(failedPoster.nodes.get('#ambient').loads,0); assert.equal(failedPoster.nodes.get('#gameon-hold').hidden,true);
 for (const missing of ['peek','ambient']) {
  const p=player(); await reachHold(p,{ peek:false });
  if (missing==='peek') await p.decode(false); else p.event(p.nodes.get('#ambient'),'error');
  assert.equal(p.nodes.get('#next').disabled,false); assert.equal(p.copies[1].hidden,false);
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
  p.event(p.nodes.get('#next'),'click'); await p.tick(150); assert.equal(p.nodes.get('#film').src,'./media/desktop/segB.mp4');
 }
});

test('pending play AbortError is intentional; current NotSupportedError degrades and obsolete rejection is ignored', async () => {
 for (const media of ['#ambient','#film']) {
  for (const name of ['AbortError','NotSupportedError']) {
   const p=player({ pendingMedia:[media] }); await reachHold(p);
   if (media==='#film') { p.event(p.nodes.get('#next'),'click'); await p.tick(150); }
   p.plays.at(-1).reject(Object.assign(new Error(name),{ name })); await p.flush();
   assert.equal(p.nodes.get('#error').hidden,name==='AbortError');
   if (name==='NotSupportedError') assert.equal(p.nodes.get(media).paused,true);
  }
  const p=player({ pendingMedia:[media] }); await reachHold(p);
  if (media==='#film') { p.event(p.nodes.get('#next'),'click'); await p.tick(150); }
  const attempt=p.plays.at(-1); p.event(p.nodes.get('#skip'),'click'); await p.decode();
  attempt.reject(Object.assign(new Error('old failure'),{ name:'NotSupportedError' })); await p.flush();
  assert.equal(p.nodes.get('#error').hidden,true);
 }
});

test('hide during pending film play ignores interruption and settles on return', async () => {
 const p=player({ pendingMedia:['#film'] }); await p.decode(); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.document.hidden=true; p.event(p.document,'visibilitychange');
 p.plays[0].reject(Object.assign(new Error('paused'),{ name:'AbortError' })); await p.flush();
 assert.equal(p.nodes.get('#error').hidden,true); p.document.hidden=false; p.event(p.document,'visibilitychange'); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp'); assert.equal(p.nodes.get('#film').paused,true);
});

test('reverse, Skip and Escape cancel hold callbacks without changing existing focus semantics', async () => {
 for (const action of ['reverse','skip','escape']) {
  const p=player({ pendingMedia:['#ambient'] }); await reachHold(p,{ peek:false });
  if (action==='reverse') p.event(p.nodes.get('#prev'),'click');
  if (action==='skip') p.event(p.nodes.get('#skip'),'click');
  if (action==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  await p.tick(150);
  if (action==='reverse') {
   assert.equal(p.nodes.get('#film').src,'./media/desktop/segA-reverse.mp4');
   p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#film'),'ended');
  }
  await p.decode(); await p.tick(5000);
  p.event(p.nodes.get('#ambient'),'playing');
  assert.equal(p.nodes.get('#ambient').paused,true); assert.equal(p.nodes.get('#gameon-hold').hidden,true);
  if (action==='skip') assert.equal(p.nodes.get('#following').focused,true);
  if (action==='escape') assert.equal(p.nodes.get('.hero').focused,true);
  if (action==='reverse') assert.equal(p.nodes.get('img').src,'./media/desktop/poster.webp');
 }
});

test('orientation gates replacement hold on the new poster, rejects stale decoration and projects on resize', async () => {
 const p=player({ pendingMedia:['#ambient'] }); await reachHold(p,{ peek:false });
 const old=p.plays.at(-1); p.portrait.matches=true; p.event(p.portrait,'change');
 assert.equal(p.nodes.get('#gameon-hold').hidden,true); await p.decode(); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/mobile/stop-1.webp');
 assert.equal(p.nodes.get('#ambient').src,'./media/mobile/gameon-hold.mp4');
 assert.equal(p.nodes.get('#gameon-peek').src,'./media/mobile/gameon-peek.webp');
 old.reject(Object.assign(new Error('obsolete'),{ name:'NotSupportedError' })); await p.flush();
 assert.equal(p.nodes.get('#error').hidden,true);
 const peek=p.nodes.get('#gameon-peek'), prior=peek.style.transform;
 p.nodes.get('.hero').getBoundingClientRect=()=>({ top:0,bottom:900,width:390,height:900 }); p.event(p.window,'resize');
 assert.match(peek.style.transform,/^matrix3d\(/); assert.notEqual(peek.style.transform,prior);
});

test('preference switches cancel pending ambient, show static peek and resume without a second reveal', async () => {
 const p=player({ pendingMedia:['#ambient'] }); await reachHold(p); const old=p.plays.at(-1);
 p.reduced.matches=true; p.event(p.reduced,'change'); await p.decode();
 assert.equal(p.nodes.get('#ambient').paused,true); assert.equal(p.nodes.get('#ambient').src,'');
 assert.equal(p.nodes.get('#film').src,''); assert.equal(p.nodes.get('#gameon-peek').style.opacity,'1');
 old.reject(Object.assign(new Error('obsolete'),{ name:'NotSupportedError' })); await p.flush(); assert.equal(p.nodes.get('#error').hidden,true);
 p.reduced.matches=false; p.event(p.reduced,'change'); await p.decode();
 assert.equal(p.nodes.get('#ambient').src,'./media/desktop/gameon-hold.mp4');
 assert.equal(p.nodes.get('#gameon-peek').style.opacity,'1');
});

// Pure receipt admission only: mocked file reads/hashes; no PNG generation or compositor run.
import { spawnSync } from 'node:child_process';
test('CPU final admission is closed, approval-bound and keeps strict preview receipts', () => {
 const result=spawnSync('python3',['-B','-c',String.raw`
import copy, importlib.util, json
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('compose','sketches/033-arena/scripts/compose_arena_hold.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
base=['--inputs','inputs.json','--desktop-loop','desktop','--mobile-loop','mobile','--out','fresh']
assert not c.parse_args(base).final
assert c.parse_args(base+['--final','--approval','final/OWNER-APPROVAL.json']).final
for flags in (['--final'],['--approval','final/OWNER-APPROVAL.json'],['--samples','32'],['--frames','84-131'],['--size','1600x900']):
 try: c.parse_args(base+flags)
 except SystemExit: pass
 else: raise AssertionError(flags)
approval=Path('/task/final/OWNER-APPROVAL.json'); inputs=Path('/task/inputs.json')
with patch.object(Path,'resolve',lambda self,**kw:self), patch.object(c.hold,'sha256',lambda p:c.FINAL_APPROVAL_SHA256 if p==approval else c.PREVIEW_INPUTS_SHA256):
 assert c.final_approval(inputs,approval)==c.FINAL_APPROVAL_SHA256
with patch.object(Path,'resolve',lambda self,**kw:self), patch.object(c.hold,'sha256',return_value='changed'):
 try: c.final_approval(inputs,approval)
 except ValueError: pass
 else: raise AssertionError('changed approval/registry admitted')
root=Path('/task/native');variant={'native_source_sha256':'source'}
for final in (False,True):
 for camera in ('desktop','mobile'):
  sizes=c.FINAL_SIZE if final else c.hold.SIZE
  receipt={'kind':'gameon-hold-native-final' if final else 'gameon-hold-native-preview','camera':camera,
   'source_sha256':'source','inputs_sha256':'inputs','frames':list(c.hold.FRAMES),'size':list(sizes[camera]),
   'fps':24,'samples':32 if final else 8,'prepare_only':False,'rebaked':False,'handlers':False,
   'closure_key_not_rendered':132,'owner_approval_sha256':c.FINAL_APPROVAL_SHA256,
   'rendered':[{'frame':f,'file':f'frame-{f:04d}.png','sha256':'frame'} for f in c.hold.FRAMES]}
  def verify(value, names=None, pixels=None, frame_hash='frame'):
   with patch.object(Path,'resolve',lambda self,**kw:self), patch.object(Path,'read_text',return_value=json.dumps(value)), \
    patch.object(Path,'glob',return_value=[root/n for n in (names or [f'frame-{f:04d}.png' for f in c.hold.FRAMES])]), \
    patch.object(c.hold,'png_size',return_value=pixels or sizes[camera]), \
    patch.object(c.hold,'sha256',lambda p:'inputs' if p==inputs else frame_hash):
    return c.verify_loop(root,camera,variant,inputs,approval_sha256=c.FINAL_APPROVAL_SHA256 if final else None)
  verify(receipt)
  changes={'kind':'wrong','camera':'wrong','source_sha256':'bad','inputs_sha256':'bad','frames':list(range(84,133)),
   'size':[1920,1080],'fps':30,'samples':8 if final else 32,'prepare_only':True,'rebaked':True,'handlers':True}
  if final: changes.update(owner_approval_sha256='wrong',closure_key_not_rendered=133)
  for key,value in changes.items():
   bad=copy.deepcopy(receipt);bad[key]=value
   try: verify(bad)
   except ValueError: pass
   else: raise AssertionError((final,camera,key))
  for kind in ('missing','excess','wrongpixels','wronghash','duplicate','path'):
   bad=copy.deepcopy(receipt);names=None;pixels=None;frame_hash='frame'
   if kind=='missing': bad['rendered'].pop()
   if kind=='excess': names=[f'frame-{f:04d}.png' for f in range(84,133)]
   if kind=='wrongpixels': pixels=(1,1)
   if kind=='wronghash': frame_hash='changed'
   if kind=='duplicate': bad['rendered'][-1]=bad['rendered'][0]
   if kind=='path': bad['rendered'][0]['file']='../frame-0084.png'
   try: verify(bad,names,pixels,frame_hash)
   except ValueError: pass
   else: raise AssertionError((final,camera,kind))
print('final/preview admission: both cameras, fixed profiles, hashes, exact48, approval and override refusals OK')
`],{ cwd:new URL('../..',import.meta.url),encoding:'utf8' });
 assert.equal(result.status,0,result.stderr || result.stdout);
 assert.match(result.stdout,/admission: both cameras/);
});

test('hold waits for visible valid poster; hidden preload and pending-poster preference gates stay closed', async () => {
 const p=player(); p.document.hidden=true; await p.decode();
 assert.equal(p.nodes.get('#film').loads,0); assert.equal(p.nodes.get('#ambient').loads,0);
 p.document.hidden=false; p.event(p.document,'visibilitychange');
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'ended');
 p.document.hidden=true; p.event(p.document,'visibilitychange'); await p.decode(); await p.decode();
 assert.equal(p.nodes.get('#ambient').loads,0);
 p.document.hidden=false; p.event(p.document,'visibilitychange'); assert.equal(p.nodes.get('#ambient').loads,1);
 const r=player({ reducedMotion:true }); await r.decode(); r.event(r.nodes.get('#next'),'click'); await r.tick(150);
 r.reduced.matches=false; r.event(r.reduced,'change');
 assert.equal(r.nodes.get('#film').loads,0); assert.equal(r.nodes.get('#ambient').loads,0);
 await r.decode(); await r.decode(); assert.equal(r.nodes.get('#ambient').src,'./media/desktop/gameon-hold.mp4');
});

test('old non-Abort rejection after hidden resume cannot spoil the current ambient attempt', async () => {
 const p=player({ pendingMedia:['#ambient'] }); await reachHold(p); const old=p.plays.at(-1);
 p.document.hidden=true; p.event(p.document,'visibilitychange');
 p.document.hidden=false; p.event(p.document,'visibilitychange'); const current=p.plays.at(-1);
 assert.notEqual(current,old); old.reject(Object.assign(new Error('obsolete'),{ name:'NotSupportedError' })); await p.flush();
 assert.equal(p.nodes.get('#error').hidden,true); assert.equal(p.nodes.get('#ambient').paused,false);
 current.reject(Object.assign(new Error('real'),{ name:'NotSupportedError' })); await p.flush();
 assert.equal(p.nodes.get('#error').hidden,false); assert.equal(p.nodes.get('#ambient').paused,true);
 assert.equal(p.nodes.get('#next').disabled,false);
});

test('peek cover projection maps the exact native84 corners, with no invented desktop underside', async () => {
 for (const mobile of [false,true]) {
  const p=player(); await reachHold(p);
  if (mobile) { p.portrait.matches=true; p.event(p.portrait,'change'); await p.decode(); await p.decode(); }
  const [sw,sh]=mobile?[900,1600]:[1600,900];
  const quad=mobile?[[.2679332494735718,.21500831842422485],[.7320667505264282,.21500831842422485],[.7520319223403931,.34547388553619385],[.24796810746192932,.34547388553619385]]:
   [[.2946240305900574,-.442750096321106],[.7053759694099426,-.442750096321106],[.7187000513076782,-.07332384586334229],[.2812999188899994,-.07332384586334229]];
  for (const [width,height] of [[1600,900],[390,844],[320,568]]) {
   p.nodes.get('.hero').getBoundingClientRect=()=>({ top:0,bottom:height,width,height }); p.event(p.window,'resize');
   const m=p.nodes.get('#gameon-peek').style.transform.slice(9,-1).split(',').map(Number);
   const scale=Math.max(width/sw,height/sh), w=sw*scale,h=sh*scale;
   for (const [i,[x,y]] of [[0,[0,0]],[1,[1,0]],[2,[1,1]],[3,[0,1]]]) {
    const d=m[3]*x+m[7]*y+m[15];
    assert.ok(Math.abs((m[0]*x+m[4]*y+m[12])/d-(quad[i][0]*w+(width-w)/2))<1e-8);
    assert.ok(Math.abs((m[1]*x+m[5]*y+m[13])/d-(quad[i][1]*h+(height-h)/2))<1e-8);
   }
  }
 }
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.match(html,/<video id="ambient" muted playsinline loop preload="none" aria-hidden="true"><\/video>/);
 assert.match(html,/<img id="gameon-peek" alt="" aria-hidden="true" hidden>/);
 assert.doesNotMatch(readFileSync(new URL('./main.js',import.meta.url),'utf8'),/requestAnimationFrame|fetch\(/);
});

async function reachGoalLoop(p, { decode = true } = {}) {
 await reachHold(p);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segB.mp4');
 p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#film'),'ended');
 if (decode) await p.decode();
}

test('Goal Loop requests its loop only after stop2 decodes, never another GameOn peek', async () => {
 const p=player(); const ambient=p.nodes.get('#ambient'), peek=p.nodes.get('#gameon-peek');
 assert.equal(ambient.src,''); await reachGoalLoop(p,{ decode:false });
 let peekDecodes=0; peek.decode=()=>{ peekDecodes++; return Promise.resolve(); };
 assert.deepEqual(ambient.loadedSources,['./media/desktop/gameon-hold.mp4']);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 await p.decode(); await p.flush();
 assert.equal(ambient.src,'./media/desktop/goal-loop-hold.mp4');
 assert.deepEqual(ambient.loadedSources,['./media/desktop/gameon-hold.mp4','./media/desktop/goal-loop-hold.mp4']);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
 assert.equal(p.nodes.get('#count').textContent,'03 / 06');
 assert.equal(p.copies[2].hidden,false); assert.equal(peek.hidden,true); assert.equal(peekDecodes,0);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segC.mp4');
});

test('Goal Loop native wraps keep the camera, copy and chapter until manual Next', async () => {
 const p=player(); await reachGoalLoop(p); const ambient=p.nodes.get('#ambient');
 assert.equal(ambient.src,'./media/desktop/goal-loop-hold.mp4'); assert.equal(ambient.loop,true);
 p.event(ambient,'playing'); assert.equal(ambient.style.visibility,'visible');
 for (let i=0;i<4;i++) { ambient.currentTime=0; p.event(ambient,'timeupdate'); p.event(ambient,'ended'); await p.tick(2000); }
 assert.equal(p.nodes.get('#count').textContent,'03 / 06'); assert.equal(p.copies[2].hidden,false);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
 assert.equal(p.nodes.get('#film').paused,true); assert.equal(p.nodes.get('#next').disabled,false);
 assert.equal(p.nodes.get('#gameon-peek').hidden,true);
});

test('Goal Loop Next freezes valid pixels until C actually plays, including pending ambient load', async () => {
 for (const playing of [true,false]) {
  const p=player({ pendingMedia:['#ambient'] }); await reachGoalLoop(p);
  const ambient=p.nodes.get('#ambient'), hold=p.nodes.get('#gameon-hold');
  const attempt=p.plays.at(-1);
  if (playing) p.event(ambient,'playing');
  assert.equal(hold.hidden,false);
  assert.equal(ambient.style.visibility,playing?'visible':'hidden');
  p.event(p.nodes.get('#next'),'click');
  assert.equal(hold.hidden,false); assert.equal(ambient.paused,true);
  await p.tick(150); assert.equal(p.nodes.get('#film').src,'./media/desktop/segC.mp4');
  assert.equal(hold.hidden,false); assert.equal(p.nodes.get('#film').style.visibility,'hidden');
  attempt.reject(Object.assign(new Error('interrupted'),{ name:'AbortError' })); await p.flush();
  p.event(ambient,'playing'); assert.equal(ambient.paused,true);
  assert.equal(p.nodes.get('#error').hidden,true); assert.equal(hold.hidden,false);
  p.event(p.nodes.get('#film'),'playing');
  assert.equal(hold.hidden,false); await p.tick(120); assert.equal(hold.hidden,true); assert.equal(p.nodes.get('#film').style.visibility,'visible');
 }
});

test('B and C final pixels stay visible until the destination poster is decoded', async () => {
 const p=player(); await reachGoalLoop(p,{ decode:false });
 assert.equal(p.nodes.get('#film').style.visibility,'visible');
 await p.decode(); assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'playing');
 p.event(p.nodes.get('#film'),'ended'); assert.equal(p.nodes.get('#film').style.visibility,'visible');
 await p.decode(); assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-3.webp');
});

test('C completion selects finished belt idle; reverse from stop3 resumes Goal Loop overview idle', async () => {
 const p=player(); await reachGoalLoop(p); const ambient=p.nodes.get('#ambient');
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'playing');
 p.event(p.nodes.get('#film'),'ended'); await p.decode(); const loads=ambient.loads;
 p.event(ambient,'playing'); await p.tick(10000);
 assert.equal(ambient.paused,false); assert.equal(p.nodes.get('#gameon-hold').hidden,false);
 assert.equal(ambient.src,'./media/desktop/goal-loop-finished-hold.mp4');
 assert.equal(p.nodes.get('#count').textContent,'04 / 06'); assert.equal(ambient.loads,loads);
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150);
 assert.equal(ambient.paused,true);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segC-reverse.mp4');
 p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#film'),'ended'); await p.decode();
 assert.equal(ambient.src,'./media/desktop/goal-loop-hold.mp4'); assert.equal(ambient.paused,false);
 assert.equal(p.nodes.get('#gameon-hold').hidden,false); assert.equal(p.nodes.get('#gameon-peek').hidden,true);
 assert.equal(p.nodes.get('#count').textContent,'03 / 06');
});

test('initial reduced motion reaches Goal Loop with no movie URLs and no Goal Loop peek request', async () => {
 const p=player({ reducedMotion:true }); await p.decode();
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); await p.decode(); await p.decode();
 let peekDecodes=0; p.nodes.get('#gameon-peek').decode=()=>{ peekDecodes++; return Promise.resolve(); };
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); await p.decode();
 assert.equal(p.nodes.get('#count').textContent,'03 / 06');
 assert.equal(p.nodes.get('#film').src,''); assert.equal(p.nodes.get('#film').loads,0);
 assert.equal(p.nodes.get('#ambient').src,''); assert.equal(p.nodes.get('#ambient').loads,0);
 assert.equal(p.nodes.get('#gameon-peek').hidden,true); assert.equal(peekDecodes,0);
 assert.equal(p.nodes.get('#next').disabled,false);
});

test('live reduced motion clears Goal Loop movie URLs and stale attempts; normal motion resumes the same idle', async () => {
 const p=player({ pendingMedia:['#ambient'] }); await reachGoalLoop(p);
 const ambient=p.nodes.get('#ambient'), old=p.plays.at(-1); p.event(ambient,'playing');
 p.reduced.matches=true; p.event(p.reduced,'change');
 assert.equal(ambient.src,''); assert.equal(p.nodes.get('#film').src,''); assert.equal(ambient.paused,true);
 assert.equal(ambient.style.visibility,'hidden'); assert.equal(p.nodes.get('#gameon-peek').hidden,true);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
 old.reject(Object.assign(new Error('obsolete'),{ name:'NotSupportedError' })); await p.flush();
 assert.equal(p.nodes.get('#error').hidden,true);
 p.reduced.matches=false; p.event(p.reduced,'change');
 assert.equal(ambient.src,'./media/desktop/goal-loop-hold.mp4'); assert.equal(ambient.paused,false);
 assert.equal(p.nodes.get('#gameon-peek').hidden,true); assert.equal(p.nodes.get('#count').textContent,'03 / 06');
});

test('live GameOn preference switches retain a decoded peek without hiding or decoding it again', async () => {
 const p=player(); await reachHold(p); await p.tick(1500);
 const peek=p.nodes.get('#gameon-peek'); let decodes=0; peek.decode=()=>{ decodes++; return Promise.resolve(); };
 for (const reduced of [true,false]) {
  p.reduced.matches=reduced; p.event(p.reduced,'change');
  assert.equal(peek.hidden,false); assert.equal(peek.style.opacity,'1');
  await p.flush(); assert.equal(decodes,0);
 }
});

test('Goal Loop hidden or offstage arrival requests no loop until eligible, then pauses and resumes', async () => {
 for (const hidden of [true,false]) {
  const p=player(); await reachGoalLoop(p,{ decode:false }); const ambient=p.nodes.get('#ambient');
  const stage=active=>{ if(hidden) p.document.hidden=!active;
   else p.nodes.get('.hero').getBoundingClientRect=()=>({ top:active?0:-900,bottom:active?900:0,width:1600,height:900 });
   p.event(hidden?p.document:p.window,hidden?'visibilitychange':'scroll'); };
  stage(false); await p.decode();
  assert.equal(ambient.paused,true); assert.equal(ambient.loadedSources.some(src=>src.includes('goal-loop')),false);
  stage(true); assert.equal(ambient.src,'./media/desktop/goal-loop-hold.mp4'); assert.equal(ambient.paused,false);
  stage(false); assert.equal(ambient.paused,true); stage(true); assert.equal(ambient.paused,false);
  assert.equal(p.nodes.get('#gameon-peek').hidden,true);
 }
});

test('Goal Loop orientation waits for its new poster and rejects stale pending play failures', async () => {
 const p=player({ pendingMedia:['#ambient'] }); await reachGoalLoop(p);
 const ambient=p.nodes.get('#ambient'), old=p.plays.at(-1); const loads=ambient.loads;
 p.portrait.matches=true; p.event(p.portrait,'change');
 assert.equal(ambient.paused,true); assert.equal(ambient.loads,loads);
 assert.equal(p.nodes.get('#gameon-hold').hidden,true);
 await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/mobile/stop-2.webp');
 assert.equal(ambient.src,'./media/mobile/goal-loop-hold.mp4');
 assert.equal(p.nodes.get('#gameon-peek').hidden,true);
 old.reject(Object.assign(new Error('obsolete'),{ name:'NotSupportedError' })); await p.flush();
 assert.equal(p.nodes.get('#error').hidden,true);
});

test('orientation during B defers Goal Loop variant and never loads the old-camera idle', async () => {
 const p=player(); await reachHold(p); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(p.nodes.get('#film'),'playing'); p.portrait.matches=true; p.event(p.portrait,'change');
 p.event(p.nodes.get('#film'),'ended');
 assert.equal(p.nodes.get('#ambient').loadedSources.some(src=>src.includes('goal-loop')),false);
 await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/mobile/stop-2.webp');
 assert.equal(p.nodes.get('#ambient').src,'./media/mobile/goal-loop-hold.mp4');
 assert.equal(p.nodes.get('#film').src,'./media/mobile/segC.mp4');
});

test('obsolete GameOn peek decode cannot reveal or request a peek at Goal Loop', async () => {
 const p=player(); await reachHold(p,{ peek:false }); const old=p.decodes.splice(0);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'playing');
 p.event(p.nodes.get('#film'),'ended'); await p.decode();
 for (const pending of old) pending.resolve(); await p.flush();
 assert.equal(p.nodes.get('#ambient').src,'./media/desktop/goal-loop-hold.mp4');
 assert.equal(p.nodes.get('#gameon-peek').hidden,true); assert.equal(p.decodes.length,0);
});

test('missing Goal Loop poster keeps the valid still and never starts its loop', async () => {
 const p=player(); await reachGoalLoop(p,{ decode:false }); await p.decode(false);
 assert.equal(p.nodes.get('#ambient').loadedSources.some(src=>src.includes('goal-loop')),false);
 assert.equal(p.nodes.get('#gameon-hold').hidden,true);
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 assert.equal(p.nodes.get('#error').hidden,false); assert.equal(p.nodes.get('#next').disabled,false);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 assert.equal(p.nodes.get('#film').src,'./media/desktop/segB.mp4');
});

test('Goal Loop AbortError is harmless and genuine media failures preserve static pixels and usable Next/Skip', async () => {
 for (const failure of ['AbortError','NotSupportedError','event']) {
  const p=player({ pendingMedia:['#ambient'] }); await reachGoalLoop(p); const ambient=p.nodes.get('#ambient');
  assert.equal(ambient.src,'./media/desktop/goal-loop-hold.mp4');
  if (failure==='event') p.event(ambient,'error');
  else p.plays.at(-1).reject(Object.assign(new Error(failure),{ name:failure }));
  await p.flush(); assert.equal(p.nodes.get('#error').hidden,failure==='AbortError');
  assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
  assert.equal(p.nodes.get('#next').disabled,false);
  if(failure!=='AbortError') { assert.equal(ambient.paused,true); assert.equal(ambient.style.visibility,'hidden'); }
  p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  assert.equal(p.nodes.get('#film').src,'./media/desktop/segC.mp4');
  p.event(p.nodes.get('#skip'),'click'); await p.decode();
  assert.equal(p.nodes.get('#following').focused,true); assert.equal(p.nodes.get('#following').scrolled,true);
 }
});

test('old GameOn and hidden Goal Loop media callbacks cannot reveal, pause or fail a newer attempt', async () => {
 const p=player({ pendingMedia:['#ambient'] }); await reachHold(p);
 const ambient=p.nodes.get('#ambient'), oldPlay=p.plays.at(-1);
 const oldPlaying=[...ambient.listeners.playing], oldError=[...ambient.listeners.error];
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'playing');
 p.event(p.nodes.get('#film'),'ended'); await p.decode();
 assert.equal(ambient.src,'./media/desktop/goal-loop-hold.mp4');
 for (const callback of [...oldPlaying,...oldError]) callback();
 oldPlay.reject(Object.assign(new Error('old chapter'),{ name:'NotSupportedError' })); await p.flush();
 assert.equal(ambient.style.visibility,'hidden'); assert.equal(ambient.paused,false); assert.equal(p.nodes.get('#error').hidden,true);
 const hiddenPlaying=[...ambient.listeners.playing], hiddenError=[...ambient.listeners.error];
 p.document.hidden=true; p.event(p.document,'visibilitychange');
 p.document.hidden=false; p.event(p.document,'visibilitychange');
 for (const callback of [...hiddenPlaying,...hiddenError]) callback();
 assert.equal(ambient.style.visibility,'hidden'); assert.equal(ambient.paused,false); assert.equal(p.nodes.get('#error').hidden,true);
 p.event(ambient,'playing'); assert.equal(ambient.style.visibility,'visible');
 p.event(ambient,'error'); assert.equal(p.nodes.get('#error').hidden,false);
});

test('Goal Loop idle Escape respects offstage focus; active Escape/Skip/reverse keep native targets', async () => {
 for (const action of ['offstage','escape','skip','reverse']) {
  const p=player(); await reachGoalLoop(p);
  if(action==='offstage') {
   p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0,width:1600,height:900 });
   p.event(p.window,'scroll'); assert.equal(p.event(p.window,'keydown',{ key:'Escape' }).prevented,undefined);
   assert.equal(p.nodes.get('.hero').focused,undefined); assert.equal(p.nodes.get('#count').textContent,'03 / 06');
  } else if(action==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  else p.event(p.nodes.get(action==='skip'?'#skip':'#prev'),'click');
  await p.tick(150);
  if(action==='reverse') {
   assert.equal(p.nodes.get('#film').src,'./media/desktop/segB-reverse.mp4');
   p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#film'),'ended');
  }
  await p.decode();
  if(action==='escape') assert.equal(p.nodes.get('.hero').focused,true);
  if(action==='skip') assert.equal(p.nodes.get('#following').focused,true);
  if(action==='reverse') {
   assert.equal(p.nodes.get('#ambient').src,'./media/desktop/gameon-hold.mp4');
   await p.decode(); assert.equal(p.nodes.get('#gameon-peek').hidden,false);
  } else assert.equal(p.nodes.get('#ambient').paused,true);
 }
});

test('reduced motion during B/C poster decode retains final pixels then clears the movie URL', async () => {
 for (const segment of ['segB','segC']) {
  const p=player(); await reachGoalLoop(p,{ decode:segment==='segC' });
  if(segment==='segC') {
   p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'playing');
   p.event(p.nodes.get('#film'),'ended');
  }
  const film=p.nodes.get('#film'), loads=film.loads;
  p.reduced.matches=true; p.event(p.reduced,'change');
  assert.equal(film.src,`./media/desktop/${segment}.mp4`);
  assert.equal(film.style.visibility,'visible'); assert.equal(film.paused,true);
  assert.equal(film.loads,loads); assert.equal(p.nodes.get('#ambient').src,'');
  await p.decode();
  assert.equal(film.src,''); assert.equal(film.style.visibility,'hidden');
  assert.equal(p.nodes.get('img').src,`./media/desktop/stop-${segment==='segB'?2:3}.webp`);
  assert.equal(p.nodes.get('#gameon-peek').hidden,true); assert.equal(p.nodes.get('#next').disabled,false);
 }
});

test('every forward segment retains final film pixels until destination decode', async () => {
 const p=player(); await p.decode();
 for (const segment of segments) {
  p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'playing');
  p.event(p.nodes.get('#film'),'ended');
  assert.equal(p.nodes.get('#film').style.visibility,'visible',segment);
  await p.decode(); await p.decode();
  if(segment==='segA') p.event(p.nodes.get('#ambient'),'playing');
  assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 }
});

test('multiple orientation generations cannot commit a stale Goal Loop poster or loop source', async () => {
 const p=player({ pendingMedia:['#ambient'] }); await reachGoalLoop(p);
 p.portrait.matches=true; p.event(p.portrait,'change'); const old=p.decodes.splice(0);
 p.portrait.matches=false; p.event(p.portrait,'change'); await p.decode();
 for(const pending of old) pending.resolve(); await p.flush();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
 assert.equal(p.nodes.get('#ambient').src,'./media/desktop/goal-loop-hold.mp4');
 assert.equal(p.nodes.get('#ambient').loadedSources.some(src=>src==='./media/mobile/goal-loop-hold.mp4'),false);
 assert.equal(p.nodes.get('#gameon-peek').hidden,true);
});

test('orientation during pending B/C preserves the frozen hold until actual travel playback', async () => {
 for (const stop of [1,2]) {
  const p=player({ pendingMedia:['#film'] });
  if(stop===1) await reachHold(p); else await reachGoalLoop(p);
  p.event(p.nodes.get('#ambient'),'playing');
  p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  p.portrait.matches=true; p.event(p.portrait,'change');
  assert.equal(p.nodes.get('#gameon-hold').hidden,false);
  assert.equal(p.nodes.get('#ambient').paused,true);
  assert.equal(p.nodes.get('#ambient').src,`./media/desktop/${stop===1?'gameon':'goal-loop'}-hold.mp4`);
  p.event(p.nodes.get('#film'),'playing'); await p.tick(120); assert.equal(p.nodes.get('#gameon-hold').hidden,true);
  p.event(p.nodes.get('#film'),'ended'); await p.decode();
  assert.equal(p.nodes.get('img').src,`./media/mobile/stop-${stop+1}.webp`);
  if(stop===1) assert.equal(p.nodes.get('#ambient').src,'./media/mobile/goal-loop-hold.mp4');
  else assert.equal(p.nodes.get('#ambient').src,'./media/mobile/goal-loop-finished-hold.mp4');
 }
});

async function reachStop(p, stop, mobile = false) {
 await p.decode();
 if (mobile) { p.portrait.matches=true; p.event(p.portrait,'change'); await p.decode(); }
 const camera=mobile?'mobile':'desktop';
 for (let i=0;i<stop;i++) {
  p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  assert.equal(p.nodes.get('#film').src,`./media/${camera}/${segments[i]}.mp4`);
  p.event(p.nodes.get('#film'),'playing'); p.event(p.nodes.get('#film'),'ended');
  await p.decode(); await p.decode();
 }
}

function reverseInput(p, route) {
 if(route==='Prev') return p.event(p.nodes.get('#prev'),'click');
 if(route==='wheel') return p.event(p.window,'wheel',{ deltaY:-40 });
 if(route==='touch') {
  p.event(p.nodes.get('.hero'),'touchstart',{ touches:[{ clientY:100 }] });
  return p.event(p.nodes.get('.hero'),'touchmove',{ touches:[{ clientY:150 }] });
 }
 return p.event(p.window,'keydown',{ key:route });
}

test('actual reverse inputs play all five clips for both cameras and wait for playback before committing', async () => {
 for(const mobile of [false,true]) for(const route of ['Prev','ArrowUp','PageUp','wheel','touch']) {
  const p=player(); await reachStop(p,5,mobile); const film=p.nodes.get('#film');
  const camera=mobile?'mobile':'desktop';
  for(let stop=5;stop>0;stop--) {
   if(route==='wheel') await p.tick(251);
   const before=p.nodes.get('img').src, input=reverseInput(p,route);
   if(route!=='Prev') assert.equal(input.prevented,true);
   assert.equal(p.nodes.get('#next').disabled,true); assert.equal(p.nodes.get('#prev').disabled,false);
   await p.tick(149); assert.equal(film.paused,true);
   await p.tick(1);
   const url=`./media/${camera}/${segments[stop-1]}-reverse.mp4`;
   assert.equal(film.src,url,`${camera} ${route} ${stop}`);
   assert.equal(film.playedSources.at(-1),url);
   assert.equal(film.paused,false); assert.equal(film.playbackRate,model.travelRate(segments[stop-1])); assert.equal(film.defaultPlaybackRate,film.playbackRate); assert.equal(film.currentTime,0);
   assert.equal(p.nodes.get('img').src,before);
   assert.equal(p.nodes.get('#count').textContent,counterLabel(stop));
   p.event(film,'playing'); assert.equal(film.style.visibility,'visible');
   p.event(film,'ended');
   assert.equal(film.style.visibility,'visible'); assert.equal(p.nodes.get('img').src,before);
   await p.decode(); await p.decode();
   if(stop===2) {
    assert.equal(film.style.visibility,'visible');
    p.event(p.nodes.get('#ambient'),'playing'); await p.tick(120);
   }
   assert.equal(p.nodes.get('img').src,`./media/${camera}/${posterName(stop-1)}.webp`);
   assert.equal(p.nodes.get('#count').textContent,counterLabel(stop-1));
   assert.equal(film.style.visibility,'hidden');
   assert.equal(p.nodes.get('#following').focused,undefined);
  }
 }
});

test('actual C timeupdates walk historical findings down from468 in reverse and up from229 forward', async () => {
 const p=player(); await reachStop(p,3); const film=p.nodes.get('#film'), finding=p.nodes.get('#finding');
 reverseInput(p,'Prev'); await p.tick(150); p.event(film,'playing');
 for(const [frame,text] of [[468,'Review: fit confirmed'],[445,'Check: joint holds'],[419,'Build: crack joined; 1 repair piece left'],[387,'Build: repair piece taken'],[378,'Check: crack found'],[303,''],[229,'']]) {
  film.currentTime=(468-frame)/24; p.event(film,'timeupdate');
  assert.equal(finding.textContent,text,`reverse historical frame ${frame}`);
  assert.equal(finding.hidden,!text);
 }
 film.currentTime=20; p.event(film,'timeupdate'); assert.equal(finding.hidden,true);
 p.event(film,'ended'); await p.decode();
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.event(film,'playing');
 for(const frame of [229,304,379,388,420,446,468]) {
  film.currentTime=(frame-229)/24; p.event(film,'timeupdate');
  assert.equal(finding.textContent,model.findingAtFrame(frame));
 }
});

test('reverse input retains native offstage, modifier, editable and multitouch boundaries', async () => {
 const p=player(); await reachStop(p,3); const film=p.nodes.get('#film'), before=film.playedSources.length;
 p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0 });
 for(const route of ['ArrowUp','PageUp','wheel','touch']) assert.equal(reverseInput(p,route).prevented,undefined);
 p.nodes.get('.hero').getBoundingClientRect=()=>({ top:0,bottom:900 });
 for(const props of [{ key:'ArrowUp',altKey:true },{ key:'PageUp',ctrlKey:true },{ key:'ArrowUp',metaKey:true },
  { key:'ArrowUp',target:{ tagName:'INPUT' } },{ key:'PageUp',target:{ tagName:'DIV',isContentEditable:true } }]) {
  assert.equal(p.event(p.window,'keydown',props).prevented,undefined);
 }
 assert.equal(p.event(p.window,'wheel',{ deltaY:-100,ctrlKey:true }).prevented,undefined);
 p.event(p.nodes.get('.hero'),'touchstart',{ touches:[{ clientY:100 },{ clientY:100 }] });
 assert.equal(p.event(p.nodes.get('.hero'),'touchmove',{ touches:[{ clientY:180 }] }).prevented,undefined);
 await p.tick(150); assert.equal(film.playedSources.length,before);
 reverseInput(p,'PageUp'); await p.tick(150);
 assert.equal(film.src,'./media/desktop/segC-reverse.mp4');
 assert.equal(p.event(p.window,'keydown',{ key:'ArrowDown' }).prevented,true); assert.equal(film.paused,false);
 assert.equal(reverseInput(p,'ArrowUp').prevented,true); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-2.webp');
 assert.equal(p.nodes.get('#following').focused,undefined);
});

test('reverse reduced motion stays static across all five stops and both cameras', async () => {
 for(const mobile of [false,true]) {
  const p=player({ reducedMotion:true }); await p.decode();
  if(mobile) { p.portrait.matches=true; p.event(p.portrait,'change'); await p.decode(); }
  for(let stop=1;stop<=5;stop++) { p.event(p.nodes.get('#next'),'click'); await p.tick(150); await p.decode(); await p.decode(); }
  for(let stop=4;stop>=0;stop--) {
   reverseInput(p,'ArrowUp'); await p.tick(150); await p.decode(); await p.decode();
   assert.equal(p.nodes.get('#count').textContent,counterLabel(stop));
   assert.equal(p.nodes.get('#film').src,''); assert.deepEqual(p.nodes.get('#film').playedSources,[]);
  }
 }
});

test('reverse interruptions keep destination, focus and paused media semantics', async () => {
 for(const action of ['skip','escape','hidden','offstage','reduced','orientation']) {
  const p=player({ pendingMedia:['#film'] }); await reachStop(p,3);
  const film=p.nodes.get('#film'); reverseInput(p,'Prev'); await p.tick(150); p.event(film,'playing');
  const attempt=p.plays.at(-1);
  if(action==='skip') p.event(p.nodes.get('#skip'),'click');
  if(action==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  if(action==='hidden') { p.document.hidden=true; p.event(p.document,'visibilitychange'); }
  if(action==='offstage') { p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0 }); p.event(p.window,'scroll'); }
  if(action==='reduced') { p.reduced.matches=true; p.event(p.reduced,'change'); }
  if(action==='orientation') {
   p.portrait.matches=true; p.event(p.portrait,'change');
   assert.equal(film.paused,false); assert.equal(film.src,'./media/desktop/segC-reverse.mp4');
   p.event(film,'ended');
  }
  if(action==='hidden') { p.document.hidden=false; p.event(p.document,'visibilitychange'); }
  await p.decode(); await p.decode();
  attempt.reject(Object.assign(new Error('obsolete'),{ name:'NotSupportedError' })); await p.flush();
  assert.equal(film.paused,true); assert.equal(p.nodes.get('#error').hidden,true);
  assert.equal(p.nodes.get('img').src,`./media/${action==='orientation'?'mobile':'desktop'}/stop-2.webp`,action);
  assert.equal(p.nodes.get('#count').textContent,'03 / 06');
  if(action==='skip') assert.equal(p.nodes.get('#following').focused,true);
  if(['escape','hidden','reduced'].includes(action)) assert.equal(p.nodes.get('.hero').focused,true);
  if(action==='offstage') { assert.equal(p.nodes.get('.hero').focused,undefined); assert.equal(p.nodes.get('#following').focused,undefined); }
  if(action==='orientation') assert.equal(p.nodes.get('#ambient').src,'./media/mobile/goal-loop-hold.mp4');
 }
});

async function failTravel(p, failure) {
 const film=p.nodes.get('#film');
 if(failure==='error') p.event(film,'error');
 if(failure==='stall') { p.event(film,'waiting'); await p.tick(2001); }
 if(failure==='reject') { p.plays.at(-1).reject(Object.assign(new Error('missing travel'),{ name:'NotSupportedError' })); await p.flush(); }
 if(failure==='offstage') {
  p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0,width:1600,height:900 });
  p.event(p.window,'scroll');
 }
}

function assertChapter(p, stop, camera) {
 assert.equal(p.nodes.get('img').src,`./media/${camera}/${posterName(stop)}.webp`);
 assert.equal(p.nodes.get('source').srcset,p.nodes.get('img').src);
 assert.match(p.nodes.get('img').alt,stop===2?/White delivery lab/:/beyond the goal/);
 assert.equal(p.nodes.get('#count').textContent,counterLabel(stop));
 assert.equal(p.nodes.get('#announcement').textContent,`${titles[stop]}. Chapter ${stop+1} of ${stopCount}.`);
 assert.deepEqual(p.copies.map(copy=>copy.hidden),titles.map((_,index)=>index!==stop));
}

test('travel failures and offstage scroll decode matching destination pixels and labels in both directions and cameras', async () => {
 for(const mobile of [false,true]) for(const reverse of [false,true]) for(const failure of ['error','stall','reject','offstage']) for(const playing of [false,true]) {
  const origin=reverse?3:2, destination=reverse?2:3, camera=mobile?'mobile':'desktop';
  const p=player({ pendingMedia:['#film'] }); await reachStop(p,origin,mobile);
  const film=p.nodes.get('#film'), image=p.nodes.get('img'), before=image.src, alt=image.alt;
  p.event(p.nodes.get(reverse?'#prev':'#next'),'click'); await p.tick(150);
  if(playing) p.event(film,'playing');
  const callbacks=Object.values(film.listeners).flat();
  await failTravel(p,failure);
  assert.equal(film.paused,true); assert.equal(image.src,before); assert.equal(image.alt,alt);
  assert.equal(film.style.visibility,playing?'visible':'hidden');
  assert.equal(p.nodes.get('#next').disabled,true,'destination decode gates travel');
  assert.equal(p.nodes.get('#error').hidden,failure==='offstage');
  assert.equal(p.decodes.at(-1)?.src,`./media/${camera}/stop-${destination}.webp`);
  await p.decode();
  assertChapter(p,destination,camera);
  assert.equal(film.style.visibility,'hidden'); assert.equal(p.nodes.get('#next').disabled,false);
  assert.equal(p.nodes.get('#error').hidden,failure==='offstage');
  assert.equal(p.nodes.get('#gameon-hold').hidden,true); assert.equal(p.nodes.get('#ambient').paused,true);
  for(const callback of callbacks) callback(); await p.tick(5000);
  assertChapter(p,destination,camera);
  assert.equal(film.paused,true); assert.equal(p.nodes.get('#following').focused,undefined);
  assert.equal(p.nodes.get('.hero').focused,undefined);
  p.nodes.get('.hero').getBoundingClientRect=()=>({ top:0,bottom:900,width:1600,height:900 });
  p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  assert.equal(film.src,`./media/${camera}/${segments[destination]}.mp4`);
  p.event(p.nodes.get('#skip'),'click'); await p.decode();
  assert.equal(p.nodes.get('#following').focused,true); assert.equal(p.nodes.get('#following').scrolled,true);
 }
});

test('failed target decode preserves real pixels without claiming a different chapter and keeps Next and Skip usable', async () => {
 for(const mobile of [false,true]) for(const reverse of [false,true]) for(const failure of ['error','stall','reject','offstage','ended']) for(const playing of [false,true]) {
  const origin=reverse?3:2, camera=mobile?'mobile':'desktop';
  const p=player({ pendingMedia:['#film'] }); await reachStop(p,origin,mobile);
  const film=p.nodes.get('#film'), image=p.nodes.get('img'), before=image.src, alt=image.alt;
  p.event(p.nodes.get(reverse?'#prev':'#next'),'click'); await p.tick(150);
  if(playing) p.event(film,'playing');
  if(failure==='ended') p.event(film,'ended'); else await failTravel(p,failure);
  const url=film.src; await p.decode(false);
  assert.equal(image.src,before); assert.equal(image.alt,alt);
  assert.equal(film.style.visibility,playing?'visible':'hidden'); assert.equal(film.src,url); assert.equal(film.paused,true);
  assert.equal(p.nodes.get('#error').hidden,false); assert.equal(p.nodes.get('#next').disabled,false);
  assert.equal(p.nodes.get('#gameon-hold').hidden,true); assert.equal(p.nodes.get('#ambient').paused,true);
  if(playing) {
   assert.ok(p.copies.every(copy=>copy.hidden)); assert.equal(p.nodes.get('#count').textContent,'');
   assert.match(p.nodes.get('#announcement').textContent,/unavailable/i);
  } else assertChapter(p,origin,camera);
  p.reduced.matches=true; p.event(p.reduced,'change');
  if(playing) { assert.equal(film.src,url); assert.equal(film.style.visibility,'visible'); }
  p.reduced.matches=false; p.event(p.reduced,'change');
  p.nodes.get('.hero').getBoundingClientRect=()=>({ top:0,bottom:900,width:1600,height:900 });
  p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  assert.equal(film.src,`./media/${camera}/${segments[origin]}.mp4`,'failed decode cannot advance the navigation anchor');
  p.event(p.nodes.get('#skip'),'click'); await p.decode();
  assert.equal(p.nodes.get('#following').focused,true); assert.equal(p.nodes.get('#following').scrolled,true);
 }
});

test('interruptions during failure decode cannot resurrect obsolete posters or travel callbacks', async () => {
 for(const reverse of [false,true]) for(const action of ['orientation','skip','escape','hidden','reduced']) {
  const p=player({ pendingMedia:['#film'] }); await reachStop(p,reverse?3:2);
  const film=p.nodes.get('#film'), destination=reverse?2:3;
  p.event(p.nodes.get(reverse?'#prev':'#next'),'click'); await p.tick(150); p.event(film,'playing');
  const attempt=p.plays.at(-1), callbacks=Object.values(film.listeners).flat();
  await failTravel(p,'error');
  const old=p.decodes.splice(0);
  if(action==='orientation') { p.portrait.matches=true; p.event(p.portrait,'change'); }
  if(action==='skip') p.event(p.nodes.get('#skip'),'click');
  if(action==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  if(action==='hidden') { p.document.hidden=true; p.event(p.document,'visibilitychange'); }
  if(action==='reduced') { p.reduced.matches=true; p.event(p.reduced,'change'); }
  if(['hidden','reduced'].includes(action)) for(const pending of old) pending.resolve();
  await p.decode(); await p.decode();
  for(const pending of old) pending.reject(new Error('obsolete poster'));
  for(const callback of callbacks) callback();
  attempt.reject(Object.assign(new Error('obsolete travel'),{ name:'NotSupportedError' }));
  await p.flush(); await p.tick(5000);
  assertChapter(p,destination,action==='orientation'?'mobile':'desktop');
  assert.equal(film.paused,true); assert.equal(film.style.visibility,'hidden');
  assert.equal(p.nodes.get('#error').hidden,false); assert.equal(p.nodes.get('#next').disabled,false);
  if(action==='skip') assert.equal(p.nodes.get('#following').focused,true);
  else assert.equal(p.nodes.get('#following').focused,undefined);
  if(action==='escape') assert.equal(p.nodes.get('.hero').focused,true);
  if(action==='reduced') assert.equal(film.src,'');
  if(action==='hidden') assert.equal(p.nodes.get('#ambient').paused,true);
 }
});

test('obsolete film events, play rejection and mismatched media source cannot finish a reverse generation', async () => {
 const p=player({ pendingMedia:['#film'] }); await reachStop(p,3);
 const film=p.nodes.get('#film'); reverseInput(p,'Prev'); await p.tick(150);
 const old=p.plays.at(-1), callbacks=Object.fromEntries(['playing','ended','error','waiting','timeupdate'].map(type=>[type,[...film.listeners[type]]]));
 p.event(p.window,'keydown',{ key:'Escape' }); await p.decode();
 reverseInput(p,'Prev'); await p.tick(150);
 for(const list of Object.values(callbacks)) for(const callback of list) callback();
 old.reject(Object.assign(new Error('old source'),{ name:'NotSupportedError' })); await p.flush();
 assert.equal(film.src,'./media/desktop/segB-reverse.mp4'); assert.equal(film.paused,false);
 assert.equal(p.nodes.get('#next').disabled,true); assert.equal(p.nodes.get('#error').hidden,true);
 assert.equal(p.nodes.get('#finding').hidden,true);
 film.currentSrc='./media/desktop/segC-reverse.mp4';
 p.event(film,'ended'); p.event(film,'error'); p.event(film,'playing');
 assert.equal(p.nodes.get('#next').disabled,true); assert.equal(p.nodes.get('#error').hidden,true);
 film.currentSrc=film.src; p.event(film,'playing'); p.event(film,'ended'); await p.decode(); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
});

test('pending destination decode gates new travel so retained final pixels cannot be cleared', async () => {
 for(const reverse of [false,true]) {
  const p=player(); await reachStop(p,reverse?3:2); const film=p.nodes.get('#film');
  p.event(p.nodes.get(reverse?'#prev':'#next'),'click'); await p.tick(150);
  p.event(film,'playing'); p.event(film,'ended');
  const url=film.src, plays=film.playedSources.length;
  assert.equal(p.nodes.get('#next').disabled,true);
  p.event(p.nodes.get('#next'),'click'); reverseInput(p,'Prev');
  assert.equal(reverseInput(p,'ArrowUp').prevented,true);
  assert.equal(reverseInput(p,'wheel').prevented,true);
  await p.tick(150);
  assert.equal(film.src,url); assert.equal(film.playedSources.length,plays);
  assert.equal(film.style.visibility,'visible');
  await p.decode(); assert.equal(p.nodes.get('#next').disabled,false);
 }
});

test('reverse cancellation before fade, downward hurry and pending orientation retain their boundaries', async () => {
 for(const action of ['earlyEscape','wheelSkip','touchSkip','orientation']) {
  const p=player(); await reachStop(p,2); const film=p.nodes.get('#film');
  p.event(p.nodes.get('#ambient'),'playing');
  const plays=film.playedSources.length; reverseInput(p,'Prev');
  if(action==='earlyEscape') {
   p.event(p.window,'keydown',{ key:'Escape' }); await p.decode(); await p.tick(5000);
   assert.equal(film.playedSources.length,plays); assert.equal(film.paused,true);
  } else {
   if(action==='orientation') { p.portrait.matches=true; p.event(p.portrait,'change'); }
   assert.equal(p.nodes.get('#gameon-hold').hidden,false);
   await p.tick(150); assert.equal(film.src,'./media/desktop/segB-reverse.mp4');
   assert.equal(p.nodes.get('#gameon-hold').hidden,false);
   p.event(film,'playing'); await p.tick(120); assert.equal(p.nodes.get('#gameon-hold').hidden,true);
   if(action==='wheelSkip') {
    p.event(p.window,'wheel',{ deltaY:70 }); assert.equal(film.paused,false,'downward input cannot hurry reverse travel');
    await p.tick(251); p.event(p.window,'wheel',{ deltaY:-70 });
   }
   if(action==='touchSkip') {
    p.event(p.nodes.get('.hero'),'touchstart',{ touches:[{ clientY:200 }] });
    p.event(p.nodes.get('.hero'),'touchmove',{ touches:[{ clientY:100 }] }); assert.equal(film.paused,false);
    p.event(p.nodes.get('.hero'),'touchstart',{ touches:[{ clientY:100 }] });
    p.event(p.nodes.get('.hero'),'touchmove',{ touches:[{ clientY:200 }] });
   }
   if(action==='orientation') p.event(film,'ended');
   await p.decode(); await p.decode();
   assert.equal(film.paused,true);
   if(action!=='orientation') assert.equal(p.nodes.get('#following').focused,undefined);
  }
  assert.equal(p.nodes.get('img').src,`./media/${action==='orientation'?'mobile':'desktop'}/stop-1.webp`);
 }
});

test('reduced motion cannot clear retained final pixels when the destination poster fails to decode', async () => {
 for(const reverse of [false,true]) {
  const p=player(); await reachStop(p,reverse?3:2); const film=p.nodes.get('#film');
  p.event(p.nodes.get(reverse?'#prev':'#next'),'click'); await p.tick(150);
  p.event(film,'playing'); p.event(film,'ended'); const url=film.src;
  p.reduced.matches=true; p.event(p.reduced,'change'); await p.decode(false);
  assert.equal(film.style.visibility,'visible'); assert.equal(film.src,url);
  assert.equal(p.nodes.get('#error').hidden,false); assert.equal(p.nodes.get('#next').disabled,false);
  p.reduced.matches=false; p.event(p.reduced,'change');
  assert.equal(film.src,url);
 }
});

test('four stable idle mappings exclude intro and Playground', () => {
 assert.deepEqual([0,1,2,3,4,5].map(model.idleName),[null,'gameon-hold.mp4','goal-loop-hold.mp4','goal-loop-finished-hold.mp4','screen-switch-hold.mp4',null]);
});

test('all four idles retain arbitrary phase until a decoded forward or reverse frame, then settle for120ms', async () => {
 for (const stop of [1,2,3,4]) for (const direction of [-1,1]) {
  const p=player({ videoFrames:true }); await reachStop(p,stop);
  const ambient=p.nodes.get('#ambient'), hold=p.nodes.get('#gameon-hold'), film=p.nodes.get('#film');
  p.frame('#ambient'); await p.tick(120);
  ambient.currentTime=.713;
  p.event(p.nodes.get(direction<0?'#prev':'#next'),'click');
  assert.equal(ambient.currentTime,.713); assert.equal(ambient.paused,true);
  await p.tick(150); await p.flush(); p.event(film,'playing');
  assert.equal(hold.hidden,false); assert.equal(ambient.currentTime,.713);
  assert.equal(film.style.visibility,'hidden','play Promise and playing alone cannot prove a frame with rVFC');
  p.frame('#film'); assert.equal(film.style.visibility,'visible'); assert.equal(hold.hidden,false);
  assert.equal(hold.style.opacity,'0'); assert.equal(ambient.currentTime,.713);
  await p.tick(119); assert.equal(hold.hidden,false);
  await p.tick(1); assert.equal(hold.hidden,true);
  assert.equal(film.src,`./media/desktop/${segments[direction<0?stop-1:stop]}${direction<0?'-reverse':''}.mp4`);
 }
});

test('fallback readiness refuses unloaded or seeking frames and cannot wait forever', async () => {
 const p=player(); await reachHold(p); const film=p.nodes.get('#film'), hold=p.nodes.get('#gameon-hold');
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 film.readyState=1; p.event(film,'playing'); assert.equal(hold.hidden,false); assert.equal(film.style.visibility,'hidden');
 film.readyState=3; film.seeking=true; p.event(film,'loadeddata'); assert.equal(film.style.visibility,'hidden');
 film.seeking=false; p.event(film,'seeked'); assert.equal(film.style.visibility,'visible');
 await p.tick(120); assert.equal(hold.hidden,true);
 const stalled=player({ videoFrames:true }); await reachStop(stalled,2);
 stalled.event(stalled.nodes.get('#next'),'click'); await stalled.tick(150);
 stalled.event(stalled.nodes.get('#film'),'playing'); await stalled.tick(2001);
 assert.equal(stalled.nodes.get('#film').paused,true); assert.equal(stalled.nodes.get('#error').hidden,false);
 await stalled.decode(false); assert.equal(stalled.nodes.get('img').src,'./media/desktop/stop-2.webp');
 assert.equal(stalled.nodes.get('#count').textContent,'03 / 06');
});

test('forward A primes frame2 during travel, enters without fade and never resets on suspension', async () => {
 const p=player({ videoFrames:true }); await p.decode(); const film=p.nodes.get('#film'), ambient=p.nodes.get('#ambient');
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film');
 assert.equal(ambient.src,'./media/desktop/gameon-hold.mp4'); assert.equal(ambient.currentTime,1/24); assert.equal(ambient.paused,true);
 p.event(film,'ended'); await p.decode(); await p.decode();
 assert.equal(ambient.currentTime,1/24); p.frame('#ambient');
 assert.equal(p.nodes.get('#gameon-hold').style.opacity,'1'); assert.equal(p.nodes.get('#gameon-hold').style.transition,'none');
 ambient.currentTime=.71;
 for (const hidden of [true,false]) {
  p.document.hidden=hidden; p.event(p.document,'visibilitychange');
  assert.equal(ambient.currentTime,.71);
 }
});

test('reverse B retains terminal pixels until full peek decode and phase0 idle readiness', async () => {
 const p=player({ videoFrames:true }); await reachStop(p,2); const film=p.nodes.get('#film'), ambient=p.nodes.get('#ambient'), peek=p.nodes.get('#gameon-peek');
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150); p.frame('#film'); await p.tick(120);
 p.event(film,'ended'); await p.decode();
 assert.equal(film.style.visibility,'visible'); assert.equal(ambient.currentTime,0);
 p.frame('#ambient'); assert.equal(film.style.visibility,'visible','undecoded peek must not expose old poster');
 await p.decode();
 assert.equal(peek.hidden,false); assert.equal(peek.style.opacity,'1');
 assert.equal(p.nodes.get('#gameon-hold').style.transition,'opacity 120ms linear');
 await p.tick(119); assert.equal(film.style.visibility,'visible');
 await p.tick(1); assert.equal(film.style.visibility,'hidden');
});

test('incoming idle settle suspended mid-blend finishes safely on return', async () => {
 for (const hidden of [true,false]) {
  const p=player({ videoFrames:true }); await reachStop(p,2);
  p.event(p.nodes.get('#prev'),'click'); await p.tick(150); p.frame('#film'); await p.tick(120);
  p.event(p.nodes.get('#film'),'ended'); await p.decode(); await p.decode(); p.frame('#ambient');
  await p.tick(40);
  const stage=on=>{
   if(hidden) p.document.hidden=!on;
   else p.nodes.get('.hero').getBoundingClientRect=()=>({ top:on?0:-900,bottom:on?900:0,width:1600,height:900 });
   p.event(hidden?p.document:p.window,hidden?'visibilitychange':'scroll');
  };
  stage(false); await p.tick(5000); stage(true); p.frame('#ambient'); await p.tick(120);
  assert.equal(p.nodes.get('#film').style.visibility,'hidden');
  assert.equal(p.nodes.get('#film').src,'./media/desktop/segB.mp4');
  assert.equal(p.nodes.get('#gameon-peek').style.opacity,'1');
 }
});

test('an outgoing hold includes its decoded poster when ambient has not delivered pixels', async () => {
 const p=player({ videoFrames:true }); await reachStop(p,3);
 const hold=p.nodes.get('#gameon-hold');
 assert.match(hold.style.backgroundImage,/stop-3.webp/);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film');
 assert.match(hold.style.backgroundImage,/stop-3.webp/); assert.equal(hold.hidden,false);
});

test('old frame, peek and blend callbacks cannot reveal media after interruption', async () => {
 for (const action of ['direction','variant','hidden','offstage','reduced','escape','skip']) {
  const p=player({ videoFrames:true }); await reachHold(p,{ peek:false });
  const ambient=p.nodes.get('#ambient'), film=p.nodes.get('#film'), pendingPeek=p.decodes.splice(0);
  const oldFrames=[...ambient.frames.values()];
  if(action==='direction') p.event(p.nodes.get('#prev'),'click');
  if(action==='variant') { p.portrait.matches=true; p.event(p.portrait,'change'); }
  if(action==='hidden') { p.document.hidden=true; p.event(p.document,'visibilitychange'); }
  if(action==='offstage') { p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0 }); p.event(p.window,'scroll'); }
  if(action==='reduced') { p.reduced.matches=true; p.event(p.reduced,'change'); }
  if(action==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  if(action==='skip') p.event(p.nodes.get('#skip'),'click');
  for(const fn of oldFrames) fn(0,{ mediaTime:1/24 });
  for(const d of pendingPeek) d.resolve(); await p.flush();
  assert.notEqual(ambient.style.visibility,'visible',action);
  assert.equal(p.nodes.get('#gameon-peek').hidden,true,action);
  assert.notEqual(film.style.visibility,'visible',action);
 }
});

test('reverse B pending peek cannot occlude retained terminal film and a failed decode stays honest', async () => {
 for(const failure of ['decode','stall']) {
  const p=player({ videoFrames:true }); await reachStop(p,2);
  const film=p.nodes.get('#film'), hold=p.nodes.get('#gameon-hold');
  p.event(p.nodes.get('#prev'),'click'); await p.tick(150); p.frame('#film'); await p.tick(120);
  p.event(film,'ended'); await p.decode();
  assert.equal(film.style.visibility,'visible'); assert.equal(hold.style.opacity,'0');
  p.frame('#ambient'); assert.equal(hold.style.opacity,'0');
  if(failure==='decode') await p.decode(false); else await p.tick(2001);
  assert.equal(film.style.visibility,'visible'); assert.equal(hold.hidden,true);
  assert.equal(p.nodes.get('#ambient').paused,true);
  assert.equal(p.nodes.get('#error').hidden,false); assert.equal(p.nodes.get('#next').disabled,false);
  p.event(p.nodes.get('#next'),'click'); await p.tick(150);
  assert.equal(film.src,'./media/desktop/segB.mp4');
 }
});

test('forward A terminal pixels remain until frame2 and the peek reveal starts on the settled hold', async () => {
 const p=player({ videoFrames:true }); await p.decode();
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film');
 p.event(p.nodes.get('#film'),'ended'); await p.decode(); await p.decode();
 assert.equal(p.nodes.get('#film').style.visibility,'visible');
 assert.equal(p.nodes.get('#gameon-hold').style.opacity,'0');
 assert.equal(p.nodes.get('#gameon-peek').style.animationPlayState,'paused');
 p.frame('#ambient');
 assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 assert.equal(p.nodes.get('#gameon-hold').style.opacity,'1');
 assert.equal(p.nodes.get('#gameon-peek').style.animationPlayState,'running');
 await p.tick(500); p.event(p.nodes.get('#next'),'click');
 assert.equal(p.nodes.get('#gameon-peek').style.animationPlayState,'paused');
 assert.notEqual(p.nodes.get('#gameon-peek').style.opacity,'1');
 await p.tick(150); p.frame('#film');
 assert.equal(p.nodes.get('#gameon-hold').style.opacity,'0');
 assert.equal(p.nodes.get('#gameon-hold').hidden,false);
 await p.tick(120); assert.equal(p.nodes.get('#gameon-hold').hidden,true);
});

test('a queued old-source frame cannot consume readiness for the newly loaded film', async () => {
 const p=player({ videoFrames:true }); await reachStop(p,2);
 const film=p.nodes.get('#film'); p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 film.currentSrc='./media/desktop/segB.mp4'; p.frame('#film'); assert.equal(film.style.visibility,'hidden');
 film.currentSrc=film.src; p.event(film,'loadeddata'); p.event(film,'playing'); p.frame('#film');
 assert.equal(film.style.visibility,'visible');
});

test('GameOn orientation after reverse B preserves the full peek state', async () => {
 const p=player(); await reachStop(p,2);
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150); p.event(p.nodes.get('#film'),'playing');
 p.event(p.nodes.get('#film'),'ended'); await p.decode(); await p.decode(); p.event(p.nodes.get('#ambient'),'playing'); await p.tick(120);
 p.portrait.matches=true; p.event(p.portrait,'change'); await p.decode(); await p.decode(); p.event(p.nodes.get('#ambient'),'playing');
 assert.equal(p.nodes.get('#gameon-peek').style.opacity,'1');
 assert.equal(p.nodes.get('#gameon-peek').style.animationName,'none');
});

test('pending finished-belt and plant media fail truthfully without borrowing another idle', async () => {
 for(const stop of [3,4]) for(const mobile of [false,true]) for(const failure of ['error','reject','stall']) {
  const p=player({ pendingMedia:['#ambient'] }); await reachStop(p,stop,mobile);
  const ambient=p.nodes.get('#ambient'), camera=mobile?'mobile':'desktop';
  assert.equal(ambient.src,`./media/${camera}/${stop===3?'goal-loop-finished-hold.mp4':'screen-switch-hold.mp4'}`);
  if(failure==='error') p.event(ambient,'error');
  if(failure==='reject') p.plays.at(-1).reject(Object.assign(new Error('missing'),{ name:'NotSupportedError' }));
  if(failure==='stall') await p.tick(2001);
  await p.flush();
  assert.equal(ambient.paused,true); assert.equal(ambient.style.visibility,'hidden');
  assert.equal(p.nodes.get('img').src,`./media/${camera}/stop-${stop}.webp`);
  assert.equal(p.nodes.get('#count').textContent,counterLabel(stop));
  assert.equal(p.nodes.get('#error').hidden,false); assert.equal(p.nodes.get('#next').disabled,false);
  p.event(p.nodes.get('#prev'),'click'); await p.tick(150);
  assert.equal(p.nodes.get('#film').src,`./media/${camera}/${segments[stop-1]}-reverse.mp4`);
 }
});

test('offstage resize cancels film readiness and settles without stealing focus', async () => {
 const p=player({ videoFrames:true }); await reachStop(p,2);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 const film=p.nodes.get('#film'), old=[...film.frames.values()];
 p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0,width:1600,height:900 });
 p.event(p.window,'resize');
 assert.equal(film.paused,true); assert.equal(film.frames.size,0);
 for(const fn of old) fn(0,{ mediaTime:0 });
 await p.decode(); assert.equal(p.nodes.get('#count').textContent,'04 / 06');
 assert.equal(p.nodes.get('.hero').focused,undefined); assert.equal(p.nodes.get('#following').focused,undefined);
});

test('an ambient source replacement invalidates its queued decoded-frame callback', async () => {
 const p=player({ videoFrames:true }); await reachStop(p,3);
 const ambient=p.nodes.get('#ambient'); ambient.src='./media/desktop/foreign.mp4'; ambient.currentSrc=ambient.src;
 p.frame('#ambient'); assert.equal(ambient.style.visibility,'hidden');
});

test('obsolete film frame callbacks cannot reveal or change chapter after navigation and suspension', async () => {
 for(const action of ['variant','hidden','reduced','escape','skip','offstage']) {
  const p=player({ videoFrames:true }); await reachStop(p,2);
  const film=p.nodes.get('#film'); p.event(p.nodes.get('#prev'),'click'); await p.tick(150);
  const old=[...film.frames.values()];
  if(action==='variant') { p.portrait.matches=true; p.event(p.portrait,'change'); }
  if(action==='hidden') { p.document.hidden=true; p.event(p.document,'visibilitychange'); }
  if(action==='reduced') { p.reduced.matches=true; p.event(p.reduced,'change'); }
  if(action==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  if(action==='skip') p.event(p.nodes.get('#skip'),'click');
  if(action==='offstage') { p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0 }); p.event(p.window,'scroll'); }
  const count=p.nodes.get('#count').textContent;
  for(const fn of old) fn(0,{ mediaTime:0 });
  assert.equal(film.style.visibility,'hidden',action);
  assert.equal(p.nodes.get('#count').textContent,count,action);
  if(action==='variant') { p.frame('#film'); assert.equal(film.style.visibility,'visible'); }
 }
});

test('priming starts only after outgoing pixels release and stops0/5 never request an idle', async () => {
 const p=player({ videoFrames:true }); await p.decode();
 assert.equal(p.nodes.get('#ambient').loads,0);
 await reachStop(p,2); p.frame('#ambient'); await p.tick(120);
 const ambient=p.nodes.get('#ambient'), loads=ambient.loads;
 ambient.currentTime=.417;
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film');
 await p.tick(119); assert.equal(ambient.loads,loads); assert.equal(ambient.currentTime,.417);
 await p.tick(1); assert.equal(ambient.src,'./media/desktop/goal-loop-finished-hold.mp4'); assert.equal(ambient.paused,true);
 const terminal=player({ videoFrames:true }); await reachStop(terminal,5);
 const lastLoads=terminal.nodes.get('#ambient').loads;
 terminal.event(terminal.window,'scroll'); terminal.event(terminal.window,'resize');
 assert.equal(terminal.nodes.get('#ambient').loads,lastLoads); assert.equal(terminal.nodes.get('#ambient').paused,true);
 assert.equal(terminal.nodes.get('#gameon-hold').hidden,true);
});

test('review R1: navigation after a no-hold fallback must not resurrect previous chapter pixels', async () => {
 const p=player(); await reachStop(p,2);
 const ambient=p.nodes.get('#ambient'), film=p.nodes.get('#film'), hold=p.nodes.get('#gameon-hold');
 p.event(ambient,'playing'); await p.tick(120);
 p.event(p.nodes.get('#next'),'click'); await p.tick(150);
 p.event(film,'error'); await p.decode();
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-3.webp');
 assert.equal(p.nodes.get('#count').textContent,'04 / 06'); assert.equal(hold.hidden,true);
 p.event(p.nodes.get('#next'),'click');
 assert.equal(hold.hidden,true,'a disabled old stop2 hold cannot cover the decoded stop3 still');
});

test('review R2: rejected early rVFC must rearm without another media event', async () => {
 const p=player({ videoFrames:true }); await p.decode();
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film');
 p.event(p.nodes.get('#film'),'ended'); await p.decode(); await p.decode();
 const ambient=p.nodes.get('#ambient');
 p.frame('#ambient',0);
 assert.equal(ambient.frames.size,1,'next frame remains requested after rejecting stale phase0');
 p.frame('#ambient',1/24);
 assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 assert.notEqual(p.nodes.get('#error').hidden,false);
});

test('review R2: fallback timeupdate can admit a valid frame after early playing', async () => {
 const p=player(); await reachHold(p,{ ready:false });
 const ambient=p.nodes.get('#ambient'); ambient.currentTime=0;
 p.event(ambient,'playing'); assert.equal(p.nodes.get('#film').style.visibility,'visible');
 ambient.currentTime=1/24; p.event(ambient,'timeupdate');
 assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 assert.notEqual(p.nodes.get('#error').hidden,false);
});

test('review R1: interrupted arrivals at stops2/3 keep stale holds hidden on either next direction', async () => {
 for(const mobile of [false,true]) for(const destination of [2,3]) for(const arrival of [-1,1]) for(const departure of [-1,1])
 for(const failure of ['error','stall','reject','escape','skip','scroll','resize']) for(const decoded of [false,true]) {
  const p=player({ videoFrames:true }); await reachStop(p,destination-arrival,mobile);
  const ambient=p.nodes.get('#ambient'), film=p.nodes.get('#film'), hold=p.nodes.get('#gameon-hold');
  p.frame('#ambient'); await p.tick(120); ambient.currentTime=.713;
  if(failure==='reject') film.play=function() { this.paused=false; return Promise.reject(new Error('missing travel')); };
  p.event(p.nodes.get(arrival<0?'#prev':'#next'),'click'); await p.tick(150);
  if(decoded) p.frame('#film');
  if(failure==='error') p.event(film,'error');
  if(failure==='stall') { p.event(film,'waiting'); await p.tick(2001); }
  if(failure==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  if(failure==='skip') p.event(p.nodes.get('#skip'),'click');
  if(failure==='scroll' || failure==='resize') {
   p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0,width:1600,height:900 });
   p.event(p.window,failure);
  }
  await p.decode();
  p.nodes.get('.hero').getBoundingClientRect=()=>({ top:0,bottom:900,width:1600,height:900 });
  p.event(p.window,'scroll');
  const context=`mobile${mobile} stop${destination} arrival${arrival} departure${departure} ${failure} decoded${decoded}`;
  assertChapter(p,destination,mobile?'mobile':'desktop'); assert.equal(hold.hidden,true,context);
  const previousAmbient=ambient.src;
  p.event(p.nodes.get(departure<0?'#prev':'#next'),'click');
  assert.equal(hold.hidden,true,context);
  await p.tick(150);
  assert.equal(hold.hidden,true,context); assert.equal(ambient.src,previousAmbient,context);
  assert.equal(ambient.paused,true,context);
 }
});

test('review R2: transient seeking rearms one callback and accepts the next frame without events', async () => {
 const p=player({ videoFrames:true }); await reachHold(p);
 const ambient=p.nodes.get('#ambient'); ambient.seeking=true;
 p.frame('#ambient'); assert.equal(ambient.frames.size,1);
 p.event(ambient,'playing'); p.event(ambient,'loadeddata'); assert.equal(ambient.frames.size,1);
 ambient.seeking=false; p.frame('#ambient');
 assert.equal(ambient.frames.size,0); assert.equal(p.nodes.get('#film').style.visibility,'hidden');
 await p.tick(2001); assert.notEqual(p.nodes.get('#error').hidden,false);
});

test('review R2: a rearmed readiness callback remains bounded and canceled continuations stay inert', async () => {
 for(const action of ['escape','skip','hidden','offstage','variant','reduced','source','timeout']) {
  const p=player({ videoFrames:true }); await reachHold(p);
  const ambient=p.nodes.get('#ambient'); p.frame('#ambient',0);
  assert.equal(ambient.frames.size,1,action); const queued=[...ambient.frames.values()];
  if(action==='escape') p.event(p.window,'keydown',{ key:'Escape' });
  if(action==='skip') p.event(p.nodes.get('#skip'),'click');
  if(action==='hidden') { p.document.hidden=true; p.event(p.document,'visibilitychange'); }
  if(action==='offstage') { p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0 }); p.event(p.window,'scroll'); }
  if(action==='variant') { p.portrait.matches=true; p.event(p.portrait,'change'); }
  if(action==='reduced') { p.reduced.matches=true; p.event(p.reduced,'change'); }
  if(action==='source') ambient.src='./media/desktop/foreign.mp4';
  if(action==='timeout') await p.tick(2001);
  p.frame('#ambient',1/24);
  for(const fn of queued) fn(0,{ mediaTime:1/24 });
  assert.equal(ambient.frames.size,0,action); assert.notEqual(ambient.style.visibility,'visible',action);
  if(action==='timeout') assert.equal(p.nodes.get('#error').hidden,false);
 }
});

test('review lifecycle: active scroll and resize preserve outgoing blend release and destination priming', async () => {
 for(const event of ['scroll','resize']) {
  const p=player({ videoFrames:true }); await reachStop(p,2); p.frame('#ambient'); await p.tick(120);
  const ambient=p.nodes.get('#ambient'), hold=p.nodes.get('#gameon-hold'), loads=ambient.loads;
  p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film'); await p.tick(40);
  p.event(p.window,event);
  assert.equal(hold.hidden,false,event); assert.equal(hold.style.transition,'opacity 120ms linear',event);
  await p.tick(79); assert.equal(hold.hidden,false,event); assert.equal(ambient.loads,loads,event);
  await p.tick(1); assert.equal(hold.hidden,true,event);
  assert.equal(ambient.src,'./media/desktop/goal-loop-finished-hold.mp4',event);
 }
});

test('review lifecycle: failed forward decoration does not block ambient readiness after suspension', async () => {
 for(const ready of [false,true]) for(const hidden of [false,true]) {
  const p=player({ videoFrames:true }); await reachHold(p,{ peek:false,ready:false });
  const ambient=p.nodes.get('#ambient');
  if(ready) p.frame('#ambient');
  await p.decode(false);
  const stage=on=>{
   if(hidden) p.document.hidden=!on;
   else p.nodes.get('.hero').getBoundingClientRect=()=>({ top:on?0:-900,bottom:on?900:0,width:1600,height:900 });
   p.event(hidden?p.document:p.window,hidden?'visibilitychange':'scroll');
  };
  stage(false); assert.equal(ambient.paused,true); stage(true);
  assert.equal(ambient.paused,false); p.frame('#ambient');
  assert.equal(p.nodes.get('#film').style.visibility,'hidden');
  assert.equal(p.nodes.get('#gameon-peek').hidden,true); assert.equal(p.nodes.get('#error').hidden,false);
 }
});

test('review R2: fallback timeupdate probes are removed on success, cancellation and timeout', async () => {
 for(const action of ['ready','skip','timeout']) {
  const p=player(); await reachHold(p,{ ready:false });
  const ambient=p.nodes.get('#ambient'); ambient.currentTime=0; p.event(ambient,'playing');
  assert.equal(ambient.listeners.timeupdate.length,1);
  const queued=ambient.listeners.timeupdate[0];
  if(action==='ready') { ambient.currentTime=1/24; p.event(ambient,'timeupdate'); }
  if(action==='skip') p.event(p.nodes.get('#skip'),'click');
  if(action==='timeout') await p.tick(2001);
  for(const type of ['playing','seeked','loadeddata','timeupdate']) assert.equal(ambient.listeners[type].length,0,`${action} ${type}`);
  const visibility=ambient.style.visibility; ambient.currentTime=1/24; queued();
  assert.equal(ambient.style.visibility,visibility);
 }
});

test('review lifecycle: suspension and preference changes still cancel an outgoing blend', async () => {
 for(const action of ['hidden','scroll','resize','variant','reduced']) {
  const p=player({ videoFrames:true }); await reachStop(p,2); p.frame('#ambient'); await p.tick(120);
  p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film'); await p.tick(40);
  if(action==='hidden') { p.document.hidden=true; p.event(p.document,'visibilitychange'); }
  if(action==='scroll' || action==='resize') {
   p.nodes.get('.hero').getBoundingClientRect=()=>({ top:-900,bottom:0,width:1600,height:900 });
   p.event(p.window,action);
  }
  if(action==='variant') { p.portrait.matches=true; p.event(p.portrait,'change'); }
  if(action==='reduced') { p.reduced.matches=true; p.event(p.reduced,'change'); }
  assert.equal(p.nodes.get('#gameon-hold').style.transition,'none',action);
  await p.tick(120);
  assert.doesNotMatch(p.nodes.get('#ambient').src,/goal-loop-finished-hold.mp4/,action);
 }
});

test('review lifecycle: reverse B failed full peek still blocks ambient after hidden resume', async () => {
 const p=player({ videoFrames:true }); await reachStop(p,2);
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150); p.frame('#film'); await p.tick(120);
 p.event(p.nodes.get('#film'),'ended'); await p.decode(); p.frame('#ambient'); await p.decode(false);
 p.document.hidden=true; p.event(p.document,'visibilitychange');
 p.document.hidden=false; p.event(p.document,'visibilitychange');
 assert.equal(p.nodes.get('#ambient').paused,true);
 assert.equal(p.nodes.get('#film').style.visibility,'visible'); assert.equal(p.nodes.get('#gameon-hold').hidden,true);
});

async function enterRetainedReverseB(p, mobile = false) {
 await p.decode();
 if(mobile) { p.portrait.matches=true; p.event(p.portrait,'change'); await p.decode(); }
 const film=p.nodes.get('#film'), camera=mobile?'mobile':'desktop';
 for(const segment of ['segA','segB']) {
  p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film'); await p.tick(120);
  assert.equal(film.src,`./media/${camera}/${segment}.mp4`);
  p.event(film,'ended'); await p.decode(); await p.decode(); p.frame('#ambient'); await p.tick(120);
 }
 p.event(p.nodes.get('#prev'),'click'); await p.tick(150);
 assert.equal(film.src,`./media/${camera}/segB-reverse.mp4`);
 p.frame('#film'); await p.tick(120);
 assert.equal(p.nodes.get('#gameon-hold').hidden,true,'outgoing hold releases before reverse arrival');
 film.currentTime=3.25; p.event(film,'ended');
 assert.equal(film.style.visibility,'visible');
 assert.equal(p.nodes.get('img').src,`./media/${camera}/stop-2.webp`);
 await p.decode();
 assert.equal(p.nodes.get('img').src,`./media/${camera}/stop-1.webp`);
 assert.equal(p.nodes.get('#gameon-hold').style.opacity,'0');
 assert.equal(film.style.visibility,'visible','decoded poster retains terminal reverse pixels until idle readiness');
 assert.equal(p.nodes.get('#ambient').currentTime,0);
 assert.equal(p.decodes.length,1); assert.equal(p.decodes[0].src,`./media/${camera}/gameon-peek.webp`);
}

for(const mobile of [false,true]) for(const first of ['ambient','peek']) {
 test(`native reverse B regression: ${mobile?'mobile':'desktop'} ${first} ready first keeps incoming hold visible`, async () => {
  const p=player({ videoFrames:true }); await enterRetainedReverseB(p,mobile);
  const film=p.nodes.get('#film'), hold=p.nodes.get('#gameon-hold'), ambient=p.nodes.get('#ambient'), peek=p.nodes.get('#gameon-peek');
  if(first==='ambient') p.frame('#ambient'); else await p.decode();
  assert.equal(film.style.visibility,'visible','one ready input cannot release the terminal film');
  assert.equal(hold.style.opacity,'0');
  await p.tick(40);
  if(first==='ambient') await p.decode(); else p.frame('#ambient');
  assert.equal(hold.hidden,false,'incoming blend must unhide its wrapper after outgoing cleanup');
  assert.equal(hold.style.opacity,'1'); assert.equal(hold.style.transition,'opacity 120ms linear');
  assert.equal(ambient.style.visibility,'visible'); assert.equal(ambient.paused,false);
  assert.equal(peek.hidden,false); assert.equal(peek.style.opacity,'1'); assert.equal(peek.style.animationName,'none');
  await p.tick(60); assert.equal(hold.hidden,false); assert.equal(film.style.visibility,'visible');
  await p.tick(59); assert.equal(hold.hidden,false); assert.equal(film.style.visibility,'visible');
  await p.tick(1);
  assert.equal(hold.hidden,false); assert.equal(film.style.visibility,'hidden');
  assert.equal(film.src,`./media/${mobile?'mobile':'desktop'}/segB.mp4`);
  assert.equal(ambient.style.visibility,'visible'); assert.equal(ambient.paused,false);
  assert.equal(peek.hidden,false); assert.equal(peek.style.opacity,'1');
  assert.equal(p.nodes.get('#count').textContent,'02 / 06'); assert.equal(p.copies[1].hidden,false);
 });
}

test('native reverse B regression: stale readiness after variant replacement cannot resurrect the old hold', async () => {
 const p=player({ videoFrames:true }); await enterRetainedReverseB(p);
 const ambient=p.nodes.get('#ambient'), hold=p.nodes.get('#gameon-hold'), film=p.nodes.get('#film');
 const staleFrames=[...ambient.frames.values()], stalePeek=p.decodes.splice(0);
 p.portrait.matches=true; p.event(p.portrait,'change');
 assert.equal(hold.hidden,true);
 for(const fn of staleFrames) fn(0,{ mediaTime:0 });
 for(const pending of stalePeek) pending.resolve(); await p.flush(); await p.tick(120);
 assert.equal(hold.hidden,true); assert.equal(ambient.style.visibility,'hidden');
 assert.equal(p.nodes.get('#gameon-peek').hidden,true); assert.equal(film.style.visibility,'visible');
 assert.equal(p.nodes.get('img').src,'./media/desktop/stop-1.webp');
 await p.decode(); await p.decode(); p.frame('#ambient'); await p.tick(120);
 assert.equal(p.nodes.get('img').src,'./media/mobile/stop-1.webp');
 assert.equal(hold.hidden,false); assert.equal(film.style.visibility,'hidden');
 assert.equal(ambient.src,'./media/mobile/gameon-hold.mp4');
});

test('native reverse B regression: canceled outgoing blend hides old hold without late destination priming', async () => {
 const p=player({ videoFrames:true }); await enterRetainedReverseB(p);
 await p.decode(); p.frame('#ambient'); await p.tick(120);
 const hold=p.nodes.get('#gameon-hold'), ambient=p.nodes.get('#ambient'), loads=ambient.loads;
 p.event(p.nodes.get('#next'),'click'); await p.tick(150); p.frame('#film'); await p.tick(40);
 assert.equal(hold.hidden,false); assert.equal(hold.style.opacity,'0');
 p.document.hidden=true; p.event(p.document,'visibilitychange');
 assert.equal(hold.hidden,true); assert.equal(hold.style.transition,'none');
 await p.tick(120);
 assert.equal(hold.hidden,true); assert.equal(ambient.loads,loads);
 assert.equal(ambient.src,'./media/desktop/gameon-hold.mp4'); assert.equal(ambient.paused,true);
});
