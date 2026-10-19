// Separate 2/2/2/4-second follow-up contract; the old verifier remains immutable.
// Parent-run native controller observations, never runtime/art acceptance.
// Parent must first follow the current canonical browser workflow for native Chrome proof.
// node verify_continuous_player.mjs /absolute/project-run/build /absolute/project-run/NEW-evidence [--budget-json /absolute/counters.json]
// node verify_continuous_player.mjs --self-test   (offline; no files, server or Chrome created)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawn } from 'node:child_process';

const runRoot = '/Users/vitek/Documents/agent-runs/portfolio-2026';
const chromeBinary = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const idles = [null, 'gameon-hold.mp4', 'goal-loop-hold.mp4', 'goal-loop-finished-hold.mp4', 'screen-switch-hold.mp4', null];
const titles = ['Hoang Viet To', 'GameOnVB', 'Goal Loop', 'Goal Loop', 'Screen Switch', 'Playground'];
const cameras = ['desktop', 'mobile'];
const idleSpecs = [null, { name: 'GameOn', seconds: 2, frames: 48 }, { name: 'overview', seconds: 2, frames: 48 }, { name: 'belt', seconds: 2, frames: 48 }, { name: 'office', seconds: 4, frames: 96 }, null];
const idleStops = idleSpecs.flatMap((spec, stop) => spec ? [stop] : []);
const directions = [-1, 1], phaseFractions = [.15, .55, .85];
const carriedCounters = Object.freeze({
  new_scope_native_frames: 1446, new_scope_render_seconds: 26051.22028904152,
  previous_batch_native_frames: 488, previous_batch_render_seconds: 22592.483298040228,
  technical_episodes: 2, technical_verdict_attempts: 4, technical_fable_attempts: 0,
  previous_harness_repair_cycles: 2, new_scope_source_review_fix_cycles: 1,
  new_scope_normal_source_reviews: 3, new_scope_hardware_audits: 1
});
function validateCounters(counters) {
  for (const [key, minimum] of Object.entries(carriedCounters)) assert(typeof counters?.[key] === 'number' && Number.isFinite(counters[key]) && counters[key] >= minimum, 'missing/reset carried counter: ' + key);
  for (const key of Object.keys(carriedCounters).filter(key => !key.endsWith('_seconds'))) assert(Number.isSafeInteger(counters[key]), 'integer carried count required: ' + key);
  for (const key of ['previous_batch_native_frames', 'previous_batch_render_seconds', 'previous_harness_repair_cycles', 'technical_episodes']) assert(counters[key] === carriedCounters[key], 'closed historical counter changed: ' + key);
  assert(counters.technical_verdict_attempts <= 8, 'technical verdict attempt budget exceeded');
  assert(counters.new_scope_native_frames <= 1536 && counters.new_scope_render_seconds <= 43200, 'render budget exceeded; no expansion authorized');
  return counters;
}
// Read-only preload admission. A buffer is not exposed decoded-pixel evidence;
// travel still requires a real rVFC after trusted input within the source2s bound.
function preloadedFilm(video, url) {
  return video.src === url && video.currentSrc === url && !video.seeking && !video.error && video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0 && video.buffered?.some(([start, end]) => start <= .001 && end >= Math.min(video.duration, .25));
}
function nativeIdleContract(video, stop) {
  const spec = idleSpecs[stop]; assert(spec, 'idle chapter required');
  assert(typeof video.duration === 'number' && Number.isFinite(video.duration) && video.duration === spec.seconds && Math.round(video.duration * 24) === spec.frames, 'native idle duration must match ' + spec.name + ' ' + spec.seconds + 's/' + spec.frames + ' frames at24fps (frame count itself requires parent ffprobe)');
  return spec;
}
function cadenceWindowMs(duration) {
  assert(typeof duration === 'number' && Number.isFinite(duration) && duration > 0, 'positive native duration required');
  return 3 * duration * 1000 + 3000; // Three actual wraps, plus bounded observer/setup overhead.
}
const exitPhases = duration => phaseFractions.map(f => Math.round(duration * f * 1e6) / 1e6);
function phaseBin(duration, phase) {
  assert(exitPhases(duration).includes(phase), 'unknown phase target for actual duration');
  return [phase, Math.min(duration, Math.round((phase + duration * .15) * 1e6) / 1e6)];
}
const capturePhases = duration => duration === 4 ? [.3, 1.1, 1.7, 3.0, 3.7] : [.3, 1.1, 1.7];
function cameraPlan() {
  const ops = [];
  for (let stop = 1; stop < titles.length; stop++) {
    ops.push({ kind: 'path', from: stop - 1, to: stop, label: 'forward-' + stop });
    if (idles[stop]) ops.push({ kind: 'cadence', stop, label: 'idle-' + stop });
  }
  for (let stop = titles.length - 2; stop >= 0; stop--) ops.push({ kind: 'path', from: stop + 1, to: stop, label: 'reverse-' + stop });
  let current = 0, setup = 0;
  for (const from of idleStops) for (const direction of directions) for (const phaseTarget of exitPhases(idleSpecs[from].seconds)) {
    while (current !== from) {
      const to = current + Math.sign(from - current);
      ops.push({ kind: 'setup', from: current, to, label: `setup-${++setup}-${current}-to-${to}` }); current = to;
    }
    const to = from + direction;
    ops.push({ kind: 'phase-exit', from, to, phaseTarget, label: `idle-${from}-${direction < 0 ? 'reverse' : 'forward'}-exit-${phaseTarget}` }); current = to;
  }
  return ops;
}
function matrixSummary(rows) {
  const transitions = rows.flatMap(c => c.transitions), idles = rows.flatMap(c => c.idles);
  const captures = idles.flatMap(i => i.phaseScreenshots);
  return {
    cameras: rows.length, transitions: transitions.length, observedTransitions: transitions.filter(t => t.status === 'OBSERVED').length,
    transitionStatuses: Object.fromEntries([...new Set(transitions.map(t => t.status ?? 'PLANNED'))].map(status => [status, transitions.filter(t => (t.status ?? 'PLANNED') === status).length])),
    forwardPaths: transitions.filter(t => t.kind === 'path' && t.to > t.from).length,
    reversePaths: transitions.filter(t => t.kind === 'path' && t.to < t.from).length,
    setupTransitions: transitions.filter(t => t.kind === 'setup').length,
    phaseExits: transitions.filter(t => t.kind === 'phase-exit').length, observedPhaseExits: transitions.filter(t => t.kind === 'phase-exit' && t.status === 'OBSERVED').length,
    cadenceWindows: idles.length, minimumNativeWraps: idles.length * 3,
    observedNativeWraps: idles.reduce((n, i) => n + (i.measurement?.wraps ?? 0), 0),
    supplementaryCaptures: captures.length,
    strictSupplementaryFailures: captures.filter(c => c.supplementary?.strictIntervalCheck.status === 'FAIL').length
  };
}
function verifyMatrix(rows) {
  assert.deepEqual(rows.map(c => c.camera), cameras, 'missing/duplicate camera');
  const plan = cameraPlan(), key = t => ({ kind: t.kind, from: t.from, to: t.to, label: t.label, phaseTarget: t.phaseTarget ?? null });
  for (const row of rows) {
    assert.deepEqual(row.transitions.map(key), plan.filter(t => t.kind !== 'cadence').map(key), 'transition matrix incomplete/duplicated');
    assert(row.transitions.every(t => t.status === 'OBSERVED'), 'unobserved transition');
    assert.deepEqual(row.idles.map(i => [i.stop, i.label]), plan.filter(t => t.kind === 'cadence').map(t => [t.stop, t.label]), 'cadence matrix incomplete/duplicated');
    for (const idle of row.idles) {
      assert(idle.status === 'OBSERVED' && idle.measurement?.status === 'OBSERVED' && idle.measurement.wraps >= 3 && idle.measurement.screenshotsDuringMeasurement === 0, 'actual three-wrap no-screenshot cadence required per idle/camera');
      assert.deepEqual(idle.phaseScreenshots.map(c => c.phaseTrigger), capturePhases(idleSpecs[idle.stop].seconds), 'supplementary phase matrix incomplete');
      assert(idle.phaseScreenshots.every(c => ['PASS', 'FAIL'].includes(c.supplementary?.strictIntervalCheck.status)), 'unclassified strict interval capture');
    }
  }
  return matrixSummary(rows); // A strict capture FAIL remains FAIL; no acceptance verdict here.
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json' };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const inside = (base, value) => value.startsWith(base + path.sep);
function videoDimensions(camera, kind, video) {
  const size = kind === 'idle' ? (camera === 'desktop' ? [3584, 2016] : [1800, 3200]) : (camera === 'desktop' ? [1600, 900] : [900, 1600]);
  return video.width === size[0] && video.height === size[1];
}
function initialPosters(html) {
  const picture = html.match(/<picture id="still">([\s\S]*?)<\/picture>/)?.[1];
  assert(picture, 'actual initial picture required');
  const desktop = picture.match(/<img\s+src="([^"]+)"/)?.[1];
  const mobile = picture.match(/<source\s+media="\(orientation: portrait\)"\s+srcset="([^"]+)"/)?.[1];
  assert(desktop?.startsWith('./') && mobile?.startsWith('./'), 'local single-source initial posters required');
  return { desktop, mobile };
}
const allowedResource = (url, origin, embeddedImages) => url.startsWith(origin + '/') || embeddedImages.has(url);
function absolute(value) {
  assert(typeof value === 'string' && path.isAbsolute(value) && path.resolve(value) === value, 'canonical absolute path required (no trailing slash)');
  return value;
}
function noSymlinks(value, stat = fs.lstatSync) {
  let current = path.parse(value).root;
  for (const part of value.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    assert(!stat(current).isSymbolicLink(), 'symlink traversal refused: ' + current);
  }
}
function absent(value, stat = fs.lstatSync) {
  try { stat(value); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  assert.fail('NEW evidence directory required (including no dangling symlink)');
}
function locations(build, out) {
  absolute(build); absolute(out);
  assert(inside(runRoot, build) && inside(runRoot, out), 'both paths must be beneath the existing project agent-runs root');
  assert(build !== out && !inside(build, out) && !inside(out, build), 'build and evidence must be disjoint');
  noSymlinks(build); noSymlinks(path.dirname(out));
  assert(fs.statSync(build).isDirectory(), 'build must be a directory');
  assert(fs.statSync(path.dirname(out)).isDirectory(), 'evidence parent must already exist');
  absent(out);
}
function requestFile(raw) {
  assert(typeof raw === 'string' && raw.length <= 4096 && raw.startsWith('/') && !raw.startsWith('//'), 'invalid request target');
  const decoded = decodeURIComponent(raw.split('?')[0]);
  assert(!/[\\\0#]/.test(decoded) && !decoded.split('/').some(x => x === '..' || x === '.'), 'unsafe request path');
  return decoded === '/' ? '/index.html' : decoded;
}
function byteRange(value, size) {
  if (value === undefined) return { start: 0, end: size - 1, status: 200 };
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  assert(m && (m[1] || m[2]) && size > 0, 'invalid range');
  const a = m[1] ? Number(m[1]) : null, b = m[2] ? Number(m[2]) : null;
  assert((a === null || Number.isSafeInteger(a)) && (b === null || Number.isSafeInteger(b)), 'unsafe range integer');
  const start = a === null ? Math.max(0, size - b) : a;
  const end = a === null || b === null ? size - 1 : Math.min(b, size - 1);
  assert(start >= 0 && start <= end && start < size, 'unsatisfiable range');
  return { start, end, status: 206 };
}
function endpoint(text) {
  const lines = text.trim().split('\n'), port = Number(lines[0]);
  assert(lines.length === 2 && /^\d+$/.test(lines[0]) && Number.isInteger(port) && port > 0 && port <= 65535 && port !== 9223 && /^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(lines[1]), 'invalid/unowned Chrome endpoint');
  return { port, suffix: lines[1] };
}

// These predicates are also exercised offline with retained native receipt values.
function idleOwnership(video, url) {
  assert(video.src === url && video.currentSrc === url && video.frame?.src === url && video.frame.currentSrc === url, 'exact native idle URL required');
  assert(video.exposed && !video.paused && !video.seeking, 'exposed playing non-seeking idle required');
  assert(Number.isFinite(video.duration) && video.duration > 0 && Number.isFinite(video.frame.mediaTime) && video.frame.mediaTime >= 0 && video.frame.mediaTime < video.duration, 'known idle duration/callback phase required');
}
function idleCaptureInterval(before, after, url, phase) {
  const a = before.ambient, b = after.ambient;
  idleOwnership(a, url); idleOwnership(b, url);
  assert(a.duration === b.duration, 'idle duration changed during capture');
  assert(a.frame.mediaTime >= phase && a.frame.mediaTime <= phase + .10 + 1 / 24, 'before capture missed trigger window plus one frame');
  assert(Number.isSafeInteger(a.frame.presentedFrames) && Number.isSafeInteger(b.frame.presentedFrames) && b.frame.presentedFrames > a.frame.presentedFrames, 'native idle presentedFrames did not advance during capture');
  const wallLatencyMs = after.now - before.now, wrappedSeam = b.frame.mediaTime < a.frame.mediaTime;
  assert(Number.isFinite(wallLatencyMs) && wallLatencyMs > 0 && wallLatencyMs < a.duration * 1000, 'capture must span less than one idle duration');
  const progress = b.frame.mediaTime - a.frame.mediaTime + (wrappedSeam ? a.duration : 0);
  assert(progress > 0 && Math.abs(progress - wallLatencyMs / 1000) <= 3 / 24, 'idle media progress disagrees with page elapsed time');
  return { mediaStart: a.frame.mediaTime, mediaEnd: b.frame.mediaTime, wrappedSeam, wallLatencyMs };
}
// Passive observation accepts native loop seeking as data, while retaining the
// exact source, exposed layer and playing guards. Its cause is never inferred.
function idleObservedOwnership(video, url) {
  assert(video.src === url && video.currentSrc === url && video.frame?.src === url && video.frame.currentSrc === url, 'exact native idle URL required');
  assert(video.exposed && !video.paused, 'exposed playing idle required during observation');
  assert(Number.isFinite(video.duration) && video.duration > 0 && Number.isFinite(video.frame.mediaTime) && video.frame.mediaTime >= 0 && video.frame.mediaTime < video.duration, 'known idle duration/callback phase required');
}
function recordIdleObservation(measurement, e, url) {
  const s = e.state, a = s.ambient; idleObservedOwnership(a, url);
  measurement.duration ??= a.duration;
  assert(a.duration === measurement.duration, 'idle duration changed during measurement');
  measurement.observations.push({ now: s.now, type: e.type, video: e.video, event: e.event, currentTime: a.currentTime, seeking: a.seeking, loop: a.loop, readyState: a.readyState, paused: a.paused, exposed: a.exposed, src: a.src, currentSrc: a.currentSrc, viewport: s.viewport, frame: a.frame });
  if (e.observerOverhead) measurement.observerOverhead.push({ now: s.now, ...e.observerOverhead });
  if (e.type === 'media-event' && e.video === 'ambient') {
    if (e.event === 'seeking') measurement.seeks.push({ start: s.now, state: a, classification: a.loop && a.currentTime === 0 ? 'Compatible with native loop seek; cause NOT PROVEN' : 'Seek observed; cause NOT PROVEN', end: null, durationMs: null });
    if (e.event === 'seeked') {
      const seek = measurement.seeks.findLast(r => r.end === null);
      if (seek) { seek.end = s.now; seek.durationMs = s.now - seek.start; seek.endState = a; }
      else measurement.seeks.push({ start: null, end: s.now, durationMs: null, endState: a, classification: 'Seek began before observed window; cause NOT PROVEN' });
    }
  }
  if (e.type !== 'frame' || e.video !== 'ambient') return;
  const f = e.frame, previous = measurement.callbacks.at(-1);
  assert(f.src === url && f.currentSrc === url && Number.isSafeInteger(f.presentedFrames) && f.presentedFrames > 0, 'expected native idle callback required');
  if (previous) {
    assert(f.presentedFrames > previous.frame.presentedFrames, 'native idle presentedFrames did not advance');
    const wrapped = f.mediaTime < previous.frame.mediaTime - .5;
    if (wrapped) measurement.wraps++;
    measurement.callbackIntervals.push({ before: previous, after: { now: s.now, frame: f }, wrapped, wallGapMs: s.now - previous.now, callbackGapMs: f.now - previous.frame.now, mediaDelta: f.mediaTime - previous.frame.mediaTime, unwrappedMediaDelta: f.mediaTime - previous.frame.mediaTime + (wrapped ? a.duration : 0), counterDelta: f.presentedFrames - previous.frame.presentedFrames });
  }
  measurement.callbacks.push({ now: s.now, frame: f });
}
function finishIdleMeasurement(measurement, end, screenshots) {
  measurement.end = { pageNow: end.now, observedAt: Date.now(), state: end };
  measurement.screenshotsAtEnd = screenshots;
  measurement.screenshotsDuringMeasurement = screenshots - measurement.screenshotsAtStart;
  assert(measurement.screenshotsDuringMeasurement === 0, 'screenshot occurred during passive idle measurement');
  assert(measurement.wraps >= 3, 'three actual native idle wraps required');
  measurement.status = 'OBSERVED';
  measurement.cadenceAndVisibleSeam = 'UNPROVEN; raw gaps, seek durations and observer overhead require parent assessment';
}
async function captureScreenshot(call, session, measurement) {
  assert(!measurement, 'screenshot forbidden during passive idle measurement');
  return call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, session);
}
function supplementaryIdleInterval(before, after, url, phase, observations) {
  const result = { status: 'UNPROVEN', continuousPlayback: 'UNPROVEN', captureInterval: { mediaStart: before.ambient.frame?.mediaTime, mediaEnd: after.ambient.frame?.mediaTime, nativeTimeStart: before.ambient.currentTime, nativeTimeEnd: after.ambient.currentTime, wallLatencyMs: after.now - before.now }, strictIntervalCheck: { metric: 'idleCaptureInterval', status: 'FAIL' } };
  try {
    Object.assign(result.captureInterval, idleCaptureInterval(before, after, url, phase));
    assert(!observations.some(e => e.state.ambient.seeking || (e.type === 'media-event' && e.video === 'ambient' && e.event === 'seeking')), 'idle seeking observed inside capture interval');
    result.strictIntervalCheck.status = 'PASS'; result.status = 'OBSERVED';
  } catch (error) { result.strictIntervalCheck.error = String(error); }
  return result;
}
async function closeOwnedTarget(call, targetId, record, now = Date.now, timeoutMs = 5000) {
  const receipt = { targetId, closeRequestedAt: now(), observations: [], removed: false, status: 'RUNNING' };
  const deadline = receipt.closeRequestedAt + timeoutMs;
  const remaining = () => { const ms = deadline - now(); assert(ms > 0, 'owned target removal timeout'); return ms; };
  try {
    receipt.closeReply = await call('Target.closeTarget', { targetId }, undefined, remaining());
    receipt.closeReplyAt = now(); assert(receipt.closeReply.success === true, 'owned target close request rejected');
    while (true) {
      const observation = { requestedAt: now(), observedAt: null, present: null };
      receipt.observations.push(observation);
      const targets = await call('Target.getTargets', {}, undefined, remaining());
      const observedAt = now(), present = targets.targetInfos.some(t => t.targetId === targetId);
      Object.assign(observation, { observedAt, present });
      assert(observedAt <= deadline, 'owned target removal timeout');
      if (!present) { receipt.removed = true; receipt.status = 'OBSERVED'; return receipt; }
      remaining();
    }
  } catch (error) { receipt.status = 'FAIL'; receipt.failedAt = now(); receipt.error = String(error); throw error; }
  finally { record(receipt); }
}
function inPhaseBin(state, phase) {
  const bin = phaseBin(state.ambient.duration, phase);
  const t = state.ambient.currentTime;
  return Number.isFinite(t) && t >= bin[0] && t < bin[1];
}
function phaseInput(state, url, phase) {
  idleOwnership(state.ambient, url);
  const nativePhase = state.ambient.currentTime, callbackPhase = state.ambient.frame.mediaTime;
  assert(inPhaseBin(state, phase), 'actual trusted input missed distinct phase bin');
  assert(Math.abs(nativePhase - callbackPhase) <= 2 / 24, 'native input phase disagrees with callback phase');
  return { nativePhase, callbackPhase, remainingCycleMs: (state.ambient.duration - nativePhase) * 1000 };
}
function filmTraversal(frames, states, duration, url) {
  assert(frames.length >= 3 && frames.at(-1).frame.mediaTime > frames[0].frame.mediaTime && frames.at(-1).frame.presentedFrames > frames[0].frame.presentedFrames, 'genuinely advancing exposed film frames required');
  assert(Number.isFinite(duration) && duration > 0, 'actual film duration required');
  assert(frames[0].frame.mediaTime <= 2 / 24 && frames.at(-1).frame.mediaTime >= duration - 2 / 24, 'exposed film callbacks must cover beginning and end');
  for (const s of states) if (s.film.exposed && s.film.src === url && s.film.currentSrc === url) assert(!s.film.seeking, 'exposed film seeking observed');
  for (let i = 0; i < frames.length; i++) {
    const e = frames[i], f = e.frame, previous = frames[i - 1]?.frame;
    assert(e.state.film.exposed && e.state.film.src === url && e.state.film.currentSrc === url && f.src === url && f.currentSrc === url, 'expected exposed film callback URL required');
    assert(e.state.film.duration === duration && !e.state.film.seeking, 'film callback duration/seeking mismatch');
    assert(Number.isFinite(f.mediaTime) && f.mediaTime >= 0 && f.mediaTime < duration && Number.isSafeInteger(f.presentedFrames) && f.presentedFrames > 0, 'invalid native film callback');
    if (previous) {
      assert(f.mediaTime >= previous.mediaTime, 'exposed film mediaTime moved backwards');
      assert(f.presentedFrames > previous.presentedFrames, 'exposed film presentedFrames did not strictly increase');
    }
  }
  const firstPresentedFrame = frames[0].frame.presentedFrames, lastPresentedFrame = frames.at(-1).frame.presentedFrames;
  const presentedFrameCounterSpan = lastPresentedFrame - firstPresentedFrame + 1;
  return { actualDuration: duration, expectedFrameCount: Math.round(duration * 24), callbackCount: frames.length, firstPresentedFrame, lastPresentedFrame, presentedFrameCounterSpan, unobservedCounterIncrements: presentedFrameCounterSpan - frames.length, claim: 'Exposed callback endpoints/order only; every-frame decode and smoothness NOT CLAIMED' };
}

// Observation only: no focus/visibility emulation, media setters, DOM clicks,
// application state edits, mocks or chapter hooks. Callback metadata is retained
// alongside actual layer state; a hidden preload callback is never exposed film.
function observe() {
  const last = {};
  let observerReady = false;
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom }; };
  const layer = el => {
    let opacity = 1, shown = true;
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      opacity *= Number(s.opacity);
      if (node.hidden || s.display === 'none' || s.visibility !== 'visible') shown = false;
    }
    const r = rect(el), s = getComputedStyle(el);
    return { hidden: el.hidden, display: s.display, visibility: s.visibility, opacity: Number(s.opacity), effectiveOpacity: opacity, shown: shown && opacity > 0 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.x + r.width > 0 && r.x < innerWidth, rect: r };
  };
  const snapshot = () => {
    const hero = document.querySelector('.hero');
    if (!observerReady || !hero) return { now: performance.now(), url: location.href, ready: false };
    const get = id => document.getElementById(id);
    const film = get('film'), ambient = get('ambient'), hold = get('gameon-hold'), peek = get('gameon-peek'), img = get('still').querySelector('img');
    const h = layer(hold), f = layer(film), a = layer(ambient), p = layer(peek), r = rect(hero);
    const video = v => ({ src: v.src, currentSrc: v.currentSrc, currentTime: v.currentTime, duration: Number.isFinite(v.duration) ? v.duration : null, paused: v.paused, ended: v.ended, seeking: v.seeking, loop: v.loop, readyState: v.readyState, buffered: Array.from({ length: v.buffered.length }, (_, i) => [v.buffered.start(i), v.buffered.end(i)]), muted: v.muted, defaultMuted: v.defaultMuted, playsInline: v.playsInline, width: v.videoWidth, height: v.videoHeight, error: v.error ? { code: v.error.code, message: v.error.message } : null, frame: last[v.id] ?? null });
    return {
      now: performance.now(), ready: true, url: location.href, origin: location.origin, visibility: document.visibilityState, hidden: document.hidden, hasFocus: document.hasFocus(), focus: { id: document.activeElement?.id, tag: document.activeElement?.tagName, editable: Boolean(document.activeElement?.isContentEditable) },
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, portrait: matchMedia('(orientation: portrait)').matches }, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      hero: { rect: r, active: r.top >= -2 && r.bottom > innerHeight * .8, moving: hero.classList.contains('moving') },
      film: { ...video(film), layer: f, exposed: f.shown && (!h.shown || h.effectiveOpacity < .999) },
      ambient: { ...video(ambient), layer: a, exposed: a.shown && h.shown && h.effectiveOpacity >= .999 },
      hold: { ...h, background: getComputedStyle(hold).backgroundImage },
      peek: { ...p, src: peek.currentSrc, complete: peek.complete, width: peek.naturalWidth, height: peek.naturalHeight, transform: getComputedStyle(peek).transform, animation: getComputedStyle(peek).animationName },
      still: { ...layer(get('still')), src: img.src, currentSrc: img.currentSrc, complete: img.complete, width: img.naturalWidth, height: img.naturalHeight, alt: img.alt, srcset: get('still').querySelector('source').srcset },
      copies: [...document.querySelectorAll('[data-stop]')].filter(el => !el.hidden).map(el => ({ stop: Number(el.dataset.stop), text: el.textContent.trim(), ...layer(el) })),
      controls: Object.fromEntries(['prev', 'next', 'skip'].map(id => [id, { disabled: get(id).disabled, ...layer(get(id)) }])),
      count: get('count').textContent, announcement: get('announcement').textContent, finding: { hidden: get('finding').hidden, text: get('finding').textContent }, error: { hidden: get('error').hidden, text: get('error').textContent }
    };
  };
  // Only this observer's telemetry is exported; product state stays in its module.
  Object.defineProperty(window, '__arenaProbeSnapshot', { value: snapshot });
  let previousEmitMs = null;
  const emit = (type, details = {}) => {
    const started = performance.now(), state = snapshot(), snapshotMs = performance.now() - started;
    window.__arenaEvidence(JSON.stringify({ type, ...details, state, observerOverhead: { snapshotMs, previousEmitMs } }));
    previousEmitMs = performance.now() - started; // Includes prior snapshot/serialization/binding, excludes CDP/Node I/O.
  };
  document.addEventListener('DOMContentLoaded', () => {
    observerReady = true;
    for (const v of document.querySelectorAll('video')) {
      if (!v.requestVideoFrameCallback) { emit('observer-error', { error: 'native rVFC unavailable' }); continue; }
      const frame = (now, meta) => {
        last[v.id] = { now, mediaTime: meta.mediaTime, presentedFrames: meta.presentedFrames, expectedDisplayTime: meta.expectedDisplayTime, presentationTime: meta.presentationTime, processingDuration: meta.processingDuration, width: meta.width, height: meta.height, src: v.src, currentSrc: v.currentSrc };
        emit('frame', { video: v.id, frame: last[v.id] });
        v.requestVideoFrameCallback(frame);
      };
      v.requestVideoFrameCallback(frame);
      for (const event of ['loadstart', 'loadeddata', 'playing', 'waiting', 'stalled', 'seeking', 'seeked', 'ended', 'error', 'pause', 'emptied']) v.addEventListener(event, () => emit('media-event', { video: v.id, event }));
    }
    let previous = -Infinity;
    const tick = now => { if (now - previous >= 30) { previous = now; emit('layers'); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    emit('observer-ready');
  }, { once: true });
  document.addEventListener('click', e => emit('input', { trusted: e.isTrusted, target: e.target.closest('button')?.id ?? e.target.id }), true);
  document.addEventListener('visibilitychange', () => emit('visibility'));
}

async function selfTest() {
  let checks = 0;
  const equal = (a, b) => { assert.deepEqual(a, b); checks++; };
  const rejects = fn => { assert.throws(fn); checks++; };
  equal(requestFile('/'), '/index.html'); equal(requestFile('/media/desktop/segA.mp4?x=1'), '/media/desktop/segA.mp4');
  for (const value of ['/../x', '/%2e%2e/x', '/a/%2E/b', '/%5cx', '/%00', '//evil/x', 'http://elsewhere/', '/%zz']) rejects(() => requestFile(value));
  equal(byteRange(undefined, 10), { start: 0, end: 9, status: 200 });
  for (const [value, start, end] of [['bytes=0-0', 0, 0], ['bytes=3-', 3, 9], ['bytes=-3', 7, 9], ['bytes=-99', 0, 9], ['bytes=2-99', 2, 9]]) equal(byteRange(value, 10), { start, end, status: 206 });
  for (const value of ['bytes=-0', 'bytes=10-', 'bytes=5-2', 'bytes=-', 'bytes=0-1,2-3', 'items=0-1', 'bytes=9007199254740992-']) rejects(() => byteRange(value, 10));
  rejects(() => byteRange('bytes=0-', 0)); rejects(() => absolute('relative')); rejects(() => absolute('/a/../b')); rejects(() => absolute('/a/'));
  equal(inside('/a/b', '/a/b/c'), true); equal(inside('/a/b', '/a/bad'), false); equal(inside('/a/b', '/a/b'), false);
  rejects(() => locations('/outside/build', runRoot + '/NEW'));
  rejects(() => locations(runRoot + '/build', runRoot + '/build/NEW'));
  const visited = [];
  noSymlinks('/a/b', p => { visited.push(p); return { isSymbolicLink: () => false }; }); equal(visited, ['/a', '/a/b']);
  rejects(() => noSymlinks('/a/b', p => ({ isSymbolicLink: () => p === '/a' })));
  rejects(() => absent('/existing', () => ({})));
  rejects(() => absent('/dangling-link', () => ({ isSymbolicLink: () => true })));
  absent('/new', () => { throw Object.assign(Error('absent'), { code: 'ENOENT' }); }); checks++;
  rejects(() => absent('/denied', () => { throw Object.assign(Error('denied'), { code: 'EACCES' }); }));
  noSymlinks(path.resolve(process.argv[1])); checks++;
  equal(endpoint('49152\n/devtools/browser/owned-123\n'), { port: 49152, suffix: '/devtools/browser/owned-123' });
  for (const text of ['9223\n/devtools/browser/shared', '0\n/devtools/browser/x', '65536\n/devtools/browser/x', '123\n/devtools/page/x', '123\n/devtools/browser/../../x', '123\n/devtools/browser/x\nextra', '1e3\n/devtools/browser/x']) rejects(() => endpoint(text));
  new vm.Script(`(${observe.toString()})()`); checks++;
  // readyState can be interactive while deferred modules/styles are still loading.
  const startup = { window: {}, location: { href: 'http://127.0.0.1/' }, performance: { now: () => 0 }, document: { readyState: 'interactive', querySelector: () => ({}), addEventListener() {} } };
  vm.runInNewContext(`(${observe.toString()})()`, startup);
  equal(startup.window.__arenaProbeSnapshot().ready, false);
  equal(videoDimensions('desktop', 'idle', { width: 3584, height: 2016 }), true);
  equal(videoDimensions('mobile', 'idle', { width: 1800, height: 3200 }), true);
  equal(videoDimensions('desktop', 'idle', { width: 1600, height: 900 }), false);
  equal(videoDimensions('desktop', 'travel', { width: 1600, height: 900 }), true);
  equal(initialPosters('<picture id="still"><source media="(orientation: portrait)" srcset="./assets/mobile.webp"><img src="./assets/desktop.webp"></picture>'), { desktop: './assets/desktop.webp', mobile: './assets/mobile.webp' });
  rejects(() => initialPosters('<picture id="still"></picture>'));
  const embedded = new Set(['data:image/png;base64,YQ==']);
  equal(allowedResource('data:image/png;base64,YQ==', 'http://127.0.0.1:123', embedded), true);
  equal(allowedResource('data:image/png;base64,Yg==', 'http://127.0.0.1:123', embedded), false);
  equal(allowedResource('http://127.0.0.1:123.evil/x', 'http://127.0.0.1:123', embedded), false);
  equal(allowedResource('http://127.0.0.1:123/media/x', 'http://127.0.0.1:123', embedded), true);
  const failures = [];
  const repair = (name, test) => { try { test(); } catch (error) { failures.push({ name, error: String(error) }); } };
  const url = 'http://127.0.0.1:12345/media/desktop/gameon-hold.mp4';
  const sample = (now, mediaTime, presentedFrames, currentTime = mediaTime) => ({ now, ambient: { src: url, currentSrc: url, exposed: true, paused: false, seeking: false, duration: 2, currentTime, frame: { src: url, currentSrc: url, mediaTime, presentedFrames } } });
  // Pure deterministic interval fixtures, not current browser observations.
  const before = sample(6318.5, 1.125, 28, 1.143273), after = sample(6752.899999856949, 1.541667, 38, 1.577657);
  repair('deterministic capture interval', () => equal(idleCaptureInterval(before, after, url, 1.1), { mediaStart: 1.125, mediaEnd: 1.541667, wrappedSeam: false, wallLatencyMs: 434.39999985694885 }));
  repair('single seam interval', () => equal(idleCaptureInterval(sample(0, 1.75, 43), sample(400, .166667, 53), url, 1.7).wrappedSeam, true));
  repair('stalled capture rejected', () => rejects(() => idleCaptureInterval(before, sample(before.now + 434.4, 1.125, 28), url, 1.1)));
  repair('seeking capture rejected', () => rejects(() => idleCaptureInterval(before, { ...sample(before.now + 50, 1.166667, 29), ambient: { ...sample(0, 1.166667, 29).ambient, seeking: true } }, url, 1.1)));
  repair('actual phase in bin', () => equal(phaseInput(sample(0, .58, 15, .59), url, .3).nativePhase, .59));
  repair('phase bin miss rejected', () => rejects(() => phaseInput(sample(0, .25, 7), url, .3)));
  // Deterministic traversal endpoints/counts (107-counter span,2..108).
  const filmURL = 'http://127.0.0.1:12345/media/desktop/segA.mp4';
  const filmFrame = (mediaTime, presentedFrames) => ({ frame: { mediaTime, presentedFrames, src: filmURL, currentSrc: filmURL }, state: { film: { exposed: true, src: filmURL, currentSrc: filmURL, seeking: false, duration: 4.5 } } });
  const filmFrames = [filmFrame(.041667, 2), filmFrame(2.25, 55), filmFrame(4.458333, 108)];
  repair('deterministic traversal endpoints', () => equal(filmTraversal(filmFrames, filmFrames.map(e => e.state), 4.5, filmURL).expectedFrameCount, 108));
  repair('middle-only traversal rejected', () => rejects(() => filmTraversal([filmFrame(1, 25), filmFrame(2, 49), filmFrame(3, 73)], [], 4.5, filmURL)));
  repair('truncated tail rejected', () => rejects(() => filmTraversal([filmFrame(.041667, 2), filmFrame(1, 25), filmFrame(2, 49)], [], 4.5, filmURL)));
  repair('exposed seek/jump-to-end rejected', () => rejects(() => filmTraversal(filmFrames, [{ film: { ...filmFrames[0].state.film, seeking: true } }], 4.5, filmURL)));
  repair('backwards media rejected', () => rejects(() => filmTraversal([filmFrames[0], filmFrame(3, 73), filmFrame(2, 74), filmFrames[2]], [], 4.5, filmURL)));
  repair('repeated presentedFrames rejected', () => rejects(() => filmTraversal([filmFrames[0], filmFrame(2.25, 2), filmFrames[2]], [], 4.5, filmURL)));
  const changedIdle = (s, fields) => ({ ...s, ambient: { ...s.ambient, ...fields } });
  const shortAfter = sample(before.now + 50, 1.166667, 29);
  repair('short continuous capture', () => equal(idleCaptureInterval(before, shortAfter, url, 1.1).wrappedSeam, false));
  for (const [name, fields] of [['paused', { paused: true }], ['unexposed', { exposed: false }], ['changed source', { src: url + '?wrong' }], ['changed currentSrc', { currentSrc: url + '?wrong' }], ['changed duration', { duration: 3 }]]) repair(name + ' capture rejected', () => rejects(() => idleCaptureInterval(before, changedIdle(shortAfter, fields), url, 1.1)));
  repair('before-capture seeking rejected', () => rejects(() => idleCaptureInterval(changedIdle(before, { seeking: true }), shortAfter, url, 1.1)));
  repair('stalled media with advancing counter rejected', () => rejects(() => idleCaptureInterval(before, sample(before.now + 50, 1.125, 29), url, 1.1)));
  repair('capture time mismatch rejected', () => rejects(() => idleCaptureInterval(before, { ...after, now: before.now + 100 }, url, 1.1)));
  repair('whole-loop capture rejected', () => rejects(() => idleCaptureInterval(before, { ...after, now: before.now + 2000 }, url, 1.1)));
  repair('multiple-loop capture rejected', () => rejects(() => idleCaptureInterval(before, { ...after, now: before.now + 4434.4 }, url, 1.1)));
  repair('before trigger drift beyond one-frame allowance rejected', () => rejects(() => idleCaptureInterval(sample(0, 1.25, 31), sample(100, 1.333333, 33), url, 1.1)));
  for (const phase of [.3, 1.1, 1.7]) {
    const [lower, upper] = phaseBin(2, phase);
    repair('phase bin lower edge ' + phase, () => equal(inPhaseBin(sample(0, lower, 1), phase), true));
    repair('phase bin exclusive upper edge ' + phase, () => equal(inPhaseBin(sample(0, upper, 1), phase), false));
  }
  repair('pre-dispatch native-only bin miss', () => equal(inPhaseBin(sample(0, .58, 15, .61), .3), false));
  repair('callback lag at actual bin entry', () => equal(phaseInput(sample(0, .291667, 8, .31), url, .3).nativePhase, .31));
  repair('input callback disagreement rejected', () => rejects(() => phaseInput(sample(0, 1.71, 42, 1.82), url, 1.7)));
  repair('actual late remaining cycle retained', () => equal(phaseInput(sample(0, 1.75, 43, 1.79), url, 1.7).remainingCycleMs, (2 - 1.79) * 1000));
  for (const [name, fields] of [['wrong URL', { currentSrc: url + '?wrong' }], ['paused', { paused: true }], ['unexposed', { exposed: false }], ['seeking', { seeking: true }]]) repair(name + ' phase input rejected', () => rejects(() => phaseInput(changedIdle(sample(0, .35, 9), fields), url, .3)));
  repair('traversal counter data is not all-frame proof', () => equal(filmTraversal(filmFrames, [], 4.5, filmURL), { actualDuration: 4.5, expectedFrameCount: 108, callbackCount: 3, firstPresentedFrame: 2, lastPresentedFrame: 108, presentedFrameCounterSpan: 107, unobservedCounterIncrements: 104, claim: 'Exposed callback endpoints/order only; every-frame decode and smoothness NOT CLAIMED' }));
  repair('hidden seek excluded from exposed-state claim', () => equal(filmTraversal(filmFrames, [{ film: { ...filmFrames[0].state.film, exposed: false, seeking: true } }], 4.5, filmURL).callbackCount, 3));
  repair('callback seeking rejected', () => rejects(() => filmTraversal([filmFrames[0], { ...filmFrames[1], state: { film: { ...filmFrames[1].state.film, seeking: true } } }, filmFrames[2]], [], 4.5, filmURL)));
  repair('wrong callback URL rejected', () => rejects(() => filmTraversal([filmFrames[0], { ...filmFrames[1], frame: { ...filmFrames[1].frame, currentSrc: filmURL + '?wrong' } }, filmFrames[2]], [], 4.5, filmURL)));
  repair('unknown actual duration rejected', () => rejects(() => filmTraversal(filmFrames, [], null, filmURL)));
  repair('callback duration change rejected', () => rejects(() => filmTraversal(filmFrames, [], 4.4, filmURL)));
  // Repair2: deterministic offline inputs only; no native browser is started.
  const measurement = () => ({ wraps: 0, callbacks: [], callbackIntervals: [], observations: [], seeks: [], observerOverhead: [], screenshotsAtStart: 0 });
  const idleEvent = (now, mediaTime, presentedFrames, fields = {}, type = 'frame', event) => {
    const state = { ...changedIdle(sample(now, mediaTime, presentedFrames), { loop: true, readyState: 4, ...fields }), viewport: { width: 1657, height: 994, dpr: 1 } };
    state.ambient.frame.now = now;
    return { type, video: 'ambient', event, state, frame: state.ambient.frame, observerOverhead: { snapshotMs: .2, previousEmitMs: .4 } };
  };
  repair('native loop seek retained in passive measurement', () => {
    assert(typeof recordIdleObservation === 'function', 'passive idle observation missing');
    const m = measurement();
    recordIdleObservation(m, idleEvent(0, 1.958333, 48), url);
    recordIdleObservation(m, idleEvent(20, 1.958333, 48, { seeking: true, currentTime: 0 }, 'media-event', 'seeking'), url);
    recordIdleObservation(m, idleEvent(60, 0, 49, {}, 'media-event', 'seeked'), url);
    recordIdleObservation(m, idleEvent(65, 0, 49), url);
    equal([m.wraps, m.seeks[0].durationMs, m.callbackIntervals[0].wallGapMs, m.observations[1].seeking], [1, 40, 65, true]);
    equal(m.observerOverhead.length, 4);
    equal([m.callbackIntervals[0].callbackGapMs, m.callbackIntervals[0].counterDelta], [65, 1]);
    rejects(() => recordIdleObservation(m, idleEvent(70, .041667, 49), url));
    for (const fields of [{ paused: true }, { src: url + '?wrong' }, { currentSrc: url + '?wrong' }, { exposed: false }]) rejects(() => recordIdleObservation(measurement(), idleEvent(0, 0, 1, fields), url));
  });
  repair('supplementary failed interval stays UNPROVEN', () => {
    assert(typeof supplementaryIdleInterval === 'function', 'supplementary classification missing');
    const result = supplementaryIdleInterval(before, changedIdle(shortAfter, { seeking: true }), url, 1.1, []);
    equal(result.status, 'UNPROVEN'); equal(result.strictIntervalCheck.status, 'FAIL');
    equal(result.strictIntervalCheck.error, 'AssertionError [ERR_ASSERTION]: exposed playing non-seeking idle required');
    const overlap = supplementaryIdleInterval(before, shortAfter, url, 1.1, [idleEvent(before.now + 20, 0, 28, { seeking: true }, 'media-event', 'seeking')]);
    equal(overlap.status, 'UNPROVEN'); equal(overlap.strictIntervalCheck.status, 'FAIL');
    const continuous = supplementaryIdleInterval(before, shortAfter, url, 1.1, []);
    equal(continuous.strictIntervalCheck.status, 'PASS'); equal(continuous.continuousPlayback, 'UNPROVEN');
    const mismatch = supplementaryIdleInterval(before, { ...after, now: before.now + 100 }, url, 1.1, []);
    equal(mismatch.strictIntervalCheck.error, 'AssertionError [ERR_ASSERTION]: idle media progress disagrees with page elapsed time');
  });
  const asyncRepair = async (name, test) => { try { await test(); } catch (error) { failures.push({ name, error: String(error) }); } };
  await asyncRepair('measurement screenshot guard and zero-count receipt', async () => {
    assert(typeof captureScreenshot === 'function' && typeof finishIdleMeasurement === 'function', 'measurement screenshot guard missing');
    let requests = 0;
    const transport = async () => { requests++; return {}; };
    await assert.rejects(() => captureScreenshot(transport, 'owned-session', measurement()), /screenshot forbidden during passive idle measurement/); checks++;
    equal(requests, 0);
    const m = measurement(); m.wraps = 3;
    finishIdleMeasurement(m, { now: 6000 }, 0); equal(m.screenshotsDuringMeasurement, 0);
    rejects(() => finishIdleMeasurement(measurement(), { now: 6000 }, 0));
    rejects(() => finishIdleMeasurement(m, { now: 6000 }, 1));
    await captureScreenshot(transport, 'owned-session', null); equal(requests, 1);
  });
  await asyncRepair('asynchronous exact owned target removal', async () => {
    assert(typeof closeOwnedTarget === 'function', 'asynchronous target removal observation missing');
    let time = 0, reads = 0; const calls = [], receipts = [];
    const transport = async (method, params) => {
      calls.push({ method, params }); time += 10;
      return method === 'Target.closeTarget' ? { success: true } : { targetInfos: ++reads < 3 ? [{ targetId: 'owned' }, { targetId: 'foreign' }] : [{ targetId: 'foreign' }] };
    };
    await closeOwnedTarget(transport, 'owned', r => receipts.push(structuredClone(r)), () => time, 100);
    equal(calls.filter(c => c.method === 'Target.closeTarget'), [{ method: 'Target.closeTarget', params: { targetId: 'owned' } }]);
    equal(reads, 3); equal(receipts.at(-1).removed, true);
    equal(receipts.at(-1).observations.map(r => r.present), [true, true, false]);
    equal(receipts.at(-1).closeRequestedAt, 0);
    equal(receipts.at(-1).observations.map(r => [r.requestedAt, r.observedAt]), [[10, 20], [20, 30], [30, 40]]);
  });
  await asyncRepair('owned target removal timeout never retries close', async () => {
    assert(typeof closeOwnedTarget === 'function', 'bounded target removal missing');
    let time = 0, closes = 0; const receipts = [];
    const transport = async method => { time += 10; if (method === 'Target.closeTarget') { closes++; return { success: true }; } return { targetInfos: [{ targetId: 'owned' }] }; };
    await assert.rejects(() => closeOwnedTarget(transport, 'owned', r => receipts.push(structuredClone(r)), () => time, 35), /owned target removal timeout/); checks++;
    equal(closes, 1); equal(receipts.at(-1).status, 'FAIL'); equal(receipts.at(-1).removed, false);
    equal(receipts.at(-1).observations.length, 3);
  });
  // New continuous-motion contract tests are pure inputs, never browser receipts.
  repair('explicit 2/2/2/4 contract', () => {
    equal(idleStops.map(stop => [stop, idleSpecs[stop].seconds, idleSpecs[stop].frames]), [[1, 2, 48], [2, 2, 48], [3, 2, 48], [4, 4, 96]]);
    for (const stop of idleStops) {
      const seconds = idleSpecs[stop].seconds;
      equal(nativeIdleContract({ duration: seconds }, stop), idleSpecs[stop]);
      rejects(() => nativeIdleContract({ duration: seconds === 4 ? 2 : 4 }, stop));
      rejects(() => nativeIdleContract({ duration: null }, stop));
      rejects(() => nativeIdleContract({ duration: seconds + 1 / 24 }, stop));
      rejects(() => nativeIdleContract({ duration: seconds + .0005 }, stop));
      equal(cadenceWindowMs(seconds), 3 * seconds * 1000 + 3000);
    }
    rejects(() => nativeIdleContract({ duration: 2 }, 0));
    for (const duration of [0, -1, NaN, Infinity, null, '4']) rejects(() => cadenceWindowMs(duration));
    equal(cadenceWindowMs(4) > 12000, true);
    equal(cadenceWindowMs(4) <= 16000, true);
    equal(capturePhases(4).some(t => t >= 3), true);
    equal(capturePhases(4).includes(3.7), true);
    equal(capturePhases(2).every(t => t < 2), true);
  });
  repair('native preload readiness does not waive decode/source guards', () => {
    const video = { src: url, currentSrc: url, readyState: 2, duration: 6, buffered: [[0, .25]], seeking: false, error: null };
    equal(preloadedFilm(video, url), true);
    for (const fields of [{ src: url + '?wrong' }, { currentSrc: url + '?wrong' }, { readyState: 1 }, { duration: null }, { duration: 0 }, { duration: NaN }, { seeking: true }, { error: { code: 3 } }, { buffered: [] }, { buffered: [[1, 6]] }, { buffered: [[0, .1]] }]) equal(Boolean(preloadedFilm({ ...video, ...fields }, url)), false);
  });
  repair('four-second passive wraps and second-half strict intervals', () => {
    const m = measurement(), officeEvent = (now, phase, count) => idleEvent(now, phase, count, { duration: 4 });
    for (const [now, phase, count] of [[0, 3.958333, 96], [42, 0, 97], [4000, 3.958333, 192], [4042, 0, 193], [8000, 3.958333, 288], [8042, 0, 289]]) recordIdleObservation(m, officeEvent(now, phase, count), url);
    finishIdleMeasurement(m, officeEvent(8042, 0, 289).state, 0);
    equal(m.wraps, 3); equal(m.duration, 4); equal(m.screenshotsDuringMeasurement, 0);
    const office = (now, phase, count) => changedIdle(sample(now, phase, count), { duration: 4 });
    const secondHalf = supplementaryIdleInterval(office(0, 3.75, 91), office(84, 3.833333, 93), url, 3.7, []);
    equal(secondHalf.strictIntervalCheck.status, 'PASS'); equal(secondHalf.continuousPlayback, 'UNPROVEN');
    equal(supplementaryIdleInterval(office(0, 3.75, 91), office(84, 3.75, 93), url, 3.7, []).strictIntervalCheck.status, 'FAIL');
    equal(supplementaryIdleInterval(office(0, 1.75, 43), office(84, 1.833333, 45), url, 3.7, []).strictIntervalCheck.status, 'FAIL');
  });
  repair('duration-scaled actual-event phase bins', () => {
    const office = (time, callback = time) => changedIdle(sample(0, callback, 80, time), { duration: 4 });
    equal(exitPhases(4), [.6, 2.2, 3.4]);
    equal(phaseInput(office(3.5), url, 3.4).nativePhase, 3.5);
    equal(phaseInput(office(3.5), url, 3.4).remainingCycleMs, 500);
    rejects(() => phaseInput(office(1.75), url, 3.4));
    rejects(() => phaseInput(office(3.5, 3.3), url, 3.4));
    rejects(() => phaseInput(office(4), url, 3.4));
    rejects(() => inPhaseBin(office(3.5), 1.7));
    for (const duration of [2, 4]) for (const phase of exitPhases(duration)) {
      const state = changedIdle(sample(0, phase, 1), { duration });
      equal(inPhaseBin(state, phase), true);
      equal(inPhaseBin(changedIdle(state, { currentTime: phaseBin(duration, phase)[1] }), phase), false);
    }
    // A valid pre-CDP observation cannot substitute for the actual trusted event.
    equal(inPhaseBin(office(3.45), 3.4), true);
    rejects(() => phaseInput(office(.05), url, 3.4));
  });
  repair('initial phase admission observes native loop seek but trusted input stays strict', () => {
    const source = fs.readFileSync(new URL(import.meta.url), 'utf8');
    const call = /const idleURL = mediaURL\(idles\[from\]\); (idle(?:Observed)?Ownership)\(initial\.ambient, idleURL\);/.exec(source);
    assert(call, 'actual travel initial admission call must be identified');
    const admitInitial = { idleOwnership, idleObservedOwnership }[call[1]];
    const seeking = changedIdle(sample(0, 1.958333, 48, 0), { seeking: true });
    admitInitial(seeking.ambient, url); checks++;
    rejects(() => phaseInput(seeking, url, 1.7));
    rejects(() => admitInitial({ ...seeking.ambient, currentSrc: url + '?wrong' }, url));
    rejects(() => admitInitial({ ...seeking.ambient, paused: true }, url));
    rejects(() => admitInitial({ ...seeking.ambient, exposed: false }, url));
  });
  repair('passive settled ownership retains loop-seek metadata while entry stays decoded', () => {
    const source = fs.readFileSync(new URL(import.meta.url), 'utf8');
    const start = source.indexOf('\n  function arrived(') + 1, end = source.indexOf('\n  async function shot(', start);
    assert(start > 0 && end > start);
    const origin = 'http://127.0.0.1:12345', mediaURL = name => origin + '/media/desktop/' + name;
    const arrived = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', { mediaURL, dimensions: (v, kind) => videoDimensions('desktop', kind, v), firstPosters: { desktop: '/media/desktop/poster.webp' }, camera: 'desktop', origin, URL, idles, titles, nativeIdleContract });
    const poster = mediaURL('stop-1.webp'), idleURL = mediaURL(idles[1]);
    const state = { ready: true, hero: { moving: false }, count: '02 / 06',
      controls: { next: { disabled: false, shown: true }, prev: { disabled: false, shown: true } },
      copies: [{ stop: 1, shown: true, effectiveOpacity: 1, text: titles[1] }],
      still: { currentSrc: poster, complete: true, width: 3584, shown: true, effectiveOpacity: 1 },
      hold: { background: `url("${poster}")`, shown: true }, film: { layer: { shown: false } },
      ambient: { src: idleURL, currentSrc: idleURL, frame: { currentSrc: idleURL }, exposed: true, paused: false, seeking: true, loop: true, readyState: 1, currentTime: 0, duration: 2, width: 3584, height: 2016 } };
    equal(arrived(state, 1), false);
    equal(arrived(state, 1, true), true);
    equal(arrived({ ...state, ambient: { ...state.ambient, readyState: 0 } }, 1, true), false);
    equal(arrived({ ...state, ambient: { ...state.ambient, currentSrc: idleURL + '?wrong' } }, 1, true), false);
    equal(arrived({ ...state, ambient: { ...state.ambient, paused: true } }, 1, true), false);
    equal(arrived({ ...state, ambient: { ...state.ambient, exposed: false } }, 1, true), false);
    equal(arrived({ ...state, film: { layer: { shown: true } } }, 1, true), false);
    equal(arrived({ ...state, count: '03 / 06' }, 1, true), false);
    equal(arrived({ ...state, ambient: { ...state.ambient, readyState: 4, seeking: false } }, 1), true);
  });
  repair('matrix covers every path/camera/idle/direction/phase', () => {
    const plan = cameraPlan();
    let current = 0;
    for (const op of plan) {
      if (op.kind === 'cadence') equal(op.stop, current);
      else { equal(op.from, current); equal(Math.abs(op.to - op.from), 1); current = op.to; }
    }
    equal(new Set(plan.map(op => op.label)).size, plan.length);
    equal(plan.filter(op => op.kind === 'path' && op.to > op.from).map(op => [op.from, op.to]), [[0,1],[1,2],[2,3],[3,4],[4,5]]);
    equal(plan.filter(op => op.kind === 'path' && op.to < op.from).map(op => [op.from, op.to]), [[5,4],[4,3],[3,2],[2,1],[1,0]]);
    equal(plan.filter(op => op.kind === 'phase-exit').map(op => [op.from, op.to, op.phaseTarget]), [1,2,3,4].flatMap(stop => [-1,1].flatMap(direction => (stop === 4 ? [.6,2.2,3.4] : [.3,1.1,1.7]).map(phase => [stop, stop + direction, phase]))));
    const rows = cameras.map(camera => ({ camera, transitions: plan.filter(op => op.kind !== 'cadence').map(op => ({ ...op, status: 'OBSERVED' })), idles: plan.filter(op => op.kind === 'cadence').map(op => ({ ...op, status: 'OBSERVED', measurement: { status: 'OBSERVED', wraps: 3, screenshotsDuringMeasurement: 0 }, phaseScreenshots: capturePhases(idleSpecs[op.stop].seconds).map(phaseTrigger => ({ phaseTrigger, supplementary: { strictIntervalCheck: { status: 'PASS' } } })) })) }));
    const coverage = verifyMatrix(rows);
    equal(coverage.cameras, cameras.length);
    equal(coverage.phaseExits, cameras.length * idleStops.length * directions.length * phaseFractions.length);
    equal(coverage.cadenceWindows, cameras.length * idleStops.length);
    equal(coverage.minimumNativeWraps, coverage.cadenceWindows * 3);
    equal(coverage.forwardPaths, cameras.length * 5);
    equal(coverage.reversePaths, cameras.length * 5);
    equal(coverage.supplementaryCaptures, cameras.length * idleStops.reduce((n, stop) => n + capturePhases(idleSpecs[stop].seconds).length, 0));
    rejects(() => verifyMatrix(rows.slice(1)));
    const missing = structuredClone(rows); missing[0].transitions.splice(missing[0].transitions.findIndex(op => op.kind === 'phase-exit' && op.from === 4 && op.to === 3), 1); rejects(() => verifyMatrix(missing));
    const duplicate = structuredClone(rows); duplicate[0].transitions.push(duplicate[0].transitions[0]); rejects(() => verifyMatrix(duplicate));
    const unobserved = structuredClone(rows); unobserved[0].transitions[0].status = 'RUNNING'; rejects(() => verifyMatrix(unobserved));
    const noCadence = structuredClone(rows); noCadence[0].idles.pop(); rejects(() => verifyMatrix(noCadence));
    const twoWraps = structuredClone(rows); twoWraps[0].idles[0].measurement.wraps = 2; rejects(() => verifyMatrix(twoWraps));
    const screenshotInCadence = structuredClone(rows); screenshotInCadence[0].idles[0].measurement.screenshotsDuringMeasurement = 1; rejects(() => verifyMatrix(screenshotInCadence));
    const lostCapture = structuredClone(rows); lostCapture[0].idles.at(-1).phaseScreenshots.pop(); rejects(() => verifyMatrix(lostCapture));
    const failedCapture = structuredClone(rows); failedCapture[0].idles[0].phaseScreenshots[0].supplementary.strictIntervalCheck.status = 'FAIL';
    equal(verifyMatrix(failedCapture).strictSupplementaryFailures, 1); // retained FAIL, never reclassified PASS
    rejects(() => validateCounters({ ...carriedCounters, new_scope_native_frames: 0 }));
    equal(validateCounters(carriedCounters), carriedCounters);
    for (const fields of [{ new_scope_native_frames: 1537 }, { new_scope_render_seconds: 43201 }, { previous_batch_native_frames: 489 }, { previous_harness_repair_cycles: 3 }, { technical_episodes: 3 }, { technical_verdict_attempts: 9 }, { new_scope_native_frames: 1446.5 }]) rejects(() => validateCounters({ ...carriedCounters, ...fields }));
    equal(verifyMatrix(rows).transitions, cameras.length * plan.filter(op => op.kind !== 'cadence').length);
  });
  assert.deepEqual(failures, [], 'continuous verifier regression failures');
  console.log(JSON.stringify({ offlineSelfTest: 'GREEN', checks, contract: '2s/48 GameOn, overview, belt; 4s/96 office, all24fps; separate verifier, old verdict untouched', plannedMatrix: matrixSummary(cameras.map(camera => ({ camera, transitions: cameraPlan().filter(op => op.kind !== 'cadence'), idles: cameraPlan().filter(op => op.kind === 'cadence').map(op => ({ ...op, phaseScreenshots: capturePhases(idleSpecs[op.stop].seconds).map(phaseTrigger => ({ phaseTrigger })) })) }))), filesystemWrites: 0, browserLaunches: 0, servers: 0, runtimeAndArt: 'NOT TESTED' }));
}

async function run(build, out, budgets) {
  locations(build, out);
  assert(typeof WebSocket === 'function', 'native Node WebSocket required');
  // Snapshot only the supplied static build. All responses use these unchanged
  // bytes, never rewritten HTML, dev-server substitutes or a test player.
  const files = new Map(); let total = 0;
  function load(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name); noSymlinks(file);
      if (entry.isDirectory()) load(file);
      else {
        assert(entry.isFile(), 'non-regular build entry refused');
        const type = mime[path.extname(file)]; assert(type, 'unsupported static MIME: ' + file);
        const bytes = fs.readFileSync(file); total += bytes.length;
        assert(total <= 1024 ** 3 && files.size < 2048, 'bounded static snapshot exceeded');
        files.set('/' + path.relative(build, file).split(path.sep).join('/'), { bytes, type, sha256: sha(bytes) });
      }
    }
  }
  load(build); assert(files.has('/index.html'), 'build index.html required');
  const firstPosters = initialPosters(files.get('/index.html').bytes.toString('utf8'));
  const embeddedImages = new Set([...files.get('/index.html').bytes.toString('utf8').matchAll(/src="(data:image\/png;base64,[A-Za-z0-9+/=]+)"/g)].map(m => m[1]));
  for (const url of embeddedImages) assert(sha(Buffer.from(url.split(',')[1], 'base64')) === files.get('/media/screen-switch-icon.png')?.sha256, 'embedded image must match the actual preserved icon bytes');
  for (const variant of ['desktop', 'mobile']) {
    const initial = files.get(requestFile(firstPosters[variant].slice(1)));
    assert(initial && initial.sha256 === files.get('/media/' + variant + '/poster.webp')?.sha256, 'initial bundled poster must match preserved canonical bytes');
  }
  fs.mkdirSync(out); // Atomic: never reuse another run's output, even after validation.
  const profile = path.join(out, 'owned-headless-profile');
  const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
  const append = (name, value) => fs.appendFileSync(path.join(out, name), JSON.stringify(value) + '\n');
  const report = {
    task: 'portfolio033-followup-native-verifier', build, out, started: new Date().toISOString(), status: 'RUNNING',
    scope: 'Owned headless ARM64 Chrome, desktop and portrait emulation at DPR 1; assembled controller evidence only.',
    pending: ['Parent runtime classification and art/smoothness/visible salience review', 'Physical phone', 'Reduced motion, hidden/offstage, orientation changes, error/fallback injection', 'Keyboard/wheel/touch aliases, Skip/Escape, focus-boundary regression probes', 'Pending reverse-B immediate Next / two-second readiness failure injection', 'Finding-chip sequence for segC forward and reverse'],
    finalArtAndContinuity: 'OPEN; screenshots and passive cadence do not establish acceptance',
    harnessConditions: { observerOverhead: 'Per-event snapshotMs and previousEmitMs in native trace; excludes CDP transport/Node I/O, no smoothness PASS', idleMeasurement: 'Three actual wraps without screenshot requests, followed by supplementary interval captures', cacheControl: 'no-store; media switches may re-fetch over loopback, unlike production caching', observer: 'Full style/layer snapshots per native callback and ~30ms rAF, synchronous event writes, headless Chrome; cadence is not production smoothness evidence' },
    renderUseThisRun: { nativeFrames: 0, renderSeconds: 0 }, budgets,
    contract: { fps: 24, idles: idleSpecs, idleDimensions: { desktop: [3584, 2016], mobile: [1800, 3200] }, travelDimensions: { desktop: [1600, 900], mobile: [900, 1600] }, sourceFrameCounts: 'PARENT FFPROBE REQUIRED; native duration alone is not source-frame proof', previousVerifier: 'Immutable old contract; no previous failure is waived or reclassified' },
    plannedMatrix: { cameras, stepsPerCamera: cameraPlan() },
    cameras: [], errors: [], recordedCancellations: [], cleanup: null
  };
  report.pending.push('Cold forward input (Next before native preload buffered, esp. segB/segE) NOT covered; forward first-exposure measured only after warm-media admission; move() reassigns src under no-store, so neither cold nor production-cache latency is proven');
  const save = () => write('report.json', report);
  write('build-manifest.json', { build, totalBytes: total, files: [...files].map(([url, f]) => ({ url, size: f.bytes.length, sha256: f.sha256, mime: f.type })) });
  save();
  let server, chrome, ws, port, origin, session, camera, events = [], sequence = 0, abort, cleanupPromise;
  let chromeSpawnError, socketClosed = false, serverRequests = 0, activeMeasurement = null, screenshotRequests = 0;
  const requests = new Map();
  const pending = new Map();
  const check = () => { if (abort) throw abort; if (report.errors.length) throw Error('Recorded runtime error: ' + JSON.stringify(report.errors.at(-1))); };
  const error = (kind, details) => { const e = { kind, camera, details }; report.errors.push(e); append('errors.jsonl', e); save(); };
  const stopped = () => !chrome || chromeSpawnError || chrome.exitCode !== null || chrome.signalCode !== null;
  function call(method, params = {}, sid, timeout = 5000) {
    if (method === 'Page.captureScreenshot') { assert(!activeMeasurement, 'screenshot forbidden during passive idle measurement'); screenshotRequests++; }
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) { reject(Error('Owned CDP socket unavailable: ' + method)); return; }
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, timeout);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: why => { clearTimeout(timer); reject(why); } });
      ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
    });
  }
  async function evaluate(expression) {
    check();
    const result = await call('Runtime.evaluate', { expression, returnByValue: true }, session);
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  const snapshot = () => evaluate('window.__arenaProbeSnapshot?.()');
  function valid(s) {
    assert(s?.ready && s.url === origin + '/' && s.origin === origin, 'exact owned app URL required');
    assert(!s.hidden && s.visibility === 'visible' && s.hero.active && !s.reduced, 'native visible/onstage normal-motion document required');
    assert(s.error.hidden && !s.film.error && !s.ambient.error, 'application/media error shown');
    assert(s.film.muted && s.ambient.muted && s.film.defaultMuted && s.ambient.defaultMuted && s.film.playsInline && s.ambient.playsInline, 'native muted inline video contract');
    assert(s.viewport.width === (camera === 'desktop' ? 1657 : 390) && s.viewport.height === (camera === 'desktop' ? 994 : 844) && s.viewport.dpr === 1 && s.viewport.portrait === (camera === 'mobile'), 'exact viewport/DPR/orientation required');
  }
  async function waitFor(test, label, ms = 2000) {
    const deadline = Date.now() + ms;
    while (true) {
      check(); const s = await snapshot();
      if (s?.ready) { write('last-observed.json', s); valid(s); if (test(s)) return s; }
      assert(Date.now() < deadline, 'timeout: ' + label);
      await delay(20);
    }
  }
  const mediaURL = file => origin + '/media/' + camera + '/' + file;
  const dimensions = (v, kind = 'travel') => videoDimensions(camera, kind, v);
  function arrived(s, stop, observing = false) {
    if (!s?.ready) return false;
    const poster = mediaURL(stop ? `stop-${stop}.webp` : 'poster.webp');
    if (s.hero.moving || s.controls.next.disabled || s.controls.prev.disabled !== (stop === 0) || s.count !== `${String(stop + 1).padStart(2, '0')} / 06`) return false;
    if (s.copies.length !== 1 || s.copies[0].stop !== stop || !s.copies[0].shown || s.copies[0].effectiveOpacity < .999 || !s.copies[0].text.includes(titles[stop])) return false;
    const initialPoster = new URL(firstPosters[camera], origin + '/').href;
    if (!(s.still.currentSrc === poster || (stop === 0 && s.still.currentSrc === initialPoster)) || !s.still.complete || !s.still.width || !s.still.shown || s.still.effectiveOpacity < .999 || s.film.layer.shown || Object.values(s.controls).some(b => !b.shown)) return false;
    if (idles[stop] && !(s.hold.background.includes(poster) && s.ambient.exposed && !s.ambient.paused && dimensions(s.ambient, 'idle') && s.ambient.currentSrc === mediaURL(idles[stop]) && s.ambient.src === mediaURL(idles[stop]) && s.ambient.frame?.currentSrc === mediaURL(idles[stop]))) return false;
    if (idles[stop]) {
      nativeIdleContract(s.ambient, stop);
      // Native loop seeks temporarily retain metadata and the last presented
      // frame. Observe them without skipping data; entry still requires data.
      if (s.ambient.readyState < (observing ? 1 : 2)) return false;
    }
    if (!idles[stop] && s.hold.shown) return false;
    return true;
  }
  async function shot(label, test = () => true, interval, trigger) {
    const before = await snapshot(); valid(before); assert(test(before), 'screenshot lost required state before capture: ' + label);
    const result = await captureScreenshot(call, session, activeMeasurement);
    const file = `${camera}-${label}.png`; fs.writeFileSync(path.join(out, file), Buffer.from(result.data, 'base64'));
    const after = await snapshot(); valid(after);
    const receipt = { file, before, after, bracketValid: test(after), captureClaim: 'captured within interval', captureInterval: { pageStart: before.now, pageEnd: after.now, wallLatencyMs: after.now - before.now }, ...(trigger ? { phaseTrigger: trigger.phase, triggerObservation: trigger.state, triggerToBeforeMs: before.now - trigger.state.now } : {}), artJudgement: 'PENDING parent; screenshot does not prove smoothness' };
    if (interval) {
      try { Object.assign(receipt.captureInterval, interval(before, after)); }
      catch (error) { receipt.bracketValid = false; receipt.intervalError = String(error); }
    }
    if (trigger?.supplementary) {
      idleObservedOwnership(before.ambient, trigger.url); idleObservedOwnership(after.ambient, trigger.url);
      const observations = events.filter(e => e.state.now >= before.now && e.state.now <= after.now);
      receipt.captureMediaEvents = observations.filter(e => e.type === 'media-event' && e.video === 'ambient');
      receipt.supplementary = supplementaryIdleInterval(before, after, trigger.url, trigger.phase, observations);
      Object.assign(receipt.captureInterval, receipt.supplementary.captureInterval);
      receipt.bracketValid = test(after) && receipt.supplementary.strictIntervalCheck.status === 'PASS';
      if (receipt.supplementary.strictIntervalCheck.status === 'FAIL') receipt.intervalError = receipt.supplementary.strictIntervalCheck.error;
      receipt.captureClaim = 'Genuine still captured within recorded before/after interval; exact phase and continuous playback UNPROVEN';
    }
    append('screenshots.jsonl', receipt);
    assert(trigger?.supplementary ? test(after) : receipt.bracketValid, 'screenshot lost required state during capture: ' + label);
    return receipt;
  }
  async function click(id, beforeDispatch) {
    const s = await snapshot(); valid(s);
    const b = s.controls[id]; assert(b?.shown && !b.disabled, 'native control unavailable: ' + id);
    const x = b.rect.x + b.rect.width / 2, y = b.rect.y + b.rect.height / 2;
    assert(x >= 0 && y >= 0 && x < s.viewport.width && y < s.viewport.height, 'control outside active viewport');
    const start = events.length;
    await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, session);
    if (beforeDispatch) {
      const pre = await snapshot(); valid(pre);
      if (!beforeDispatch(pre)) return null; // No press/release occurred; retry on the next cycle.
    }
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x, y }, session);
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x, y }, session);
    await waitFor(() => events.slice(start).some(e => e.type === 'input' && e.target === id && e.trusted), 'trusted native ' + id, 1000);
    return events.slice(start).find(e => e.type === 'input' && e.target === id && e.trusted);
  }
  const exposedFilm = (s, url) => s?.ready && s.film.exposed && s.film.currentSrc === url && s.film.src === url && s.film.frame?.currentSrc === url && s.film.frame?.src === url && s.now - s.film.frame.now < 150 && dimensions(s.film) && !s.film.paused;
  async function travel(from, to, label, phase, kind = 'path') {
    let initial = await waitFor(s => arrived(s, from), label + ' departure settled');
    const reverse = to < from, segment = `seg${'ABCDE'[Math.min(from, to)]}${reverse ? '-reverse' : ''}.mp4`, url = mediaURL(segment);
    let preloadReadiness = null;
    if (!reverse) {
      const startedAt = initial.now;
      // Longer B/E files may still be loading after the chapter has settled.
      // Wait only for the player's own preload, with all normal error guards.
      initial = await waitFor(s => arrived(s, from) && preloadedFilm(s.film, url), label + ' native forward preload metadata/buffer', 20000);
      preloadReadiness = { startedAt, readyAt: initial.now, elapsedMs: initial.now - startedAt, state: initial, claim: 'Native preload buffer; warm-media admission, not cold-input latency proof; actual exposed decode still required after trusted input' };
    }
    const row = { kind, from, to, segment, url, label, preloadReadiness, phaseTarget: phase ?? null, status: 'RUNNING', sourceFixedDelaysMs: { copyFade: 150, layerBlend: 120 }, initial };
    report.cameras.at(-1).transitions.push(row); save();
    const start = events.length;
    let input;
    if (phase !== undefined) {
      const idleURL = mediaURL(idles[from]); idleObservedOwnership(initial.ambient, idleURL);
      row.phaseBin = phaseBin(initial.ambient.duration, phase); row.phasePreDispatchAttempts = [];
      const deadline = Date.now() + 3 * initial.ambient.duration * 1000;
      for (let cycle = 1; cycle <= 3 && !input; cycle++) {
        const remaining = () => { const ms = deadline - Date.now(); assert(ms > 0, 'three-cycle phase input bound exceeded'); return ms; };
        await waitFor(s => arrived(s, from) && s.ambient.frame?.mediaTime >= phase && s.ambient.frame.mediaTime <= phase + .07, label + ' requested idle phase', remaining());
        input = await click(reverse ? 'prev' : 'next', pre => {
          assert(Date.now() < deadline, 'three-cycle phase input bound exceeded before dispatch');
          assert(arrived(pre, from), 'phase pre-dispatch lost settled ownership'); idleOwnership(pre.ambient, idleURL);
          const inBin = inPhaseBin(pre, phase);
          row.phasePreDispatchAttempts.push({ cycle, inBin, state: pre, action: inBin ? 'dispatch' : 'wait next cycle; no click' });
          return inBin;
        });
        if (!input && cycle < 3) await waitFor(s => arrived(s, from) && s.ambient.frame?.mediaTime < phase, label + ' next idle cycle after bin miss', remaining());
      }
      assert(input, 'phase pre-dispatch missed bin on three cycles; no click');
    } else input = await click(reverse ? 'prev' : 'next');
    row.input = input;
    if (phase !== undefined) {
      const nativePhase = input.state.ambient.currentTime, callbackPhase = input.state.ambient.frame?.mediaTime;
      row.phaseAtInput = nativePhase; row.callbackPhaseAtInput = callbackPhase;
      row.remainingCycleMs = (input.state.ambient.duration - nativePhase) * 1000;
      valid(input.state); assert(arrived(input.state, from), 'trusted phase input lost settled ownership');
      assert(input.state.ambient.duration === initial.ambient.duration, 'phase input idle duration changed');
      assert(input.state.now - initial.now <= 3 * initial.ambient.duration * 1000, 'actual phase input exceeded three-cycle bound');
      phaseInput(input.state, mediaURL(idles[from]), phase);
    }
    await waitFor(() => events.slice(start).some(e => exposedFilm(e.state, url)), label + ' first exposed native film', 2150);
    const first = events.slice(start).find(e => exposedFilm(e.state, url));
    row.firstExposed = first; row.firstExposedAfterInputMs = first.state.now - input.state.now;
    assert(row.firstExposedAfterInputMs <= 2150, 'source 150ms + 2000ms decoded-frame readiness bound exceeded');
    if (phase !== undefined) assert(row.firstExposedAfterInputMs < row.remainingCycleMs, 'Idle exit waited through remaining actual cycle; no performance waiver');
    row.handoff = await shot(label + '-handoff', s => exposedFilm(s, url));
    row.handoffInterpretation = 'Capture interval after first exposure; not an instant blend frame';
    const middle = await waitFor(s => exposedFilm(s, url) && s.film.frame.mediaTime >= .35 && s.film.frame.mediaTime < s.film.duration - .25, label + ' intermediate presented frame');
    row.intermediate = await shot(label + '-intermediate', s => exposedFilm(s, url) && s.film.frame.mediaTime >= .15 && s.film.frame.mediaTime < s.film.duration - .15);
    const destination = await waitFor(s => arrived(s, to), label + ' destination poster/copy/idle', (middle.film.duration + 2) * 1000);
    const frames = events.slice(start).filter(e => e.type === 'frame' && e.video === 'film' && exposedFilm(e.state, url));
    const ended = events.slice(start).find(e => e.type === 'media-event' && e.video === 'film' && e.event === 'ended' && e.state.film.currentSrc === url);
    assert(ended, 'real expected film ended event required');
    row.filmTraversal = filmTraversal(frames, events.slice(start).map(e => e.state), ended.state.film.duration, url);
    const settled = events.slice(start).find(e => e.state.now >= ended.state.now && arrived(e.state, to)) ?? { type: 'read-only-evaluation', state: destination };
    assert(settled && settled.state.now - ended.state.now <= 2000, 'arrival/idle failed source two-second readiness bound');
    row.exposedFrameCount = frames.length; row.exposedFrameSpan = [frames[0].frame, frames.at(-1).frame]; row.arrivalAfterEndedMs = settled.state.now - ended.state.now;
    if (idles[to]) {
      const nativeIdleFrames = () => events.slice(start).filter(e => e.type === 'frame' && e.video === 'ambient' && e.state.now >= ended.state.now && arrived(e.state, to));
      await waitFor(() => nativeIdleFrames().length >= 3, label + ' advancing arrival idle');
      const idleFrames = nativeIdleFrames();
      assert(idleFrames.at(-1).frame.mediaTime > idleFrames[0].frame.mediaTime && idleFrames.at(-1).frame.presentedFrames > idleFrames[0].frame.presentedFrames, 'arrival idle did not advance');
      row.arrivalIdleFrameSpan = [idleFrames[0].frame, idleFrames.at(-1).frame];
    }
    row.arrival = await shot(label + '-arrival', s => arrived(s, to));
    if (reverse && to === 1) {
      for (const p of [settled.state.peek, row.arrival.before.peek]) assert(!p.hidden && p.complete && p.width > 0 && p.src === mediaURL('gameon-peek.webp') && p.opacity >= .999 && p.effectiveOpacity >= .999, 'native reverse B did not return full decoded peek');
      row.reverseBFullPeekDomState = { decodedFullOpacity: true, viewportIntersections: [settled.state, row.arrival.before].map(s => {
        const r = s.peek.rect;
        const width = Math.max(0, Math.min(r.x + r.width, s.viewport.width) - Math.max(0, r.x));
        const height = Math.max(0, Math.min(r.bottom, s.viewport.height) - Math.max(0, r.top));
        return { width, height, area: width * height, shown: s.peek.shown, rect: r, viewport: s.viewport };
      }) };
    }
    row.status = 'OBSERVED'; save();
  }
  async function idle(stop, label) {
    const initial = await waitFor(s => arrived(s, stop), label + ' idle settled');
    const start = events.length, url = mediaURL(idles[stop]), row = { stop, url, label, status: 'RUNNING', wraps: 0, phaseScreenshots: [] };
    report.cameras.at(-1).idles.push(row);
    const measurement = row.measurement = { start: { pageNow: initial.now, observedAt: Date.now(), state: initial }, status: 'RUNNING', screenshotsAtStart: screenshotRequests, wraps: 0, callbacks: [], callbackIntervals: [], observations: [], seeks: [], observerOverhead: [], viewport: initial.viewport };
    activeMeasurement = measurement; save();
    const nativeDuration = initial.ambient.duration; nativeIdleContract(initial.ambient, stop);
    measurement.deadlineAllowanceMs = cadenceWindowMs(nativeDuration);
    measurement.deadlineBasis = { actualDuration: nativeDuration, fullCycles: 3, boundedSetupOverheadMs: 3000 };
    const deadline = Date.now() + measurement.deadlineAllowanceMs;
    let processed = start, end;
    try {
      while (true) {
        check(); end = await snapshot(); valid(end); assert(arrived(end, stop, true), 'idle lost settled ownership');
        idleObservedOwnership(end.ambient, url);
        for (; processed < events.length; processed++) {
          const e = events[processed];
          valid(e.state); assert(arrived(e.state, stop, true), 'idle lost settled ownership in native observation');
          recordIdleObservation(measurement, e, url);
        }
        assert(Date.now() < deadline, label + ': three native wraps missing');
        if (measurement.wraps >= 3) break;
        await delay(20); // Existing bounded condition polling; no playback delay or speed change.
      }
      // A fresh endpoint includes every callback consumed above in the interval.
      end = await snapshot(); valid(end); assert(arrived(end, stop, true), 'idle lost settled ownership at measurement end');
      idleObservedOwnership(end.ambient, url);
      for (; processed < events.length; processed++) {
        const e = events[processed];
        if (e.state.now > end.now) break;
        valid(e.state); assert(arrived(e.state, stop, true), 'idle lost settled ownership at measurement end');
        recordIdleObservation(measurement, e, url);
      }
      finishIdleMeasurement(measurement, end, screenshotRequests);
      row.wraps = measurement.wraps; row.nativeCallbackSamples = measurement.callbacks.length;
    } catch (error) {
      measurement.status = 'FAIL'; measurement.error = String(error);
      measurement.end = { pageNow: end?.now ?? null, observedAt: Date.now(), state: end ?? null };
      measurement.screenshotsAtEnd = screenshotRequests;
      measurement.screenshotsDuringMeasurement = screenshotRequests - measurement.screenshotsAtStart;
      throw error;
    } finally { activeMeasurement = null; save(); }
    // Captures are supplementary and cannot perturb the completed cadence window.
    const phases = capturePhases(nativeDuration);
    const captureDeadline = Date.now() + phases.length * (nativeDuration * 1000 + 2000);
    for (const phase of phases) {
      const remaining = captureDeadline - Date.now(); assert(remaining > 0, label + ': phase screenshots missing');
      const trigger = await waitFor(s => arrived(s, stop) && !s.ambient.seeking && s.ambient.frame.mediaTime >= phase && s.ambient.frame.mediaTime <= phase + .10, label + ' supplementary phase ' + phase, remaining);
      const receipt = await shot(`${label}-phase-${phase}`, x => arrived(x, stop, true), undefined, { phase, state: trigger, supplementary: true, url });
      row.phaseScreenshots.push(receipt); save();
    }
    row.strictIntervalCaptures = row.phaseScreenshots.some(r => r.supplementary.strictIntervalCheck.status === 'FAIL') ? 'FAIL' : 'PASS';
    row.status = 'OBSERVED'; row.artJudgement = 'PENDING'; row.continuity = 'UNPROVEN; parent must assess raw measurement and visible seams'; save();
  }
  async function endpointClosed() {
    if (!port) return true;
    return new Promise(resolve => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      let done = false;
      const finish = closed => { if (done) return; done = true; socket.destroy(); resolve(closed); };
      socket.setTimeout(500, () => finish(false)); socket.on('connect', () => finish(false)); socket.on('error', e => finish(e.code === 'ECONNREFUSED'));
    });
  }
  async function cleanup() {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const receipt = { ownedPid: chrome?.pid ?? null, profile, profileRemoved: false, profileCleanup: 'Parent only, after verified process/endpoint stop', sharedBrowserTouched: false, cmuxTouched: false, actions: [] };
      try {
        if (ws?.readyState === WebSocket.OPEN && !stopped()) { receipt.actions.push('Browser.close on endpoint read from newly owned profile'); try { await call('Browser.close', {}, undefined, 2000); } catch (e) { receipt.browserCloseReply = String(e); } }
        try { ws?.close(); } catch (e) { receipt.socketCloseError = String(e); }
        for (const signal of ['SIGTERM', 'SIGKILL']) {
          if (stopped()) break;
          receipt.actions.push({ signal, pid: chrome.pid }); chrome.kill(signal);
          const until = Date.now() + 3000;
          while (!stopped() && Date.now() < until) await delay(50);
        }
        receipt.ownedProcessStopped = Boolean(stopped());
        let closed = port ? await endpointClosed() : chrome ? null : true; const until = Date.now() + 3000;
        while (port && !closed && Date.now() < until) { await delay(100); closed = await endpointClosed(); }
        receipt.ownedEndpointStopped = closed;
      } catch (e) { receipt.error = String(e); }
      try {
        if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        receipt.ownedServerStopped = !server?.listening;
      } catch (e) { receipt.serverCloseError = String(e); }
      report.cleanup = receipt; write('cleanup.json', receipt); save();
      if (!receipt.ownedProcessStopped || !receipt.ownedEndpointStopped || !receipt.ownedServerStopped || receipt.error) { report.status = 'FAILED_CLEANUP'; process.exitCode = 1; }
    })();
    return cleanupPromise;
  }
  const interrupt = why => { abort ??= Error(why); report.status = 'FAILED_PARTIAL'; report.failure ??= { error: why }; process.exitCode = 1; for (const p of pending.values()) p.reject(abort); pending.clear(); };
  const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  // Observation scheduling for the expanded matrix only; render limits/counters
  // and every individual native source readiness/error deadline are unchanged.
  const controllerWallClockMs = 30000 + cameras.length * cameraPlan().reduce((ms, op) => ms + (op.kind === 'cadence' ? cadenceWindowMs(idleSpecs[op.stop].seconds) + capturePhases(idleSpecs[op.stop].seconds).length * (idleSpecs[op.stop].seconds * 1000 + 2000) : 20000 + (op.kind === 'phase-exit' ? 3 * idleSpecs[op.from].seconds * 1000 : 0)), 0);
  report.controllerWallClockMs = controllerWallClockMs; save();
  const deadline = setTimeout(() => interrupt('matrix-derived controller observation wall-clock bound exceeded'), controllerWallClockMs);
  try {
    server = http.createServer((req, res) => {
      try {
        assert(++serverRequests <= 5000, 'request bound exceeded');
        assert(req.headers.host === new URL(origin).host && ['GET', 'HEAD'].includes(req.method), 'unowned host/method');
        const file = requestFile(req.url), f = files.get(file);
        if (file === '/favicon.ico' && !f) { res.writeHead(204); res.end(); return; }
        assert(f, 'missing static file: ' + file);
        let range;
        try { range = byteRange(req.headers.range, f.bytes.length); }
        catch { res.writeHead(416, { 'Content-Range': `bytes */${f.bytes.length}` }); res.end(); error('http-range', { file, range: req.headers.range }); return; }
        const { start, end, status } = range;
        const headers = { 'Content-Type': f.type, 'Accept-Ranges': 'bytes', 'Content-Length': Math.max(0, end - start + 1), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
        if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${f.bytes.length}`;
        append('http.jsonl', { method: req.method, url: req.url, file, range: req.headers.range, status, start, end, sha256: f.sha256 });
        res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : f.bytes.subarray(start, end + 1));
      } catch (e) { res.writeHead(404); res.end(); error('http', { url: req.url, error: String(e) }); }
    });
    server.requestTimeout = 5000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${server.address().port}`;
    fs.mkdirSync(profile);
    write('ownership.json', { build, origin, profile, launchState: 'PLANNED', reason: 'Required Chromium H264/rVFC/native-input proof; parent must apply current canonical browser workflow. Owned headless process, no OS window/focus or shared port/profile.' });
    const log = fs.openSync(path.join(out, 'chrome.log'), 'wx');
    try {
      chrome = spawn('/usr/bin/arch', ['-arm64', chromeBinary, '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-default-apps', '--disable-background-networking', '--disable-component-update', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', 'about:blank'], { stdio: ['ignore', log, log] });
      chrome.on('error', e => { chromeSpawnError = e; interrupt('Owned Chrome spawn failed: ' + e); });
    } finally { fs.closeSync(log); }
    write('ownership.json', { build, origin, profile, ownedPid: chrome.pid, launchState: 'SPAWNED', nativeArchitecture: 'ARM64', osWindow: false, focusEmulation: false, sharedPort9223: false });
    const portFile = path.join(profile, 'DevToolsActivePort'), startup = Date.now() + 20000;
    while (!fs.existsSync(portFile)) { check(); assert(!stopped() && Date.now() < startup, 'owned Chrome startup failed/timed out'); await delay(100); }
    noSymlinks(portFile);
    const ownedEndpoint = endpoint(fs.readFileSync(portFile, 'utf8')); port = ownedEndpoint.port;
    ws = new WebSocket(`ws://127.0.0.1:${port}${ownedEndpoint.suffix}`);
    ws.addEventListener('message', event => {
      try {
        const m = JSON.parse(event.data);
        if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
        if (m.method === 'Fetch.requestPaused') {
          const allowed = allowedResource(m.params.request.url, origin, embeddedImages);
          if (!allowed) error('external-request-blocked', m.params.request.url);
          void call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: m.params.requestId, ...(!allowed ? { errorReason: 'BlockedByClient' } : {}) }, m.sessionId).catch(e => error('fetch-control', String(e)));
        }
        if (m.sessionId !== session) return;
        if (m.method === 'Runtime.bindingCalled' && m.params.name === '__arenaEvidence') {
          const e = JSON.parse(m.params.payload); events.push(e); append(camera + '-native-trace.jsonl', e);
          const counts = report.cameras.at(-1).observerEventCounts, key = e.type + (e.video ? ':' + e.video : ''); counts[key] = (counts[key] ?? 0) + 1;
          if (e.type === 'observer-error' || (e.state.ready && (e.state.hidden || !e.state.error.hidden || e.state.film.error || e.state.ambient.error))) error('native-observation', e);
        } else if (m.method === 'Runtime.exceptionThrown') error('javascript', m.params);
        else if (m.method === 'Runtime.consoleAPICalled') {
          append('console.jsonl', { camera, ...m.params });
          if (m.params.type === 'error') error('console-error', m.params);
        } else if (m.method?.startsWith('Media.')) {
          append('media.jsonl', { camera, method: m.method, ...m.params });
          if (m.method === 'Media.playerErrorsRaised' && m.params.errors.length) error('native-media', m.params);
        } else if (m.method === 'Network.requestWillBeSent') {
          requests.set(m.params.requestId, m.params.request.url);
        } else if (m.method === 'Network.loadingFailed') {
          append('network.jsonl', { camera, method: m.method, ...m.params });
          const url = requests.get(m.params.requestId), knownVideo = [...'ABCDE'].flatMap(c => [`seg${c}.mp4`, `seg${c}-reverse.mp4`]).concat(idles.filter(Boolean)).some(file => url === mediaURL(file));
          if (m.params.canceled && m.params.errorText === 'net::ERR_ABORTED' && knownVideo) { report.recordedCancellations.push({ camera, url, classification: 'Canceled known local video request; retained separately from hard errors, never proof of playback', ...m.params }); }
          else error('network', m.params);
        } else if (m.method === 'Network.responseReceived') {
          const r = m.params.response; append('network.jsonl', { camera, url: r.url, status: r.status, mimeType: r.mimeType, fromDiskCache: r.fromDiskCache });
          if (r.status >= 400 || !allowedResource(r.url, origin, embeddedImages)) error('network-response', r);
        }
      } catch (e) { interrupt('CDP event/recording failure: ' + e); }
    });
    ws.addEventListener('close', () => { socketClosed = true; for (const p of pending.values()) p.reject(Error('owned CDP closed')); pending.clear(); });
    ws.addEventListener('error', () => interrupt('owned CDP WebSocket error'));
    const connect = Date.now() + 10000;
    while (ws.readyState !== WebSocket.OPEN) { check(); assert(!socketClosed && Date.now() < connect, 'owned CDP connection timed out'); await delay(30); }
    const version = await call('Browser.getVersion');
    write('ownership.json', { build, origin, profile, ownedPid: chrome.pid, port, endpoint: ownedEndpoint.suffix, version, launchState: 'CONNECTED', reason: 'Native Chromium H264/rVFC/input evidence; parent applies current canonical browser workflow', osWindow: false, focusEmulation: false, profileCleanup: 'Parent only' });
    write('initial-owned-targets.json', await call('Target.getTargets'));
    for (camera of cameras) {
      check(); events = []; requests.clear();
      const { targetId } = await call('Target.createTarget', { url: 'about:blank', background: false });
      ({ sessionId: session } = await call('Target.attachToTarget', { targetId, flatten: true }));
      report.cameras.push({ camera, targetId, viewport: camera === 'desktop' ? [1657, 994] : [390, 844], transitions: [], idles: [], observerEventCounts: {}, status: 'RUNNING' }); save();
      for (const domain of ['Page', 'Runtime', 'Network', 'Media']) await call(domain + '.enable', {}, session);
      await call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, session);
      await call('Runtime.addBinding', { name: '__arenaEvidence' }, session);
      await call('Page.addScriptToEvaluateOnNewDocument', { source: `(${observe.toString()})()` }, session);
      await call('Emulation.setDeviceMetricsOverride', { width: camera === 'desktop' ? 1657 : 390, height: camera === 'desktop' ? 994 : 844, deviceScaleFactor: 1, mobile: camera === 'mobile' }, session);
      await call('Page.navigate', { url: origin + '/' }, session);
      const initial = await waitFor(s => arrived(s, 0), 'visible native initial app', 10000);
      report.cameras.at(-1).initial = initial; await shot('initial', s => arrived(s, 0));
      // Three-wrap proof occurs exactly once per idle/camera. Setup traversals
      // remain real native inputs and full films; they do not repeat cadence.
      for (const op of cameraPlan()) {
        if (op.kind === 'cadence') await idle(op.stop, op.label);
        else await travel(op.from, op.to, op.label, op.phaseTarget, op.kind);
      }
      report.cameras.at(-1).coverage = matrixSummary([report.cameras.at(-1)]);
      check(); report.cameras.at(-1).status = 'OBSERVED_PENDING_PARENT'; save();
      // Shutdown visibility/cancellation events are outside the observation window.
      session = undefined;
      await closeOwnedTarget(call, targetId, receipt => append('target-cleanup.jsonl', { camera, ...receipt }));
    }
    for (const [url, file] of files) { const original = path.join(build, url.slice(1)); noSymlinks(original); assert(sha(fs.readFileSync(original)) === file.sha256, 'build changed during native proof: ' + url); }
    check(); report.coverage = verifyMatrix(report.cameras);
    report.strictIntervalCaptures = report.coverage.strictSupplementaryFailures ? 'FAIL' : 'PASS';
    if (report.coverage.strictSupplementaryFailures) report.pending.push('Strict supplementary capture interval FAILs retained; parent must inspect, no waiver');
    report.buildStillMatchesSnapshot = true; report.status = 'OBSERVED_PENDING_PARENT'; save();
  } catch (e) {
    report.status = 'FAILED_PARTIAL'; report.failure = { error: String(e), stack: e.stack }; save(); process.exitCode = 1;
  } finally {
    clearTimeout(deadline); await cleanup(); process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
    report.coverage = matrixSummary(report.cameras);
    report.finished = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: report.status, report: path.join(out, 'report.json'), errors: report.errors.length, coverage: report.coverage ?? matrixSummary(report.cameras), strictIntervalCaptures: report.strictIntervalCaptures ?? 'INCOMPLETE', recordedCancellations: report.recordedCancellations.length, cleanup: report.cleanup, runtimeAcceptance: 'PARENT MUST VERIFY', artAcceptance: 'PENDING' }));
  }
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') await selfTest();
  else {
    assert(args.length === 2 || (args.length === 4 && args[2] === '--budget-json'), 'Usage: node verify_continuous_player.mjs <absolute-built-static-directory> <NEW-absolute-project-run-evidence-directory> [--budget-json <absolute-counters.json>] | --self-test');
    let budgets = { source: 'Task contract snapshot;1446 attempts/26051.22028904152s independently matched renders/ledger.json during implementation', currency: 'Historical carry-forward snapshot, NOT refreshed runtime accounting or additional authority; parent may supply current --budget-json', counters: carriedCounters };
    if (args[2]) {
      absolute(args[3]); noSymlinks(args[3]);
      const bytes = fs.readFileSync(args[3]);
      budgets = { source: args[3], sha256: sha(bytes), currency: 'Explicit parent input; bounds enforced, authority unchanged', counters: validateCounters(JSON.parse(bytes.toString('utf8'))) };
    }
    budgets.limits = { newNativeFrameAttempts: 1536, renderSeconds: 43200, newRenderEncodeBytes: 21474836480 };
    await run(args[0], args[1], budgets);
  }
} catch (error) { console.error(String(error)); process.exitCode = 1; }
