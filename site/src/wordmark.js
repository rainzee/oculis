import * as THREE from 'three'

const display = (hex) => new THREE.Color(hex).convertLinearToSRGB()

// 字标几何来自 scripts/brand.js 的 WORD, 单位与 SVG 相同, 线宽 5, 基线 y 36
const STROKE = 2.5
export const WORD_WIDTH = 120
const ORIGIN = { x: 57.5, y: 19 }

/** SVG 坐标里的圆弧, 角度按 y 向下的方向计 */
class Arc extends THREE.Curve {
  constructor(cx, cy, r, a0, a1) {
    super()
    Object.assign(this, { cx, cy, r, a0, a1 })
  }

  getPoint(t, target = new THREE.Vector3()) {
    const a = this.a0 + (this.a1 - this.a0) * t
    return target.set(this.cx + this.r * Math.cos(a), -(this.cy + this.r * Math.sin(a)), 0)
  }
}

const line = (x0, y0, x1, y1) => new THREE.LineCurve3(new THREE.Vector3(x0, -y0, 0), new THREE.Vector3(x1, -y1, 0))
const path = (...curves) => {
  const p = new THREE.CurvePath()
  for (const c of curves) p.add(c)
  return p
}

const C_ANGLE = Math.atan2(6.11, 7.28)
const S_ANGLE = Math.atan2(2.375, 4.11)

// 每个字母: 中心, 笔画, 需要圆头的端点, 是否带点
const LETTERS = [
  { center: [12, 24], strokes: [{ curve: new Arc(12, 24, 9.5, 0, Math.PI * 2), closed: true }] },
  { center: [40, 24], strokes: [{ curve: new Arc(41, 24, 9.5, C_ANGLE, Math.PI * 2 - C_ANGLE) }] },
  {
    center: [67, 24],
    strokes: [
      { curve: path(line(57.5, 12, 57.5, 24), new Arc(67, 24, 9.5, Math.PI, 0)) },
      { curve: line(76.5, 12, 76.5, 36) },
    ],
  },
  { center: [86.5, 18], strokes: [{ curve: line(86.5, 0, 86.5, 36) }] },
  { center: [96.5, 20], strokes: [{ curve: line(96.5, 12, 96.5, 36) }], dot: [96.5, 4.5] },
  {
    center: [111.25, 24],
    strokes: [
      {
        curve: path(
          new Arc(111.25, 19.25, 4.75, -S_ANGLE, -S_ANGLE - (Math.PI * 4) / 3),
          new Arc(111.25, 28.75, 4.75, -Math.PI / 2, Math.PI - S_ANGLE),
        ),
      },
    ],
  },
]

/**
 * 立体的 oculis 字标, 每个字母是一组可以单独转动的镀铬管
 *
 * i 的点用品牌色发光, 对应眼睛的瞳孔
 */
export function createWordmark({ scene, envMap, iris, snow }) {
  const chrome = new THREE.MeshPhysicalMaterial({
    color: display(snow),
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    iridescence: 0.6,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [180, 620],
    envMap,
    envMapIntensity: 1.3,
  })
  const glow = new THREE.MeshStandardMaterial({
    color: display(iris),
    emissive: display(iris),
    emissiveIntensity: 0.8,
    roughness: 0.2,
  })
  const cap = new THREE.SphereGeometry(STROKE, 24, 16)

  const group = new THREE.Group()
  group.visible = false
  scene.add(group)

  const letters = LETTERS.map((spec, index) => {
    const [cx, cy] = spec.center
    const letter = new THREE.Group()
    const offset = new THREE.Vector3(-cx, cy, 0)
    for (const { curve, closed = false } of spec.strokes) {
      const segments = Math.max(16, Math.round(curve.getLength() * 2))
      const tube = new THREE.TubeGeometry(curve, segments, STROKE, 20, closed)
      tube.translate(offset.x, offset.y, 0)
      letter.add(new THREE.Mesh(tube, chrome))
      if (closed) continue
      for (const t of [0, 1]) {
        const end = new THREE.Mesh(cap, chrome)
        end.position.copy(curve.getPoint(t)).add(offset)
        letter.add(end)
      }
    }
    if (spec.dot) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 20), glow)
      dot.position.set(spec.dot[0] - cx, cy - spec.dot[1], 0)
      letter.add(dot)
    }
    letter.traverse((o) => (o.userData.letter = index))
    letter.userData = { home: new THREE.Vector3(cx - ORIGIN.x, ORIGIN.y - cy, 0), spin: 0, angle: 0, letter: index }
    letter.position.set(0, 0, -400)
    group.add(letter)
    return letter
  })

  return { group, letters }
}
