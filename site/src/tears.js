import * as THREE from 'three'

const display = (hex) => new THREE.Color(hex).convertLinearToSRGB()
const DROPS = 90

/** 尖头朝上的泪滴, 高约 2, 底部是半球 */
function dropGeometry() {
  const geometry = new THREE.SphereGeometry(1, 20, 16)
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const k = y > 0 ? (1 - y) ** 0.9 * 0.85 + 0.15 * (1 - y) : 1
    pos.setXYZ(i, pos.getX(i) * k, y > 0 ? y * 1.6 : y, pos.getZ(i) * k)
  }
  geometry.computeVertexNormals()
  return geometry
}

/**
 * 眼泪: 从下眼睑的眼角涌出, 顺着重力落下, 被甩动时向外飞溅
 *
 * 位置都在世界坐标里, 由调用方给出眼角的世界坐标与眼睛的尺寸
 */
export function createTears({ scene, envMap }) {
  const mesh = new THREE.InstancedMesh(
    dropGeometry(),
    new THREE.MeshPhysicalMaterial({
      color: display('#cfe3ff'),
      emissive: display('#5a72ff'),
      emissiveIntensity: 0.18,
      roughness: 0.04,
      clearcoat: 1,
      envMap,
      envMapIntensity: 1.6,
      transparent: true,
      opacity: 0.88,
    }),
    DROPS,
  )
  mesh.renderOrder = 11
  mesh.frustumCulled = false
  mesh.count = DROPS
  scene.add(mesh)

  const drops = Array.from({ length: DROPS }, () => ({
    alive: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    size: 0,
    cling: 0,
    age: 0,
  }))
  const dummy = new THREE.Object3D()
  let next = 0

  /**
   * 生成一滴泪
   *
   * 参数
   * - at: 世界坐标
   * - size: 泪滴半径
   * - vx, vy: 初速度, 每帧的世界单位
   * - cling: 先挂在眼角慢慢长大的时长, 秒
   */
  function emit(at, size, vx = 0, vy = 0, cling = 0.5) {
    const d = drops[next++ % DROPS]
    d.alive = true
    d.pos.copy(at)
    d.vel.set(vx, vy, 0)
    d.size = size
    d.cling = cling
    d.age = 0
  }

  /** 推进一帧, floor 以下的泪滴消失, follow 是挂着时跟随的位移 */
  function update({ f, dt, floor, follow }) {
    drops.forEach((d, i) => {
      if (!d.alive) {
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        return
      }
      d.age += dt
      let grow = 1
      if (d.age < d.cling) {
        // 挂在眼角: 跟着眼睛走, 慢慢胀大
        grow = 0.3 + 0.7 * (d.age / d.cling)
        d.pos.add(follow)
        d.pos.y -= d.size * 0.004 * f
      } else {
        d.vel.y -= d.size * 0.012 * f
        d.vel.multiplyScalar(0.995 ** f)
        d.pos.addScaledVector(d.vel, f)
      }
      if (d.pos.y < floor) d.alive = false
      const speed = d.vel.length()
      dummy.position.copy(d.pos)
      // 尖头指向来处, 越快拉得越长
      dummy.rotation.set(0, 0, speed > 1e-4 ? Math.atan2(d.vel.x, -d.vel.y) : 0)
      dummy.scale.set(d.size * grow, d.size * grow * (1 + Math.min(1.2, speed / d.size * 1.5)), d.size * grow)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  return { emit, update }
}
