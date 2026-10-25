import pkg from '../../package.json'
import { createAudio } from './audio.js'
import { loadFonts } from './textures.js'

const root = document.documentElement
const nav = document.getElementById('nav')
const gate = document.getElementById('gate')
const enter = document.getElementById('enter')
const hint = document.getElementById('hint')
const cta = document.getElementById('cta')
const progress = nav.querySelector('[data-progress]')
const sound = nav.querySelector('[data-sound]')

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function supportsWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/** 最近一次提交, 拿不到就保持隐藏 */
async function showCommit() {
  try {
    const res = await fetch('https://api.github.com/repos/rainzee/oculis/commits/main')
    if (!res.ok) return
    const { sha, commit } = await res.json()
    const hours = (Date.now() - new Date(commit.committer.date)) / 36e5
    const ago = hours < 1 ? 'just now' : hours < 48 ? `${Math.floor(hours)}h` : `${Math.floor(hours / 24)}d`
    nav.querySelector('[data-sha]').textContent = sha.slice(0, 7)
    nav.querySelector('[data-pushed]').textContent = ` pushed to main ${ago}`
    nav.querySelector('[data-commit]').hidden = false
  } catch {}
}

/** 警示文字逐词模糊淡入 */
function revealTokens(el) {
  const words = el.textContent.trim().split(/\s+/)
  el.innerHTML = words
    .map((word, i) => `<span class="token" style="transition-delay:${i * 18}ms">${word}</span>`)
    .join(' ')
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shown')))
}

/** 加载进度: 随机递增, 场景就绪前停在 99 */
function loadProgress(ready) {
  let value = 0
  let done = false
  ready.then(() => (done = true))
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      value = Math.min(done ? 100 : 99, value + Math.random() * 15)
      progress.textContent = value >= 100 ? 'load progress DONE' : `load progress ${Math.floor(value)}/100%`
      if (value >= 100) {
        clearInterval(timer)
        resolve()
      }
    }, 100)
  })
}

async function main() {
  nav.querySelector('[data-version]').textContent = pkg.version
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !supportsWebGL()) {
    root.classList.add('still-mode')
    loadFonts()
    return
  }

  history.scrollRestoration = 'manual'
  window.scrollTo(0, 0)
  root.classList.add('locked')
  revealTokens(gate.querySelector('[data-tokens]'))
  showCommit()

  const audio = createAudio()
  const ready = loadFonts().then(async () => {
    const { createScene } = await import('./scene.js')
    return createScene({
      container: document.getElementById('stage'),
      audio,
      hooks: { onLoop: () => updateProgress() },
    })
  })
  await loadProgress(ready)
  const scene = await ready
  enter.disabled = false
  enter.classList.add('ready')

  function updateProgress() {
    const p = scene.progress
    const percent = Math.round((window.scrollY / document.body.scrollHeight) * 100)
    const loops = scene.loops
    if (loops >= 7) {
      progress.textContent = 'memory alert · engaging manual audio'
      progress.classList.add('malfunction')
    } else {
      const prefix = loops ? `loop ${loops} · ` : ''
      progress.textContent = `${prefix}scroll progress ${String(percent).padStart(3, ' ')}/100%`
    }
    const shown = smooth(10.5, 10.9, p) * (1 - smooth(11.6, 11.9, p))
    cta.style.opacity = shown
    cta.classList.toggle('live', shown > 0.5)
  }

  // 停在顶部 3 秒后重新显示滚动提示
  let idle = null
  function onScroll() {
    updateProgress()
    hint.classList.add('hidden')
    clearTimeout(idle)
    idle = setTimeout(() => scene.progress < 0.05 && hint.classList.remove('hidden'), 3000)
  }

  enter.addEventListener(
    'click',
    () => {
      audio.start()
      scene.enter()
      root.classList.remove('locked')
      document.body.classList.remove('gated')
      nav.classList.remove('inverse')
      gate.classList.add('leaving')
      setTimeout(() => gate.remove(), 2200)
      updateProgress()
      window.addEventListener('scroll', onScroll, { passive: true })
    },
    { once: true },
  )

  const toggleSound = () => {
    audio.setMuted(!audio.muted)
    sound.querySelector('span').textContent = audio.muted ? 'Sound off' : 'Sound on'
  }
  sound.addEventListener('click', toggleSound)
  nav.querySelector('[data-sha]').addEventListener('click', () => scene.zoom())
  window.addEventListener('keydown', (e) => e.key === 'm' && !e.metaKey && !e.ctrlKey && toggleSound())
  window.addEventListener('resize', () => scene.resize())
}

main()
