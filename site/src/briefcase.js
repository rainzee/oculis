import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { SANS, MONO } from './textures.js'

const display = (hex) => new THREE.Color(hex).convertLinearToSRGB()

// 箱体尺寸: 平放, 宽 x, 深 z, 下半壳高与箱盖高
const W = 3
const D = 2.1
const BASE = 0.42
const LID = 0.3
const GOLD = '#ffb53d'
export const PAPER_ASPECT = 1 / 1.3

/** 一页按 GitHub 样式渲染好的 README */
function readmeTexture() {
  const w = 1000
  const h = 1300
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ebe5d8'
  ctx.fillRect(0, 0, w, h)
  const ink = '#1f2328'
  const muted = '#59636e'
  const rule = 'rgba(31,35,40,0.18)'
  const x = 80
  let y = 130

  ctx.fillStyle = ink
  ctx.font = `700 92px ${SANS}`
  ctx.fillText('README', x, y)
  y += 34
  ctx.fillStyle = rule
  ctx.fillRect(x, y, w - x * 2, 3)
  y += 80
  ctx.fillStyle = ink
  ctx.font = `700 44px ${SANS}`
  ctx.fillText('Open is the only verb.', x, y)
  y += 64
  ctx.fillStyle = muted
  ctx.font = `400 34px ${SANS}`
  ctx.fillText('A minimalist, read-only Markdown viewer.', x, y)
  y += 48
  ctx.fillText('Opinionated, GitHub by default.', x, y)

  y += 100
  ctx.fillStyle = ink
  ctx.font = `700 52px ${SANS}`
  ctx.fillText("What's inside", x, y)
  y += 24
  ctx.fillStyle = rule
  ctx.fillRect(x, y, w - x * 2, 2)
  y += 70
  ctx.font = `400 36px ${SANS}`
  for (const item of ['Nothing to edit', 'Nothing to save', 'Nothing else']) {
    ctx.beginPath()
    ctx.arc(x + 14, y - 12, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillText(item, x + 44, y)
    y += 58
  }

  y += 40
  ctx.fillStyle = 'rgba(129,139,152,0.16)'
  ctx.beginPath()
  ctx.roundRect(x, y, w - x * 2, 110, 14)
  ctx.fill()
  ctx.fillStyle = ink
  ctx.font = `400 34px ${MONO}`
  ctx.fillText('$ oculis README.md', x + 34, y + 68)

  y += 180
  ctx.fillStyle = '#0969da'
  ctx.fillRect(x, y - 50, 8, 120)
  ctx.font = `700 34px ${SANS}`
  ctx.fillText('ⓘ Note', x + 36, y - 6)
  ctx.fillStyle = ink
  ctx.font = `400 34px ${SANS}`
  ctx.fillText('This file cannot be changed.', x + 36, y + 48)

  ctx.fillStyle = muted
  ctx.font = `400 26px ${MONO}`
  ctx.fillText('README.md · read only', x, h - 70)

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

/** 从箱口往上打的金色光柱, 方锥台, 叠加混合, 带缓慢流动的条纹 */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uColor: { value: display(GOLD) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rise = pow(vUv.y, 1.6);
        float edge = pow(abs(dot(vNormal, vView)), 1.5);
        float streak = 0.6 + 0.4 * sin(vUv.x * 60.0 + uTime * 0.7) * sin(vUv.x * 23.0 - uTime * 0.4);
        float a = rise * edge * streak * uPower * 0.22;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  })
}

/**
 * 黑色硬壳手提箱, 打开后金光溢出, 里面只有一份 README
 *
 * 局部坐标里箱子平放, 铰链在 -z 一侧, open 从 0 到 1 掀开箱盖;
 * paper 是独立放在场景里的, 由调用方安排它的飞行
 */
export function createBriefcase({ scene, envMap }) {
  const root = new THREE.Group()
  root.visible = false
  scene.add(root)

  const leather = new THREE.MeshPhysicalMaterial({
    color: display('#121214'),
    roughness: 0.38,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    envMap,
    envMapIntensity: 1.2,
  })
  const brass = new THREE.MeshStandardMaterial({ color: display('#c9a24a'), metalness: 1, roughness: 0.28, envMap, envMapIntensity: 1.4 })
  const lining = new THREE.MeshStandardMaterial({
    color: display('#3a2a10'),
    emissive: display(GOLD),
    emissiveIntensity: 0,
  })
  const lidLining = new THREE.MeshStandardMaterial({ color: display('#2a2016'), roughness: 0.9 })

  const base = new THREE.Mesh(new RoundedBoxGeometry(W, BASE, D, 4, 0.08), leather)
  base.position.y = BASE / 2
  root.add(base)

  // 箱内衬, 发光的那一面
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.22, D - 0.22), lining)
  glow.rotation.x = -Math.PI / 2
  glow.position.y = BASE + 0.003
  root.add(glow)

  const hinge = new THREE.Group()
  hinge.position.set(0, BASE, -D / 2)
  root.add(hinge)
  const lid = new THREE.Mesh(new RoundedBoxGeometry(W, LID, D, 4, 0.08), leather)
  lid.position.set(0, LID / 2, D / 2)
  hinge.add(lid)
  const lidInside = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.22, D - 0.22), lidLining)
  lidInside.rotation.x = Math.PI / 2
  lidInside.position.set(0, -0.003, D / 2)
  hinge.add(lidInside)

  // 提手在前侧, 两个锁扣在接缝上
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 32, Math.PI), leather)
  handle.rotation.x = Math.PI / 2
  handle.position.set(0, BASE, D / 2)
  root.add(handle)
  const latches = [-1, 1].map((side) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.95, BASE - 0.1, D / 2 + 0.02)
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.26, 0.05, 2, 0.02), brass)
    plate.position.y = 0.1
    pivot.add(plate)
    root.add(pivot)
    return pivot
  })
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const corner = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), brass)
      corner.position.set(sx * (W / 2 - 0.08), 0.02, sz * (D / 2 - 0.08))
      root.add(corner)
    }
  }

  const light = new THREE.PointLight(display(GOLD), 0, 8, 1.6)
  light.position.set(0, BASE + 0.5, 0.1)
  root.add(light)

  const beamGeometry = new THREE.CylinderGeometry(1.05, 0.7, 3.4, 4, 1, true)
  beamGeometry.rotateY(Math.PI / 4)
  beamGeometry.translate(0, 1.7, 0)
  const beam = new THREE.Mesh(beamGeometry, beamMaterial())
  beam.scale.set(W / 1.4 / 0.7, 1, D / 1.4 / 0.7)
  beam.position.y = BASE
  beam.renderOrder = 7
  root.add(beam)

  // 光柱里飘浮的金色尘埃
  const DUST = 220
  const dustPos = new Float32Array(DUST * 3)
  const dustSeed = new Float32Array(DUST)
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * W * 0.9
    dustPos[i * 3 + 1] = BASE + Math.random() * 3
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * D * 0.9
    dustSeed[i] = Math.random()
  }
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1))
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uScale: { value: 500 }, uColor: { value: display(GOLD) } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uScale;
        varying float vTwinkle;
        void main() {
          vec3 p = position;
          p.y = ${BASE.toFixed(2)} + mod(p.y - ${BASE.toFixed(2)} + uTime * (0.08 + aSeed * 0.12), 3.0);
          p.x += sin(uTime * 0.6 + aSeed * 40.0) * 0.08;
          vTwinkle = (0.4 + 0.6 * sin(uTime * 3.0 + aSeed * 60.0)) * (1.0 - (p.y - ${BASE.toFixed(2)}) / 3.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.012 + aSeed * 0.02) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uPower;
        uniform vec3 uColor;
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = (1.0 - smoothstep(0.1, 0.5, d)) * vTwinkle * uPower * 0.7;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
    }),
  )
  root.add(dust)

  // README: 微微卷曲的纸, 自身带一点光, 在暗场里也读得清
  const map = readmeTexture()
  const paperGeometry = new THREE.PlaneGeometry(PAPER_ASPECT, 1, 24, 24)
  const pp = paperGeometry.attributes.position
  for (let i = 0; i < pp.count; i++) {
    const px = pp.getX(i) / PAPER_ASPECT
    const py = pp.getY(i)
    pp.setZ(i, -0.05 * px * px - 0.03 * py * py)
  }
  paperGeometry.computeVertexNormals()
  const paper = new THREE.Mesh(
    paperGeometry,
    new THREE.MeshStandardMaterial({
      map,
      emissiveMap: map,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.85,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  )
  paper.visible = false
  paper.renderOrder = 8
  scene.add(paper)

  /**
   * 推进一帧
   *
   * 参数
   * - open: 箱盖开合, 0 到 1
   * - power: 金光强度, 0 到 1
   * - latch: 锁扣弹开, 0 到 1
   * - time: 秒
   * - pixelScale: 用于尘埃的透视尺寸
   */
  function update({ open, power, latch, time, pixelScale }) {
    hinge.rotation.x = -open * 1.85
    latches.forEach((l, i) => (l.rotation.x = -latch * (1.2 + i * 0.1)))
    lining.emissiveIntensity = 0.85 * power
    light.intensity = 9 * power
    beam.material.uniforms.uPower.value = power
    beam.material.uniforms.uTime.value = time
    dust.material.uniforms.uPower.value = power
    dust.material.uniforms.uTime.value = time
    dust.material.uniforms.uScale.value = pixelScale * root.scale.x
  }

  /** 箱内衬中心的世界坐标, README 从这里升起 */
  const inside = new THREE.Vector3()
  return {
    root,
    paper,
    update,
    inside: () => glow.getWorldPosition(inside),
    size: { w: W, d: D },
  }
}
