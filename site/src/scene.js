import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js'
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { IRIS, IRIS_LIGHT, INK, SNOW } from '../../scripts/brand.js'
import { headlineTexture, stripTexture, tileTexture, scleraTexture, glyphTextures } from './textures.js'
import { headlineMaterial, stripMaterial, tileMaterial, eyeMaterial } from './materials.js'

const CAMERA_Z = 6
const FOV = 50
// 标题略暗于辉光阈值, 只有眼睑描边与高光会发光
const HEAD = '#b4bcc6'
const MUTED = '#8b949e'

const COPY = {
  opening: {
    lines: ['Every .md file', 'opens in an editor.'],
    narrow: ['Every .md', 'file opens in', 'an editor.'],
    source: '# Every .md file opens in an editor.',
  },
  noise: [
    { lines: ['Cursors.'], source: '- Cursors.' },
    { lines: ['Toolbars.'], source: '- Toolbars.' },
    { lines: ['Unsaved changes.'], narrow: ['Unsaved', 'changes.'], source: '- Unsaved changes.' },
  ],
  wanted: {
    lines: ['All you wanted', 'was to read it.'],
    narrow: ['All you', 'wanted was', 'to read it.'],
    source: '> All you wanted was to read it.',
  },
  github: {
    lines: ['Rendered the way', 'GitHub renders it.'],
    narrow: ['Rendered the', 'way GitHub', 'renders it.'],
    source: '_Rendered the way GitHub renders it._',
  },
  strip: 'TABLES  ·  ALERTS  ·  FOOTNOTES  ·  MERMAID  ·  SYNTAX  ·  LIGHT & DARK  ·  LIVE RELOAD  ·  ',
  built: ['So we built', 'a viewer', 'that does', 'one thing.'],
  opens: { lines: ['It opens Markdown.'], narrow: ['It opens', 'Markdown.'], source: '## It opens Markdown.' },
  nothing: { lines: ['Nothing else.'], source: '**Nothing else.**' },
  sclera: [
    '# Oculis',
    '',
    '**Open is the only verb.**',
    '',
    '- GitHub Flavored Markdown',
    '- Syntax highlighting',
    '- Mermaid diagrams',
    '- Live reload',
    '',
    '```sh',
    'bun run start README.md',
    '```',
    '',
    '> [!NOTE]',
    '> Read only.',
    '',
    '| Key    | Action |',
    '| ------ | ------ |',
    '| Ctrl+O | Open   |',
    '| Ctrl+R | Reload |',
  ],
}

// 章节切换时的提示音, 字标成形时的和弦
const CHIMES = [1.15, 2.2, 7, 7.5]
const CHORD_AT = 10.4

const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const ease = (from, to, k, f) => from + (to - from) * (1 - (1 - k) ** f)

/**
 * 创建滚动驱动的 WebGL 场景
 *
 * 参数
 * - container: 画布的父元素
 * - audio: createAudio 的返回值
 * - onLoop: 每次滚到底部回到顶部时调用
 */
export async function createScene({ container, audio, onLoop }) {
  const renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' })
  const dpr = Math.min(1.5, window.devicePixelRatio)
  renderer.setPixelRatio(dpr)
  renderer.setSize(innerWidth, innerHeight)
  const canvas = renderer.domElement
  container.append(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 400)
  camera.position.z = CAMERA_Z
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.35

  // 后期: 辉光, 胶片颗粒, 残影; 残影衰减在进入后逐渐变短
  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(dpr)
  composer.setSize(innerWidth, innerHeight)
  composer.addPass(new RenderPass(scene, camera))
  // 不做线性到 sRGB 的输出转换, 颜色直接按 sRGB 书写, 暗部保持纯黑
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.55, 0.8)
  composer.addPass(bloom)
  composer.addPass(new FilmPass(0.35))
  const afterimage = new AfterimagePass(0.96)
  composer.addPass(afterimage)

  const view = { w: 1, h: 1, narrow: innerWidth < 760 }
  const measure = () => {
    view.h = 2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360)
    view.w = view.h * (innerWidth / innerHeight)
  }
  measure()
  const widthAt = (z) => (view.w * (CAMERA_Z - z)) / CAMERA_Z
  const heightAt = (z) => (view.h * (CAMERA_Z - z)) / CAMERA_Z

  const lights = [new THREE.PointLight(0xff8888, 30), new THREE.PointLight(0x7d8cff, 24)]
  lights[0].position.set(-3, 0, 4)
  lights[1].position.set(4, 0, 3)
  scene.add(...lights)

  // 背景: 平铺的小眼睛
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tileMaterial(tileTexture()))
  tiles.position.z = -10
  tiles.renderOrder = -1
  scene.add(tiles)

  // 眼睛: 品牌几何, 唯一贯穿全程的角色
  const eye = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    eyeMaterial(scleraTexture(COPY.sclera), { iris: IRIS, irisLight: IRIS_LIGHT, ink: INK, snow: SNOW }),
  )
  eye.renderOrder = 10
  scene.add(eye)

  const glyphs = glyphTextures().map((glyph) => {
    const aspect = glyph.size[0] / glyph.size[1]
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(aspect, 1),
      headlineMaterial(glyph.texture, { head: SNOW, source: SNOW }),
    )
    mesh.userData = glyph
    mesh.renderOrder = 5
    scene.add(mesh)
    return mesh
  })

  function headline(spec, { aspect, segments }) {
    const lines = view.narrow && spec.narrow ? spec.narrow : spec.lines
    const map = headlineTexture({ lines, source: spec.source, aspect })
    const geometry = new THREE.PlaneGeometry(1, 1 / aspect, segments, Math.max(2, Math.round(segments / aspect)))
    const mesh = new THREE.Mesh(geometry.toNonIndexed(), headlineMaterial(map, { head: HEAD, source: MUTED }))
    geometry.dispose()
    mesh.frustumCulled = false
    mesh.userData.aspect = aspect
    scene.add(mesh)
    return mesh
  }

  function hashMark() {
    const bar = (cx, cy, w, h, slant) => {
      const shape = new THREE.Shape()
      shape.moveTo(cx - w / 2 - slant, cy - h / 2)
      shape.lineTo(cx + w / 2 - slant, cy - h / 2)
      shape.lineTo(cx + w / 2 + slant, cy + h / 2)
      shape.lineTo(cx - w / 2 + slant, cy + h / 2)
      return shape
    }
    const shapes = [
      bar(-0.2, 0, 0.15, 1.1, 0.08),
      bar(0.2, 0, 0.15, 1.1, 0.08),
      bar(0, 0.2, 1.1, 0.15, 0),
      bar(0, -0.2, 1.1, 0.15, 0),
    ]
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3,
    })
    geometry.center()
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: SNOW, metalness: 0.9, roughness: 0.3 }),
    )
    mesh.position.y = 12
    scene.add(mesh)
    return mesh
  }

  function build() {
    const n = view.narrow
    return {
      opening: headline(COPY.opening, { aspect: n ? 0.95 : 2, segments: 120 }),
      noise: COPY.noise.map((spec) => headline(spec, { aspect: n ? 2.2 : 4, segments: 24 })),
      wanted: headline(COPY.wanted, { aspect: n ? 1.8 : 3.4, segments: 130 }),
      github: headline(COPY.github, { aspect: n ? 1.8 : 3.4, segments: 130 }),
      strip: (() => {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1 / 11.5, 80, 8).toNonIndexed(),
          stripMaterial(stripTexture(COPY.strip)),
        )
        mesh.frustumCulled = false
        scene.add(mesh)
        return mesh
      })(),
      built: COPY.built.map((line) => headline({ lines: [line] }, { aspect: 5, segments: 12 })),
      hash: hashMark(),
      opens: headline(COPY.opens, { aspect: n ? 1.8 : 4.4, segments: 130 }),
      nothing: headline(COPY.nothing, { aspect: n ? 2.4 : 4.4, segments: 130 }),
    }
  }

  function dispose(chapters) {
    for (const value of Object.values(chapters)) {
      for (const mesh of [value].flat()) {
        scene.remove(mesh)
        mesh.geometry.dispose()
        mesh.material.uniforms?.uMap.value.dispose()
        mesh.material.dispose()
      }
    }
  }

  let ch = build()

  /** 平面按所在深度铺满视野, 只缩放 xy, 让 z 方向的位移保持世界单位 */
  function fit(mesh, z, fill = 0.94, heightFill = 0.9) {
    const aspect = mesh.userData.aspect
    const s = Math.min(widthAt(z) * fill, heightAt(z) * heightFill * aspect)
    mesh.scale.set(s, s, 1)
    return s
  }

  function layout() {
    measure()
    tiles.scale.set(widthAt(-10) * 1.2, heightAt(-10) * 1.2, 1)
    const cell = 0.8
    tiles.material.uniforms.uColumns.value = Math.round(tiles.scale.x / cell)
    tiles.material.uniforms.uRows.value = Math.round(tiles.scale.y / cell)
    fit(ch.opening, 0.6)
    for (const mesh of ch.noise) fit(mesh, 0, view.narrow ? 0.9 : 0.6, 0.3)
    fit(ch.wanted, 0.5, 0.92, 0.42)
    fit(ch.github, 0.5, 0.92, 0.42)
    const strip = widthAt(1.6) * 0.86
    ch.strip.scale.set(strip, strip, 1)
    for (const mesh of ch.built) fit(mesh, 0, 0.8, 0.2)
    fit(ch.opens, 0, 0.92, 0.4)
    fit(ch.nothing, 0, 0.92, 0.4)
    ch.hash.userData.size = Math.min(view.h * 0.42, view.w * 0.5)
  }

  const state = {
    p: 0,
    entered: false,
    enteredAt: 0,
    zoom: false,
    loops: 0,
    stage: 0,
    ignoreScroll: false,
    mouse: { x: 0, y: 0 },
  }
  const body = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    dir: 1,
    size: 1,
    gaze: new THREE.Vector2(),
    blinkAt: -10,
    nextBlink: 3,
  }
  let drag = null
  let trail = 0.96
  let time = 0
  let frame = 0
  let last = performance.now()

  layout()

  function onScroll() {
    const p = window.scrollY / innerHeight
    const dp = p - state.p
    state.p = p
    if (state.ignoreScroll) {
      state.ignoreScroll = false
      return
    }
    for (const at of CHIMES) if (dp > 0 && p >= at && p - dp < at) audio.chime(CHIMES.indexOf(at))
    if (dp > 0 && p >= CHORD_AT && p - dp < CHORD_AT) audio.chord()
    audio.scroll(dp)
    // 滚动给眼睛加速, 横向方向在撞墙时翻转, 让持续滚动始终推着它走
    const k = view.w / 8
    body.vx += body.dir * dp * 0.016 * k
    body.vy += dp * 0.014 * k
  }

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const cursorWorld = () => [state.mouse.x * view.w, -state.mouse.y * view.h]

  function hitEye(clientX, clientY) {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObject(eye)[0]
    if (!hit) return false
    return Math.abs(hit.uv.x - 0.5) < 0.38 && Math.abs(hit.uv.y - 0.5) < 0.2
  }

  const free = () => state.entered && !state.zoom && state.p < 10.2

  function onPointerMove(e) {
    state.mouse.x = e.clientX / innerWidth - 0.5
    state.mouse.y = e.clientY / innerHeight - 0.5
    if (drag) {
      const [cx, cy] = cursorWorld()
      const x = cx + drag.ox
      const y = cy + drag.oy
      body.vx = (x - body.x) * 0.5
      body.vy = (y - body.y) * 0.5
      body.x = x
      body.y = y
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true
      document.body.style.cursor = 'grabbing'
      return
    }
    if (state.entered) document.body.style.cursor = hitEye(e.clientX, e.clientY) ? 'grab' : ''
  }

  function onPointerDown(e) {
    if (!free() || !hitEye(e.clientX, e.clientY)) return
    const [cx, cy] = cursorWorld()
    drag = { ox: body.x - cx, oy: body.y - cy, sx: e.clientX, sy: e.clientY, moved: false }
  }

  function onPointerUp(e) {
    if (e.target.closest('a, button')) {
      drag = null
      return
    }
    if (drag) {
      if (!drag.moved) zoom(true)
      drag = null
      document.body.style.cursor = ''
      return
    }
    if (state.zoom) zoom(false)
  }

  /** 拉近或放开眼睛, 在结尾处放开时回到字标 */
  function zoom(on) {
    state.zoom = on
    body.blinkAt = time
    if (!on && state.p > 11) {
      state.ignoreScroll = true
      window.scrollTo(0, innerHeight * 10.6)
    }
  }

  function blink() {
    body.blinkAt = time
  }

  function openness() {
    if (!state.entered) return 0
    const opening = smooth(0, 1.2, time - state.enteredAt)
    const t = time - body.blinkAt
    const lid = t < 0.08 ? 1 - t / 0.08 : t < 0.26 ? smooth(0.08, 0.26, t) : 1
    return opening * lid
  }

  // 每次滚到底部回到顶部, 依次叠加: 蓝色火焰, 反色, 倒置, 旋转, 然后复位
  function loop() {
    state.loops++
    state.stage = (state.stage + 1) % 5
    state.ignoreScroll = true
    state.zoom = false
    body.vx = body.vy = 0
    window.scrollTo(0, 0)
    state.p = 0
    document.body.classList.toggle('is-backwards', state.stage === 3)
    document.body.classList.toggle('is-twirling', state.stage === 4)
    canvas.style.transform = state.stage >= 3 ? 'scale(1, -1)' : ''
    audio.chord()
    onLoop()
  }

  const show = (mesh, on = true) => {
    mesh.material.uniforms.uVisible.value = on ? 1 : 0
    mesh.visible = on
  }
  const tilt = (mesh, f, amount = 0.4) => {
    mesh.rotation.y = ease(mesh.rotation.y, state.mouse.x * amount, 0.04, f)
    mesh.rotation.x = ease(mesh.rotation.x, state.mouse.y * amount, 0.04, f)
  }

  function chapters(p, T, f) {
    for (const mesh of Object.values(ch).flat()) mesh.material.uniforms && (mesh.material.uniforms.uTime.value = T)

    // 一: 标题从下方升起, 底边闪烁飞散, 字形随滚动鼓起
    const opening = ch.opening
    show(opening, state.entered && p < 1.5)
    if (opening.visible) {
      const u = opening.material.uniforms
      u.uVisible.value = smooth(0, 1, time - state.enteredAt)
      u.uSlide.value = 0.08 - p * 0.75
      u.uDepth.value = 0.5 * p
      u.uSpike.value = 0.12
      u.uJitter.value = p > 1.15 ? 0.2 : 0
      opening.position.z = 0.6
      tilt(opening, f)
    }

    // 二: 三个词从深处以不同速度飞来
    const flying = p > 1.15 && p < 2.5
    const targets = [-11.21 + p * 6, -12.24 + p * 7.2, -12.27 + p * 7]
    const rates = [0.5, 0.35, 0.3]
    ch.noise.forEach((mesh, i) => {
      show(mesh, flying)
      if (!flying) {
        mesh.position.z = -60
        return
      }
      mesh.position.y = (1 - i) * view.h * 0.3
      mesh.position.z = ease(mesh.position.z, targets[i], rates[i], f)
      // 飞到镜头前之前淡出
      mesh.material.uniforms.uVisible.value = 1 - smooth(2, 3.6, mesh.position.z)
      const spin = i === 1 ? p * -13 : (p - 1.9) * -1
      mesh.rotation.z = ease(mesh.rotation.z, spin, 0.2, f)
    })

    // 三: 上下两段标题, 鼓起的波峰反向扫过, 右缘燃烧, 中间是功能跑马灯, 最后碎裂
    const third = p > 2.2 && p < 5.6
    const shatter = Math.max(0, p - 5.4)
    for (const [mesh, y, sweep] of [
      [ch.wanted, 0.24, (p - 2.2) / 2.4],
      [ch.github, -0.24, 1 - (p - 2.8) / 2.4],
    ]) {
      show(mesh, third)
      if (!third) continue
      const u = mesh.material.uniforms
      u.uSweep.value = sweep
      u.uDepth.value = 0.8
      u.uBurn.value = 0.935
      u.uShatter.value = shatter
      mesh.position.set(0, y * view.h, 0.5)
      tilt(mesh, f)
    }
    show(ch.strip, third)
    if (third) {
      const u = ch.strip.material.uniforms
      u.uProgress.value = p
      u.uShatter.value = shatter
      ch.strip.position.set(0, view.narrow ? -0.02 * view.h : 0, 1.6)
      tilt(ch.strip, f)
    }

    // 四: 一句话叠成四行, 继续滚动时四行各自飞散
    const fourth = p > 6.9
    const z = p - 7.05
    const spread = [
      [10, 5],
      [9, -5],
      [8, 2],
      [7, -5],
    ]
    ch.built.forEach((mesh, i) => {
      show(mesh, fourth && p < 9)
      if (!mesh.visible) {
        mesh.position.z = -80
        return
      }
      mesh.position.y = (1.5 - i) * view.h * 0.15
      mesh.position.z = ease(mesh.position.z, z * spread[i][0], [0.5, 0.4, 0.3, 0.3][i], f)
      mesh.material.uniforms.uVisible.value = smooth(6.9, 7.05, p) * (1 - smooth(2, 3.6, mesh.position.z))
      mesh.position.x = ease(mesh.position.x, z * spread[i][1] * (view.narrow ? 0.4 : 1), 0.3, f)
    })

    // 金属的井号, 在第四章中段转动
    const hash = ch.hash
    const hashOn = p > 7.9 && p < 9.8
    const hashSize = hashOn ? hash.userData.size : hash.userData.size * 2.2
    hash.position.y = hashOn ? ease(hash.position.y, -0.1, 0.1, f) : 12
    hash.scale.setScalar(ease(hash.scale.x, hashSize, 0.1, f))
    hash.rotation.y += 0.01 * f
    hash.rotation.x = ease(hash.rotation.x, state.mouse.y * 0.6, 0.05, f)

    const fifth = p > 7.5 && p < 10
    for (const [mesh, y] of [
      [ch.opens, 0.24],
      [ch.nothing, -0.24],
    ]) {
      show(mesh, fifth)
      if (!fifth) continue
      const u = mesh.material.uniforms
      u.uBurn.value = 0.935
      u.uShatter.value = Math.max(0, p - 9.5) * 0.26
      mesh.position.set(0, y * view.h, 0)
      tilt(mesh, f)
    }

    // 结尾: 字母从螺旋中聚拢成字标, 眼睛飞入字标的位置
    const logo = logoLayout()
    const gather = Math.max(0, 10.45 - p)
    glyphs.forEach((mesh, i) => {
      const on = p > 9.3
      mesh.visible = on
      if (!on) return
      const u = mesh.material.uniforms
      u.uVisible.value = smooth(9.3, 9.9, p)
      const [cx, cy] = mesh.userData.center
      const tx = (76.2 + cx - 97.5) * logo.k
      const ty = logo.y + (18 - cy) * logo.k
      const a = i + Math.PI * 1.2
      mesh.position.x = tx + Math.sin(a) * gather * 4
      mesh.position.y = ty + Math.cos(a) * gather * 4 + Math.sin(T * 0.9 + i + p) * 0.02
      mesh.rotation.z = Math.sin(T * 0.25 + i + p) * (0.04 + gather * 0.3)
      mesh.rotation.x = Math.cos(T * 0.25 + i + p) * (0.04 + gather * 0.5)
      mesh.scale.setScalar(mesh.userData.size[1] * logo.k)
    })
  }

  function logoLayout() {
    const width = Math.min(view.w * (view.narrow ? 0.86 : 0.56), 8.5)
    return { k: width / 195, y: view.h * 0.08 }
  }

  function updateEye(p, T, f) {
    const u = eye.material.uniforms
    u.uTime.value = T
    u.uScroll.value = p
    u.uFire.value = state.stage >= 1 ? 1 : 0
    u.uOpen.value = openness()

    if (state.entered && time > body.nextBlink) {
      blink()
      body.nextBlink = time + 2.5 + Math.random() * 4
    }

    const base = Math.min(view.w * 0.3, view.h * 0.8)
    let targetSize = base
    let z = 0
    const [cx, cy] = cursorWorld()

    if (state.zoom) {
      z = 1.2
      targetSize = Math.min(heightAt(1.2) * 1.7, widthAt(1.2) * 1.25)
      body.x = ease(body.x, 0, 0.2, f)
      body.y = ease(body.y, 0, 0.2, f)
    } else if (state.entered && p > 10.2) {
      const logo = logoLayout()
      targetSize = 80 * logo.k
      body.x = ease(body.x, (33.1 - 97.5) * logo.k, 0.3, f)
      body.y = ease(body.y, logo.y + (18 - 18.5) * logo.k, 0.3, f)
      body.vx = body.vy = 0
    } else if (state.entered && !drag) {
      // 自由漂移, 撞墙反弹并眨眼
      const vmax = view.w * 0.018
      const vmin = view.w * 0.0002
      body.vx = clamp(body.vx * 0.993 ** f, -vmax, vmax)
      body.vy = clamp(body.vy * 0.993 ** f, -vmax, vmax)
      if (Math.abs(body.vx) < vmin) body.vx = Math.sign(body.vx || 1) * vmin
      if (Math.abs(body.vy) < vmin) body.vy = Math.sign(body.vy || 1) * vmin
      body.x += body.vx * f
      body.y += body.vy * f
      const bx = view.w / 2 - body.size * 0.41
      const by = view.h / 2 - body.size * 0.22
      if (Math.abs(body.x) > bx) {
        body.x = Math.sign(body.x) * bx
        body.vx *= -1
        body.dir *= -1
        audio.boing()
        blink()
      } else if (Math.abs(body.y) > by) {
        body.y = Math.sign(body.y) * by
        body.vy *= -1
        audio.boing()
        blink()
      }
    }

    body.size = ease(body.size, targetSize, 0.1, f)
    eye.scale.set(body.size, body.size, 1)
    eye.position.set(body.x, body.y, ease(eye.position.z, z, 0.2, f))

    const gaze = new THREE.Vector2(cx - body.x, cy - body.y).divideScalar(body.size * 0.5)
    if (gaze.length() > 1) gaze.normalize()
    body.gaze.lerp(gaze, 1 - 0.85 ** f)
    u.uGaze.value.copy(body.gaze)

    const still = state.zoom || p > 10.2
    eye.rotation.y = ease(eye.rotation.y, still ? 0 : clamp(state.mouse.x * 0.7 - body.vx * 4, -0.5, 0.5), 0.1, f)
    eye.rotation.x = ease(eye.rotation.x, still ? 0 : clamp(state.mouse.y * 0.7 + body.vy * 4, -0.5, 0.5), 0.1, f)

    audio.speed((Math.abs(body.vx) + Math.abs(body.vy)) / (view.w * 0.018))
  }

  function tick(now) {
    requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    time += dt
    frame++
    const f = dt * 60
    const p = state.p
    const T = time * 1.2

    // 残影衰减按时间而非帧数计算, 在任何刷新率下拖尾长度一致
    if (state.entered) trail = Math.max(0.8, trail - 0.024 * dt)
    afterimage.uniforms.damp.value = trail ** f

    if (state.entered && p > 11.9 && !state.zoom) zoom(true)
    const end = document.body.scrollHeight / innerHeight - 1.1
    if (state.entered && p >= end) loop()

    tiles.material.uniforms.uTime.value = T
    chapters(p, T, f)
    updateEye(p, T, f)

    lights[0].position.x += Math.sin(T * 0.4) * 0.01 * f
    lights[0].position.y += Math.cos(T * 0.48) * 0.01 * f
    lights[1].position.x += Math.sin(T * 0.34) * 0.012 * f
    lights[1].position.y += Math.cos(T * 0.35) * 0.012 * f

    camera.position.x = ease(camera.position.x, state.mouse.x * 0.4, 0.04, f)
    camera.position.y = ease(camera.position.y, -state.mouse.y * 0.4, 0.04, f)
    camera.lookAt(0, 0, 0)

    composer.render(dt)

    // 色相与背景色随滚动漂移, 开头与结尾回到纯粹的品牌色
    if (frame % 3 === 0) {
      const envelope = smooth(0.5, 1.5, p) * (1 - smooth(9.6, 10.3, p))
      const t = Math.max(0, p - 0.5)
      const hue = Math.sin(t * 3) * 360 * envelope
      canvas.style.filter = `hue-rotate(${hue.toFixed(1)}deg)${state.stage >= 2 ? ' invert(1)' : ''}`
      const r = Math.sin(t * 3) * 60 * envelope
      const g = Math.sin(t * 2) * 90 * envelope
      const b = Math.sin(t * 2.5) * 200 * envelope
      document.body.style.backgroundColor = `rgb(${r | 0} ${g | 0} ${b | 0})`
      if (state.stage === 4) canvas.style.transform = `scale(1, -1) rotate(${p * 24}deg)`
    }
  }

  function onResize() {
    const narrow = innerWidth < 760
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    composer.setSize(innerWidth, innerHeight)
    bloom.resolution.set(innerWidth, innerHeight)
    if (narrow !== view.narrow) {
      view.narrow = narrow
      dispose(ch)
      ch = build()
    }
    layout()
  }

  function onKey(e) {
    if (e.key === 'Escape' && state.zoom) zoom(false)
    if (e.key === 'w' && !e.metaKey && !e.ctrlKey) {
      scene.traverse((o) => o.material && (o.material.wireframe = !o.material.wireframe))
    }
  }

  renderer.compile(scene, camera)
  requestAnimationFrame((now) => {
    last = now
    tick(now)
    canvas.classList.add('shown')
  })

  return {
    get progress() {
      return state.p
    },
    get loops() {
      return state.loops
    },
    enter() {
      state.entered = true
      state.enteredAt = time
      body.nextBlink = time + 3
      const k = view.w / 8
      body.vx = 0.012 * k
      body.vy = 0.008 * k
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('keydown', onKey)
    },
    zoom: () => zoom(!state.zoom),
    resize: onResize,
  }
}
