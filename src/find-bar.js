import { WebContentsView } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// 视图比查找栏大一圈, 给阴影留位置, 右侧让开文档滚动条; 窗口 minWidth 保证放得下
const WIDTH = 380
const HEIGHT = 64
const RIGHT = 16

const isFindNext = (input) => input.key === 'F3' || ((input.control || input.meta) && input.key.toLowerCase() === 'g')

/**
 * 页内查找栏
 *
 * 查找栏放在独立的 WebContentsView 里, 若与文档同页,
 * findInPage 会把输入框里的文字也算作匹配并抢走焦点,
 * 查找对象是当前标签页, 由 setPage 切换, getTop 给出标签栏下沿
 */
export function createFindBar(win, getTop) {
  let page = null
  let view = null
  let query = ''
  let requestId = 0

  const isOpen = () => view?.getVisible() ?? false

  function send(channel, payload) {
    const bar = view.webContents
    if (bar.isLoading()) bar.once('did-finish-load', () => bar.send(channel, payload))
    else bar.send(channel, payload)
  }

  function search(options) {
    if (!query) {
      requestId = 0
      page.stopFindInPage('clearSelection')
      send('result', { active: 0, matches: 0 })
      return
    }
    requestId = page.findInPage(query, options)
  }

  function layout() {
    if (!view) return
    const { width } = win.getContentBounds()
    view.setBounds({ x: width - WIDTH - RIGHT, y: getTop(), width: WIDTH, height: HEIGHT })
  }

  function createView() {
    view = new WebContentsView({
      webPreferences: {
        preload: path.join(here, 'find-preload.cjs'),
        // 独立会话, 文档缩放不会波及查找栏
        partition: 'find-bar',
        spellcheck: false,
      },
    })
    view.setBackgroundColor('#00000000')
    const bar = view.webContents
    // 拖入文件会让查找栏导航到该文件
    bar.on('will-navigate', (e) => e.preventDefault())
    bar.on('before-input-event', onKey)
    bar.ipc.on('query', (_e, text) => {
      query = text
      search({ findNext: true })
    })
    bar.ipc.on('step', (_e, forward) => step(forward))
    bar.ipc.on('close', close)
    bar.loadFile(path.join(here, 'find.html'))
    // 窗口关闭不会销毁子视图的 webContents
    win.once('closed', () => bar.close())
  }

  function open() {
    if (!view) createView()
    // 重复添加会把视图移到最上层, 盖过之后新建的标签页
    win.contentView.addChildView(view)
    layout()
    view.setVisible(true)
    view.webContents.focus()
    send('open')
    if (query) search({ findNext: true })
  }

  function close() {
    requestId = 0
    page.stopFindInPage('keepSelection')
    view.setVisible(false)
    page.focus()
  }

  function step(forward) {
    if (query) search({ findNext: false, forward })
  }

  /** 文档重新渲染后旧的高亮已失效, 重新查找 */
  function refresh() {
    if (isOpen() && query) search({ findNext: true })
  }

  function onKey(e, input) {
    if (input.type !== 'keyDown' || !isOpen()) return
    if (input.key === 'Escape') close()
    else if (isFindNext(input)) step(!input.shift)
    else return
    e.preventDefault()
  }

  /** 接管一个标签页的按键与查找结果 */
  function attach(contents) {
    contents.on('before-input-event', onKey)
    contents.on('found-in-page', (_e, result) => {
      if (contents !== page || result.requestId !== requestId || !result.finalUpdate) return
      send('result', { active: result.activeMatchOrdinal, matches: result.matches })
    })
  }

  /** 切换查找对象, 查找栏开着时在新标签页上重新查找 */
  function setPage(contents) {
    if (contents === page) return
    if (page && !page.isDestroyed()) page.stopFindInPage('keepSelection')
    page = contents
    requestId = 0
    refresh()
  }

  return { open, refresh, attach, setPage, layout }
}
