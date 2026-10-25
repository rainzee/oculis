import { Marked } from 'marked'
import { gfmHeadingId, resetHeadings } from 'marked-gfm-heading-id'
import markedAlert from 'marked-alert'
import markedFootnote from 'marked-footnote'
import { codeToHtml, isSupportedLanguage } from '@pierre/highlights'
import { githubLightDefault, githubDarkDefault } from '@pierre/highlights/themes'

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
const fenceLang = (lang) => (lang ?? '').trim().split(/\s/)[0].toLowerCase()
const decoder = new TextDecoder()

/** 高亮代码块, light-dark() 让配色跟随 color-scheme 切换 */
function highlight(code, lang) {
  const html = codeToHtml(code, {
    lang: isSupportedLanguage(lang) ? lang : 'plaintext',
    themes: { light: githubLightDefault, dark: githubDarkDefault },
    defaultColor: 'light-dark()',
  })
  // 返回值共享 wasm 内存, 必须在下一次调用前解码
  return decoder.decode(html)
}

const marked = new Marked(
  gfmHeadingId(),
  markedAlert(),
  markedFootnote(),
  {
    gfm: true,
    renderer: {
      code(token) {
        const lang = fenceLang(token.lang)
        const code = token.text.replace(/\n$/, '')
        // mermaid 源码原样保留, 交给渲染进程中的 Pele 绘制
        if (lang === 'mermaid') return `<pre class="mermaid">${escapeHtml(code)}</pre>\n`
        return `${highlight(code, lang)}\n`
      },
    },
  },
)

/** 将 Markdown 源文本渲染为 HTML */
export function renderMarkdown(source) {
  resetHeadings()
  return marked.parse(source.replace(/^\uFEFF/, ''))
}
