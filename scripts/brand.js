// Oculis 视觉识别的唯一几何来源, 详见 design/identity.html
//
// 64 网格, 单位 u = 4 (线宽)
// - 上下眼睑: 半径 30 的两段圆弧, 圆心 (32,14) 与 (32,50), 与眼角构成 3:4:5 直角三角形
//   以三次贝塞尔绘制, 控制柄 (12,16) 恰为该圆弧的四分切线长度
// - 杏仁形中线尺寸 48 x 24, 中心 (32,32)
// - 瞳孔: 半径 2u 的圆, 唯一的品牌色

export const IRIS = '#2b44ff'
export const IRIS_LIGHT = '#7d8cff'
export const INK = '#0d1117'
export const SNOW = '#f0f6fc'

export const EYE_OPEN = 'M8 32 C20 16 44 16 56 32 C44 48 20 48 8 32 Z'
export const LID_CLOSED = 'M8 32 C20 48 44 48 56 32'

// 字标, 单线几何, 线宽 5, x 高 24, 升部 36, 基线 y 36
export const WORD = `
    <g fill="none" stroke="currentColor" stroke-width="5">
      <circle cx="12" cy="24" r="9.5" />
      <path d="M48.28 30.11 A 9.5 9.5 0 1 1 48.28 17.89" />
      <path d="M57.5 12 V 24 A 9.5 9.5 0 0 0 76.5 24 M76.5 12 V 36" />
      <path d="M86.5 0 V 36" />
      <path d="M96.5 12 V 36" />
      <path d="M115.36 16.875 A 4.75 4.75 0 1 0 111.25 24 A 4.75 4.75 0 1 1 107.14 31.125" />
    </g>
    <circle cx="96.5" cy="4.5" r="3" fill="currentColor" />`

/** 线条标志, 墨色眼睑, 品牌色瞳孔 */
export function markSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <path d="${EYE_OPEN}" fill="none" stroke="${INK}" stroke-width="4" />
  <circle cx="32" cy="32" r="8" fill="${IRIS}" />
</svg>
`
}

/**
 * 标志与字标组合, 眼睛立于基线, 高度等于升部
 *
 * 眼睛按线宽 5 放大 1.25 倍, 字标右移 76.2
 */
export function logoSvg({ color, pupil }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 195 36" width="390" height="72" color="${color}">
  <title>Oculis</title>
  <path d="M3.1 18.5 C18.1 -1.5 48.1 -1.5 63.1 18.5 C48.1 38.5 18.1 38.5 3.1 18.5 Z" fill="none" stroke="currentColor" stroke-width="5" />
  <circle cx="33.1" cy="18.5" r="10" fill="${pupil}" />
  <g transform="translate(76.2 0)">${WORD}
  </g>
</svg>
`
}

/**
 * 应用图标, 品牌色底, 实心白色杏仁, 瞳孔镂空为品牌色
 *
 * inset 为 macOS 规范的留白, 1024 画布内图块为 824
 */
export function iconSvg({ inset = false } = {}) {
  const tile = inset ? 824 : 1024
  const offset = (1024 - tile) / 2
  const radius = tile * 0.2246
  const markSize = tile * 0.738
  const markOffset = offset + (tile - markSize) / 2
  const scale = markSize / 64
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect x="${offset}" y="${offset}" width="${tile}" height="${tile}" rx="${radius}" fill="${IRIS}" />
  <g transform="translate(${markOffset} ${markOffset}) scale(${scale})">
    <path d="${EYE_OPEN}" fill="#fff" stroke="#fff" stroke-width="4" />
    <circle cx="32" cy="32" r="8" fill="${IRIS}" />
  </g>
</svg>
`
}
