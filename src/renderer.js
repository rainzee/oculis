const empty = document.getElementById('empty')
const content = document.getElementById('content')

let base = document.querySelector('base')
if (!base) {
  base = document.createElement('base')
  document.head.prepend(base)
}

let diagrams = []

/** 用 Pele 将 mermaid 代码块挂载为可缩放, 自适应宽度的 SVG 图表 */
function mountDiagrams() {
  for (const d of diagrams) d.destroy()
  diagrams = []
  for (const pre of content.querySelectorAll('pre.mermaid')) {
    const container = document.createElement('div')
    container.className = 'mermaid-diagram'
    pre.replaceWith(container)
    diagrams.push(window.pele.mount(container, pre.textContent))
  }
}

window.oculis.onRender(({ html, baseUrl, keepScroll }) => {
  const scroll = keepScroll ? window.scrollY : 0
  base.href = baseUrl
  content.innerHTML = html
  mountDiagrams()
  content.hidden = false
  empty.hidden = true
  window.scrollTo(0, scroll)
})

// 页内锚点直接滚动, 其余链接交给主进程处理
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href.startsWith('#')) return
  e.preventDefault()
  const id = decodeURIComponent(href.slice(1))
  const target = document.getElementById(id) ?? document.getElementsByName(id)[0]
  target?.scrollIntoView()
})

const isFileDrag = (e) => e.dataTransfer?.types.includes('Files')
const setDragging = (on) => document.body.classList.toggle('dragging', on)

document.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return
  e.preventDefault()
  setDragging(true)
})
document.addEventListener('dragover', (e) => {
  if (!isFileDrag(e)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
})
// relatedTarget 为 null 说明拖离了窗口, 元素之间移动不会隐藏遮罩
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) setDragging(false)
})
document.addEventListener('drop', (e) => {
  e.preventDefault()
  setDragging(false)
  const file = e.dataTransfer.files[0]
  if (file) window.oculis.openFile(file)
})

empty.addEventListener('dblclick', () => window.oculis.openDialog())
