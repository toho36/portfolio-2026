// The Goal Loop card object (owner-approved study 034): a silver cloche on a plate with a
// service bell. Same contract as the former watch scene: paint(time, amount) where amount
// 0..1 is the hover/focus reveal; the ticket under the lid stays hidden at rest.
export function createCloche(T, host, surface = host) {
  const owned = new Set(), own = r => { owned.add(r); return r }
  let renderer, disposed = false
  function destroy() { if (disposed) return; disposed = true; for (const r of owned) r.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove(); ding?.remove() }
  let ding
  try {
    renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true })
    renderer.setClearColor(0, 0); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
    renderer.domElement.setAttribute('aria-hidden', 'true'); surface.append(renderer.domElement)
    ding = host.ownerDocument.createElement('span'); ding.className = 'cloche-ding'; ding.setAttribute('aria-hidden', 'true'); ding.textContent = 'Ding!'; surface.append(ding)

    const scene = new T.Scene()
    // Studio environment: a grey sweep with long softboxes gives controlled silver stripes.
    {
      const env = new T.Scene()
      env.add(new T.Mesh(own(new T.SphereGeometry(20, 32, 16)), own(new T.ShaderMaterial({ side: T.BackSide,
        vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: 'varying vec3 p; void main(){ float t = clamp(p.y * .5 + .5, 0., 1.); gl_FragColor = vec4(mix(vec3(.08,.08,.08), vec3(.95,.94,.91), smoothstep(.35,.75,t)), 1.); }' }))))
      for (const [w, h, x, y, z, k] of [[14, 2.2, -6, 9, 8, 7], [2, 12, 11, 3, 2, 4], [10, 1.2, 0, 4, -12, 3], [30, 4, 0, -3, 12, 1.4]]) {
        const m = new T.Mesh(own(new T.PlaneGeometry(w, h)), own(new T.MeshBasicMaterial({ color: new T.Color(k, k, k), side: T.DoubleSide }))); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m)
      }
      const pmrem = new T.PMREMGenerator(renderer); scene.environment = own(pmrem.fromScene(env, .02)).texture; pmrem.dispose()
    }
    scene.add(new T.HemisphereLight('#fff7e6', '#7e8684', 1))
    const key = new T.DirectionalLight('#fff1d9', 2); key.position.set(-4, 7, 5); scene.add(key)
    const camera = new T.PerspectiveCamera(28, 1, .1, 60)

    const grain = (() => { const c = host.ownerDocument.createElement('canvas'); c.width = 8; c.height = 256; const g = c.getContext('2d')
      for (let y = 0; y < 256; y++) { const v = 118 + ((y * 37) % 20); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, 8, 1) }
      const t = own(new T.CanvasTexture(c)); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, 3); return t })()
    const silver = own(new T.MeshPhysicalMaterial({ color: '#d9dddc', metalness: 1, roughness: .1, clearcoat: .6, clearcoatRoughness: .1, bumpMap: grain, bumpScale: .03, side: T.DoubleSide }))
    const porcelain = own(new T.MeshPhysicalMaterial({ color: '#f6f3ec', roughness: .3, clearcoat: .8 }))
    const gold = own(new T.MeshStandardMaterial({ color: '#c5a75e', metalness: .9, roughness: .3 }))
    const brass = own(new T.MeshPhysicalMaterial({ color: '#dcb45c', metalness: .85, roughness: .28, clearcoat: .5 }))
    const walnut = own(new T.MeshStandardMaterial({ color: '#2f241d', roughness: .55 }))
    const seam = own(new T.MeshStandardMaterial({ color: '#1d1915', roughness: .6 }))
    const mesh = (g, m, parent = scene) => { const o = new T.Mesh(own(g), m); parent.add(o); return o }
    const radial = (inner, outer) => { const c = host.ownerDocument.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = own(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t }

    mesh(new T.LatheGeometry([[0, 0], [1.15, 0], [1.3, .04], [1.95, .16], [2.03, .18], [2.05, .14], [1.35, -.02], [1.15, -.07], [0, -.07]].map(([x, y]) => new T.Vector2(x, y)), 96), porcelain)
    const goldLine = mesh(new T.TorusGeometry(1.78, .011, 6, 120), gold); goldLine.rotation.x = Math.PI / 2; goldLine.position.y = .125
    const shadow = mesh(new T.PlaneGeometry(5.4, 5.4), own(new T.MeshBasicMaterial({ map: radial('rgba(40,36,30,.42)', 'rgba(40,36,30,0)'), transparent: true, depthWrite: false }))); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.075

    // The task ticket, hidden under the lid until it lifts.
    const ticketMap = (() => { const c = host.ownerDocument.createElement('canvas'); c.width = 512; c.height = 704; const g = c.getContext('2d')
      g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, 512, 704); g.fillStyle = '#343c34'; g.font = '700 58px monospace'
      ;['#12 · TASK', 'Signup form', '+ email check'].forEach((line, i) => g.fillText(line, 44, 100 + i * 80))
      g.strokeStyle = '#343c3466'; g.setLineDash([10, 10]); g.lineWidth = 4; g.beginPath(); g.moveTo(36, 370); g.lineTo(476, 370); g.stroke()
      g.save(); g.translate(256, 540); g.rotate(-.16); g.setLineDash([]); g.fillStyle = '#17624f'; g.fillRect(-215, -88, 430, 176)
      g.fillStyle = '#fbf8f0'; g.font = '900 108px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PASS ✓', 0, 6); g.restore()
      const t = own(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t })()
    const paper = own(new T.MeshStandardMaterial({ color: '#f3efe4', roughness: .9 }))
    const ticket = mesh(new T.BoxGeometry(1.2, .02, 1.64), [paper, paper, own(new T.MeshStandardMaterial({ map: ticketMap, roughness: .85 })), paper, paper, paper])
    ticket.position.set(.1, .03, .2); ticket.rotation.set(0, .42, 0)

    const cloche = new T.Group(), dome = new T.Group()
    const profile = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI / 2; profile.push(new T.Vector2(1.52 * Math.cos(a) ** .82, 1.12 * Math.sin(a))) }
    mesh(new T.LatheGeometry(profile.reverse(), 96), silver, dome)
    const rim = mesh(new T.TorusGeometry(1.53, .045, 12, 120), silver, dome); rim.rotation.x = Math.PI / 2
    mesh(new T.CylinderGeometry(.06, .09, .14, 24), silver, dome).position.y = 1.18
    const knob = mesh(new T.SphereGeometry(.17, 32, 16), silver, dome); knob.position.y = 1.35; knob.scale.y = .8
    dome.position.set(0, 0, 1.52); cloche.position.set(0, .08, -1.52); cloche.add(dome); scene.add(cloche) // pivot on the back rim

    const bell = new T.Group(); bell.position.set(2.5, -.07, 1); scene.add(bell)
    mesh(new T.CylinderGeometry(.46, .49, .07, 48), walnut, bell).position.y = .035
    const ring = mesh(new T.TorusGeometry(.405, .018, 8, 64), seam, bell); ring.rotation.x = Math.PI / 2; ring.position.y = .075
    const bp = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI / 2; bp.push(new T.Vector2(.4 * Math.cos(a), .36 * Math.sin(a))) }
    mesh(new T.LatheGeometry(bp.reverse(), 64), brass, bell).position.y = .075
    const plunger = new T.Group(); plunger.position.y = .44; bell.add(plunger)
    mesh(new T.CylinderGeometry(.03, .03, .12, 16), brass, plunger)
    mesh(new T.CylinderGeometry(.085, .085, .03, 24), brass, plunger).position.y = .07

    const steamMap = radial('rgba(176,170,160,.8)', 'rgba(176,170,160,0)')
    const steam = Array.from({ length: 5 }, (_, i) => { const s = new T.Sprite(own(new T.SpriteMaterial({ map: steamMap, transparent: true, depthWrite: false, opacity: 0 }))); s.userData = { delay: i * .12, x: -1 + i * .5, z: 1.25 - Math.abs(i - 2) * .12 }; scene.add(s); return s })

    let width = 0, height = 0, pose = { time: 0, open: 0 }, rang = null, dingAt = -9
    function resize() {
      const w = Math.max(1, surface.clientWidth), h = Math.max(1, surface.clientHeight); if (w === width && h === height) return false
      width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h
      // Frame plate (x -2.05..2.05) and bell (to x 3) inside the art box with a margin, so nothing is cut at its edge.
      const back = camera.aspect >= 1 ? 1.3 : Math.min(2.4, Math.max(1.3, 1.5 / camera.aspect)), cx = .47
      camera.position.set(cx, 3.6 * back, 8 * back); camera.lookAt(cx, .4, 0); camera.updateProjectionMatrix(); return true
    }
    function paint(time = 0, open = 0) {
      if (disposed) return
      pose = { time, open }
      const peek = Math.max(0, Math.min(1, open)) * .42
      // The first paint adopts the pose without ringing, so a recreated open scene stays quiet.
      if (rang === null) rang = peek > .25
      else if (peek > .25 && !rang) { rang = true; dingAt = time }
      if (peek < .08) rang = false
      cloche.rotation.x = -peek; cloche.position.y = .08 + Math.sin(time * 1.8) * .012 * (1 - open) + .12 * peek
      ticket.rotation.x = -.5 * peek; ticket.position.y = .03 + .12 * peek
      const since = time - dingAt
      plunger.position.y = .44 - .05 * (since >= 0 && since < .2 ? Math.sin(since / .2 * Math.PI) : 0)
      for (const s of steam) {
        const k = Math.max(0, Math.min(1, (since - s.userData.delay) / 1.4))
        s.position.set(s.userData.x * (1 + k * .15), .14 + k * .9, s.userData.z + k * .1); s.scale.set(.25 + k * .35, .5 + k * .8, 1)
        s.material.opacity = since >= 0 ? Math.sin(k * Math.PI) * .2 : 0
      }
      renderer.render(scene, camera)
      // The "Ding!" label sits over the bell for a short moment after it rings.
      const on = since >= 0 && since < .65, p = bell.localToWorld(new T.Vector3(0, .6, 0)).project(camera)
      ding.dataset.on = on ? 'true' : 'false'; ding.style.left = `${(p.x + 1) / 2 * width}px`; ding.style.top = `${(1 - p.y) / 2 * height}px`
    }
    // Hover reveal: 1 over the dome, easing to 0 away from it.
    function proximity(x, y) {
      const c = cloche.localToWorld(new T.Vector3(0, .5, 1.52)).project(camera), cx = (c.x + 1) / 2 * width, cy = (1 - c.y) / 2 * height
      const d = Math.hypot(x - cx, y - cy) / (Math.min(width, height) * .45), t = Math.max(0, Math.min(1, (1.3 - d) / .5))
      return t * t * (3 - 2 * t)
    }
    resize()
    return { resize, paint, proximity, destroy, get pose() { return { ...pose } }, snapshotPose() { paint(pose.time, pose.open); return renderer.domElement.toDataURL('image/png') } }
  } catch (error) { destroy(); throw error }
}
