import { titles, stopCount, counterLabel, initialState, transition, finish, interrupt, findingAtFrame, mediaVariant, posterName, nextSegment, idleName, travelRate } from './model.js';
// One player per hero. The returned cleanup removes every listener and stops media loading.
export function mountArena(hero, { media = './media', following = null, onExit = null } = {}) {
 const controller = new AbortController(), { signal } = controller;
 const $ = selector => hero.querySelector(selector), still = $('#still');
 const film = $('#film'), image = still.querySelector('img'), source = still.querySelector('source');
 const next = $('#next'), prev = $('#prev');
 const portrait = matchMedia('(orientation: portrait)'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
 let state = initialState(), variant = mediaVariant(portrait.matches), pendingVariant = null, timer, stallTimer;
 let revision = 0, posterReady = false, posterStop = 0, movingSegment = null, settling = false;
 const finding = $('#finding');
 const path = file => `${media}/${variant}/${file}`;
 const error = () => {
  const message = $('#error');
  message.textContent = 'Media unavailable or stalled. The last valid image is shown. You can continue or skip.';
  message.hidden = false;
 };
 const hold = $('#gameon-hold'), ambient = $('#ambient'), peek = $('#gameon-peek');
 // Approved inputs.json/native84, atlas -> real front face. Desktop is above frame.
 const holdProjection = {
  desktop: { size: [1600,900], h: [.41075193881988525,-.030462045921043047,.2946240305900574,0,.37389343712526857,-.44275009632110596,0,-.060924063855442294,1] },
  mobile: { size: [900,1600], h: [.46413350105285645,-.03960837776361588,.2679332494735718,0,.10309823730009135,.21500831842422485,0,-.07921678296871004,1] },
 };
 let holdEpoch = 0, holdVersion = -1, holdVariant, holdEnabled = false, peekReady = false, peekRequested = false;
 let ambientSource = '', ambientFailed = false, ambientAttempt = 0, ambientPending = false, filmAttempt = 0;
 let ambientError, cancelAmbientFrame = () => {}, cancelFilmFrame = () => {};
 let blendTimer, blendEpoch = 0, blendingIncoming = false, primedEntry = '', entrySegment = null, entryPending = false, ambientDecoded = false, peekFailed = false;
 let armFilmFrame = () => {};
 let filmListeners = {};
 let revealElapsed = 0, revealStarted = null, revealTimer;
 // Bounded readiness chain, stopping at one decoded frame. play() proves no pixels.
 function decodedFrame(media, current, ready, failed, minimumTime = 0) {
  let live = true, frame;
  const valid = () => live && current() && media.readyState >= 2 && !media.seeking && (!media.currentSrc || media.currentSrc === media.src);
  const cancel = () => {
   live = false; clearTimeout(timeout);
   if (frame !== undefined) media.cancelVideoFrameCallback(frame);
   for (const type of ['playing','seeked','loadeddata','timeupdate']) media.removeEventListener(type, probe);
  };
  const accept = time => { if (!valid() || time < minimumTime-.001) return; cancel(); ready(); };
  const probe = () => {
   if (media.requestVideoFrameCallback) {
    if (live && current() && frame === undefined) frame = media.requestVideoFrameCallback((_, info) => {
     frame = undefined; accept(info.mediaTime);
     if (live && current()) probe();
    });
   } else if (!media.paused) accept(media.currentTime);
  };
  const timeout = setTimeout(() => { const eligible = live && current(); cancel(); if (eligible) failed(); },2000);
  for (const type of ['playing','seeked','loadeddata','timeupdate']) media.addEventListener(type, probe);
  if (media.requestVideoFrameCallback) probe();
  return cancel;
 }
 function cancelBlend() {
  ++blendEpoch; clearTimeout(blendTimer);
  if (blendingIncoming) entryPending = true;
  else if (hold.style.opacity === '0' && film.style.visibility === 'visible') hold.hidden = true;
  blendingIncoming = false;
  hold.style.transition = 'none';
 }
 function blendHold(incoming, done) {
  cancelBlend(); const epoch = blendEpoch; blendingIncoming = incoming; entryPending = false;
  if (incoming) hold.hidden = false;
  hold.style.opacity = incoming ? '0' : '1'; void hold.offsetWidth;
  hold.style.transition = 'opacity 120ms linear'; hold.style.opacity = incoming ? '1' : '0';
  blendTimer = setTimeout(() => {
   if (epoch !== blendEpoch || document.hidden || !active() || reduced.matches) return;
   blendingIncoming = false; done();
  },120);
 }
 function primeIdle(stop, segment) {
  if (!idleName(stop) || reduced.matches || document.hidden || !active() || pendingVariant) return;
  const key = `${variant}:${stop}:${segment}`;
  if (primedEntry === key) return;
  cancelAmbientFrame(); ambient.pause(); ambient.style.visibility = 'hidden';
  ambientSource = path(idleName(stop)); ambient.src = ambientSource; ambient.load();
  // Arrival24 is loop frame1. Continue at frame2; reverse entries start at phase0.
  ambient.currentTime = segment === 'segA' ? 1/24 : 0;
  primedEntry = key;
 }
 function projectPeek() {
  const { width, height } = hero.getBoundingClientRect();
  const { size: [sw,sh], h: a } = holdProjection[variant];
  const scale = Math.max(width/sw,height/sh), w = sw*scale, h = sh*scale, ox = (width-w)/2, oy = (height-h)/2;
  const p = [w*a[0]+ox*a[6],w*a[1]+ox*a[7],w*a[2]+ox*a[8],h*a[3]+oy*a[6],h*a[4]+oy*a[7],h*a[5]+oy*a[8],a[6],a[7],a[8]];
  peek.style.transform = `matrix3d(${[p[0],p[3],0,p[6],p[1],p[4],0,p[7],0,0,1,0,p[2],p[5],0,p[8]].join(',')})`;
 }
 function pauseHold() {
  cancelBlend();
  clearTimeout(revealTimer);
  if (revealStarted !== null) revealElapsed = Math.min(1500,revealElapsed+performance.now()-revealStarted);
  revealStarted = null; peek.style.animationPlayState = 'paused';
  ++ambientAttempt; ambientPending = false; ambient.pause();
  cancelAmbientFrame();
  ambient.removeEventListener('error', ambientError);
  // Image.decode cannot be canceled, so invalidate its continuation and allow a retry.
  ++holdEpoch; if (!peekReady) peekRequested = false;
 }
 function cancelHold(retain = false) {
  pauseHold(); cancelBlend(); holdEnabled = false; peekReady = false;
  if (!retain) { hold.hidden = true; peek.hidden = true; }
 }
 function holdOnstage() {
  return holdEnabled && holdVersion === revision && holdVariant === variant && posterReady && idleName(state.stop) && !state.moving && !document.hidden && active();
 }
 function ambientFailure() {
  ambientFailed = true; ++ambientAttempt; ambientPending = false;
  cancelAmbientFrame(); ambient.pause(); ambient.style.visibility = 'hidden'; error();
  settleHold();
 }
 function peekFailure() {
  peekFailed = true; peek.hidden = true; error();
  if (entrySegment === 'segB-reverse') {
   cancelAmbientFrame(); ambient.pause(); hold.hidden = true; entryPending = false;
  }
 }
 function settleHold() {
  if (!holdOnstage() || !entryPending || (!ambientDecoded && !ambientFailed && !reduced.matches)) return;
  if (state.stop === 1 && entrySegment === 'segB-reverse' && !peekReady && !peekFailed) return;
  entryPending = false;
  const done = () => { film.style.visibility = 'hidden'; preload(); };
  hold.hidden = false;
  if (reduced.matches || entrySegment === 'segA') {
   hold.style.transition = 'none'; hold.style.opacity = '1'; done();
  } else blendHold(true, done);
 }
 function syncHold() {
  if (!holdOnstage()) { if (!state.moving) pauseHold(); return; }
  if (state.stop === 1 && !peekRequested) {
   peekRequested = true; peek.src = path('gameon-peek.webp');
   const epoch = holdEpoch;
   peek.decode().then(() => {
    if (epoch !== holdEpoch || !holdOnstage()) return;
    peekReady = true; peek.hidden = false; syncHold();
   }).catch(() => { if (epoch === holdEpoch && holdOnstage()) peekFailure(); });
   // A reverse peek decode must not hold the terminal media indefinitely.
   if (entrySegment === 'segB-reverse') {
    revealTimer = setTimeout(() => {
     if (epoch !== holdEpoch || !holdOnstage() || peekReady) return;
     ++holdEpoch; peekFailure();
    },2000);
   }
  }
  settleHold();
  if (state.stop === 1 && peekReady && (!entryPending || reduced.matches)) {
   if (reduced.matches || revealElapsed >= 1500) {
    revealElapsed = 1500; peek.style.animationName = 'none'; peek.style.opacity = '1';
   } else if (revealStarted === null) {
    revealStarted = performance.now(); peek.style.animationPlayState = 'running';
    const epoch = holdEpoch;
    revealTimer = setTimeout(() => {
     if (epoch !== holdEpoch || !holdOnstage()) return;
     revealElapsed = 1500; revealStarted = null; peek.style.animationName = 'none'; peek.style.opacity = '1';
    },1500-revealElapsed);
   }
  }
  if (reduced.matches || ambientFailed || (peekFailed && entrySegment === 'segB-reverse')) return;
  primeIdle(state.stop, entrySegment);
  const url = path(idleName(state.stop));
  if (!ambient.paused || ambientPending) return;
  const attempt = ++ambientAttempt, epoch = holdEpoch, mediaURL = ambient.src;
  const current = () => attempt === ambientAttempt && epoch === holdEpoch && holdOnstage() && !reduced.matches && ambientSource === url && ambient.src === mediaURL;
  ambient.removeEventListener('error', ambientError);
  cancelAmbientFrame();
  cancelAmbientFrame = decodedFrame(ambient, current, () => {
   ambientDecoded = true; ambient.style.visibility = 'visible'; syncHold();
  }, ambientFailure, entrySegment === 'segA' && !ambientDecoded ? 1/24 : 0);
  ambientError = () => { if (current()) ambientFailure(); };
  ambient.addEventListener('error', ambientError);
  ambientPending = true;
  ambient.play().then(() => {
   if (attempt === ambientAttempt) ambientPending = false;
  }).catch(reason => {
   if (attempt !== ambientAttempt || epoch !== holdEpoch || !holdOnstage()) return;
   ambientPending = false;
   if (reason?.name !== 'AbortError') ambientFailure();
  });
 }
 function beginHold(elapsed = 0, retainPeek = false) {
  const decodedPeek = retainPeek && peekReady && state.stop === 1;
  cancelHold(); holdEnabled = true; holdVersion = revision; holdVariant = variant;
  ambientFailed = false; ambientDecoded = false; peekFailed = false; entryPending = true;
  peekReady = decodedPeek; peekRequested = decodedPeek; revealElapsed = elapsed;
  hold.hidden = false; peek.hidden = !decodedPeek; ambient.style.visibility = 'hidden';
  // Preserve the same decoded base even if the ambient clip has not produced a frame.
  hold.style.backgroundImage = `url("${image.src}")`;
  hold.style.opacity = film.style.visibility === 'visible' ? '0' : '1';
  if (!decodedPeek) {
   peek.style.opacity = '0'; peek.style.animationName = 'none'; void peek.offsetWidth;
   peek.style.animationName = 'gameon-reveal'; peek.style.animationPlayState = 'paused';
  }
  projectPeek();
  syncHold();
 }
 async function poster(stop, version) {
  posterReady = false;
  const url = path(`${posterName(stop)}.webp`), candidate = new Image();
  candidate.src = url;
  try { await candidate.decode(); }
  catch { if (version === revision) error(); return false; }
  if (version !== revision) return false;
  source.srcset = url; image.src = url;
  image.alt = ['Modern arena at blue hour', 'Volleyball court inside the arena', 'White delivery lab: Plan piece, fixed goal opening, four stations and two repair pieces at Build', 'The same glass piece beyond the goal, with its amber repair joiner; one of two repair pieces used, Check passed and Review confirmed the fit', 'Two displays in a home office after their windows exchange places; the same glass pane retains its amber repair joiner', 'The existing villa lighting study inside the left monitor window'][stop];
  posterReady = true; posterStop = stop;
  return true;
 }
 function preload() {
  const segment = nextSegment(state.stop);
  if (!posterReady || reduced.matches || document.hidden || !segment || film.style.visibility === 'visible') return;
  film.preload = 'auto'; film.src = path(`${segment}.mp4`); film.load();
 }
 function controls() {
  const travel = state.moving ? Math.sign(state.destination - state.stop) : 0;
  prev.disabled = settling || travel > 0 || (!travel && state.stop === 0); next.disabled = settling || travel < 0;
 }
 function copy(available = true) {
  hero.querySelectorAll('[data-stop]').forEach(el => { el.hidden = !available || Number(el.dataset.stop) !== state.stop; });
  hero.classList.toggle('lab', state.stop >= 2);
  hero.classList.toggle('moving', false);
  $('#announcement').textContent = available ? `${titles[state.stop]}. Chapter ${state.stop + 1} of ${stopCount}.` : 'Media unavailable. You can continue or skip.';
  $('#count').textContent = available ? counterLabel(state.stop) : '';
 }
 function clearFilmListeners() {
  cancelFilmFrame(); armFilmFrame = () => {};
  for (const [type, listener] of Object.entries(filmListeners)) film.removeEventListener(type, listener);
  filmListeners = {};
 }
 async function complete({ warmNext = true, cut = false } = {}) {
  cancelHold(); ++filmAttempt; clearFilmListeners(); settling = true;
  clearTimeout(timer); clearStall(); film.pause();
  // Either direction keeps its last valid film pixels until a decoded still replaces them.
  const version = ++revision;
  const arrival = movingSegment ?? entrySegment;
  movingSegment = null; finding.hidden = true;
  state = finish(state);
  if (pendingVariant) { variant = pendingVariant; pendingVariant = null; }
  controls();
  const loaded = await poster(state.stop, version);
  if (version !== revision) return;
  // A failed decode cannot advance navigation beyond the last verified still.
  if (!loaded) state = { stop: posterStop, moving: false, destination: null };
  settling = false; controls();
  const idle = loaded && idleName(state.stop) && (warmNext || reduced.matches);
  entrySegment = arrival;
  // A hurried film stopped mid-travel; its frame cannot stand in for the destination.
  if (loaded && (cut || !(idle && (arrival === 'segA' || arrival === 'segB-reverse') && !reduced.matches))) film.style.visibility = 'hidden';
  if (reduced.matches && film.src && film.style.visibility !== 'visible') { film.removeAttribute('src'); film.load(); }
  // A retained travel frame may be between chapters; do not label it as an arrival.
  still.style.opacity = '1'; copy(loaded || film.style.visibility !== 'visible');
  if (idle) beginHold(reduced.matches || arrival === 'segB-reverse' ? 1500 : 0);
  if (loaded && warmNext) preload();
 }
 function leave(onward = false) {
  const result = interrupt(state, onward);
  state = result.state;
  void complete({ warmNext: false });
  if (onward && onExit) { onExit(); return; }
  const target = onward ? following : hero;
  target.focus({ preventScroll: true });
  if (onward) target.scrollIntoView();
 }
 function move(direction) {
  if (settling) return true;
  const result = transition(state, direction, reduced.matches);
  if (result.action === 'scroll') return false;
  if (result.action === 'ignore') return true;
  // Keep the frozen valid hold until the first actual playing frame in either direction.
  const retain = holdEnabled && holdVersion === revision && holdVariant === variant && posterReady && posterStop === state.stop && Boolean(idleName(state.stop)) && result.action === 'play';
  cancelHold(retain);
  if (retain) {
   // If entry was interrupted before an idle frame, its decoded poster is the valid base.
   hold.hidden = false; hold.style.opacity = '1'; film.style.visibility = 'hidden';
  }
  primedEntry = '';
  state = result.state; movingSegment = result.segment ?? null; const version = ++revision;
  clearFilmListeners();
  controls(); $('#error').hidden = true;
  hero.classList.toggle('moving', true);
  $('#announcement').textContent = `Moving to the ${direction < 0 ? 'previous' : 'next'} chapter. Next jumps there now; Skip continues to the content.`;
  // Let the copy fade away before either the film or the still changes.
  timer = setTimeout(() => {
   if (version !== revision) return;
   if (result.action === 'still') { void complete(); return; }
   film.src = path(`${result.segment}.mp4`); film.currentTime = 0;
   // Source changes reset playbackRate to defaultPlaybackRate.
   film.defaultPlaybackRate = film.playbackRate = travelRate(result.segment);
   const attempt = ++filmAttempt, url = film.src;
   const current = () => attempt === filmAttempt && version === revision && state.moving && film.src === url && (!film.currentSrc || film.currentSrc === url);
   let frameReady = false;
   const revealFilm = () => {
    if (!current() || document.hidden || !active() || reduced.matches) return;
    frameReady = true; clearStall(); film.style.visibility = 'visible';
    const release = () => { hold.hidden = true; primeIdle(state.destination, result.segment); };
    if (!hold.hidden) blendHold(false, release); else release();
   };
   armFilmFrame = () => {
    cancelFilmFrame();
    if (!frameReady) cancelFilmFrame = decodedFrame(film, () => current() && !document.hidden && active() && !reduced.matches, revealFilm, fallback);
   };
   armFilmFrame();
   filmListeners = {
    playing: () => {
     if (!current()) return;
     if (frameReady) clearStall();
     if (document.hidden || !active() || reduced.matches) film.pause();
    },
    waiting: () => { if (current()) waiting(); },
    ended: () => { if (current()) void complete(); },
    error: () => { if (current() && !document.hidden && !reduced.matches) fallback(); },
    timeupdate: () => {
     if (!current() || (movingSegment !== 'segC' && movingSegment !== 'segC-reverse')) return;
     const elapsed = Math.floor(film.currentTime*24);
     const text = findingAtFrame(movingSegment === 'segC-reverse' ? Math.max(229,468-elapsed) : Math.min(468,229+elapsed));
     if (finding.textContent !== text) finding.textContent = text;
     finding.hidden = !text;
    },
   };
   for (const [type, listener] of Object.entries(filmListeners)) film.addEventListener(type, listener);
   film.play().catch(reason => {
    if (reason?.name !== 'AbortError' && current() && !document.hidden && active() && !reduced.matches) fallback();
   });
   waiting();
  }, 150);
  return true;
 }
 function fallback() {
  if (!state.moving) return;
  error(); void complete({ warmNext: false });
 }
 function waiting() {
  if (!state.moving || document.hidden || stallTimer) return;
  stallTimer = setTimeout(() => { stallTimer = null; fallback(); }, 2000);
 }
 function clearStall() { clearTimeout(stallTimer); stallTimer = null; }
 // A second input in the travel direction lands on its destination instead of leaving the hero.
 function hurry(direction) {
  if (!state.moving || settling || direction !== Math.sign(state.destination - state.stop)) return false;
  void complete({ cut: true }); return true;
 }
 next.addEventListener('click', () => { if (state.moving) hurry(1); else if (!move(1)) leave(true); }, { signal });
 prev.addEventListener('click', () => { if (state.moving) hurry(-1); else move(-1); }, { signal });
 $('#skip').addEventListener('click', () => leave(true), { signal });
 function active() { const r = hero.getBoundingClientRect(); return r.top >= -2 && r.bottom > innerHeight * .8; }
 // One wheel gesture acts once, so trackpad momentum cannot chain chapters.
 let wheelAt = -Infinity, wheelUsed = false, wheelSum = 0;
 window.addEventListener('wheel', e => {
  const now = performance.now();
  if (now - wheelAt > 250) { wheelUsed = false; wheelSum = 0; }
  wheelAt = now;
  // Momentum carried in from the following content must not turn a chapter on arrival.
  if (!active() || e.ctrlKey) { wheelUsed = true; return; }
  const delta = e.deltaY*(e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
  if (wheelUsed || state.moving || settling) {
   e.preventDefault();
   if (!wheelUsed && Math.abs(delta) >= 8 && hurry(Math.sign(delta))) wheelUsed = true;
   return;
  }
  // Slow pans add up inside the hero instead of scrolling past it.
  wheelSum += delta;
  const direction = Math.sign(wheelSum);
  if (!direction) return;
  // A host exit replaces native scrolling past the last chapter.
  const exit = transition(state, direction).action === 'scroll';
  if (exit && !onExit) return;
  e.preventDefault();
  if (Math.abs(wheelSum) < 8) return;
  wheelUsed = true;
  if (exit) leave(true); else move(direction);
 }, { passive: false, signal });
 window.addEventListener('scroll', () => {
  if (state.moving && !active()) void complete({ warmNext: false });
  syncHold();
 }, { passive: true, signal });
 window.addEventListener('resize', () => {
  if (state.moving && !active()) void complete({ warmNext: false });
  projectPeek(); syncHold();
 }, { passive: true, signal });
 window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (state.moving || settling || (holdEnabled && active()))) { e.preventDefault(); leave(); return; }
  if (!active() || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.key === ' ' && e.target.closest('button,a')) return;
  const direction = ['ArrowDown','PageDown',' '].includes(e.key) ? 1 : ['ArrowUp','PageUp'].includes(e.key) ? -1 : 0;
  if (state.moving || settling) { if (direction) { e.preventDefault(); hurry(direction); } return; }
  if (!direction) return;
  if (move(direction)) e.preventDefault();
  else if (direction > 0 && onExit) { e.preventDefault(); leave(true); }
 }, { signal });
 // One swipe acts once; its remaining drag stays inside the hero.
 let touchY = null, touchUsed = false;
 hero.addEventListener('touchstart', e => { touchY = e.touches.length === 1 ? e.touches[0].clientY : null; touchUsed = false; }, { passive: true, signal });
 hero.addEventListener('touchmove', e => {
  if (!active() || touchY === null || e.touches.length !== 1) return;
  const delta = touchY - e.touches[0].clientY, direction = Math.sign(delta);
  if (touchUsed || state.moving || settling) {
   e.preventDefault();
   if (!touchUsed && Math.abs(delta) > 35 && hurry(direction)) touchUsed = true;
   return;
  }
  // Native scrolling must not start before the swipe reaches its threshold.
  if (!direction) return;
  const exit = transition(state, direction).action === 'scroll';
  if (exit && !onExit) return;
  e.preventDefault();
  if (Math.abs(delta) <= 35) return;
  touchUsed = true;
  if (exit) leave(true); else move(direction);
 }, { passive: false, signal });
 hero.addEventListener('touchend', () => { touchY = null; }, { signal });
 portrait.addEventListener('change', () => {
  cancelFilmFrame(); cancelBlend();
  cancelHold(state.moving);
  if (state.moving) { pendingVariant = mediaVariant(portrait.matches); armFilmFrame(); }
  else { variant = mediaVariant(portrait.matches); posterReady = false; void complete(); }
 }, { signal });
 reduced.addEventListener('change', () => {
  const elapsed = reduced.matches ? 1500 : revealElapsed;
  const retainPeek = holdEnabled && peekReady;
  pauseHold(); cancelFilmFrame(); cancelBlend(); ++filmAttempt;
  if (state.moving && reduced.matches) leave();
  if (reduced.matches) {
   if (posterReady || film.style.visibility !== 'visible') { film.removeAttribute('src'); film.load(); }
   ambient.style.visibility = 'hidden'; ambient.removeAttribute('src'); ambient.load(); ambientSource = ''; primedEntry = '';
  }
  else if (!state.moving) preload();
  if (!state.moving && idleName(state.stop) && posterReady) beginHold(elapsed, retainPeek);
  else cancelHold();
 }, { signal });
 document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ++filmAttempt; cancelFilmFrame(); cancelBlend(); clearTimeout(timer); clearStall(); film.pause(); }
  else if (state.moving) leave();
  syncHold();
 }, { signal });
 $('#count').textContent = counterLabel(state.stop);
 // The responsive HTML poster owns first paint; never compete with it for media bytes.
 const initialRevision = revision;
 image.decode().then(() => {
  if (initialRevision !== revision) return;
  posterReady = true; preload();
 }).catch(() => { if (initialRevision === revision) error(); });
 return () => {
  controller.abort(); ++revision; ++filmAttempt; ++holdEpoch; ++ambientAttempt;
  cancelHold(); clearFilmListeners(); clearTimeout(timer); clearStall();
  for (const element of [film, ambient]) { element.pause(); element.removeAttribute('src'); element.load(); }
 };
}
