import * as THREE from 'three'

// 画面不做输出色彩转换, 所以 uniform 里直接放 sRGB 分量
const srgb = (hex) => new THREE.Color(hex).convertLinearToSRGB()

const HASH = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`

/**
 * 标题平面的材质
 *
 * 顶点阶段: 字形质量沿扫描窗口凸起 (uDepth, uSweep), 底边顶点随机飞出 (uSpike),
 * 右缘燃烧剥落 (uBurn), 整体抖动 (uJitter) 与碎裂 (uShatter), 随机数按帧和顶点编号生成
 */
export function headlineMaterial(map, { head, source }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uVisible: { value: 0 },
      uSlide: { value: 0 },
      uDepth: { value: 0 },
      uSweep: { value: -1 },
      uSpike: { value: -1 },
      uBurn: { value: 2 },
      uJitter: { value: 0 },
      uShatter: { value: 0 },
      uSeed: { value: Math.random() * 100 },
      uHead: { value: srgb(head) },
      uSource: { value: srgb(source) },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime, uSlide, uDepth, uSweep, uSpike, uBurn, uJitter, uShatter, uSeed;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vUv = uv;
        vec3 p = position;
        // 几何是非索引的: 燃烧与尖刺按 uv 取随机数, 共享的角一起动, 拉出火舌;
        // 碎裂按三角形编号取随机数, 每片完整飞散
        float frame = floor(uTime * 60.0);
        vec2 key = floor(uv * 512.0 + 0.5);
        float r1 = hash(key + vec2(frame, uSeed));
        float r2 = hash(key * 1.37 + vec2(frame * 0.71, uSeed));
        float tri = floor(float(gl_VertexID) / 3.0);
        float window = uSweep < -0.5 ? 1.0 : exp(-pow((uv.x - uSweep) * 3.2, 2.0));
        float mass = textureLod(uMap, uv + vec2(0.0, uSlide), 5.0).r;
        p.z += mass * uDepth * window;
        // 飞出的顶点停在镜头前, 不穿过近裁剪面铺满画面
        if (uv.y < uSpike + (r2 - 0.5) * 0.04) p.z += 2.2 * r1;
        p.z += r1 * uJitter;
        if (uv.x > uBurn + (r2 - 0.5) * 0.06) {
          p.z += 1.4 * r1;
          p.y -= uv.x * r1 * 0.36;
          p.x = 0.56;
        }
        // 碎裂向四周散开而不是冲向镜头
        vec3 shard = vec3(hash(vec2(tri, uSeed)), hash(vec2(tri * 2.13, uSeed + 7.0)), hash(vec2(tri * 0.61, uSeed + 3.0)));
        p.xy += (shard.xy - 0.5) * uShatter * 1.6;
        p.z += uShatter * 6.0 * (shard.z - 0.35);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime, uVisible, uSlide;
      uniform vec3 uHead, uSource;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv + vec2(0.0, uSlide);
        float inside = step(0.0, uv.y) * step(uv.y, 1.0);
        vec4 t = texture2D(uMap, uv);
        vec4 s = texture2D(uMap, uv + sin(uTime * 100.0) * 0.002);
        float head = t.r * t.a * inside;
        float src = s.g * s.a * inside;
        float a = clamp(head + src, 0.0, 1.0) * uVisible;
        if (a < 0.003) discard;
        vec3 color = mix(uHead, uSource, src / (head + src + 1e-4));
        gl_FragColor = vec4(color, a);
      }
    `,
  })
}

/** 功能跑马灯, 随滚动横移, 带波动与闪烁 */
export function stripMaterial(map) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uVisible: { value: 0 },
      uShatter: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uShatter;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vUv = uv;
        vec3 p = position;
        float tri = floor(float(gl_VertexID) / 3.0);
        p.xy += (vec2(hash(vec2(tri, 1.0)), hash(vec2(tri, 2.0))) - 0.5) * uShatter * 1.6;
        p.z += uShatter * 6.0 * (hash(vec2(tri, 3.0)) - 0.35);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime, uProgress, uVisible;
      varying vec2 vUv;
      void main() {
        float wobble = sin(vUv.x * 11.1415 + uTime * 0.2) * 0.015;
        vec2 uv = vec2(vUv.x * 0.6 + wobble - uProgress * 0.4, vUv.y);
        vec4 t = texture2D(uMap, uv);
        float a = t.r * t.a * uVisible;
        if (a < 0.003) discard;
        float flicker = 0.75 + 0.25 * sin(uTime * 3.0);
        gl_FragColor = vec4(vec3(flicker), a);
      }
    `,
  })
}

/** 背景平铺的小眼睛, 奇偶列反向滚动 */
export function tileMaterial(map) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uColumns: { value: 30 },
      uRows: { value: 40 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime, uColumns, uRows;
      varying vec2 vUv;
      void main() {
        vec2 uv = vec2(vUv.x * uColumns, vUv.y * uRows);
        uv.y -= (mod(floor(uv.x), 2.0) - 0.5) * uTime;
        vec4 t = texture2D(uMap, uv * 0.5);
        float a = t.r * t.a * 0.08;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vec3(0.8, 0.84, 1.0), a);
      }
    `,
  })
}

/**
 * 品牌眼睛的材质, 在 64 网格里按 scripts/brand.js 的几何求值
 *
 * 下眼睑是圆心 (32,14) 半径 30 的圆弧, 上眼睑是过两个眼角, 拱高 s 的圆弧,
 * s 从 -12 (闭眼, 与下眼睑重合) 变到 12 (睁眼, 圆心 (32,50) 半径 30)
 */
export function eyeMaterial(sclera, colors) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uOpen: { value: 0 },
      uGaze: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uFire: { value: 0 },
      uSclera: { value: sclera },
      uIris: { value: srgb(colors.iris) },
      uIrisLight: { value: srgb(colors.irisLight) },
      uInk: { value: srgb(colors.ink) },
      uSnow: { value: srgb(colors.snow) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpen, uTime, uScroll, uFire;
      uniform vec2 uGaze;
      uniform sampler2D uSclera;
      uniform vec3 uIris, uIrisLight, uInk, uSnow;
      varying vec2 vUv;
      ${HASH}

      // 正值在眼内
      float lowerLid(vec2 q) {
        return 30.0 - length(q - vec2(32.0, 14.0));
      }

      float upperLid(vec2 q, float s) {
        if (abs(s) < 0.05) return q.y - 32.0;
        float r = (576.0 + s * s) / (2.0 * abs(s));
        if (s > 0.0) return r - length(q - vec2(32.0, 32.0 - s + r));
        return length(q - vec2(32.0, 32.0 - s - r)) - r;
      }

      void main() {
        vec2 q = vec2(vUv.x, 1.0 - vUv.y) * 64.0;
        float s = mix(-12.0, 12.0, uOpen);
        float dl = lowerLid(q);
        float du = upperLid(q, s);
        float d = min(dl, du);
        float aa = max(fwidth(d), 1e-3);
        float inside = smoothstep(-aa, aa, d);

        // 眼睑描边, 线宽 4; 闭合时两弧重合, 只保留两眼角之间的一段
        float stroke = 1.0 - smoothstep(2.0 - aa, 2.0 + aa, abs(d));
        if (s < 0.0) stroke = (1.0 - smoothstep(2.0 - aa, 2.0 + aa, abs(dl))) * smoothstep(29.0, 31.0, q.y);

        // 巩膜, 反射着滚动的 Markdown 源码
        vec2 sp = (q - 32.0) / 24.0;
        vec2 suv = sp * (1.0 - 0.22 * dot(sp, sp)) * 0.5 + 0.5;
        suv.y += uScroll * 0.06 + uTime * 0.01;
        float text = texture2D(uSclera, suv).r;
        vec3 sclera = uSnow * (0.78 - 0.16 * text);
        sclera *= mix(0.45, 1.0, smoothstep(0.0, 8.0, d));

        // 瞳孔: 唯一的品牌色, 半径 8
        vec2 c = vec2(32.0) + uGaze * vec2(12.0, 3.0 * uOpen);
        float dc = length(q - c);
        float ang = atan(q.y - c.y, q.x - c.x);
        float fibers = noise(vec2(ang * 9.0, dc * 0.9 - uTime * 0.4));
        vec3 iris = uIris * (0.8 + 0.45 * fibers);
        iris *= mix(1.0, 0.55, smoothstep(5.5, 8.0, dc));
        iris = mix(uInk, iris, smoothstep(2.2, 3.2, dc));
        float irisMask = 1.0 - smoothstep(8.0 - aa, 8.0 + aa, dc);
        vec3 color = mix(sclera, iris, irisMask);
        float glint = 1.0 - smoothstep(0.7, 1.3, length(q - c - vec2(-2.6, -2.8)));
        color = mix(color, vec3(1.0), glint * 0.9 * irisMask);

        color = mix(color, uSnow * 1.15, stroke);
        float alpha = max(inside, stroke);

        // 蓝色火焰, 第一次循环之后出现
        if (uFire > 0.0) {
          float outside = max(-d, 0.0);
          float n = fbm(q * vec2(0.09, 0.06) + vec2(0.0, uTime * 1.6));
          float up = q.y < 32.0 ? 1.4 : 0.45;
          float height = (6.0 + 30.0 * n) * up;
          float flame = (1.0 - smoothstep(0.0, height, outside)) * step(0.001, outside) * uFire;
          vec3 fire = mix(uIris, uIrisLight, smoothstep(0.2, 0.8, n));
          fire = mix(fire, vec3(1.0), (1.0 - smoothstep(0.0, 3.0, outside)) * 0.6);
          color = mix(fire, color, alpha);
          alpha = max(alpha, flame * 0.95);
        }
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
}
