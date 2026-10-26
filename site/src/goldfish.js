import * as THREE from 'three'

// 画面不做输出色彩转换, 颜色按 sRGB 分量直接写入
const display = (hex) => new THREE.Color(hex).convertLinearToSRGB()
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

const PALETTE = { back: '#e8401a', belly: '#ffc061', fin: '#ff7a2a', gill: '#b8240e' }
const BUBBLES = 160

/** 鱼鳞纹理, 一行压一行的半圆, 同时用作颜色与凹凸 */
function scaleTexture() {
  const size = 256
  const r = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#bbb'
  ctx.fillRect(0, 0, size, size)
  for (let row = -1; row <= size / (r / 2) + 1; row++) {
    const y = row * (r / 2)
    for (let col = -1; col <= size / (r * 2) + 1; col++) {
      const x = col * r * 2 + (row % 2 ? r : 0)
      const g = ctx.createRadialGradient(x, y - r * 0.35, r * 0.1, x, y, r)
      g.addColorStop(0, '#fff')
      g.addColorStop(0.75, '#e6e6e6')
      g.addColorStop(1, '#8a8a8a')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(10, 22)
  texture.anisotropy = 8
  return texture
}

/** 鳍条纹理, 根部实, 末梢透 */
function finTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')
  const fade = ctx.createLinearGradient(0, 0, 256, 0)
  fade.addColorStop(0, 'rgba(255,255,255,0.9)')
  fade.addColorStop(0.6, 'rgba(255,255,255,0.5)')
  fade.addColorStop(1, 'rgba(255,255,255,0.08)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let y = 3; y < 256; y += 11) ctx.fillRect(0, y, 256, 2.5)
  return new THREE.CanvasTexture(canvas)
}

/**
 * 参数化的鳍网格, 位于 yz 平面, 根部在原点, 向 -z 延伸
 *
 * length(v) 给出每条鳍条的长度, spread(u, v) 给出纵向张开量, u 沿鳍条, v 在 [-1, 1]
 */
function finGeometry({ length, spread, segU = 24, segV = 18 }) {
  const positions = []
  const uvs = []
  const index = []
  for (let i = 0; i <= segU; i++) {
    const u = i / segU
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1
      positions.push(0, spread(u, v), -u * length(v))
      uvs.push(u, j / segV)
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j
      const b = a + segV + 1
      index.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(index)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

/** 头朝 +z 的纺锤形身体, 尾部收窄, 腹部更圆, 顶点色从腹到背渐变, 带鳃盖暗线 */
function bodyGeometry() {
  const geometry = new THREE.SphereGeometry(1, 96, 64)
  geometry.rotateX(Math.PI / 2)
  const pos = geometry.attributes.position
  const back = display(PALETTE.back)
  const belly = display(PALETTE.belly)
  const gill = display(PALETTE.gill)
  const colors = []
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const taper = z < 0 ? 1 - 0.68 * (-z) ** 1.5 : 1 - 0.25 * z * z
    // 金鱼背部隆起, 腹部圆鼓
    const hump = 1 + 0.18 * Math.exp(-((z - 0.1) ** 2) * 6) * Math.max(0, y)
    pos.setXYZ(i, x * 0.42 * taper, y * (y < 0 ? 0.62 : 0.55) * taper * hump, z)
    c.copy(belly).lerp(back, smooth(-0.55, 0.45, y))
    c.lerp(gill, Math.exp(-(((z - 0.42 + y * 0.08) / 0.025) ** 2)) * 0.7 * smooth(0.3, 0.6, Math.abs(x)))
    colors.push(c.r, c.g, c.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** 鳍的波动: 沿鳍条传播的正弦横摆, 振幅随离根部的距离增大 */
function ripple(mesh, phase, amp, wave) {
  const pos = mesh.geometry.attributes.position
  const uv = mesh.geometry.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    const sway = Math.sin(phase - u * wave + v * 1.3) + 0.35 * u * Math.sin(phase * 0.6 - u * 5 + v * 4)
    pos.setX(i, sway * u * amp)
  }
  pos.needsUpdate = true
}

/**
 * 一条特写尺度的金鱼, 头朝局部 +z, 体长约 2, 加上尾鳍约 4
 *
 * animate 推进游动: 身体波动, 鳍摆动, 眼睛盯着 gaze
 */
export function createGoldfish({ envMap }) {
  const root = new THREE.Group()
  const scales = scaleTexture()

  const skin = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: scales,
    bumpMap: scales,
    bumpScale: 2,
    roughness: 0.4,
    metalness: 0.1,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    iridescence: 0.25,
    iridescenceIOR: 1.5,
    sheen: 0.3,
    sheenColor: display('#ffd27a'),
    emissive: display(PALETTE.back),
    emissiveIntensity: 0.03,
    envMap,
    envMapIntensity: 0.9,
  })
  const geometry = bodyGeometry()
  const rest = geometry.attributes.position.array.slice()
  const body = new THREE.Mesh(geometry, skin)
  root.add(body)

  const fin = new THREE.MeshPhysicalMaterial({
    color: display(PALETTE.fin),
    map: finTexture(),
    emissive: display(PALETTE.fin),
    emissiveIntensity: 0.06,
    roughness: 0.55,
    sheen: 0.2,
    sheenColor: display('#fff0c0'),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMap,
  })

  // 双叶长尾, 像纱一样飘
  const tail = new THREE.Mesh(
    finGeometry({
      length: (v) => 2.3 * (0.55 + 0.45 * Math.abs(v) ** 0.7),
      spread: (u, v) => v * (0.08 + 1.25 * u ** 0.8),
    }),
    fin,
  )
  tail.position.z = -0.86
  root.add(tail)

  const dorsalGeometry = finGeometry({
    length: (v) => 0.08 + 0.62 * Math.sqrt(Math.max(0, 1 - v * v)),
    spread: (u, v) => v * 0.5 * (1 - 0.3 * u) - u * 0.45,
    segU: 14,
    segV: 14,
  })
  dorsalGeometry.rotateX(Math.PI / 2)
  const dorsal = new THREE.Mesh(dorsalGeometry, fin)
  dorsal.position.set(0, 0.5, 0.05)
  root.add(dorsal)

  const anals = [-1, 1].map((side) => {
    const g = finGeometry({
      length: (v) => 0.1 + 0.4 * Math.sqrt(Math.max(0, 1 - v * v)),
      spread: (u, v) => v * 0.22 + u * 0.35,
      segU: 10,
      segV: 10,
    })
    g.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(g, fin)
    mesh.position.set(side * 0.08, -0.4, -0.45)
    mesh.rotation.z = side * 0.25
    root.add(mesh)
    return mesh
  })

  const pectorals = [-1, 1].map((side) => {
    const mesh = new THREE.Mesh(
      finGeometry({ length: () => 0.6, spread: (u, v) => v * 0.16 * (0.4 + u), segU: 12, segV: 10 }),
      fin,
    )
    mesh.position.set(side * 0.3, -0.26, 0.34)
    mesh.userData.side = side
    root.add(mesh)
    return mesh
  })

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.03, 12, 32),
    new THREE.MeshPhysicalMaterial({ color: display('#c83a1c'), roughness: 0.3, clearcoat: 1, envMap }),
  )
  lip.position.set(0, -0.04, 0.98)
  root.add(lip)

  // 金边的大眼睛, 瞳孔朝局部 +z, 由 lookAt 转向注视点
  const iris = new THREE.MeshStandardMaterial({ color: display('#e0ae48'), metalness: 0.7, roughness: 0.3, envMap, envMapIntensity: 0.9 })
  const pupil = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.05, clearcoat: 1, envMap, envMapIntensity: 1.5 })
  const glint = new THREE.MeshBasicMaterial({ color: 0xcccccc })
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Group()
    eye.position.set(side * 0.27, 0.12, 0.58)
    eye.rotation.y = (side * Math.PI) / 2
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 24), iris))
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), pupil)
    p.position.z = 0.065
    eye.add(p)
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), glint)
    g.position.set(0.04, 0.05, 0.16)
    eye.add(g)
    eye.userData = { side, base: eye.position.clone() }
    root.add(eye)
    return eye
  })

  let phase = 0
  const bend = (z, amp, turn) => {
    const w = ((1 - z) / 2) ** 2
    return (Math.sin(phase - z * 2.4) * amp + turn) * w
  }

  const outward = new THREE.Vector3()
  const toward = new THREE.Vector3()
  const eyeWorld = new THREE.Vector3()

  /**
   * 推进一帧
   *
   * 参数
   * - f: 以 60fps 为 1 的帧时长
   * - speed: 游速, 0 是悬停, 1 是快游
   * - turn: 转弯时身体的侧弯量
   * - gaze: 世界坐标里的注视点, 为空时眼睛朝外
   */
  function animate({ f, speed, turn = 0, gaze = null }) {
    phase += (0.05 + speed * 0.22) * f
    const amp = 0.06 + speed * 0.16
    const pos = geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const z = rest[i * 3 + 2]
      pos.setX(i, rest[i * 3] + bend(z, amp, turn))
    }
    pos.needsUpdate = true

    const root0 = bend(-0.86, amp, turn)
    const slope = (root0 - bend(-0.7, amp, turn)) / 0.16
    tail.position.x = root0
    tail.rotation.y = -Math.atan(slope)
    ripple(tail, phase * 1.05 - 1, 0.25 + speed * 0.4, 2.2)
    dorsal.position.x = bend(0.05, amp, turn)
    ripple(dorsal, phase * 0.9, 0.1, 2)
    for (const a of anals) {
      a.position.x = bend(-0.45, amp, turn) + a.rotation.z * 0.3
      ripple(a, phase, 0.08, 2)
    }
    for (const p of pectorals) {
      const s = p.userData.side
      p.rotation.z = s * (1.1 + Math.sin(phase * 0.8) * 0.35)
      p.rotation.y = s * (0.5 + Math.sin(phase * 0.8 + 1) * 0.2)
      ripple(p, phase * 1.3, 0.05, 2)
    }
    lip.scale.setScalar(1 + Math.sin(phase * 0.5) * 0.18)

    root.updateMatrixWorld()
    for (const eye of eyes) {
      eye.position.x = eye.userData.base.x + bend(0.58, amp, turn)
      if (!gaze) continue
      eye.getWorldPosition(eyeWorld)
      outward.set(eye.userData.side, 0.1, 0.3).transformDirection(root.matrixWorld)
      toward.subVectors(gaze, eyeWorld).normalize()
      // 不让眼珠转到眼窝里面
      if (toward.dot(outward) < 0.1) toward.addScaledVector(outward, 0.1 - toward.dot(outward)).normalize()
      eye.lookAt(eyeWorld.add(outward.add(toward.multiplyScalar(1.6))))
    }
  }

  const mouth = new THREE.Vector3()
  return {
    root,
    animate,
    /** 嘴的世界坐标 */
    mouth: () => lip.getWorldPosition(mouth),
  }
}

/** 气泡: 点精灵, 空心圆环加高光, 慢慢上浮并左右摇摆 */
export function createBubbles({ scene }) {
  const position = new Float32Array(BUBBLES * 3)
  const size = new Float32Array(BUBBLES)
  const life = new Float32Array(BUBBLES)
  const rise = new Float32Array(BUBBLES)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1))
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 500 } },
      vertexShader: /* glsl */ `
        attribute float aSize, aLife;
        uniform float uScale;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aLife > 0.0 && mv.z < -0.2 ? aSize * uScale / -mv.z : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q);
          if (d > 0.5) discard;
          float ring = (1.0 - smoothstep(0.45, 0.5, d)) * (0.12 + 0.88 * smoothstep(0.3, 0.47, d));
          float glint = 1.0 - smoothstep(0.05, 0.1, length(q - vec2(-0.17, -0.17)));
          float fade = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.8, 1.0, vLife));
          float a = max(ring, glint) * fade * 0.5;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vec3(0.7, 0.76, 0.82), a);
        }
      `,
    }),
  )
  points.frustumCulled = false
  points.renderOrder = 6
  scene.add(points)
  let next = 0

  /** 在 at 处吐出 n 个气泡, scale 为气泡的世界尺寸 */
  function emit(at, n = 1, scale = 0.2) {
    for (let k = 0; k < n; k++) {
      const i = next++ % BUBBLES
      position[i * 3] = at.x + (Math.random() - 0.5) * scale
      position[i * 3 + 1] = at.y + (Math.random() - 0.5) * scale
      position[i * 3 + 2] = at.z + (Math.random() - 0.5) * scale
      size[i] = scale * (0.3 + Math.random() * 0.7)
      life[i] = 0.001 + k * 0.02
      rise[i] = scale * (0.04 + Math.random() * 0.05)
    }
  }

  function update({ f, time, pixelScale }) {
    points.material.uniforms.uScale.value = pixelScale
    for (let i = 0; i < BUBBLES; i++) {
      if (life[i] <= 0) continue
      life[i] += 0.0035 * f
      if (life[i] >= 1) {
        life[i] = 0
        continue
      }
      position[i * 3] += Math.sin(time * 3 + i) * rise[i] * 0.15 * f
      position[i * 3 + 1] += rise[i] * f
      size[i] *= 1.0015 ** f
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
    geometry.attributes.aLife.needsUpdate = true
  }

  return { emit, update }
}
