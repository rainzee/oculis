// 由 scripts/brand.js 生成全部品牌资源: assets/*.svg 与 build/icon.{png,ico,icns}
// 用法: bun run icons

import { Resvg } from '@resvg/resvg-js'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INK, IRIS, IRIS_LIGHT, SNOW, iconSvg, logoSvg, markSvg } from './brand.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'assets')
const build = path.join(root, 'build')

/** 按目标尺寸矢量渲染 SVG 为透明 PNG, 每个尺寸都重新绘制而不是从大图缩小 */
function rasterize(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
}

/** ICO 容器, 每个尺寸直接内嵌 PNG */
function ico(entries) {
  const header = Buffer.alloc(6 + entries.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(({ size, data }, i) => {
    const at = 6 + i * 16
    header.writeUInt8(size >= 256 ? 0 : size, at)
    header.writeUInt8(size >= 256 ? 0 : size, at + 1)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(data.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...entries.map((e) => e.data)])
}

/** ICNS 容器, 各 OSType 对应的 PNG 尺寸见 Apple 规范 */
function icns(entries) {
  const chunks = entries.map(({ type, data }) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(data.length + 8, 4)
    return Buffer.concat([head, data])
  })
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(8 + chunks.reduce((n, c) => n + c.length, 0), 4)
  return Buffer.concat([head, ...chunks])
}

// Windows 与 Linux 使用满版图块, macOS 使用带留白的图块
const full = iconSvg()
const inset = iconSvg({ inset: true })
const render = (svg, sizes) => Object.fromEntries(sizes.map((size) => [size, rasterize(svg, size)]))

const win = render(full, [16, 24, 32, 48, 64, 128, 256, 1024])
const mac = render(inset, [16, 32, 64, 128, 256, 512, 1024])

await writeFile(path.join(assets, 'mark.svg'), markSvg())
await writeFile(path.join(assets, 'logo-light.svg'), logoSvg({ color: INK, pupil: IRIS }))
await writeFile(path.join(assets, 'logo-dark.svg'), logoSvg({ color: SNOW, pupil: IRIS_LIGHT }))
await writeFile(path.join(assets, 'icon.svg'), full)
await writeFile(path.join(build, 'icon.png'), win[1024])
await writeFile(path.join(build, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: win[size] }))))
await writeFile(
  path.join(build, 'icon.icns'),
  icns([
    { type: 'icp4', data: mac[16] },
    { type: 'icp5', data: mac[32] },
    { type: 'ic11', data: mac[32] },
    { type: 'ic12', data: mac[64] },
    { type: 'ic07', data: mac[128] },
    { type: 'ic13', data: mac[256] },
    { type: 'ic08', data: mac[256] },
    { type: 'ic14', data: mac[512] },
    { type: 'ic09', data: mac[512] },
    { type: 'ic10', data: mac[1024] },
  ]),
)
console.log('icons written to assets/ and build/')
