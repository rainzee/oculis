const strip = document.getElementById('tabs')
const root = document.documentElement

// 标签栏即标题栏, 按平台给窗口按钮留位置
root.dataset.platform = window.tabs.platform
window.tabs.onFullscreen((on) => root.classList.toggle('fullscreen', on))

// 关闭图标取自 GitHub Octicons
const CLOSE_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" /></svg>'

function renderTab({ id, title, path, active }) {
  const tab = document.createElement('div')
  tab.className = 'tab'
  tab.role = 'tab'
  tab.title = path
  tab.dataset.id = id
  tab.ariaSelected = active
  const label = tab.appendChild(document.createElement('span'))
  label.textContent = title
  const close = tab.appendChild(document.createElement('button'))
  close.className = 'close'
  close.title = '关闭 (Ctrl+W)'
  close.ariaLabel = '关闭'
  close.innerHTML = CLOSE_ICON
  return tab
}

window.tabs.onUpdate((tabs) => {
  strip.replaceChildren(...tabs.map(renderTab))
  strip.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest' })
})

strip.addEventListener('mousedown', (e) => {
  const tab = e.target.closest('.tab')
  if (!tab || e.button !== 0 || e.target.closest('.close')) return
  window.tabs.activate(Number(tab.dataset.id))
})
// 中键关闭, 与浏览器一致
strip.addEventListener('auxclick', (e) => {
  const tab = e.target.closest('.tab')
  if (tab && e.button === 1) window.tabs.close(Number(tab.dataset.id))
})
strip.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab')
  if (tab && e.target.closest('.close')) window.tabs.close(Number(tab.dataset.id))
})
// 竖向滚轮横向滚动标签
strip.addEventListener('wheel', (e) => (strip.scrollLeft += e.deltaY + e.deltaX), { passive: true })
// 点击后把焦点还给文档, 键盘滚动和缩放都作用于文档
document.addEventListener('mouseup', () => window.tabs.focusPage())

document.addEventListener('dragover', (e) => {
  if (!e.dataTransfer.types.includes('Files')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
})
document.addEventListener('drop', (e) => {
  e.preventDefault()
  if (e.dataTransfer.files.length) window.tabs.openFile(e.dataTransfer.files[0])
})
