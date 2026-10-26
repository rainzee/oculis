import { Marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import markedAlert from 'marked-alert'
import markedFootnote from 'marked-footnote'
import { codeToHtml, isSupportedLanguage } from '@pierre/highlights'
import { githubLightDefault, githubDarkDefault } from '@pierre/highlights/themes'

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
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

// gfmHeadingId 在每次 parse 前重置标题 id 计数
const marked = new Marked(gfmHeadingId(), markedAlert(), markedFootnote(), {
  renderer: {
    code(token) {
      // 缩进代码块没有 lang, marked 已去掉首尾空白
      const lang = (token.lang ?? '').split(/\s/)[0].toLowerCase()
      const code = token.text.replace(/\n$/, '')
      // mermaid 源码原样保留, 交给渲染进程中的 Pele 绘制
      if (lang === 'mermaid') return `<pre class="mermaid">${escapeHtml(code)}</pre>\n`
      return `${highlight(code, lang)}\n`
    },
  },
})

/** 将 Markdown 源文本渲染为 HTML */
export function renderMarkdown(source) {
  return marked.parse(source.replace(/^\uFEFF/, ''))
}
