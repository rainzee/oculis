const empty = document.getElementById('empty')
const content = document.getElementById('content')

let base = document.querySelector('base')
if (!base) {
  base = document.createElement('base')
  document.head.prepend(base)
}

window.oculis.onRender(({ html, baseUrl, keepScroll }) => {
  const scroll = keepScroll ? window.scrollY : 0
  base.href = baseUrl
  content.innerHTML = html
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

let dragDepth = 0
document.addEventListener('dragenter', (e) => {
  e.preventDefault()
  if (++dragDepth === 1) document.body.classList.add('dragging')
})
document.addEventListener('dragleave', () => {
  if (--dragDepth === 0) document.body.classList.remove('dragging')
})
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => {
  e.preventDefault()
  dragDepth = 0
  document.body.classList.remove('dragging')
  const file = e.dataTransfer.files[0]
  if (file) window.oculis.openFile(file)
})

empty.addEventListener('dblclick', () => window.oculis.openDialog())
