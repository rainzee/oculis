import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { gfmHeadingId, resetHeadings } from 'marked-gfm-heading-id'
import markedAlert from 'marked-alert'
import markedFootnote from 'marked-footnote'
import hljs from 'highlight.js'

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
  gfmHeadingId(),
  markedAlert(),
  markedFootnote(),
  { gfm: true },
)

/** 将 Markdown 源文本渲染为 HTML */
export function renderMarkdown(source) {
  resetHeadings()
  return marked.parse(source.replace(/^\uFEFF/, ''))
}
