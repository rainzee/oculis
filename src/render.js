import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { gfmHeadingId, resetHeadings } from 'marked-gfm-heading-id'
import markedAlert from 'marked-alert'
import markedFootnote from 'marked-footnote'
import hljs from 'highlight.js'

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
const isMermaid = (lang) => (lang ?? '').trim().split(/\s/)[0].toLowerCase() === 'mermaid'

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      // mermaid 源码原样保留, 交给渲染进程中的 Pele 绘制
      if (isMermaid(lang)) return code
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
  gfmHeadingId(),
  markedAlert(),
  markedFootnote(),
  {
    gfm: true,
    renderer: {
      code(token) {
        if (!isMermaid(token.lang)) return false
        return `<pre class="mermaid">${escapeHtml(token.text.replace(/\n$/, ''))}</pre>\n`
      },
    },
  },
)

/** 将 Markdown 源文本渲染为 HTML */
export function renderMarkdown(source) {
  resetHeadings()
  return marked.parse(source.replace(/^\uFEFF/, ''))
}
