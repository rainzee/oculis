import * as THREE from 'three'
import { WORD, LID_CLOSED, EYE_OPEN } from '../../scripts/brand.js'
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'
import interItalic from '@fontsource-variable/inter/files/inter-latin-wght-italic.woff2'
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'

export const SANS = '"Inter Variable", Inter, system-ui, sans-serif'
export const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'

/** 加载拉丁字符子集的字体, 页面与画布纹理共用 */
export async function loadFonts() {
  const faces = [
    new FontFace('Inter Variable', `url(${inter})`, { weight: '100 900' }),
    new FontFace('Inter Variable', `url(${interItalic})`, { weight: '100 900', style: 'italic' }),
    new FontFace('JetBrains Mono Variable', `url(${mono})`, { weight: '100 800' }),
  ]
  for (const face of faces) document.fonts.add(face)
  await Promise.allSettled(faces.map((face) => face.load()))
  await Promise.all([
    document.fonts.load(`800 64px ${SANS}`),
    document.fonts.load(`italic 900 64px ${SANS}`),
    document.fonts.load(`400 64px ${MONO}`),
  ])
}

function canvas(width, height) {
  const el = document.createElement('canvas')
  el.width = width
  el.height = height
  return [el, el.getContext('2d')]
}

function texture(el, { repeat = false, mipmaps = true } = {}) {
  const tex = new THREE.CanvasTexture(el)
  tex.colorSpace = THREE.NoColorSpace
  tex.generateMipmaps = mipmaps
  tex.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  tex.anisotropy = 4
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** 以给定字体把多行文字缩放到盒子内, 返回字号 */
function fit(ctx, lines, font, maxWidth, maxHeight, lineHeight, tracking) {
  let size = maxHeight / (lines.length * lineHeight)
  for (let i = 0; i < 40; i++) {
    ctx.font = font(size)
    ctx.letterSpacing = `${tracking * size}px`
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width))
    if (widest <= maxWidth) break
    size *= (maxWidth / widest) * 0.99
  }
  return size
}

/**
 * 标题纹理, 红通道是渲染后的标题, 绿通道是它的 Markdown 源码
 *
 * 着色器分别采样两个通道, 源码层带抖动, 形成渲染与源码叠印的效果
 */
export function headlineTexture({ lines, source, aspect = 2, fill = 0.86, align = 'center' }) {
  const width = 2048
  const height = Math.round(width / aspect)
  const [el, ctx] = canvas(width, height)
  const lineHeight = 0.92
  const heading = (size) => `800 ${size}px ${SANS}`
  const size = fit(ctx, lines, heading, width * fill, height * fill, lineHeight, -0.055)
  const blockHeight = size * lineHeight * lines.length
  const x = align === 'center' ? width / 2 : width * (1 - fill) * 0.5
  ctx.textAlign = align === 'center' ? 'center' : 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgb(255 0 0)'
  lines.forEach((line, i) => {
    const baseline = (height - blockHeight) / 2 + size * lineHeight * (i + 0.8)
    ctx.fillText(line, x, baseline)
  })

  if (source) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgb(0 255 0)'
    const mono = (s) => `400 ${s}px ${MONO}`
    const sourceSize = Math.min(size * 0.2, fit(ctx, [source], mono, width * fill, height, 1, -0.02))
    ctx.font = mono(sourceSize)
    ctx.letterSpacing = `${-0.02 * sourceSize}px`
    ctx.fillText(source, x, (height - blockHeight) / 2 - sourceSize * 0.4)
  }
  return texture(el)
}

/** 功能清单跑马灯, 横向可平铺 */
export function stripTexture(text) {
  const [el, ctx] = canvas(4096, 256)
  ctx.fillStyle = 'rgb(255 0 0)'
  ctx.textBaseline = 'middle'
  const size = 150
  ctx.font = `800 ${size}px ${SANS}`
  ctx.letterSpacing = `${-0.04 * size}px`
  const unit = ctx.measureText(text).width
  ctx.save()
  ctx.scale(4096 / unit, 1)
  ctx.fillText(text, 0, 132)
  ctx.restore()
  return texture(el, { repeat: true })
}

/** 背景平铺的小眼睛, 闭眼与睁眼交替 */
export function tileTexture() {
  const [el, ctx] = canvas(128, 128)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 4
  ctx.lineJoin = 'miter'
  ctx.stroke(new Path2D(EYE_OPEN))
  ctx.setTransform(1, 0, 0, 1, 64, 58)
  ctx.stroke(new Path2D(LID_CLOSED))
  return texture(el, { repeat: true })
}

/** 巩膜里反射的 Markdown 源码 */
export function scleraTexture(lines) {
  const [el, ctx] = canvas(1024, 1024)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 1024, 1024)
  ctx.fillStyle = '#fff'
  ctx.font = `400 30px ${MONO}`
  ctx.textBaseline = 'top'
  for (let row = 0, y = 12; y < 1024; row++, y += 42) {
    ctx.fillText(lines[row % lines.length], 24, y)
  }
  return texture(el, { repeat: true })
}

/**
 * 字标的每个字母单独成一张纹理, 几何来自 scripts/brand.js
 *
 * 返回字母在字标坐标系中的中心与尺寸, 字标坐标 x 向右, y 向下, 基线 36
 */
export function glyphTextures() {
  const svg = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${WORD}</svg>`, 'image/svg+xml')
  const shapes = [...svg.querySelectorAll('circle, path')]
  // 顺序: o, c, u, l, i 竖线, s, i 的点
  const [o, c, u, l, i, s, dot] = shapes
  const glyphs = [
    { parts: [o], box: [0, 12, 24, 38] },
    { parts: [c], box: [26, 12, 51, 38] },
    { parts: [u], box: [54, 9, 80, 39] },
    { parts: [l], box: [83, -3, 90, 39] },
    { parts: [i, dot], box: [92, -3, 101, 39] },
    { parts: [s], box: [103, 13, 119, 36] },
  ]
  const scale = 12
  return glyphs.map(({ parts, box }) => {
    const [x0, y0, x1, y1] = box
    const [el, ctx] = canvas(Math.ceil((x1 - x0) * scale), Math.ceil((y1 - y0) * scale))
    ctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale)
    ctx.strokeStyle = 'rgb(255 0 0)'
    ctx.fillStyle = 'rgb(255 0 0)'
    ctx.lineWidth = 5
    for (const part of parts) {
      if (part.tagName === 'circle') {
        const cx = +part.getAttribute('cx')
        const cy = +part.getAttribute('cy')
        const r = +part.getAttribute('r')
        const path = new Path2D()
        path.arc(cx, cy, r, 0, Math.PI * 2)
        if (part.getAttribute('fill') === 'currentColor') ctx.fill(path)
        else ctx.stroke(path)
      } else {
        ctx.stroke(new Path2D(part.getAttribute('d')))
      }
    }
    return {
      texture: texture(el),
      center: [(x0 + x1) / 2, (y0 + y1) / 2],
      size: [x1 - x0, y1 - y0],
    }
  })
}
