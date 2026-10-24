import { buildVitekPath, nearestInWindow, pointAt, LOOP, type Vec2 } from './wirePath'
import { canRegrab, checkStep, easeAngle, nextLoopTarget, wandTiltFor, wandAt } from './wireRules'
import type { Mode } from './wireScore'

export interface WireRuntimeHud {
  onProgress(percent: number): void
  onFail(): void
  onFinish(timeMs: number): void
  onHold(holding: boolean): void
}
export interface WireRuntime { setMode(m: Mode): void; setSound(on: boolean): void; restart(): void; destroy(): void }
export function attachWireInput(target: EventTarget, handlers: Record<string, (e: Event) => void>): () => void {
  for (const [name, handler] of Object.entries(handlers)) target.addEventListener(name, handler)
  return () => { for (const [name, handler] of Object.entries(handlers)) target.removeEventListener(name, handler) }
}

export function wireFraming(width: number, height: number, active: boolean, insets: { top: number; bottom: number }) {
  const fullScale = Math.min((width - 64) / 16.1, (height - 130) / 7.3)
  const follow = fullScale * LOOP.outerRadius * 2 < 44
  const overview = follow && !active
  if (!overview) return { follow, overview, scale: follow ? 56 / (LOOP.outerRadius * 2) : fullScale, centerY: 2.6 }
  // Conservative camera-plane bounds around (7.7, 2.6): route, posts and letter marks.
  // Reserve 40px at each side, 34px above for captions, 12px below for marks, plus 8px clearance.
  const top = insets.top + 42, bottom = insets.bottom + 22
  const scale = Math.max(0.1, Math.min((width - 80) / 16.1, (height - top - bottom) / 8.2))
  const upY = Math.hypot(2.2, 17) / Math.hypot(2.2, 3.7, 17)
  return { follow, overview, scale, centerY: 2.6 + (top - bottom) / (2 * scale * upY) }
}

export function createWireRuntime(three: any, opts: { host: HTMLElement; reducedMotion: boolean; hud: WireRuntimeHud; onFirstFrame(): void }): WireRuntime {
  const { host, reducedMotion, hud, onFirstFrame } = opts
  const path = buildVitekPath()
  const scene = new three.Scene()
  scene.background = new three.Color('#f2efe6')
  const camera = new three.OrthographicCamera(-9, 9, 5, -5, 0.1, 100)
  camera.position.set(10, 6, 17)
  camera.lookAt(8, 2, 0)
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: false })
  renderer.outputColorSpace = three.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = three.PCFShadowMap
  const canvas = renderer.domElement as HTMLCanvasElement
  canvas.setAttribute('aria-label', 'VITEK hot wire game')
  canvas.setAttribute('tabindex', '0')
  canvas.setAttribute('role', 'application')
  canvas.setAttribute('aria-describedby', 'wire-instructions')
  host.appendChild(canvas)
  const flash = document.createElement('div')
  flash.className = 'wire-flash'
  flash.setAttribute('aria-hidden', 'true')
  host.appendChild(flash)
  const ink = new three.MeshStandardMaterial({ color: '#090909', metalness: 0.67, roughness: 0.27 })
  const lime = new three.MeshStandardMaterial({ color: '#d9ff43', emissive: '#719000', emissiveIntensity: 0.15, metalness: 0.22, roughness: 0.3 })
  const postMat = new three.MeshStandardMaterial({ color: '#141414', metalness: 0.35, roughness: 0.42 })
  const paperMat = new three.MeshBasicMaterial({ color: '#f2efe6' })
  const shadowMat = new three.ShadowMaterial({ color: '#242015', opacity: 0.18 })
  const disposable: any[] = []
  const add = (geometry: any, material: any, x = 0, y = 0, z = 0) => {
    const mesh = new three.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    disposable.push(geometry)
    return mesh
  }
  const pts = path.points.filter((_, i) => i % 4 === 0 || i === path.points.length - 1)
    .map((p) => new three.Vector3(p.x, p.y, 0))
  add(new three.TubeGeometry(new three.CatmullRomCurve3(pts, false, 'centripetal'), Math.max(400, pts.length * 2), LOOP.wireRadius, 8, false), ink)
  for (const [a, b] of path.hazards) {
    const v = [new three.Vector3(a.x, a.y, 0), new three.Vector3(b.x, b.y, 0)]
    add(new three.TubeGeometry(new three.LineCurve3(v[0], v[1]), 8, LOOP.wireRadius, 8, false), ink)
  }
  const base = new three.PlaneGeometry(40, 20)
  const floor = add(base, paperMat, 8, 2, -0.32)
  floor.castShadow = false
  const shadowFloor = add(new three.PlaneGeometry(40, 20), shadowMat, 8, 2, -0.31)
  shadowFloor.castShadow = false
  const ambient = new three.AmbientLight('#ffffff', 0.85)
  scene.add(ambient)
  const light = new three.DirectionalLight('#ffffff', 1.5)
  light.position.set(2, 8, 11)
  light.castShadow = true
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.camera.left = -12; light.shadow.camera.right = 26
  light.shadow.camera.top = 12; light.shadow.camera.bottom = -8
  light.shadow.bias = -0.0003
  light.shadow.radius = 3
  scene.add(light)
  for (const p of [path.start, path.finish]) {
    add(new three.CylinderGeometry(0.11, 0.16, 0.6, 16), postMat, p.x, p.y, 0.16).rotation.x = Math.PI / 2
    add(new three.SphereGeometry(0.12, 12, 8), lime, p.x, p.y, 0.48)
  }
  const loop = add(new three.TorusGeometry(0.26, 0.035, 12, 64), lime, path.start.x, path.start.y, 0)
  loop.castShadow = false; loop.receiveShadow = false
  const wand = add(new three.CylinderGeometry(0.065, 0.075, 1, 12), ink)
  const grip = add(new three.CylinderGeometry(0.105, 0.105, 0.4, 16), lime)
  const collar = add(new three.SphereGeometry(0.075, 12, 8), ink)
  for (const part of [wand, grip, collar]) { part.castShadow = false; part.receiveShadow = false }
  const captionStyle = 'position:absolute;z-index:2;pointer-events:none;font-weight:700;font-family:system-ui;line-height:1;letter-spacing:.2em;color:#090909'
  const labels = [document.createElement('span'), document.createElement('span')]
  labels[0].textContent = 'START'; labels[1].textContent = 'FINISH'
  for (const el of labels) { el.className = 'wire-end-label'; el.style.cssText = captionStyle; host.appendChild(el) }
  const letterMarks = [...'VITEK'].map((letter) => {
    const el = document.createElement('span')
    el.textContent = letter
    el.style.cssText = captionStyle + ';font-size:12px;opacity:.55'
    host.appendChild(el)
    return el
  })
  let width = 1, height = 1, scale = 70, centerX = 7.7, cameraVelocity = 0
  let centerY = 2.6, verticalVelocity = 0, scaleVelocity = 0
  let insets = { top: 0, bottom: 0 }, canFollow = false
  let mode: Mode = 'easy', sound = true, status: 'idle' | 'holding' | 'paused' | 'frozen' | 'finished' = 'idle'
  let pose: Vec2 = path.start, s = 0, maxS = 0
  let theta = Math.atan2(pointAt(path, 0).tangent.y, pointAt(path, 0).tangent.x)
  let wandTilt = wandTiltFor(theta)
  let primary: number | null = null
  let owner: 'pointer' | 'keyboard' | null = null
  const keys = new Set<string>()
  const pointers = new Map<number, Vec2>()
  let started = false, startedAt = 0, pauseAt = 0, pausedMs = 0
  let freezeUntil = 0, lastTick = -1, raf = 0, destroyed = false, firstFrame = false
  let lastFrame = performance.now(), firstFrames = 0, frameSum = 0
  let lastMoveAt = performance.now()
  let audio: AudioContext | null = null
  const worldToScreen = (p: Vec2 & { z?: number }): Vec2 => {
    const v = new three.Vector3(p.x, p.y, p.z ?? 0).project(camera)
    const rect = canvas.getBoundingClientRect()
    return { x: rect.left + (v.x + 1) * rect.width / 2, y: rect.top + (1 - v.y) * rect.height / 2 }
  }
  const screenToWorld = (x: number, y: number): Vec2 => {
    const rect = canvas.getBoundingClientRect()
    const ndc = new three.Vector3((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2, 0)
    const ray = new three.Raycaster()
    ray.setFromCamera(new three.Vector2(ndc.x, ndc.y), camera)
    const v = new three.Vector3()
    ray.ray.intersectPlane(new three.Plane(new three.Vector3(0, 0, 1), 0), v)
    return { x: v.x, y: v.y }
  }
  function frameCamera(dt = 0, immediate = false) {
    const framing = wireFraming(width, height, status === 'holding' || status === 'paused', insets)
    const follow = framing.follow && !framing.overview
    const desired = follow ? pose.x : 7.7
    const deadZone = follow ? 0.35 : 0
    const goal = Math.max(1.5, Math.min(13.8, desired - Math.max(-deadZone, Math.min(deadZone, desired - centerX))))
    if (immediate || reducedMotion) {
      centerX = goal; centerY = framing.centerY; scale = framing.scale
      cameraVelocity = 0; verticalVelocity = 0; scaleVelocity = 0
    }
    else {
      const omega = 9, decay = Math.exp(-omega * dt / 1000)
      const distance = centerX - goal, step = (cameraVelocity + omega * distance) * dt / 1000
      centerX = goal + (distance + step) * decay
      cameraVelocity = (cameraVelocity - omega * step) * decay
      const verticalDistance = centerY - framing.centerY, verticalStep = (verticalVelocity + omega * verticalDistance) * dt / 1000
      centerY = framing.centerY + (verticalDistance + verticalStep) * decay
      verticalVelocity = (verticalVelocity - omega * verticalStep) * decay
      const scaleDistance = scale - framing.scale, scaleStep = (scaleVelocity + omega * scaleDistance) * dt / 1000
      scale = framing.scale + (scaleDistance + scaleStep) * decay
      scaleVelocity = (scaleVelocity - omega * scaleStep) * decay
    }
    camera.position.set(centerX + 2.2, 6.3 + (centerY - 2.6), 17)
    camera.lookAt(centerX, centerY, 0)
    camera.left = -width / scale / 2; camera.right = width / scale / 2
    camera.top = height / scale / 2; camera.bottom = -height / scale / 2
    camera.updateProjectionMatrix()
  }
  function resize() {
    const previousWidth = width, previousHeight = height
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight)
    const rect = host.getBoundingClientRect()
    insets = {
      top: Math.max(0, (hudElement?.getBoundingClientRect().bottom ?? rect.top) - rect.top),
      bottom: Math.max(0, rect.bottom - (footerElement?.getBoundingClientRect().top ?? rect.bottom)),
    }
    canFollow = wireFraming(width, height, false, insets).follow
    frameCamera(0, width !== previousWidth || height !== previousHeight)
    renderer.setSize(width, height, false)
  }
  const hudElement = host.parentElement?.querySelector('.wire-hud')
  const footerElement = host.parentElement?.querySelector('.wire-footer')
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  if (hudElement) observer.observe(hudElement)
  if (footerElement) observer.observe(footerElement)
  resize()
  function wandWorld() { return wandAt(pose, wandTilt, 0.26 * (mode === 'hard' ? 0.7 : 1)) }
  function reset() {
    status = 'idle'; pose = path.start; s = 0; maxS = 0
    theta = Math.atan2(pointAt(path, 0).tangent.y, pointAt(path, 0).tangent.x)
    wandTilt = wandTiltFor(theta)
    loop.scale.setScalar(mode === 'hard' ? 0.7 : 1)
    started = false; startedAt = 0; pausedMs = 0; primary = null; owner = null; keys.clear()
    pointers.clear(); lastTick = -1
    frameCamera(); hud.onProgress(0); hud.onHold(false)
  }
  function tone(freq: number, duration: number, kind: OscillatorType, gainValue: number, endFreq = freq) {
    if (!sound || !audio) return
    const osc = audio.createOscillator(), gain = audio.createGain()
    osc.type = kind; osc.frequency.setValueAtTime(freq, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(endFreq, audio.currentTime + duration)
    gain.gain.setValueAtTime(gainValue, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
    osc.connect(gain).connect(audio.destination)
    osc.start(); osc.stop(audio.currentTime + duration)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }
  function fail() {
    status = 'frozen'; freezeUntil = performance.now() + 600
    primary = null; owner = null; pointers.clear(); keys.clear()
    hud.onHold(false); hud.onFail()
    flash.classList.remove('active'); void flash.offsetWidth; flash.classList.add('active')
    tone(220, 0.18, 'square', 0.13, 180)
  }
  function pause() {
    if (status !== 'holding') return
    if (mode === 'hard') { fail(); return }
    status = 'paused'; pauseAt = performance.now(); primary = null; owner = null
    pointers.clear(); keys.clear(); hud.onHold(false)
  }
  function applyMove(previous: Vec2, next: Vec2) {
    if (status !== 'holding') return
    const now = performance.now()
    const target = nextLoopTarget(pose, screenToWorld(previous.x, previous.y), screenToWorld(next.x, next.y))
    const n = nearestInWindow(path, target, s, 3 * LOOP.outerRadius)
    const nextTheta = easeAngle(theta, Math.atan2(n.tangent.y, n.tangent.x), Math.min(100, now - lastMoveAt), mode === 'hard' ? 140 : 80)
    lastMoveAt = now
    const result = checkStep(path, pose, target, theta, nextTheta, s, maxS, mode === 'hard' ? LOOP.innerRadius * 0.7 : LOOP.innerRadius)
    if (!result.ok) { fail(); return }
    if (!started && Math.hypot(target.x - pose.x, target.y - pose.y) > 0.001) {
      started = true; startedAt = performance.now()
    }
    pose = target; theta = nextTheta; s = result.s; maxS = result.maxS
    const percent = Math.min(100, Math.round(maxS / path.length * 100))
    hud.onProgress(percent)
    const tick = Math.floor(percent / 10)
    if (tick > lastTick && tick > 0 && tick < 10) { lastTick = tick; tone(680, 0.055, 'sine', 0.018) }
    if (result.finished) {
      owner = null; primary = null; pointers.clear(); keys.clear()
      status = 'finished'; hud.onHold(false); hud.onProgress(100)
      tone(523, 0.22, 'sine', 0.09); setTimeout(() => { if (!destroyed) tone(784, 0.32, 'sine', 0.1) }, 120)
      hud.onFinish(performance.now() - startedAt - pausedMs)
    }
  }
  function onDown(event: Event) {
    const e = event as PointerEvent
    if (status !== 'idle' && status !== 'paused') return
    if (!canRegrab(worldToScreen(wandWorld().grip), { x: e.clientX, y: e.clientY })) return
    primary = e.pointerId; pointers.set(primary, { x: e.clientX, y: e.clientY })
    owner = 'pointer'; keys.clear()
    canvas.focus({ preventScroll: true })
    lastMoveAt = performance.now()
    const fromOverview = status === 'idle'
    if (status === 'paused' && started) pausedMs += performance.now() - pauseAt
    status = 'holding'; hud.onHold(true)
    // Leave the overview before the first move so finger precision matches today's game; a paused regrab keeps its spring.
    if (fromOverview) frameCamera(0, true)
    enableAudio()
    try { canvas.setPointerCapture(e.pointerId) } catch { /* synthetic input */ }
  }
  function onMove(event: Event) {
    const e = event as PointerEvent
    if (owner !== 'pointer' || !pointers.has(e.pointerId)) return
    const next = { x: e.clientX, y: e.clientY }
    const previous = pointers.get(e.pointerId)!
    pointers.set(e.pointerId, next)
    if (e.pointerId === primary) applyMove(previous, next)
  }
  function onUp(event: Event) {
    const e = event as PointerEvent
    pointers.delete(e.pointerId)
    if (e.pointerId === primary) pause()
  }
  function enableAudio() {
    if (!sound) return
    if (!audio && typeof AudioContext !== 'undefined') audio = new AudioContext()
    void audio?.resume()
  }
  function onKey(event: Event) {
    const e = event as KeyboardEvent
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape', 'r', 'R'].includes(e.key)) return
    e.preventDefault()
    if (e.repeat) return
    if (e.key === 'r' || e.key === 'R') { reset(); return }
    if (owner === 'pointer') return
    if (e.key === 'Escape') { pause(); return }
    if (e.key === ' ' || e.key === 'Enter') {
      if (status === 'holding') { pause(); return }
      if (status !== 'idle' && status !== 'paused') return
      const fromOverview = status === 'idle'
      if (status === 'paused' && started) pausedMs += performance.now() - pauseAt
      owner = 'keyboard'; keys.clear(); status = 'holding'; lastMoveAt = performance.now()
      hud.onHold(true)
      if (fromOverview) frameCamera(0, true)
      enableAudio()
      return
    }
    if (owner === 'keyboard' && status === 'holding') keys.add(e.key)
  }
  function keyboardMove(dt: number) {
    if (owner !== 'keyboard' || status !== 'holding') return
    const dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))
    const dy = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'))
    const length = Math.hypot(dx, dy)
    if (!length) return
    const previous = worldToScreen(pose), step = .7 * scale * dt / 1000 / length
    applyMove(previous, { x: previous.x + dx * step, y: previous.y + dy * step })
  }
  const detachCanvas = attachWireInput(canvas, {
    pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onUp,
    pointerleave: (e) => { if ((e as PointerEvent).pointerId === primary) pause() },
    keydown: onKey, keyup: (e) => { keys.delete((e as KeyboardEvent).key) },
    blur: () => { keys.clear(); pause() },
  })
  function drawWand(dt: number) {
    loop.position.set(pose.x, pose.y, 0)
    loop.quaternion.setFromUnitVectors(new three.Vector3(0, 0, 1), new three.Vector3(Math.cos(theta), Math.sin(theta), 0))
    wandTilt += (wandTiltFor(theta) - wandTilt) * (1 - Math.exp(-dt / 110))
    const { collar: attach, grip: handle } = wandWorld()
    const direction = new three.Vector3(handle.x - attach.x, handle.y - attach.y, handle.z - attach.z)
    const rotation = new three.Quaternion().setFromUnitVectors(new three.Vector3(0, 1, 0), direction.clone().normalize())
    wand.position.set((attach.x + handle.x) / 2, (attach.y + handle.y) / 2, (attach.z + handle.z) / 2)
    wand.scale.y = direction.length()
    wand.quaternion.copy(rotation)
    grip.position.set(handle.x, handle.y, handle.z); grip.quaternion.copy(rotation)
    collar.position.set(attach.x, attach.y, attach.z)
    const starts = worldToScreen(path.start), ends = worldToScreen(path.finish)
    const rect = host.getBoundingClientRect()
    for (const [i, p] of [starts, ends].entries()) {
      // Desktop keeps its original caption offsets; phone captions are centered and kept clear of the HUD and footer.
      const top = p.y - rect.top - 34
      labels[i].style.left = `${p.x - rect.left - (canFollow ? labels[i].offsetWidth / 2 : i ? 24 : 18)}px`
      labels[i].style.top = `${canFollow ? Math.max(insets.top + 8, Math.min(height - insets.bottom - 8 - labels[i].offsetHeight, top)) : top}px`
    }
    for (const [i, x] of [1.5, 3.7, 5.5, 8.8, 13].entries()) {
      const q = worldToScreen({ x, y: -1 })
      letterMarks[i].style.left = `${q.x - host.getBoundingClientRect().left}px`
      letterMarks[i].style.top = `${q.y - host.getBoundingClientRect().top}px`
    }
  }
  function frame(now: number) {
    if (destroyed || document.hidden) return
    const dt = Math.min(50, Math.max(0, now - lastFrame)); lastFrame = now
    if (status === 'frozen' && now >= freezeUntil) reset()
    keyboardMove(dt)
    frameCamera(dt)
    drawWand(dt)
    if (status === 'frozen' && !reducedMotion) camera.position.x += Math.sin(now * 0.14) * 0.035
    renderer.render(scene, camera)
    if (!firstFrame) { firstFrame = true; onFirstFrame() }
    if (++firstFrames <= 30) {
      frameSum += dt
      if (firstFrames === 30 && frameSum / 30 > 22) {
        renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; light.castShadow = false
        renderer.setSize(width, height, false)
      }
    }
    raf = requestAnimationFrame(frame)
  }
  function visibility() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; pause() }
    else { lastFrame = performance.now(); if (!raf) raf = requestAnimationFrame(frame) }
  }
  document.addEventListener('visibilitychange', visibility)
  reset()
  raf = requestAnimationFrame(frame)
  if (import.meta.env.DEV) {
    (window as typeof window & { __wireDebug?: unknown }).__wireDebug = {
      worldToScreen, pointAt: (distance: number) => pointAt(path, distance).p, pathLength: path.length,
      get pose() { return { ...pose } }, get grip() { return worldToScreen(wandWorld().grip) }, get centerX() { return centerX },
    }
  }
  return {
    setMode(m) { mode = m; reset() },
    setSound(on) { sound = on },
    restart: reset,
    destroy() {
      if (destroyed) return
      destroyed = true; keys.clear(); pointers.clear(); owner = null; cancelAnimationFrame(raf)
      detachCanvas(); observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      for (const geometry of disposable) geometry.dispose()
      ink.dispose(); lime.dispose(); postMat.dispose(); paperMat.dispose(); shadowMat.dispose()
      renderer.dispose(); renderer.forceContextLoss()
      canvas.remove(); flash.remove(); for (const el of [...labels, ...letterMarks]) el.remove()
      if (import.meta.env.DEV) delete (window as typeof window & { __wireDebug?: unknown }).__wireDebug
      void audio?.close()
    },
  }
}
