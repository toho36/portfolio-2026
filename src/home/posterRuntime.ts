import { buildVitekPath } from '../playground/wirePath'
import { CMS_BLOCKS, CMS_DURATION, GOAL_DURATION, sampleCmsBlock, sampleGoalLoop } from './posterTimelines'

export interface PosterRuntime {
  setActive(index: number): void
  setBend(amount: number): void
  setPointer(x: number, y: number): void
  destroy(): void
}

interface Piece {
  mesh: any
  material: any
  delay: number
  motion: 'rise' | 'draw' | 'fade'
  alpha: number
}

interface PosterScene { scene: any; pieces: Piece[]; played: boolean; started: number }

const INK = '#0b0b0b'
const DURATION = 1100
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const ease = (t: number) => 1 - (1 - t) ** 4

export function serveArc(t: number) {
  return { x: -2.1 + 3.45 * t, y: 1.3 - 1.02 * t + 15.6 * t * (1 - t), z: 10.2 - 13.6 * t }
}

export function createPosterRuntime(three: any, opts: {
  host: HTMLElement
  slots: HTMLElement[]
  accents: string[]
  reducedMotion: boolean
  onFirstFrame(): void
}): PosterRuntime {
  const renderer = new three.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(INK, 0)
  renderer.autoClear = false
  renderer.setScissorTest(true)
  const canvas = renderer.domElement as HTMLCanvasElement
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1' })
  canvas.setAttribute('aria-hidden', 'true')
  opts.host.appendChild(canvas)

  const camera = new three.OrthographicCamera(-4, 4, 2.5, -2.5, 0.1, 20)
  camera.position.z = 10
  // Perspective twin of `camera` so pointer tilt reads as depth, not a squash.
  const tiltCamera = new three.PerspectiveCamera(30, 1, .1, 100)
  const scenes: PosterScene[] = opts.slots.map(() => ({ scene: new three.Scene(), pieces: [], played: false, started: -1 }))
  const goalOverlay = opts.slots[3]?.querySelector?.<HTMLElement>('.goal-pipeline')
  const goalStages = goalOverlay?.querySelectorAll<HTMLElement>('.goal-stage')
  let dpr = Math.min(window.devicePixelRatio || 1, 2)
  let destroyed = false, raf = 0, bend = 0, targetBend = 0, lastBendInput = 0
  let px = 0, py = 0, targetPx = 0, targetPy = 0
  let frameCount = 0, frameTotal = 0, previousFrame = 0, firstFrame = false

  function material(hex: string, alpha: number) {
    return new three.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uColor: { value: new three.Color(hex).convertLinearToSRGB() }, uOpacity: { value: alpha }, uBend: { value: 0 } },
      vertexShader: `uniform float uBend;
        void main() {
          vec3 p = position;
          p.x += uBend * sin((p.y + 2.5) * 0.62831853) * 1.25;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity;
        void main() {
          gl_FragColor = vec4(uColor, uOpacity);
        }`,
    })
  }

  function mesh(index: number, vertices: number[], hex: string, alpha: number, delay = 0, motion: Piece['motion'] = 'fade') {
    const geometry = new three.BufferGeometry()
    geometry.setAttribute('position', new three.Float32BufferAttribute(vertices, 3))
    const mat = material(hex, alpha)
    const object = new three.Mesh(geometry, mat)
    object.frustumCulled = false
    scenes[index].scene.add(object)
    scenes[index].pieces.push({ mesh: object, material: mat, delay, motion, alpha })
    return object
  }

  function fill(index: number, x: number, y: number, w: number, h: number, hex: string, alpha: number, delay = 0, motion: Piece['motion'] = 'fade') {
    return mesh(index, [x,y,0, x+w,y,0, x+w,y+h,0, x,y,0, x+w,y+h,0, x,y+h,0], hex, alpha, delay, motion)
  }

  function stroke(index: number, points: readonly (readonly [number, number])[], width: number, hex: string, alpha = 1, delay = 0, motion: Piece['motion'] = 'draw') {
    const v: number[] = []
    for (let i = 1; i < points.length; i++) {
      const [x1,y1] = points[i-1], [x2,y2] = points[i]
      const length = Math.hypot(x2-x1, y2-y1) || 1
      const nx = -(y2-y1) * width / length / 2, ny = (x2-x1) * width / length / 2
      v.push(x1+nx,y1+ny,0, x1-nx,y1-ny,0, x2+nx,y2+ny,0,
        x1-nx,y1-ny,0, x2-nx,y2-ny,0, x2+nx,y2+ny,0)
    }
    return mesh(index, v, hex, alpha, delay, motion)
  }

  const accent = (i: number) => opts.accents[i] || '#f2efe6'
  // Regulation 9 × 18 m court, viewed from just above the near baseline.
  const court = new three.Group()
  scenes[1].scene.add(court)
  const courtCamera = new three.OrthographicCamera(-8, 8, 6, -6, .1, 80)
  courtCamera.position.set(6.5, 10, 21)
  courtCamera.lookAt(0, .6, 0)
  const owned: any[] = []
  const add = (geometry: any, mat: any, x = 0, y = 0, z = 0) => {
    const object = new three.Mesh(geometry, mat)
    object.position.set(x, y, z)
    court.add(object)
    owned.push(geometry, mat)
    return object
  }
  const orange = new three.MeshBasicMaterial({ color: '#ff5a24', side: three.DoubleSide })
  const paper = new three.MeshBasicMaterial({ color: '#f2efe6' })
  const meshInk = new three.MeshBasicMaterial({ color: '#f2efe6', transparent: true, opacity: .18, depthWrite: false })
  const floor = add(new three.PlaneGeometry(9, 18), new three.MeshLambertMaterial({ color: '#141110', side: three.DoubleSide }), 0, -.035, 0)
  floor.rotation.x = -Math.PI / 2
  const vignette = add(new three.PlaneGeometry(9, 18), new three.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float edge=smoothstep(.28,.76,length((vUv-.5)*vec2(1.15,1.))); gl_FragColor=vec4(0.,0.,0.,edge*.6); }',
  }), 0, -.026, 0)
  vignette.rotation.x = -Math.PI / 2
  scenes[1].scene.add(new three.AmbientLight('#fff2e7', .55))
  const light = new three.DirectionalLight('#fff2e7', 1.2)
  light.position.set(-5, 9, 6)
  scenes[1].scene.add(light)
  const mark = (x: number, z: number, w: number, d: number) => {
    const line = add(new three.PlaneGeometry(w, d), orange, x, .004, z)
    line.rotation.x = -Math.PI / 2
  }
  mark(-4.5, 0, .055, 18); mark(4.5, 0, .055, 18)
  mark(0, -9, 9, .055); mark(0, 9, 9, .055)
  mark(0, 0, 9, .065); mark(0, -3, 9, .045); mark(0, 3, 9, .045)
  for (const x of [-4.7, 4.7]) add(new three.CylinderGeometry(.045, .055, 2.8, 8), paper, x, 1.4, 0)
  add(new three.BoxGeometry(9.35, .09, .035), paper, 0, 2.43, 0)
  add(new three.BoxGeometry(9.25, .025, .02), meshInk, 0, .95, 0)
  for (let x = -4.4; x <= 4.4; x += .22) add(new three.BoxGeometry(.009, 1.4, .008), meshInk, x, 1.69, 0)
  for (let y = 1.05; y < 2.4; y += .18) add(new three.BoxGeometry(9.2, .009, .008), meshInk, 0, y, 0)
  for (const x of [-4.46, 4.46]) for (let stripe = 0; stripe < 8; stripe++) {
    const mat = stripe % 2 ? orange : paper
    add(new three.CylinderGeometry(.013, .013, .1, 6), mat, x, 2.48 + stripe * .1, 0)
  }
  const texture = new three.TextureLoader().load('/assets/gameonvb-ball.png', () => request())
  texture.magFilter = texture.minFilter = three.NearestFilter
  texture.colorSpace = three.SRGBColorSpace
  const ballMaterial = new three.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const ball = new three.Sprite(ballMaterial)
  ball.scale.set(1.05, 1.05, 1)
  court.add(ball)
  const shadowMaterial = new three.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uOpacity: { value: .3 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; uniform float uOpacity; void main(){ float a=1.-smoothstep(.05,.5,length(vUv-.5)); gl_FragColor=vec4(0.,0.,0.,a*uOpacity); }',
  })
  const shadow = add(new three.CircleGeometry(.7, 32), shadowMaterial)
  shadow.rotation.x = -Math.PI / 2
  const trailPoints = Array.from({ length: 65 }, (_, i) => serveArc(i / 64))
  const trailGeometry = new three.BufferGeometry().setFromPoints(trailPoints.map(p => new three.Vector3(p.x, p.y, p.z)))
  const trailMaterial = new three.LineBasicMaterial({ color: '#f2efe6', transparent: true, opacity: .25, depthWrite: false })
  const trail = new three.Line(trailGeometry, trailMaterial)
  court.add(trail)
  owned.push(trailGeometry, trailMaterial, ballMaterial, shadowMaterial, texture)
  const rippleMaterial = new three.MeshBasicMaterial({ color: '#ff5a24', transparent: true, opacity: 0, side: three.DoubleSide, depthWrite: false })
  const ripple = add(new three.RingGeometry(.34, .38, 48), rippleMaterial, 1.35, .012, -3.4)
  ripple.rotation.x = -Math.PI / 2
  function updateCourt(age: number) {
    const t = opts.reducedMotion ? 1 : clamp(age / 1180, 0, 1)
    const p = serveArc(t)
    ball.position.set(p.x, p.y, p.z)
    ballMaterial.rotation = t < 1 ? t * Math.PI * 1.25 : Math.PI * 1.25
    shadow.position.set(p.x, .014, p.z)
    const height = p.y - .28
    shadow.scale.setScalar(1 - Math.min(height / 7, .62))
    shadowMaterial.uniforms.uOpacity.value = .3 * (1 - Math.min(height / 5, .85))
    trailGeometry.setDrawRange(0, Math.max(2, Math.ceil(t * 65)))
    trailMaterial.opacity = t === 1 ? .25 : .75
    const impact = opts.reducedMotion ? 1 : clamp((age - 1180) / 220, 0, 1)
    rippleMaterial.opacity = t === 1 && impact < 1 ? .75 * (1 - impact) : 0
    ripple.scale.setScalar(1 + impact * 1.3)
    court.rotation.y = bend * .35 + px * .06
    court.rotation.x = py * .03
  }

  let drawOrder = 0
  function graphic(parent: any, geometry: any, hex: string, opacity = 1, additive = false) {
    const mat = new three.MeshBasicMaterial({ color: hex, transparent: true, opacity, depthTest: false, depthWrite: false, side: three.DoubleSide, blending: additive ? three.AdditiveBlending : three.NormalBlending })
    const object = new three.Mesh(geometry, mat)
    object.renderOrder = ++drawOrder
    parent.add(object)
    owned.push(geometry, mat)
    return object
  }
  function panel(parent: any, x: number, y: number, w: number, h: number, hex: string, opacity = 1) {
    const object = graphic(parent, new three.PlaneGeometry(w, h), hex, opacity)
    object.position.set(x + w / 2, y + h / 2, 0)
    return object
  }
  function label(parent: any, value: string, x: number, y: number, w: number, h: number, hex: string) {
    if (typeof document.createElement !== 'function') return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const font = 'bold 96px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.font = font
    canvas.width = Math.ceil(ctx.measureText(value).width) + 16; canvas.height = 160
    // Keep the glyph aspect ratio; right-align inside the requested box.
    const width = Math.min(w, h * canvas.width / canvas.height)
    x += (w - width) / 2; w = width
    ctx.font = font
    ctx.fillStyle = hex
    ctx.textBaseline = 'middle'
    ctx.fillText(value, 8, 84)
    const texture = new three.CanvasTexture(canvas)
    texture.colorSpace = three.SRGBColorSpace
    const mat = new three.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
    const sprite = new three.Sprite(mat)
    sprite.position.set(x, y, .02)
    sprite.scale.set(w, h, 1)
    sprite.renderOrder = ++drawOrder
    parent.add(sprite)
    owned.push(texture, mat)
    return sprite
  }

  // A page is assembled from outside the frame, then published in its status row.
  const cms = new three.Group()
  scenes[2].scene.add(cms)
  const frameWidth = 5.56, frameHeight = 3.56
  const frameBottom = -frameHeight / 2, statusHeight = frameHeight * .11
  const statusBarLeft = -frameWidth / 2 + .18, statusBarWidth = frameWidth - .36
  panel(cms, -2.85, -1.85, 5.7, 3.7, '#657084', .17)
  panel(cms, -frameWidth / 2, frameBottom, frameWidth, frameHeight, '#f2efe6')
  panel(cms, -frameWidth / 2, frameHeight / 2 - .35, frameWidth, .35, '#dce0e5')
  for (let dot = 0; dot < 3; dot++) graphic(cms, new three.CircleGeometry(.055, 12), dot === 0 ? '#1557ff' : '#8e969e').position.set(-2.5 + dot * .2, 1.6, .01)
  const cmsBlocks = CMS_BLOCKS.map((block, i) => {
    const group = new three.Group()
    cms.add(group)
    panel(group, .075, -.075, block.w, block.h, '#475467', .23)
    panel(group, 0, 0, block.w, block.h, block.color)
    if (i === 2) {
      panel(group, .18, .18, .58, .46, '#f2efe6', .78)
      panel(group, .88, .18, .58, .46, '#0b286f', .45)
    }
    const lines = i === 5 ? [] : [0, 1, 2].map((row) => {
      const width = block.w * (.72 - row * .12)
      const line = panel(group, .13, block.h * (.68 - row * .22), width, .025, i === 0 || i === 2 ? '#f2efe6' : '#727b85', .75)
      return { line, width }
    })
    return { group, lines }
  })
  panel(cms, -frameWidth / 2, frameBottom, frameWidth, statusHeight, '#e8e8e2')
  panel(cms, statusBarLeft, frameBottom + statusHeight * .18, statusBarWidth, .07, '#cbd4e6')
  const publish = panel(cms, statusBarLeft, frameBottom + statusHeight * .18, statusBarWidth, .07, '#1557ff')
  const published = label(cms, '✓ Published', frameWidth / 2 - .18 - .71, frameBottom + statusHeight * .67, 1.42, .16, '#1557ff')
  const cursor = new three.Group()
  cms.add(cursor)
  graphic(cursor, new three.ShapeGeometry(new three.Shape().moveTo(0, 0).lineTo(0, -.3).lineTo(.085, -.23).lineTo(.15, -.36).lineTo(.21, -.33).lineTo(.15, -.2).lineTo(.27, -.18).closePath()), '#0b0b0b')
  const cursorHalo = graphic(cursor, new three.RingGeometry(.12, .135, 24), '#1557ff', .55)
  cursorHalo.position.set(.09, -.15, -.01)
  function updateCms(age: number) {
    cms.rotation.y = bend * .22
    cms.rotation.x = py * .32
    cms.rotation.y += px * .45
    CMS_BLOCKS.forEach((_, i) => {
      const state = sampleCmsBlock(i, age)
      const { group, lines } = cmsBlocks[i]
      group.visible = state.visible
      group.position.set(state.x, state.y, .05 + i * .005)
      group.rotation.z = state.rotation
      group.scale.setScalar(state.scale)
      lines.forEach(({ line, width }) => {
        line.scale.x = Math.max(.001, state.lines)
        line.position.x = .13 + width * state.lines / 2
      })
    })
    const end = sampleCmsBlock(5, age)
    publish.scale.x = Math.max(.001, end.progress)
    publish.position.x = statusBarLeft + statusBarWidth * end.progress / 2
    if (published) { published.visible = end.published > 0; published.material.opacity = end.published }
    cursor.visible = age >= 2350 && age < 2700
    cursor.position.set(2.15, -.88 - .52 * end.cursor, .2)
    for (const part of cursor.children) part.material.opacity = age < 2400 ? .55 : .55 * (1 - end.cursor)
  }

  function updateGoal(age: number, width: number) {
    if (!goalOverlay) return
    const state = sampleGoalLoop(age)
    const vertical = width < 420
    goalOverlay.style.setProperty('--goal-x', `${vertical ? 22 - state.side * 24 : 10 + state.position * 16}%`)
    goalOverlay.style.setProperty('--goal-y', `${vertical ? 12 + state.position * 12 : 47 + state.side * 18}%`)
    goalOverlay.style.setProperty('--goal-repair', String(state.repair))
    goalOverlay.dataset.returned = String(state.returned)
    goalOverlay.dataset.verdict = String(state.verdict)
    goalStages?.forEach((stage, i) => { stage.dataset.state = i === 3 && state.rejected ? 'failed' : (i === 5 ? state.verdict : state.lit[i]) ? 'passed' : 'pending' })
  }

  // Playground: the actual routed VITEK path, rescaled only for this poster.
  const path = buildVitekPath()
  const wire = path.points.map((p) => [-3.15 + p.x * .405, -1.23 + p.y * .41] as const)
  stroke(4, wire, .085, accent(4), .13, 0)
  stroke(4, wire, .024, accent(4), .9, 130)
  stroke(4, [[-3.38,-1.23],[-3.15,-1.23]], .02, '#f2efe6', .65)
  fill(4,-3.2,-1.3,.13,.13,'#f2efe6',.9,380,'fade')
  fill(4,2.95,-1.3,.13,.13,'#f2efe6',.9,630,'fade')

  function size() {
    if (destroyed) return
    renderer.setPixelRatio(dpr)
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    request()
  }

  const duration = (index: number) => index === 1 ? 1400 : index === 2 ? CMS_DURATION : index === 3 ? GOAL_DURATION : DURATION

  function draw(now: number) {
    if (destroyed || document.hidden) return
    const w = window.innerWidth, h = window.innerHeight
    renderer.setViewport(0,0,w,h)
    renderer.setScissor(0,0,w,h)
    renderer.clear()
    const limit = Math.min(opts.slots.length, scenes.length)
    for (let i=1; i<limit; i++) {
      if (i===5 || i===6) continue
      const rect = opts.slots[i].getBoundingClientRect()
      const left = clamp(rect.left,0,w), right = clamp(rect.right,0,w)
      const top = clamp(rect.top,0,h), bottom = clamp(rect.bottom,0,h)
      if (right-left < 2 || bottom-top < 2) continue
      const slot = scenes[i]
      const age = i === 1 && !slot.played ? 0 : slot.started < 0 ? duration(i) : now-slot.started
      if (i === 3) { updateGoal(age, rect.width); continue }
      for (const piece of slot.pieces) {
        const t = opts.reducedMotion ? 1 : ease(clamp((age-piece.delay)/(DURATION-piece.delay),0,1))
        piece.material.uniforms.uOpacity.value = piece.alpha * (piece.motion==='fade' ? t : .25+.75*t)
        piece.material.uniforms.uBend.value = bend
        piece.mesh.position.y = piece.motion==='rise' ? (t-1)*.38 : 0
        piece.mesh.position.x = 0
        piece.mesh.scale.x = piece.motion==='draw' ? Math.max(.001,t) : 1
      }
      slot.scene.rotation.set(py * .32, px * .45, 0)
      if (i === 1) updateCourt(age)
      if (i === 2) {
        cms.scale.setScalar(Math.min(1, 4 * rect.height / rect.width / 1.85))
        updateCms(age)
      }
      // Keep the full slot projection when part of a poster is scrolled offscreen.
      renderer.setViewport(Math.floor(rect.left), Math.floor(h-rect.bottom), Math.ceil(rect.width), Math.ceil(rect.height))
      renderer.setScissor(Math.floor(left), Math.floor(h-bottom), Math.ceil(right-left), Math.ceil(bottom-top))
      camera.left = -4
      camera.right = 4
      camera.top = 4 * rect.height / rect.width
      camera.bottom = -camera.top
      camera.updateProjectionMatrix()
      if (i === 1) {
        courtCamera.top = 8 * rect.height / rect.width
        courtCamera.bottom = -courtCamera.top
        courtCamera.updateProjectionMatrix()
      }
      tiltCamera.aspect = rect.width / rect.height
      tiltCamera.position.z = camera.top / Math.tan(Math.PI / 12)
      tiltCamera.updateProjectionMatrix()
      renderer.render(slot.scene, i === 1 ? courtCamera : tiltCamera)
    }
    if (!firstFrame) { firstFrame = true; opts.onFirstFrame() }
  }

  function tick(now: number) {
    raf = 0
    if (destroyed || document.hidden) return
    const dt = previousFrame ? now-previousFrame : 16
    if (dt > 60) { frameCount=0; frameTotal=0 }
    else if (previousFrame && frameCount < 30) {
      frameTotal += dt
      frameCount++
      if (frameCount===30 && frameTotal/30>22 && dpr>1) { dpr=1; size() }
    }
    previousFrame=now
    if (now-lastBendInput>120) targetBend=0
    bend += (targetBend-bend)*Math.min(1,Math.max(.15,dt/80))
    if (Math.abs(bend)<.002 && targetBend===0) bend=0
    const follow = Math.min(1, dt/140)
    px += (targetPx-px)*follow
    py += (targetPy-py)*follow
    if (Math.abs(targetPx-px)<.002 && Math.abs(targetPy-py)<.002) { px=targetPx; py=targetPy }
    draw(now)
    if (Math.abs(bend-targetBend)>.002 || targetBend!==0 || px!==targetPx || py!==targetPy || scenes.some((s, i) => s.started>=0 && now-s.started<duration(i))) request()
  }
  function request() { if (!destroyed && !document.hidden && !raf) raf=requestAnimationFrame(tick) }
  function visibility() { if (document.hidden) { cancelAnimationFrame(raf); raf=0; previousFrame=0 } else request() }

  window.addEventListener('resize',size)
  window.addEventListener('scroll',request,true)
  document.addEventListener('visibilitychange',visibility)
  size()
  request()
  return {
    setActive(index) {
      if (destroyed || index<0 || index>=scenes.length) return
      const scene=scenes[index]
      if (!scene.pieces.length && index !== 1 && index !== 2 && index !== 3) return
      if (!scene.played) { scene.played=true; scene.started=opts.reducedMotion ? -1 : performance.now() }
      request()
    },
    setBend(amount) {
      if (destroyed || opts.reducedMotion) return
      targetBend=clamp(amount,-.35,.35)
      lastBendInput=performance.now()
      request()
    },
    setPointer(x, y) {
      if (destroyed || opts.reducedMotion) return
      targetPx=clamp(x,-1,1)
      targetPy=clamp(y,-1,1)
      request()
    },
    destroy() {
      if (destroyed) return
      destroyed=true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize',size)
      window.removeEventListener('scroll',request,true)
      document.removeEventListener('visibilitychange',visibility)
      for (const scene of scenes) for (const piece of scene.pieces) { piece.mesh.geometry.dispose(); piece.material.dispose() }
      for (const resource of new Set(owned)) resource.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
