// Parent-run native cold-input evidence ONLY. No runtime/art acceptance verdict.
// node sketches/033-arena/scripts/verify_continuous_cold.mjs --self-test
// node sketches/033-arena/scripts/verify_continuous_cold.mjs <absolute-build> <NEW-absolute-report-folder> [--budget-json <absolute-counters.json>]
// Parent must apply the canonical browser workflow before native execution.
// Native Chrome/rVFC/trusted-input proof is the reason for the owned headless fallback.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';

const runRoot = '/Users/vitek/Documents/agent-runs/portfolio-2026';
const chromeBinary = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cameras = ['desktop', 'mobile'];
const caseNames = ['cold-forward-B', 'reverse-B-immediate-Next', 'cold-forward-E', 'first-decoded-frame-timeout'];
const titles = ['Hoang Viet To', 'GameOnVB', 'Goal Loop', 'Goal Loop', 'Screen Switch', 'Playground'];
const idles = [null, 'gameon-hold.mp4', 'goal-loop-hold.mp4', 'goal-loop-finished-hold.mp4', 'screen-switch-hold.mp4', null];
const carriedCounters = Object.freeze({
  new_scope_native_frames: 1446, new_scope_render_seconds: 26051.22028904152,
  previous_batch_native_frames: 488, previous_batch_render_seconds: 22592.483298040228,
  technical_episodes: 2, technical_verdict_attempts: 4, technical_fable_attempts: 0,
  previous_harness_repair_cycles: 2, new_scope_source_review_fix_cycles: 1,
  new_scope_normal_source_reviews: 6, new_scope_hardware_audits: 1,
  new_followup_verifier_repair_cycles: 2
});
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json' };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const inside = (base, value) => value.startsWith(base + path.sep);
function absolute(value) {
  assert(typeof value === 'string' && path.isAbsolute(value) && path.resolve(value) === value, 'canonical absolute path required');
  return value;
}
function noSymlinks(value) {
  let current = path.parse(value).root;
  for (const part of value.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'symlink traversal refused: ' + current);
  }
}
function absent(value) {
  try { fs.lstatSync(value); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  assert.fail('NEW evidence directory required, including no dangling symlink');
}
function locations(build, out) {
  absolute(build); absolute(out);
  assert(inside(runRoot, build) && inside(runRoot, out), 'paths must be under existing portfolio agent-runs root');
  assert(build !== out && !inside(build, out) && !inside(out, build), 'build/report must be disjoint');
  noSymlinks(build); noSymlinks(path.dirname(out));
  assert(fs.statSync(build).isDirectory() && fs.statSync(path.dirname(out)).isDirectory(), 'existing build and report parent required');
  absent(out);
}
function validateCounters(counters) {
  for (const [key, minimum] of Object.entries(carriedCounters)) {
    assert(Number.isFinite(counters?.[key]) && counters[key] >= minimum, 'missing/reset counter: ' + key);
    if (!key.endsWith('_seconds')) assert(Number.isSafeInteger(counters[key]), 'integer counter required: ' + key);
  }
  for (const key of ['previous_batch_native_frames', 'previous_batch_render_seconds', 'previous_harness_repair_cycles', 'technical_episodes']) assert(counters[key] === carriedCounters[key], 'closed historical counter changed');
  assert(counters.new_scope_native_frames <= 1536 && counters.new_scope_render_seconds <= 43200 && counters.technical_verdict_attempts <= 8, 'existing budget exceeded');
  return counters;
}
function requestFile(raw) {
  assert(typeof raw === 'string' && raw.length <= 4096 && raw.startsWith('/') && !raw.startsWith('//'), 'invalid request target');
  const decoded = decodeURIComponent(raw.split('?')[0]);
  assert(!/[\\\0#]/.test(decoded) && !decoded.split('/').some(p => p === '..' || p === '.'), 'unsafe request path');
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
function endpoint(value) {
  const lines = value.trim().split('\n'), port = Number(lines[0]);
  assert(lines.length === 2 && /^\d+$/.test(lines[0]) && Number.isInteger(port) && port > 0 && port <= 65535 && port !== 9223 && /^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(lines[1]), 'invalid/unowned endpoint');
  return { port, suffix: lines[1] };
}

// Parse the actual source, refusing drift instead of guessing timing constants.
function sourceBounds(source) {
  const decoded = source.match(/function decodedFrame\([\s\S]*?\n}\n/)?.[0];
  const move = source.match(/function move\(direction\)[\s\S]*?\n}\n/)?.[0];
  const waiting = source.match(/function waiting\(\)[\s\S]*?\n}\n/)?.[0];
  assert(decoded?.includes('requestVideoFrameCallback') && decoded.includes('cancelVideoFrameCallback') && decoded.includes('failed();'), 'actual native decoded-frame gate required');
  assert(move?.includes('armFilmFrame();') && move.includes('film.play()') && waiting, 'actual travel readiness chain required');
  const firstFrameDeadline = Number(decoded.match(/const timeout = setTimeout\([\s\S]*?},\s*(\d+)\);/)?.[1]);
  const copyFade = Number(move.match(/},\s*(\d+)\);\s*return true;/)?.[1]);
  const stallDeadline = Number(waiting.match(/setTimeout\([\s\S]*?},\s*(\d+)\);/)?.[1]);
  assert(firstFrameDeadline === 2000 && copyFade === 150 && stallDeadline === firstFrameDeadline, 'source contract changed; parent review required');
  return { firstFrameDeadline, copyFade, stallDeadline, inputToFirstExposure: copyFade + firstFrameDeadline };
}
// Built bundles can be minified. Identify the decoded-frame function by native
// APIs and the move function by its actual announcement, then read their timers.
function builtBounds(source) {
  const blocks = [];
  for (const match of source.matchAll(/function\s+[\w$]+\([^)]*\)\s*\{/g)) {
    let depth = 1, quote = '', escaped = false, i = match.index + match[0].length;
    const start = i;
    for (; i < source.length && depth; i++) {
      const c = source[i];
      if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; }
      else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    if (!depth) blocks.push(source.slice(start, i - 1));
  }
  const decoded = blocks.filter(s => s.includes('.cancelVideoFrameCallback(') && s.includes('.requestVideoFrameCallback(') && s.includes('.readyState') && s.includes('setTimeout('));
  const move = blocks.filter(s => s.includes('Moving to the ') && s.includes('Escape stops the film; Skip continues to the content.'));
  assert(decoded.length === 1 && move.length === 1, 'cannot uniquely identify built readiness/move functions; setup INVALID');
  const deadlines = [...decoded[0].matchAll(/},\s*(\d+(?:e[+-]?\d+)?)\s*\)/gi)].map(m => Number(m[1]));
  const fades = [...move[0].matchAll(/},\s*(\d+(?:e[+-]?\d+)?)\s*\)/gi)].map(m => Number(m[1]));
  assert(deadlines.length === 1 && fades.length === 1, 'ambiguous built timing bounds; setup INVALID');
  return { firstFrameDeadline: deadlines[0], copyFade: fades[0] };
}
function coldBuffer(video, url) {
  return video.src === url && (video.currentSrc === '' || video.currentSrc === url) && !video.error && video.readyState < 2 && video.buffered.length === 0;
}
function coldInputFacts(input, url, hold, requests = hold.records) {
  const at = input.state.wallNow;
  const records = requests.filter(r => r.url === url && r.startedAt >= hold.armedAt && r.startedAt <= at);
  const live = records.filter(r => r.method === 'GET' && r.held && (r.abortedAt === null || r.abortedAt > at) && (r.releasedAt === null || r.releasedAt > at));
  const noReleasedOrNonHeldResponseSinceArm = !records.some(r => !r.held || (r.releasedAt !== null && r.releasedAt <= at));
  const warm = input.state.film.readyState >= 2 || input.state.film.buffered.length > 0;
  return {
    mediaURL: url, inputWallNow: at, armedAt: hold.armedAt, disarmedAt: hold.disarmedAt,
    film: structuredClone(input.state.film), coldBufferAtInput: coldBuffer(input.state.film, url),
    preloadRequestLiveAtInput: live.length > 0, heldRequestIds: live.map(r => r.id),
    httpRecordsSinceArmAtInput: structuredClone(records), noReleasedOrNonHeldResponseSinceArm,
    classification: hold.name === 'reverse-B-immediate-Next' && input.state.film.src === url && warm && noReleasedOrNonHeldResponseSinceArm ? 'in-document media cache suspected, not proven' : null,
    httpObservation: 'Node request/abort/release observations; live does not guarantee browser consumption'
  };
}
function coldAtInput(input, url, hold, prevInput, requests = hold.records) {
  const facts = coldInputFacts(input, url, hold, requests);
  assert(input.type === 'input' && input.trusted && input.target === 'next', 'real trusted Next required');
  assert(facts.coldBufferAtInput, 'setup INVALID: trusted input already has current data/buffer or wrong source');
  assert(hold.url === url && hold.disarmedAt === null && hold.armedAt <= input.state.wallNow, 'setup INVALID: exact hold must remain armed at trusted input');
  if (hold.name === 'reverse-B-immediate-Next') {
    assert(prevInput?.type === 'input' && prevInput.trusted && prevInput.target === 'prev' && hold.armedAt <= prevInput.state.wallNow && prevInput.state.wallNow <= input.state.wallNow, 'setup INVALID: hold was not armed before trusted Prev');
    assert(facts.noReleasedOrNonHeldResponseSinceArm, 'setup INVALID: B response escaped hold since arm');
  } else assert(facts.preloadRequestLiveAtInput, 'setup INVALID: no real live held request at trusted input');
  return { ...facts, predicate: hold.name === 'reverse-B-immediate-Next' ? 'exact src, readyState<2, zero native buffered ranges AT trusted click; hold armed before Prev with no released/non-held response since arm; preload request may not yet exist' : 'exact src, readyState<2, zero native buffered ranges, real live HTTP hold AT trusted click', input };
}
function caseFailure(item, error) {
  item.status = String(error).includes('setup INVALID') ? 'INVALID_SETUP' : 'FAILED_OBSERVATION';
  item.failure = { error: String(error), stack: error.stack };
}
function checkErrors(report, item) {
  assert(!report.fatalErrors.length, 'infrastructure error: ' + JSON.stringify(report.fatalErrors.at(-1)));
  assert(!item?.errors?.length, 'runtime error: ' + JSON.stringify(item?.errors?.at(-1)));
}
function expectedFault(state, scope, bounds) {
  return Boolean(scope?.name === 'first-decoded-frame-timeout' && scope.inputNow !== null &&
    state.film.src === scope.url && !state.film.error && !state.ambient.error &&
    state.now - scope.inputNow >= bounds.inputToFirstExposure - 1 &&
    state.now - scope.inputNow <= bounds.inputToFirstExposure + 2500 &&
    /Media unavailable or stalled/.test(state.error.text));
}
function coverage(rows) {
  assert.deepEqual(rows.map(r => r.camera), cameras, 'missing/duplicate camera');
  for (const row of rows) {
    assert.deepEqual(row.cases.map(r => r.name), caseNames, 'missing/duplicate/reordered case');
    assert(row.cases.every(r => r.status === 'OBSERVED_PENDING_PARENT' && r.coldCondition && r.input?.trusted && r.http?.records?.some(h => h.held)), 'unobserved/missing cold native evidence');
  }
  return { cameras: rows.length, actualCases: rows.reduce((n, r) => n + r.cases.length, 0), expectedCases: 8 };
}

// Real HTTP response objects in production; EventEmitter fakes only in --self-test.
// Never resume a closed response. Aborted preloads remain in the same ledger.
function holdLedger(record, now = Date.now) {
  let next = 0, active = null;
  const requests = [];
  const emit = (event, receipt) => record({ event, at: now(), ...receipt });
  return {
    requests,
    arm(url, name) {
      assert(!active, 'overlapping hold refused');
      active = { url, name, armedAt: now(), disarmedAt: null, records: [] };
      emit('hold-armed', { url, name, armedAt: active.armedAt }); return active;
    },
    start(req, res, facts, send) {
      const receipt = { id: ++next, ...facts, startedAt: now(), held: active?.url === facts.url, releasedAt: null, abortedAt: null, finishedAt: null, sentAt: null };
      requests.push(receipt);
      const item = { receipt, res, send };
      if (receipt.held) { active.records.push(receipt); active.live ??= new Map(); active.live.set(receipt.id, item); }
      emit('request-start', receipt);
      const aborted = reason => {
        if (receipt.finishedAt !== null || receipt.abortedAt !== null) return;
        receipt.abortedAt = now(); receipt.abortReason = reason; emit('request-abort', receipt);
      };
      req.once('aborted', () => aborted('request-aborted'));
      req.once('error', error => {
        const expectedAbort = req.aborted && error.code === 'ECONNRESET';
        if (expectedAbort) aborted('request-aborted/ECONNRESET');
        emit('request-error', { ...receipt, error: String(error), expectedAbort });
      });
      res.once('close', () => { if (!res.writableFinished) aborted('response-close-before-finish'); });
      res.once('error', error => emit('response-error', { ...receipt, error: String(error) }));
      res.once('finish', () => { receipt.finishedAt = now(); emit('response-finish', receipt); });
      item.release = () => {
        if (receipt.abortedAt !== null || res.destroyed || res.writableEnded) { aborted('closed-before-release'); return false; }
        receipt.releasedAt = now(); receipt.sentAt = receipt.releasedAt; emit('response-release', receipt); send(); return true;
      };
      if (!receipt.held) item.release();
      else emit('response-held-before-headers', receipt);
      return receipt;
    },
    release(hold) {
      assert(active === hold && hold.disarmedAt === null, 'wrong/already-disarmed hold');
      hold.disarmedAt = now(); active = null; // New requests are now ordinary real file responses.
      let released = 0;
      for (const item of hold.live?.values() ?? []) if (item.release()) released++;
      emit('hold-disarmed', { url: hold.url, name: hold.name, released, disarmedAt: hold.disarmedAt });
      return released;
    },
    cancel(hold) {
      if (active === hold) { hold.disarmedAt = now(); active = null; }
      for (const item of hold.live?.values() ?? []) if (!item.res.destroyed && !item.res.writableEnded) item.res.destroy();
      emit('own-hold-cancel', { url: hold.url, name: hold.name });
    }
  };
}

// Passive native observer copied literally from the proven warm harness, with
// wall-clock correlation and stale frame invalidation on actual emptied events.
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
    if (!observerReady || !hero) return { now: performance.now(), wallNow: Date.now(), url: location.href, ready: false };
    const get = id => document.getElementById(id);
    const film = get('film'), ambient = get('ambient'), hold = get('gameon-hold'), peek = get('gameon-peek'), img = get('still').querySelector('img');
    const h = layer(hold), f = layer(film), a = layer(ambient), p = layer(peek), r = rect(hero);
    const video = v => ({ src: v.src, currentSrc: v.currentSrc, currentTime: v.currentTime, duration: Number.isFinite(v.duration) ? v.duration : null, paused: v.paused, ended: v.ended, seeking: v.seeking, loop: v.loop, readyState: v.readyState, buffered: Array.from({ length: v.buffered.length }, (_, i) => [v.buffered.start(i), v.buffered.end(i)]), muted: v.muted, defaultMuted: v.defaultMuted, playsInline: v.playsInline, width: v.videoWidth, height: v.videoHeight, error: v.error ? { code: v.error.code, message: v.error.message } : null, frame: last[v.id] ?? null });
    return {
      now: performance.now(), wallNow: Date.now(), ready: true, url: location.href, origin: location.origin, visibility: document.visibilityState, hidden: document.hidden, hasFocus: document.hasFocus(), focus: { id: document.activeElement?.id, tag: document.activeElement?.tagName, editable: Boolean(document.activeElement?.isContentEditable) },
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
      for (const event of ['loadstart', 'loadeddata', 'playing', 'waiting', 'stalled', 'seeking', 'seeked', 'ended', 'error', 'pause', 'emptied']) v.addEventListener(event, () => { if (event === 'emptied') delete last[v.id]; emit('media-event', { video: v.id, event }); });
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
  const source = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  const bounds = sourceBounds(source);
  equal(bounds, { firstFrameDeadline: 2000, copyFade: 150, stallDeadline: 2000, inputToFirstExposure: 2150 });
  equal(builtBounds(source), { firstFrameDeadline: 2000, copyFade: 150 });
  equal(builtBounds(source.replaceAll('2000', '2e3').replaceAll('\n', ' ')), { firstFrameDeadline: 2000, copyFade: 150 });
  rejects(() => sourceBounds(source.replace('},2000);', '},1999);')));
  rejects(() => sourceBounds(source.replace('}, 150);', '}, 151);')));
  rejects(() => sourceBounds(source.replace('if (eligible) failed();', 'if (eligible) ready();')));
  rejects(() => builtBounds('function f(){return 2000}'));
  rejects(() => builtBounds(source + source));
  const url = 'http://127.0.0.1:49152/media/desktop/segB.mp4';
  const film = { src: url, currentSrc: '', readyState: 0, buffered: [], error: null };
  equal(coldBuffer(film, url), true);
  equal(coldBuffer({ ...film, currentSrc: url, readyState: 1 }, url), true);
  for (const changes of [{ src: url + '?wrong' }, { currentSrc: url + '?wrong' }, { readyState: 2 }, { buffered: [[0, .01]] }, { error: { code: 3 } }]) equal(coldBuffer({ ...film, ...changes }, url), false);
  let now = 10;
  const trace = [], ledger = holdLedger(e => trace.push(e), () => now);
  const hold = ledger.arm(url, 'test');
  const fake = () => {
    const req = new EventEmitter(), res = new EventEmitter();
    Object.assign(res, { destroyed: false, writableEnded: false, writableFinished: false, sent: 0,
      destroy() { this.destroyed = true; this.emit('close'); } });
    const send = () => { res.sent++; res.writableEnded = res.writableFinished = true; res.emit('finish'); };
    return { req, res, send };
  };
  const a = fake(), b = fake();
  const ar = ledger.start(a.req, a.res, { url, method: 'GET', range: 'bytes=0-', start: 0, end: 9, status: 206 }, a.send);
  const br = ledger.start(b.req, b.res, { url, method: 'GET' }, b.send);
  equal(a.res.sent + b.res.sent, 0); equal(hold.records.length, 2);
  rejects(() => ledger.arm(url, 'overlap'));
  now = 11; a.req.emit('aborted'); a.res.destroy();
  a.req.aborted = true; a.req.emit('error', Object.assign(Error('aborted'), { code: 'ECONNRESET' }));
  equal(ar.abortedAt, 11); equal(ar.releasedAt, null);
  equal(trace.find(e => e.event === 'request-error').expectedAbort, true);
  const input = { type: 'input', trusted: true, target: 'next', state: { wallNow: 12, film } };
  equal(coldAtInput(input, url, hold).heldRequestIds, [br.id]);
  rejects(() => coldAtInput({ ...input, trusted: false }, url, hold));
  rejects(() => coldAtInput({ ...input, state: { ...input.state, film: { ...film, readyState: 4 } } }, url, hold));
  rejects(() => coldAtInput(input, url, { ...hold, records: [ar] }));
  now = 13; equal(ledger.release(hold), 1);
  equal(a.res.sent, 0); equal(b.res.sent, 1); equal(br.releasedAt, 13); equal(br.finishedAt, 13);
  equal(hold.disarmedAt, 13); rejects(() => ledger.release(hold));
  rejects(() => coldAtInput(input, url, hold));
  const c = fake(); ledger.start(c.req, c.res, { url, method: 'GET' }, c.send);
  equal(c.res.sent, 1); equal(hold.records.length, 2);
  const hold2 = ledger.arm(url, 'cancel'), d = fake();
  const dr = ledger.start(d.req, d.res, { url, method: 'GET' }, d.send);
  now = 14; ledger.cancel(hold2); equal(dr.abortedAt, 14); equal(d.res.sent, 0);
  equal(trace.filter(e => e.event === 'request-abort').length, 2);
  equal(trace.filter(e => e.event === 'response-held-before-headers').length, 3);
  const scope = { name: 'first-decoded-frame-timeout', url, inputNow: 100 };
  const state = { now: 2250, film: { src: url, error: null }, ambient: { error: null }, error: { text: 'Media unavailable or stalled. The last valid image is shown.' } };
  equal(expectedFault(state, scope, bounds), true);
  for (const value of [null, { ...scope, url: url + '?wrong' }, { ...scope, inputNow: 2000 }, { ...scope, name: 'cold-forward-B' }]) equal(expectedFault(state, value, bounds), false);
  equal(expectedFault({ ...state, film: { src: url, error: { code: 3 } } }, scope, bounds), false);
  equal(expectedFault({ ...state, ambient: { error: { code: 3 } } }, scope, bounds), false);
  equal(expectedFault({ ...state, error: { text: 'Different error' } }, scope, bounds), false);
  equal(expectedFault({ ...state, now: 9000 }, scope, bounds), false);
  const rows = cameras.map(camera => ({ camera, cases: caseNames.map(name => ({ name, status: 'OBSERVED_PENDING_PARENT', coldCondition: {}, input: { trusted: true }, http: { records: [{ held: true }] } })) }));
  equal(coverage(rows), { cameras: 2, actualCases: 8, expectedCases: 8 });
  rejects(() => coverage(rows.slice(1)));
  for (const mutate of [r => r[0].cases.pop(), r => r[0].cases.push(r[0].cases[0]), r => { r[0].cases[0].status = 'RUNNING'; }, r => { r[0].cases[0].coldCondition = null; }, r => { r[0].cases[0].http.records = []; }]) {
    const bad = structuredClone(rows); mutate(bad); rejects(() => coverage(bad));
  }
  equal(requestFile('/'), '/index.html'); equal(requestFile('/media/desktop/segB.mp4?q=1'), '/media/desktop/segB.mp4');
  for (const raw of ['/../a', '/%2e%2e/a', '/a/./b', '/%5cx', '/%00', '//foreign', 'http://foreign/', '/%zz']) rejects(() => requestFile(raw));
  equal(byteRange(undefined, 10), { start: 0, end: 9, status: 200 });
  for (const [value, start, end] of [['bytes=0-0', 0, 0], ['bytes=3-', 3, 9], ['bytes=-3', 7, 9], ['bytes=2-99', 2, 9]]) equal(byteRange(value, 10), { start, end, status: 206 });
  for (const raw of ['bytes=-0', 'bytes=10-', 'bytes=5-2', 'bytes=-', 'bytes=0-1,2-3', 'items=0-1', 'bytes=9007199254740992-']) rejects(() => byteRange(raw, 10));
  equal(endpoint('49152\n/devtools/browser/own-123\n'), { port: 49152, suffix: '/devtools/browser/own-123' });
  rejects(() => endpoint('9223\n/devtools/browser/shared')); rejects(() => endpoint('49152\n/devtools/page/foreign'));
  equal(validateCounters({ ...carriedCounters }), carriedCounters);
  rejects(() => validateCounters({ ...carriedCounters, new_scope_native_frames: 0 }));
  rejects(() => validateCounters({ ...carriedCounters, new_scope_native_frames: 1537 }));
  rejects(() => validateCounters({ ...carriedCounters, new_followup_verifier_repair_cycles: 0 }));
  const baselineChecks = checks;
  assert.equal(baselineChecks, 84);
  console.log(JSON.stringify({ status: 'OFFLINE_BASELINE_PASS', checks: baselineChecks }));
  const reverseHold = { url, name: 'reverse-B-immediate-Next', armedAt: 10, disarmedAt: null, records: [] };
  const prevInput = { type: 'input', trusted: true, target: 'prev', state: { wallNow: 11 } };
  equal(coldAtInput(input, url, reverseHold, prevInput).preloadRequestLiveAtInput, false);
  equal(coldAtInput(input, url, { ...reverseHold, records: [ar] }, prevInput).heldRequestIds, []);
  equal(coldAtInput(input, url, { ...reverseHold, records: [br] }, prevInput).preloadRequestLiveAtInput, true);
  for (const name of caseNames.filter(name => name !== reverseHold.name)) rejects(() => coldAtInput(input, url, { ...reverseHold, name }, prevInput));
  for (const changes of [{ readyState: 2 }, { buffered: [[0, .01]] }]) {
    const warm = { ...input, state: { ...input.state, film: { ...film, ...changes } } };
    rejects(() => coldAtInput(warm, url, reverseHold, prevInput));
    const facts = coldInputFacts(warm, url, reverseHold);
    equal(facts.classification, 'in-document media cache suspected, not proven');
    equal(facts.film.buffered, warm.state.film.buffered);
    equal(facts.film.readyState, warm.state.film.readyState);
  }
  rejects(() => coldAtInput(input, url, { ...reverseHold, disarmedAt: 11 }, prevInput));
  rejects(() => coldAtInput(input, url, { ...reverseHold, armedAt: 12 }, prevInput));
  rejects(() => coldAtInput(input, url, reverseHold));
  rejects(() => coldAtInput(input, url, reverseHold, { ...prevInput, trusted: false }));
  for (const record of [{ ...br, releasedAt: 11 }, { ...br, held: false, startedAt: 11, releasedAt: 11 }]) rejects(() => coldAtInput(input, url, reverseHold, prevInput, [record]));
  equal(coldInputFacts({ ...input, state: { ...input.state, film: { ...film, readyState: 2 } } }, url, reverseHold, [{ ...br, releasedAt: 11 }]).classification, null);
  equal(coldAtInput(input, url, reverseHold, prevInput, [{ ...br, held: false, startedAt: 9, releasedAt: 9 }]).preloadRequestLiveAtInput, false);
  const failureRows = structuredClone(rows), failedCase = failureRows[0].cases[1];
  const retainedError = { kind: 'javascript', details: 'offline failure accounting fixture' };
  const errorReport = { errors: [retainedError], fatalErrors: [] };
  failedCase.errors = [retainedError];
  rejects(() => checkErrors(errorReport, failedCase));
  caseFailure(failedCase, Error('setup INVALID: warm input'));
  equal(failedCase.status, 'INVALID_SETUP');
  equal(failedCase.failure.error, 'Error: setup INVALID: warm input');
  checkErrors(errorReport, { errors: [] }); checks++;
  equal(errorReport.errors, [retainedError]);
  rejects(() => coverage(failureRows));
  caseFailure(failedCase, Error('exposure absent'));
  equal(failedCase.status, 'FAILED_OBSERVATION');
  rejects(() => coverage(failureRows));
  rejects(() => checkErrors({ ...errorReport, fatalErrors: [retainedError] }, { errors: [] }));
  console.log(JSON.stringify({ status: 'OFFLINE_SELF_TEST_PASS', checks, baselineChecks, regressionChecks: checks - baselineChecks, serverStarted: false, browserStarted: false, nativeEvidenceFabricated: false }));
}

async function run(build, out, budgets) {
  locations(build, out);
  assert(typeof WebSocket === 'function', 'Node 22+ native WebSocket required');
  const sourcePath = new URL('../main.js', import.meta.url), sourceBytes = fs.readFileSync(sourcePath);
  const bounds = sourceBounds(sourceBytes.toString('utf8'));
  const files = new Map(); let total = 0;
  function load(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name); noSymlinks(file);
      if (entry.isDirectory()) load(file);
      else {
        assert(entry.isFile(), 'non-regular build entry');
        const type = mime[path.extname(file)]; assert(type, 'unsupported static MIME: ' + file);
        const bytes = fs.readFileSync(file); total += bytes.length;
        assert(total <= 1024 ** 3 && files.size < 2048, 'bounded build snapshot exceeded');
        files.set('/' + path.relative(build, file).split(path.sep).join('/'), { bytes, type, sha256: sha(bytes) });
      }
    }
  }
  load(build); assert(files.has('/index.html'), 'build index.html required');
  const compiledBounds = builtBounds([...files].filter(([url]) => url.endsWith('.js')).map(([, f]) => f.bytes.toString('utf8')).join('\n'));
  assert.deepEqual(compiledBounds, { firstFrameDeadline: bounds.firstFrameDeadline, copyFade: bounds.copyFade }, 'built timing differs from source');
  const html = files.get('/index.html').bytes.toString('utf8');
  const picture = html.match(/<picture id="still">([\s\S]*?)<\/picture>/)?.[1]; assert(picture, 'actual initial picture required');
  const firstPosters = { desktop: picture.match(/<img\s+src="([^"]+)"/)?.[1], mobile: picture.match(/<source\s+media="\(orientation: portrait\)"\s+srcset="([^"]+)"/)?.[1] };
  const embeddedImages = new Set([...html.matchAll(/src="(data:image\/png;base64,[A-Za-z0-9+/=]+)"/g)].map(m => m[1]));
  for (const image of embeddedImages) assert(sha(Buffer.from(image.split(',')[1], 'base64')) === files.get('/media/screen-switch-icon.png')?.sha256, 'unrecognized embedded image');
  for (const camera of cameras) {
    assert(firstPosters[camera]?.startsWith('./'), 'local initial poster required');
    assert(files.get(requestFile(firstPosters[camera].slice(1)))?.sha256 === files.get(`/media/${camera}/poster.webp`)?.sha256, 'initial/canonical poster mismatch');
  }
  fs.mkdirSync(out); // Atomic NEW folder: never overwrite a prior run.
  const profile = path.join(out, 'owned-headless-profile');
  const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
  const append = (name, value) => fs.appendFileSync(path.join(out, name), JSON.stringify(value) + '\n');
  const report = {
    task: 'portfolio033-cold-input-native-probe', status: 'RUNNING', build, out, started: new Date().toISOString(), budgets,
    renderUseThisRun: { nativeFrames: 0, renderSeconds: 0, renderAuthority: 0 },
    source: { path: sourcePath.pathname, sha256: sha(sourceBytes), bounds, compiledBounds },
    scope: 'Eight cold-input/readiness observations in owned ARM64 headless Chrome default context; desktop1657x994 and portrait390x844/DPR1 emulation. Reverse-B immediate Next starts at the first fully settled reverse arrival with decoded idle and peek, not the earliest enabled control. No art, physical phone, every-frame or smoothness claim.',
    safeguards: { sharedChrome9223: false, mediaSetters: false, scriptedClicks: false, focusVisibilityEmulation: false, screenshots: 0, cache: 'no-store plus browser cache disabled', preInput: 'Actual trusted capture event, not earlier admission poll', observer: 'Native rVFC plus actual styles/DOM, ~30ms layer observation; per-event overhead retained. Latency includes observation overhead; no relaxed 2150ms exposure bound.' },
    unchangedObjections: ['Four prior supplementary capture FAILs retained', 'Fourteen prior canceled local requests retained by parent; this run has its own cancellation list', 'Parent lifecycle/404/visual/final review/application remain separate'],
    httpObservation: 'releasedLiveResponses is a Node observation; an abort may not yet have arrived. It does not guarantee browser consumption; native exposed frames are separate evidence.',
    plannedCases: caseNames, cameras: [], errors: [], fatalErrors: [], recordedCancellations: [], expectedFaults: [], targetCleanup: [], cleanup: null
  };
  const save = () => write('report.json', report);
  write('build-manifest.json', { build, totalBytes: total, files: [...files].map(([url, f]) => ({ url, size: f.bytes.length, sha256: f.sha256, mime: f.type })) });
  save();
  let server, chrome, ws, port, serverPort, origin, session, camera, activeCase, faultScope, abort, spawnError, cleanupPromise;
  let events = [], sequence = 0, serverRequests = 0, socketClosed = false;
  const requests = new Map(), pending = new Map(), ownedTargets = new Set();
  const ledger = holdLedger(e => {
    append('http.jsonl', { camera, case: activeCase?.name, ...e });
    if (e.event === 'response-error' || (e.event === 'request-error' && !e.expectedAbort)) recordError('http-stream', e);
  });
  const caseErrorKinds = new Set(['observer', 'native-media/visibility', 'unexpected-ui-error', 'javascript', 'console-error', 'native-media']);
  const recordError = (kind, details) => {
    const error = { kind, camera, case: activeCase?.name, details };
    report.errors.push(error);
    if (activeCase && caseErrorKinds.has(kind)) activeCase.errors.push(error);
    else report.fatalErrors.push(error); // HTTP/control/ownership failures must stop the matrix.
    append('errors.jsonl', error);
  };
  const check = () => { if (abort) throw abort; checkErrors(report, activeCase); };
  const stopped = () => !chrome || spawnError || chrome.exitCode !== null || chrome.signalCode !== null;
  const interrupt = why => { abort ??= Error(why); for (const p of pending.values()) p.reject(abort); pending.clear(); };
  function call(method, params = {}, sid, timeout = 5000) {
    assert(method !== 'Page.captureScreenshot', 'no screenshots in cold probe');
    return new Promise((resolve, reject) => {
      const fail = error => reject(Object.assign(error, { fatal: true }));
      if (ws?.readyState !== WebSocket.OPEN) { fail(Error('owned CDP unavailable: ' + method)); return; }
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); fail(Error('CDP timeout: ' + method)); }, timeout);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: why => { clearTimeout(timer); fail(why); } });
      try { ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }
      catch (error) { clearTimeout(timer); pending.delete(id); fail(error); }
    });
  }
  async function snapshot() {
    check();
    const result = await call('Runtime.evaluate', { expression: 'window.__arenaProbeSnapshot?.()', returnByValue: true }, session);
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
  }
  const mediaURL = name => `${origin}/media/${camera}/${name}`;
  function valid(s) {
    if (!(s?.ready && s.url === origin + '/' && s.origin === origin)) throw Object.assign(Error('exact owned app required'), { fatal: true });
    assert(!s.hidden && s.visibility === 'visible' && s.hero.active && !s.reduced, 'native visible onstage normal-motion required');
    assert(!s.film.error && !s.ambient.error && (s.error.hidden || expectedFault(s, faultScope, bounds)), 'unexpected application/media error');
    assert(s.film.muted && s.ambient.muted && s.film.defaultMuted && s.ambient.defaultMuted && s.film.playsInline && s.ambient.playsInline, 'muted inline contract lost');
    assert(s.viewport.width === (camera === 'desktop' ? 1657 : 390) && s.viewport.height === (camera === 'desktop' ? 994 : 844) && s.viewport.dpr === 1 && s.viewport.portrait === (camera === 'mobile'), 'viewport/variant drift');
  }
  async function until(test, label, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (true) {
      check(); const s = await snapshot();
      if (s?.ready) { valid(s); if (test(s)) return s; }
      assert(Date.now() < deadline, 'observation timeout: ' + label); await delay(10);
    }
  }
  function arrived(s, stop, idleRequired = true, fullPeek = false) {
    if (!s?.ready || s.hero.moving || s.controls.next.disabled || s.controls.prev.disabled !== (stop === 0) || s.count !== `${String(stop + 1).padStart(2, '0')} / 06`) return false;
    const poster = mediaURL(stop ? `stop-${stop}.webp` : 'poster.webp');
    if (s.copies.length !== 1 || s.copies[0].stop !== stop || !s.copies[0].shown || s.copies[0].effectiveOpacity < .999 || !s.copies[0].text.includes(titles[stop])) return false;
    if (![poster, ...(stop === 0 ? [new URL(firstPosters[camera], origin + '/').href] : [])].includes(s.still.currentSrc) || !s.still.complete || !s.still.width || !s.still.shown || s.still.effectiveOpacity < .999 || s.film.layer.shown || Object.values(s.controls).some(b => !b.shown)) return false;
    if (idleRequired && idles[stop]) {
      const v = s.ambient, dimensions = camera === 'desktop' ? [3584, 2016] : [1800, 3200];
      if (!s.hold.background.includes(poster) || !v.exposed || v.paused || v.readyState < 1 || v.src !== mediaURL(idles[stop]) || v.currentSrc !== v.src || v.frame?.src !== v.src || v.frame.currentSrc !== v.src || v.width !== dimensions[0] || v.height !== dimensions[1] || v.duration !== (stop === 4 ? 4 : 2)) return false;
    }
    if ((!idleRequired || !idles[stop]) && (!s.hold.hidden || !s.ambient.paused)) return false;
    if (fullPeek && (s.peek.hidden || !s.peek.complete || !s.peek.width || s.peek.src !== mediaURL('gameon-peek.webp') || s.peek.effectiveOpacity < .999)) return false;
    return true;
  }
  function exposed(s, url) {
    const v = s?.film, dimensions = camera === 'desktop' ? [1600, 900] : [900, 1600];
    return Boolean(s?.ready && v.exposed && !v.paused && !v.seeking && v.readyState >= 2 && v.src === url && v.currentSrc === url && v.frame?.src === url && v.frame.currentSrc === url && s.now - v.frame.now < 150 && v.width === dimensions[0] && v.height === dimensions[1]);
  }
  async function press(id, observed) {
    const s = observed ?? await snapshot(); valid(s);
    const b = s.controls[id]; assert(b?.shown && !b.disabled, 'native button unavailable');
    const x = b.rect.x + b.rect.width / 2, y = b.rect.y + b.rect.height / 2;
    assert(x >= 0 && y >= 0 && x < s.viewport.width && y < s.viewport.height, 'button outside viewport');
    const start = events.length;
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x, y }, session);
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x, y }, session);
    await until(() => events.slice(start).some(e => e.type === 'input' && e.trusted && e.target === id), 'trusted ' + id, 1000);
    const input = events.slice(start).find(e => e.type === 'input' && e.trusted && e.target === id);
    valid(input.state); return input;
  }
  async function filmArrival(input, from, to, label, fullPeek = false) {
    const name = `seg${'ABCDE'[Math.min(from, to)]}${to < from ? '-reverse' : ''}.mp4`, url = mediaURL(name);
    assert(arrived(input.state, from), 'trusted departure lost actual settled chapter');
    await until(() => events.some(e => e.state.now >= input.state.now && exposed(e.state, url)), label + ' native decoded exposure', bounds.inputToFirstExposure + 500);
    const first = events.find(e => e.state.now >= input.state.now && exposed(e.state, url));
    const latency = first.state.now - input.state.now;
    if (label === activeCase.name) { activeCase.firstDecodedExposure = first; activeCase.firstExposureAfterInputMs = latency; }
    assert(latency <= bounds.inputToFirstExposure, 'unchanged source 2150ms exposure bound exceeded');
    await until(() => events.some(e => e.type === 'media-event' && e.video === 'film' && e.event === 'ended' && e.state.now > input.state.now && e.state.film.currentSrc === url), label + ' genuine film end', 25000);
    const ended = events.find(e => e.type === 'media-event' && e.video === 'film' && e.event === 'ended' && e.state.now > input.state.now && e.state.film.currentSrc === url);
    const destination = await until(s => arrived(s, to, true, fullPeek), label + ' decoded target/copy/idle', 2500);
    const firstSettled = events.find(e => e.state.now >= ended.state.now && arrived(e.state, to, true, fullPeek)) ?? { type: 'read-only-evaluation', state: destination };
    const frames = events.filter(e => e.type === 'frame' && e.video === 'film' && e.state.now >= input.state.now && e.state.now <= ended.state.now && exposed(e.state, url));
    assert(frames.length >= 3 && frames[0].frame.mediaTime <= 2 / 24 && frames.at(-1).frame.mediaTime >= ended.state.film.duration - 2 / 24 && frames.at(-1).frame.presentedFrames > frames[0].frame.presentedFrames, 'native film beginning/end/advancement absent');
    for (let i = 1; i < frames.length; i++) assert(frames[i].frame.mediaTime >= frames[i - 1].frame.mediaTime && frames[i].frame.presentedFrames > frames[i - 1].frame.presentedFrames, 'native callback order regressed');
    assert(firstSettled.state.now - ended.state.now <= bounds.firstFrameDeadline, 'arrival decoded-frame bound exceeded');
    return { mediaURL: url, input, firstDecodedExposure: first, firstExposureAfterInputMs: latency, ended, firstSettled, destination, exposedCallbacks: frames.length, frameSpan: [frames[0].frame, frames.at(-1).frame] };
  }
  async function navigate(from, to, label, fullPeek = false) {
    const departure = await until(s => arrived(s, from), label + ' departure');
    const input = await press(to < from ? 'prev' : 'next', departure);
    const result = await filmArrival(input, from, to, label, fullPeek);
    activeCase.setup.push({ label, ...result }); return result;
  }
  function arm(name) {
    const url = mediaURL(name), hold = ledger.arm(url, activeCase.name);
    activeCase.http = hold; activeCase.mediaURL = url; save(); return hold;
  }
  async function releaseAfterInput(hold, input) {
    // move() replaces src after its real copy fade; preserve the aborted old
    // preload and wait for the live replacement request, never for buffered data.
    await until(() => hold.records.some(r => r.startedAt >= input.state.wallNow + bounds.copyFade - 5 && r.abortedAt === null && r.releasedAt === null), 'real post-input replacement HTTP hold', 1000);
    activeCase.releaseAfterInputPageState = await snapshot();
    assert(coldBuffer(activeCase.releaseAfterInputPageState.film, hold.url), 'held media unexpectedly warmed before release');
    activeCase.releasedLiveResponses = ledger.release(hold); save();
    assert(activeCase.releasedLiveResponses > 0, 'no live held response released');
  }
  async function coldTravel(hold, from, to, initial, arrival) {
    const input = await press('next', initial); activeCase.input = input;
    activeCase.coldInputFacts = coldInputFacts(input, hold.url, hold, ledger.requests);
    activeCase.preloadRequestLiveAtInput = activeCase.coldInputFacts.preloadRequestLiveAtInput;
    if (arrival) {
      activeCase.immediateTimingScope = 'First fully settled reverse arrival with decoded idle and peek; earliest enabled Next is not covered';
      activeCase.firstObservedReverseArrival = arrival;
      activeCase.arrivalToInputMs = input.state.now - arrival.state.now;
    }
    save(); // Preserve actual warm/cold and HTTP facts even if admission fails.
    activeCase.coldCondition = coldAtInput(input, hold.url, hold, activeCase.reverseInput, ledger.requests);
    assert(arrived(input.state, from, true, activeCase.name === 'reverse-B-immediate-Next'), 'cold input lost actual departure');
    if (arrival) {
      assert(activeCase.arrivalToInputMs >= 0 && activeCase.arrivalToInputMs <= 250, 'setup INVALID: immediate Next exceeded bounded input/observer overhead');
    }
    save(); await releaseAfterInput(hold, input);
    activeCase.travel = await filmArrival(input, from, to, activeCase.name);
    const released = events.filter(e => e.state.now >= activeCase.travel.firstDecodedExposure.state.now + 200 && e.state.now < activeCase.travel.ended.state.now && exposed(e.state, hold.url));
    assert(released.length && released.every(e => e.state.hold.hidden && e.state.ambient.paused), 'hidden incoming hold/stale idle during actual cold travel');
    activeCase.status = 'OBSERVED_PENDING_PARENT'; save();
  }
  async function timeoutCase(hold, departure) {
    faultScope = { name: activeCase.name, url: hold.url, inputNow: null };
    const input = await press('next', departure); activeCase.input = input;
    assert(faultScope.inputNow === input.state.now, 'fault scope must start at actual input');
    activeCase.coldInputFacts = coldInputFacts(input, hold.url, hold, ledger.requests);
    activeCase.preloadRequestLiveAtInput = activeCase.coldInputFacts.preloadRequestLiveAtInput; save();
    activeCase.coldCondition = coldAtInput(input, hold.url, hold, undefined, ledger.requests); save();
    const fallback = await until(s => !s.error.hidden && arrived(s, 2, false), 'actual source readiness fallback and decoded target', bounds.inputToFirstExposure + 1000);
    const ui = events.find(e => e.state.now >= input.state.now && e.state.ready && !e.state.error.hidden);
    assert(ui && expectedFault(ui.state, faultScope, bounds), 'exact expected readiness error absent');
    const waitMs = ui.state.now - input.state.now;
    assert(waitMs >= bounds.inputToFirstExposure - 1 && waitMs <= bounds.inputToFirstExposure + 250, 'timeout did not wait actual 150+2000ms source gate within bounded observation overhead');
    assert(fallback.now - input.state.now <= bounds.inputToFirstExposure + 1000, 'decoded target poster exceeded fallback observation allowance');
    const loadstart = events.find(e => e.type === 'media-event' && e.video === 'film' && e.event === 'loadstart' && e.state.now > input.state.now && e.state.film.src === hold.url);
    assert(loadstart, 'actual native film loadstart required');
    assert(Math.abs(ui.state.now - loadstart.state.now - bounds.firstFrameDeadline) <= 250, 'native loadstart-to-timeout inconsistent with source two-second gate');
    assert(hold.disarmedAt === null && hold.records.some(r => r.startedAt >= input.state.wallNow + bounds.copyFade - 5 && r.releasedAt === null), 'readiness response must remain withheld across actual source gate');
    const frames = events.filter(e => e.type === 'frame' && e.video === 'film' && e.state.now >= input.state.now && e.state.now <= fallback.now && e.frame.currentSrc === hold.url);
    assert(!frames.length && !events.some(e => e.state.now >= input.state.now && e.state.now <= fallback.now && e.state.ready && exposed(e.state, hold.url)), 'decoded/exposed travel frame appeared despite withheld response');
    assert(fallback.still.currentSrc === mediaURL('stop-2.webp') && fallback.hold.hidden && fallback.ambient.paused && !fallback.film.layer.shown && fallback.copies[0].text.includes('Goal Loop'), 'false chapter/old image or stale hold at fallback');
    const failureStates = events.filter(e => e.state.ready && e.state.now >= input.state.now && e.state.now <= fallback.now);
    for (const { state } of failureStates) if (state.copies.some(c => c.stop === 2 && c.shown)) assert(state.still.currentSrc === mediaURL('stop-2.webp') && state.still.complete && state.still.width > 0, 'target chapter exposed over an old/undecoded image');
    activeCase.timeout = { actualUI: ui, actualFallback: fallback, actualLoadstart: loadstart, fullInputWaitMs: waitMs, loadstartToErrorMs: ui.state.now - loadstart.state.now, copyFade: bounds.copyFade, firstFrameDeadline: bounds.firstFrameDeadline, targetPosterDelayAfterErrorMs: fallback.now - ui.state.now, exposedOrDecodedTravelCallbacksBeforeTimeout: frames.length, heldAtTimeout: structuredClone(hold.records) };
    save();
    activeCase.releasedLiveResponses = ledger.release(hold); // May be zero after genuine browser abort; retain that fact.
    const afterRelease = await until(s => s.now >= fallback.now + 300, 'post-timeout stale-idle observation', 1000);
    assert(arrived(afterRelease, 2, false) && !afterRelease.error.hidden, 'releasing late bytes resurrected old hold or false film');
    assert(events.filter(e => e.state.ready && e.state.now >= fallback.now && e.state.now <= afterRelease.now).every(e => e.state.hold.hidden && e.state.ambient.paused && !e.state.film.layer.shown), 'transient stale hold/film after late response release');
    activeCase.timeout.afterLateResponseRelease = afterRelease;
    const recoveryInput = await press('next', afterRelease);
    assert(arrived(recoveryInput.state, 2, false), 'fallback controls not usable');
    faultScope = null;
    // filmArrival's normal departure includes live idle; timeout recovery owns a
    // deliberately static poster, so observe this genuine C separately.
    const url = mediaURL('segC.mp4');
    await until(() => events.some(e => e.state.now > recoveryInput.state.now && exposed(e.state, url)), 'native recovery C exposure', bounds.inputToFirstExposure + 500);
    const first = events.find(e => e.state.now > recoveryInput.state.now && exposed(e.state, url));
    assert(first.state.now - recoveryInput.state.now <= bounds.inputToFirstExposure && first.state.hold.hidden && first.state.ambient.paused, 'recovery delayed or stale previous idle resurrected');
    const recovered = await until(s => arrived(s, 3) && s.error.hidden, 'true recovered chapter3', 25000);
    const recoveryStates = events.filter(e => e.state.now >= recoveryInput.state.now && e.state.now < recovered.now && e.state.ready);
    assert(recoveryStates.every(e => !e.state.hold.shown || e.state.hold.background.includes(mediaURL('stop-3.webp'))), 'stale fallback idle resurrected during recovery');
    assert(events.some(e => e.type === 'media-event' && e.video === 'film' && e.event === 'ended' && e.state.now > recoveryInput.state.now && e.state.film.currentSrc === url), 'genuine C recovery end absent');
    activeCase.recovery = { mediaURL: url, input: recoveryInput, firstDecodedExposure: first, firstExposureAfterInputMs: first.state.now - recoveryInput.state.now, destination: recovered, staleIdleObservationStates: recoveryStates.length };
    activeCase.status = 'OBSERVED_PENDING_PARENT'; save();
  }
  async function closeTarget(targetId) {
    const receipt = { targetId, requestedAt: Date.now(), removed: false, observations: [] };
    report.targetCleanup.push(receipt);
    try {
      const fresh = await call('Target.getTargets');
      if (!fresh.targetInfos.some(t => t.targetId === targetId)) { receipt.removed = true; receipt.alreadyAbsent = true; ownedTargets.delete(targetId); return; }
      receipt.reply = await call('Target.closeTarget', { targetId }); assert(receipt.reply.success, 'owned target close rejected');
      const deadline = Date.now() + 5000;
      while (true) {
        const targets = await call('Target.getTargets');
        const present = targets.targetInfos.some(t => t.targetId === targetId);
        receipt.observations.push({ at: Date.now(), present });
        if (!present) { receipt.removed = true; ownedTargets.delete(targetId); break; }
        assert(Date.now() < deadline, 'owned target removal timeout'); await delay(20);
      }
    } catch (error) { receipt.error = String(error); throw error; }
    finally { append('target-cleanup.jsonl', receipt); save(); }
  }
  async function portClosed(number) {
    if (!number) return true;
    return new Promise(resolve => {
      const socket = net.createConnection({ host: '127.0.0.1', port: number }); let done = false;
      const finish = value => { if (done) return; done = true; socket.destroy(); resolve(value); };
      socket.setTimeout(500, () => finish(false)); socket.on('connect', () => finish(false)); socket.on('error', e => finish(e.code === 'ECONNREFUSED'));
    });
  }
  async function cleanup() {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const receipt = { ownedPid: chrome?.pid ?? null, ownedPort: port ?? null, ownedServerPort: serverPort ?? null, profile, profileRemoved: false, profileCleanup: 'Parent only after verified process/endpoint stop; retained diagnostic evidence', sharedBrowserTouched: false, actions: [] };
      session = undefined;
      try {
        if (ws?.readyState === WebSocket.OPEN) {
          for (const id of [...ownedTargets]) { try { await closeTarget(id); } catch (error) { (receipt.targetErrors ??= []).push(String(error)); } }
          if (!stopped()) { receipt.actions.push('Browser.close on newly owned profile endpoint'); try { await call('Browser.close', {}, undefined, 2000); } catch (error) { receipt.closeReplyError = String(error); } }
        }
        try { ws?.close(); } catch (error) { receipt.socketCloseError = String(error); }
        for (const signal of ['SIGTERM', 'SIGKILL']) {
          if (stopped()) break;
          receipt.actions.push({ signal, ownedPid: chrome.pid }); chrome.kill(signal);
          const until = Date.now() + 3000; while (!stopped() && Date.now() < until) await delay(50);
        }
        receipt.ownedProcessStopped = Boolean(stopped());
        const until = Date.now() + 3000;
        do { receipt.ownedEndpointStopped = await portClosed(port); if (receipt.ownedEndpointStopped) break; await delay(50); } while (Date.now() < until);
      } catch (error) { receipt.processError = String(error); }
      try {
        if (activeCase?.http?.disarmedAt === null) ledger.cancel(activeCase.http);
        if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        receipt.ownedServerStopped = !server?.listening && await portClosed(serverPort);
      } catch (error) { receipt.serverError = String(error); }
      receipt.allCreatedTargetsVerifiedRemoved = ownedTargets.size === 0 && report.targetCleanup.every(t => t.removed);
      report.cleanup = receipt; write('cleanup.json', receipt);
      if (!receipt.ownedProcessStopped || !receipt.ownedEndpointStopped || !receipt.ownedServerStopped || !receipt.allCreatedTargetsVerifiedRemoved || receipt.targetErrors || receipt.processError || receipt.serverError) { report.status = 'FAILED_CLEANUP'; process.exitCode = 1; }
    })(); return cleanupPromise;
  }
  function readback() {
    const names = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const name = path.join(dir, entry.name); noSymlinks(name);
        if (entry.isDirectory()) walk(name);
        else {
          assert(entry.isFile(), 'build acquired non-regular file');
          const url = '/' + path.relative(build, name).split(path.sep).join('/'); names.push(url);
          assert(files.has(url) && sha(fs.readFileSync(name)) === files.get(url).sha256, 'build bytes changed: ' + url);
        }
      }
    };
    walk(build); assert.deepEqual(names.sort(), [...files.keys()].sort(), 'build file set changed');
    assert(sha(fs.readFileSync(sourcePath)) === sha(sourceBytes), 'repository source changed during probe');
    report.buildStillMatchesSnapshot = true; report.sourceStillMatchesSnapshot = true;
    write('build-readback.json', { observedAt: new Date().toISOString(), files: names.map(url => ({ url, sha256: files.get(url).sha256 })), sourceSha256: sha(sourceBytes), unchanged: true });
  }
  const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  const wallClockBound = 12 * 60000;
  report.controllerWallClockMs = wallClockBound;
  const deadline = setTimeout(() => interrupt('12-minute native cold observation bound exceeded'), wallClockBound);
  try {
    server = http.createServer((req, res) => {
      try {
        assert(++serverRequests <= 5000 && req.headers.host === new URL(origin).host && ['GET', 'HEAD'].includes(req.method), 'unowned request/method/bound');
        const file = requestFile(req.url), f = files.get(file);
        if (file === '/favicon.ico' && !f) { res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end(); return; }
        assert(f, 'missing static file: ' + file);
        let range;
        try { range = byteRange(req.headers.range, f.bytes.length); }
        catch { res.writeHead(416, { 'Content-Range': `bytes */${f.bytes.length}`, 'Cache-Control': 'no-store' }); res.end(); recordError('http-range', { file, range: req.headers.range }); return; }
        const { start, end, status } = range;
        const headers = { 'Content-Type': f.type, 'Accept-Ranges': 'bytes', 'Content-Length': Math.max(0, end - start + 1), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
        if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${f.bytes.length}`;
        ledger.start(req, res, { url: origin + req.url, file, method: req.method, range: req.headers.range ?? null, status, start, end, headers, sha256: f.sha256, case: activeCase?.name, camera }, () => {
          res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : f.bytes.subarray(start, end + 1));
        });
      } catch (error) { if (!res.headersSent) res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end(); recordError('http', { url: req.url, error: String(error) }); }
    });
    server.requestTimeout = 30000; server.headersTimeout = 10000; server.keepAliveTimeout = 1000;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    serverPort = server.address().port; origin = `http://127.0.0.1:${serverPort}`;
    fs.mkdirSync(profile);
    write('ownership.json', { build, origin, profile, launch: 'PLANNED', reason: 'Required Chromium H264/native rVFC/trusted CDP input proof; parent applies canonical workflow. No shared browser or OS window.' });
    const log = fs.openSync(path.join(out, 'chrome.log'), 'wx');
    try {
      chrome = spawn('/usr/bin/arch', ['-arm64', chromeBinary, '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-default-apps', '--disable-background-networking', '--disable-component-update', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', 'about:blank'], { stdio: ['ignore', log, log] });
      chrome.on('error', error => { spawnError = error; interrupt('owned Chrome spawn failed: ' + error); });
    } finally { fs.closeSync(log); }
    const portFile = path.join(profile, 'DevToolsActivePort'), startup = Date.now() + 20000;
    while (!fs.existsSync(portFile)) { check(); assert(!stopped() && Date.now() < startup, 'owned Chrome startup failed'); await delay(50); }
    noSymlinks(portFile); const ownEndpoint = endpoint(fs.readFileSync(portFile, 'utf8')); port = ownEndpoint.port;
    ws = new WebSocket(`ws://127.0.0.1:${port}${ownEndpoint.suffix}`);
    ws.addEventListener('message', event => {
      try {
        const m = JSON.parse(event.data);
        if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
        if (m.method === 'Fetch.requestPaused') {
          const allowed = m.params.request.url.startsWith(origin + '/') || embeddedImages.has(m.params.request.url);
          if (!allowed) recordError('external-request-blocked', m.params.request.url);
          void call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: m.params.requestId, ...(!allowed ? { errorReason: 'BlockedByClient' } : {}) }, m.sessionId).catch(error => recordError('fetch-control', String(error)));
        }
        if (!session || m.sessionId !== session) return;
        if (m.method === 'Runtime.bindingCalled' && m.params.name === '__arenaEvidence') {
          const e = JSON.parse(m.params.payload); events.push(e);
          append(`${camera}-${activeCase.name}-native-trace.jsonl`, e);
          if (e.type === 'input' && e.trusted && e.target === 'next' && faultScope?.inputNow === null) faultScope.inputNow = e.state.now;
          if (e.type === 'observer-error') recordError('observer', e);
          if (e.state.ready) {
            if (e.state.film.error || e.state.ambient.error || e.state.hidden) recordError('native-media/visibility', e);
            if (!e.state.error.hidden) {
              if (expectedFault(e.state, faultScope, bounds)) {
                report.expectedFaults.push({ camera, case: activeCase.name, mediaURL: faultScope.url, pageNow: e.state.now, classification: 'Exact source first-frame timeout UI only; JS/media/network errors remain hard errors' });
              } else recordError('unexpected-ui-error', e);
            }
          }
        } else if (m.method === 'Runtime.exceptionThrown') recordError('javascript', m.params);
        else if (m.method === 'Runtime.consoleAPICalled') {
          append('console.jsonl', { camera, case: activeCase.name, ...m.params });
          if (m.params.type === 'error') recordError('console-error', m.params);
        } else if (m.method?.startsWith('Media.')) {
          append('media.jsonl', { camera, case: activeCase.name, method: m.method, ...m.params });
          if (m.method === 'Media.playerErrorsRaised' && m.params.errors.length) recordError('native-media', m.params);
        } else if (m.method === 'Network.requestWillBeSent') {
          requests.set(m.params.requestId, m.params.request.url);
          append('network.jsonl', { camera, case: activeCase.name, method: m.method, ...m.params });
        } else if (m.method === 'Network.loadingFailed') {
          const url = requests.get(m.params.requestId), knownVideo = [...'ABCDE'].flatMap(c => [`seg${c}.mp4`, `seg${c}-reverse.mp4`]).concat(idles.filter(Boolean)).some(name => url === mediaURL(name));
          const receipt = { camera, case: activeCase.name, url, method: m.method, ...m.params };
          append('network.jsonl', receipt);
          if (knownVideo && m.params.canceled && m.params.errorText === 'net::ERR_ABORTED') report.recordedCancellations.push({ ...receipt, heldRequestIds: activeCase.http?.records.filter(r => r.url === url).map(r => r.id) ?? [], classification: 'Native known local video cancellation retained, never decode evidence or a waived HTTP/media error' });
          else recordError('network', receipt);
        } else if (m.method === 'Network.responseReceived') {
          const r = m.params.response; append('network.jsonl', { camera, case: activeCase.name, method: m.method, url: r.url, status: r.status, fromDiskCache: r.fromDiskCache, fromServiceWorker: r.fromServiceWorker, mimeType: r.mimeType });
          if (r.status >= 400 || !(r.url.startsWith(origin + '/') || embeddedImages.has(r.url)) || r.fromDiskCache || r.fromServiceWorker) recordError('network-response/cache', r);
        }
      } catch (error) { interrupt('CDP recording failed: ' + error); }
    });
    ws.addEventListener('close', () => { socketClosed = true; for (const p of pending.values()) p.reject(Error('owned CDP closed')); pending.clear(); });
    ws.addEventListener('error', () => interrupt('owned CDP WebSocket error'));
    const connect = Date.now() + 10000;
    while (ws.readyState !== WebSocket.OPEN) { check(); assert(!socketClosed && Date.now() < connect, 'owned CDP connection timeout'); await delay(20); }
    write('ownership.json', { build, origin, profile, ownedPid: chrome.pid, port, endpoint: ownEndpoint.suffix, version: await call('Browser.getVersion'), nativeArchitecture: 'ARM64', launch: 'CONNECTED', defaultContext: true, osWindow: false, focusVisibilityEmulation: false, sharedPort9223: false, reason: 'Native Chromium H264/rVFC/trusted-input proof', profileCleanup: 'Parent after verified shutdown' });
    write('initial-owned-targets.json', await call('Target.getTargets'));
    for (camera of cameras) {
      const row = { camera, viewport: camera === 'desktop' ? [1657, 994] : [390, 844], cases: [] }; report.cameras.push(row);
      for (const name of caseNames) {
        check(); events = []; requests.clear(); faultScope = null;
        activeCase = { name, status: 'RUNNING', setup: [], errors: [], screenshots: 0, trace: { file: `${camera}-${name}-native-trace.jsonl`, events: 0 } }; row.cases.push(activeCase); save();
        let targetId;
        try {
          ({ targetId } = await call('Target.createTarget', { url: 'about:blank', background: false })); ownedTargets.add(targetId); activeCase.targetId = targetId;
          ({ sessionId: session } = await call('Target.attachToTarget', { targetId, flatten: true }));
          for (const domain of ['Page', 'Runtime', 'Network', 'Media']) await call(domain + '.enable', {}, session);
          await call('Network.setCacheDisabled', { cacheDisabled: true }, session);
          await call('Network.setBypassServiceWorker', { bypass: true }, session);
          await call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, session);
          await call('Runtime.addBinding', { name: '__arenaEvidence' }, session);
          await call('Page.addScriptToEvaluateOnNewDocument', { source: `(${observe.toString()})()` }, session);
          await call('Emulation.setDeviceMetricsOverride', { width: row.viewport[0], height: row.viewport[1], deviceScaleFactor: 1, mobile: camera === 'mobile' }, session);
          await call('Page.navigate', { url: origin + '/' }, session);
          activeCase.initial = await until(s => arrived(s, 0), 'initial decoded native app');
          let hold;
          if (name === 'cold-forward-B' || name === 'first-decoded-frame-timeout') {
            assert(!ledger.requests.some(r => r.url === mediaURL('segB.mp4') && r.case === name && r.camera === camera), 'setup INVALID: B request preceded chapter0 arm');
            hold = arm('segB.mp4');
            await navigate(0, 1, 'actual-A-before-held-B');
            const departure = await until(s => arrived(s, 1) && hold.records.some(r => r.held && r.abortedAt === null), 'settled GameOn with real unbuffered held B');
            assert(coldBuffer(departure.film, hold.url), 'setup INVALID: B preload already completed');
            if (name === 'first-decoded-frame-timeout') await timeoutCase(hold, departure);
            else await coldTravel(hold, 1, 2, departure);
          } else if (name === 'reverse-B-immediate-Next') {
            await navigate(0, 1, 'setup-A'); await navigate(1, 2, 'genuine-forward-B-before-reverse');
            hold = arm('segB.mp4'); // Before trusted Prev2->1, never after arrival.
            const reverse = await navigate(2, 1, 'genuine-reverse-B', true);
            activeCase.reverseInput = reverse.input;
            await coldTravel(hold, 1, 2, reverse.destination, reverse.firstSettled);
          } else {
            await navigate(0, 1, 'setup-A'); await navigate(1, 2, 'setup-B');
            assert(!ledger.requests.some(r => r.url === mediaURL('segE.mp4') && r.case === name && r.camera === camera), 'setup INVALID: E request preceded arm');
            hold = arm('segE.mp4'); // Before both actual C and D; office4 cannot preload early.
            await navigate(2, 3, 'actual-C'); await navigate(3, 4, 'actual-D-to-office4s');
            const departure = await until(s => arrived(s, 4) && hold.records.some(r => r.held && r.abortedAt === null), 'office4s and real unbuffered held E');
            assert(departure.ambient.duration === 4 && coldBuffer(departure.film, hold.url), 'setup INVALID: not real four-second office/cold E');
            await coldTravel(hold, 4, 5, departure);
          }
          check(); save();
        } catch (error) {
          caseFailure(activeCase, error);
          activeCase.trace.events = events.length; save(); // Original failure is durable before any cleanup can fail.
          if (error.fatal || abort || report.fatalErrors.length) throw error;
        } finally {
          let cleanupError;
          try { if (activeCase.http?.disarmedAt === null) ledger.cancel(activeCase.http); }
          catch (error) { cleanupError = error; activeCase.holdCleanupFailure = String(error); }
          session = undefined; faultScope = null;
          try { if (targetId) await closeTarget(targetId); }
          catch (error) { cleanupError ??= error; activeCase.targetCleanupFailure = String(error); }
          if (activeCase.status === 'OBSERVED_PENDING_PARENT' && activeCase.errors.length) caseFailure(activeCase, Error('late case runtime error: ' + JSON.stringify(activeCase.errors.at(-1))));
          activeCase.trace.events = events.length; save();
          activeCase = undefined; // Reset only local admission state; report.errors and case evidence remain intact.
          if (cleanupError) throw cleanupError;
        }
      }
      row.status = row.cases.every(c => c.status === 'OBSERVED_PENDING_PARENT') ? 'OBSERVED_PENDING_PARENT' : 'FAILED_PARTIAL'; save();
    }
    check(); report.coverage = coverage(report.cameras); report.status = 'OBSERVED_PENDING_PARENT';
  } catch (error) { report.status = 'FAILED_PARTIAL'; report.failure = { error: String(error), stack: error.stack }; process.exitCode = 1; }
  finally {
    clearTimeout(deadline); await cleanup(); process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
    try { readback(); } catch (error) { report.buildStillMatchesSnapshot = false; report.readbackFailure = String(error); report.status = 'FAILED_READBACK'; process.exitCode = 1; }
    if (report.status === 'OBSERVED_PENDING_PARENT' && (report.errors.length || abort)) { report.status = 'FAILED_PARTIAL'; report.failure ??= { error: String(abort ?? 'Late runtime/cleanup error recorded') }; process.exitCode = 1; }
    report.actualCounts = { cameras: report.cameras.length, cases: report.cameras.reduce((n, r) => n + r.cases.length, 0), observedCases: report.cameras.flatMap(r => r.cases).filter(c => c.status === 'OBSERVED_PENDING_PARENT').length, expectedCases: 8 };
    report.finished = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: report.status, report: path.join(out, 'report.json'), actualCounts: report.actualCounts, hardErrors: report.errors.length, recordedCancellations: report.recordedCancellations.length, cleanup: report.cleanup, runtimeAcceptance: 'PARENT MUST VERIFY', artAndPhysicalPhoneAcceptance: 'NOT CLAIMED' }));
  }
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') await selfTest();
  else {
    assert(args.length === 2 || (args.length === 4 && args[2] === '--budget-json'), 'Usage: node verify_continuous_cold.mjs <absolute-build> <NEW-absolute-report-folder-under-portfolio-agent-runs> [--budget-json <absolute-counters.json>] | --self-test');
    let budgets = { source: 'Immutable task contract carry-forward, matched runtime-budget-counters-02.json during implementation', currency: 'Honest historical snapshot; no fresh render accounting or additional authority', counters: validateCounters({ ...carriedCounters }) };
    if (args[2]) {
      absolute(args[3]); noSymlinks(args[3]); const bytes = fs.readFileSync(args[3]);
      budgets = { source: args[3], sha256: sha(bytes), currency: 'Explicit parent input; authority and total budgets unchanged', counters: validateCounters(JSON.parse(bytes.toString('utf8'))) };
    }
    budgets.limits = { newNativeFrameAttempts: 1536, renderSeconds: 43200, newRenderEncodeBytes: 21474836480, renderAuthorityThisProbe: 0 };
    await run(args[0], args[1], budgets);
  }
} catch (error) { console.error(String(error)); process.exitCode = 1; }
