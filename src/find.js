const input = document.getElementById('query')
const count = document.getElementById('count')
const prev = document.getElementById('prev')
const next = document.getElementById('next')

function showResult({ active, matches }) {
  const searching = input.value !== ''
  count.textContent = searching ? `${active} / ${matches}` : ''
  count.classList.toggle('none', searching && matches === 0)
  prev.disabled = next.disabled = matches === 0
}

// 输入法组字过程中的拼音不参与查找, 上屏后再查
input.addEventListener('input', (e) => e.isComposing || window.finder.query(input.value))
input.addEventListener('compositionend', () => window.finder.query(input.value))
// Esc 与 F3 由主进程的 before-input-event 处理
input.addEventListener('keydown', (e) => e.key === 'Enter' && !e.isComposing && window.finder.step(!e.shiftKey))

prev.addEventListener('click', () => window.finder.step(false))
next.addEventListener('click', () => window.finder.step(true))
document.getElementById('close').addEventListener('click', () => window.finder.close())

window.finder.onOpen(() => {
  input.focus()
  input.select()
})
window.finder.onResult(showResult)
