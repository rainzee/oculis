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
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return
  if (e.key === 'Enter') window.finder.step(!e.shiftKey)
  else if (e.key === 'Escape') window.finder.close()
  else return
  e.preventDefault()
})

prev.addEventListener('click', () => window.finder.step(false))
next.addEventListener('click', () => window.finder.step(true))
document.getElementById('close').addEventListener('click', () => window.finder.close())
document.querySelector('form').addEventListener('submit', (e) => e.preventDefault())

window.finder.onOpen(() => {
  input.focus()
  input.select()
})
window.finder.onResult(showResult)
showResult({ active: 0, matches: 0 })
