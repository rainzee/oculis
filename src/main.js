import { app, BrowserWindow, Menu, WebContentsView, dialog, ipcMain, shell, nativeTheme } from 'electron'
import { readFile } from 'node:fs/promises'
import { watch, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderMarkdown } from './render.js'
import { createFindBar } from './find-bar.js'
import electronUpdater from 'electron-updater'

const here = path.dirname(fileURLToPath(import.meta.url))
const MD_EXT = /\.(md|markdown|mdown|mkd|mkdn|mdx|txt)$/i
const STRIP_HEIGHT = 36

let win = null
let findBar = null
/** 每个标签页一个文档视图, file 为 null 表示空白页 */
let tabs = []
let active = null
let nextId = 1
let pendingFiles = findFileArgs(process.argv)

function findFileArgs(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2)
  return args.filter((a) => !a.startsWith('-') && existsSync(a) && statSync(a).isFile())
}

// 只有一个标签页时不显示标签栏, 与单文档时的外观一致
const stripHeight = () => (tabs.length > 1 ? STRIP_HEIGHT : 0)
const backgroundColor = () => (nativeTheme.shouldUseDarkColors ? '#0d1117' : '#ffffff')

async function readSource(file) {
  try {
    return await readFile(file, 'utf8')
  } catch (err) {
    dialog.showErrorBox('无法打开文件', `${file}\n\n${err.message}`)
    return null
  }
}

/** 打开文件: 已打开则切过去并刷新, 当前是空白页则就地打开, 否则新建标签页 */
async function openFile(file) {
  if (!win) {
    pendingFiles.push(file)
    return
  }
  file = path.resolve(file)
  const source = await readSource(file)
  if (source === null || !win) return
  const tab = tabs.find((t) => t.file === file) ?? (active.file ? createTab() : active)
  show(tab, file, source)
  activate(tab)
}

async function reload(tab) {
  const source = await readSource(tab.file)
  if (source !== null && tabs.includes(tab)) show(tab, tab.file, source)
}

function show(tab, file, source) {
  const sameFile = file === tab.file
  tab.file = file
  if (!sameFile) watchFile(tab)
  app.addRecentDocument(file)
  const payload = {
    html: renderMarkdown(source),
    baseUrl: pathToFileURL(path.dirname(file) + path.sep).href,
    keepScroll: sameFile,
  }
  const page = tab.view.webContents
  tab.ready.then(() => page.isDestroyed() || page.send('render', payload))
  if (tab === active) updateTitle()
  updateStrip()
}

function watchFile(tab) {
  tab.watcher?.close()
  const { file } = tab
  let timer = null
  tab.watcher = watch(file, () => {
    clearTimeout(timer)
    timer = setTimeout(() => existsSync(file) && file === tab.file && reload(tab), 120)
  })
}

async function showOpenDialog() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (!canceled) for (const file of filePaths) openFile(file)
}

/** 处理文档内链接点击: 站内 Markdown 在当前标签页打开, 其他交给系统 */
async function handleLink(tab, url) {
  const { protocol } = new URL(url)
  if (protocol === 'file:') {
    const file = fileURLToPath(url)
    if (!existsSync(file)) return
    if (!MD_EXT.test(file)) return shell.openPath(file)
    const source = await readSource(file)
    if (source !== null && tabs.includes(tab)) show(tab, file, source)
  } else if (['http:', 'https:', 'mailto:'].includes(protocol)) shell.openExternal(url)
}

function createTab() {
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      spellcheck: false,
    },
  })
  view.setBackgroundColor(backgroundColor())
  const page = view.webContents
  const tab = { id: nextId++, view, file: null, watcher: null }
  tab.ready = new Promise((resolve) => page.once('did-finish-load', resolve))
  page.on('will-navigate', (e, url) => {
    e.preventDefault()
    handleLink(tab, url)
  })
  page.setWindowOpenHandler(({ url }) => {
    handleLink(tab, url)
    return { action: 'deny' }
  })
  findBar.attach(page)
  page.loadFile(path.join(here, 'index.html'))
  view.setVisible(false)
  win.contentView.addChildView(view)
  tabs.push(tab)
  return tab
}

function activate(tab) {
  if (active !== tab) active?.view.setVisible(false)
  active = tab
  tab.view.setVisible(true)
  layout()
  findBar.setPage(tab.view.webContents)
  tab.view.webContents.focus()
  updateTitle()
  updateStrip()
}

/** 关闭标签页, 关掉最后一个即关闭窗口 */
function closeTab(tab) {
  if (tabs.length === 1) return win.close()
  const index = tabs.indexOf(tab)
  tabs.splice(index, 1)
  win.contentView.removeChildView(tab.view)
  destroyTab(tab)
  if (tab === active) {
    active = null
    activate(tabs[Math.min(index, tabs.length - 1)])
  } else {
    layout()
    updateStrip()
  }
}

function destroyTab(tab) {
  tab.watcher?.close()
  // 移除视图或关闭窗口都不会销毁它的 webContents
  tab.view.webContents.close()
}

function cycleTab(step) {
  if (tabs.length < 2) return
  activate(tabs[(tabs.indexOf(active) + step + tabs.length) % tabs.length])
}

function layout() {
  const { width, height } = win.getContentBounds()
  const top = stripHeight()
  for (const tab of tabs) tab.view.setBounds({ x: 0, y: top, width, height: height - top })
  findBar.layout()
}

function updateTitle() {
  win.setTitle(active.file ? path.basename(active.file) : 'Oculis')
  win.setRepresentedFilename(active.file ?? '')
}

function updateStrip() {
  const strip = win.webContents
  const list = tabs
    .filter((t) => t.file)
    .map((t) => ({ id: t.id, title: path.basename(t.file), path: t.file, active: t === active }))
  if (strip.isLoading()) strip.once('did-finish-load', () => strip.send('tabs', list))
  else strip.send('tabs', list)
}

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 1000,
    minWidth: 420,
    minHeight: 300,
    show: false,
    title: 'Oculis',
    autoHideMenuBar: true,
    backgroundColor: backgroundColor(),
    // 打包后图标来自可执行文件, 开发时用 build/icon.png
    icon: app.isPackaged ? undefined : path.join(here, '..', 'build', 'icon.png'),
    // 窗口自身只承载标签栏, 文档在各标签页的视图里
    webPreferences: {
      preload: path.join(here, 'tabs-preload.cjs'),
      // 独立会话, 文档缩放不会波及标签栏
      partition: 'tabs',
      spellcheck: false,
    },
  })

  const strip = win.webContents
  // 标题跟随当前文档, 不用标签栏页面的标题
  win.on('page-title-updated', (e) => e.preventDefault())
  strip.on('will-navigate', (e) => e.preventDefault())
  strip.ipc.on('activate', (_e, id) => {
    const tab = tabs.find((t) => t.id === id)
    if (tab) activate(tab)
  })
  strip.ipc.on('close', (_e, id) => {
    const tab = tabs.find((t) => t.id === id)
    if (tab) closeTab(tab)
  })
  strip.ipc.on('focus-page', () => active?.view.webContents.focus())
  strip.loadFile(path.join(here, 'tabs.html'))

  findBar = createFindBar(win, stripHeight)
  win.on('resize', layout)
  win.on('closed', () => {
    for (const tab of tabs) destroyTab(tab)
    win = null
    findBar = null
    tabs = []
    active = null
  })

  const first = createTab()
  activate(first)
  first.ready.then(() => {
    win?.show()
    const files = pendingFiles
    pendingFiles = []
    for (const file of files) openFile(file)
  })
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: showOpenDialog },
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => active?.file && reload(active) },
        { type: 'separator' },
        { label: '关闭标签页', accelerator: 'CmdOrCtrl+W', click: () => active && closeTab(active) },
        isMac ? { role: 'close', label: '关闭窗口', accelerator: 'CmdOrCtrl+Shift+W' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'copy', label: '复制' },
        { role: 'selectAll', label: '全选' },
        { label: '查找…', accelerator: 'CmdOrCtrl+F', click: () => active?.file && findBar.open() },
        { type: 'separator' },
        { label: '下一个标签页', accelerator: 'Ctrl+Tab', click: () => cycleTab(1) },
        { label: '上一个标签页', accelerator: 'Ctrl+Shift+Tab', click: () => cycleTab(-1) },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // 再次打开文件时交给已运行的实例, 在新标签页中打开
  app.on('second-instance', (_e, argv) => {
    for (const file of findFileArgs(argv)) openFile(file)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  // macOS 通过 Finder 或 Dock 打开文件
  app.on('open-file', (e, file) => {
    e.preventDefault()
    openFile(file)
  })

  ipcMain.on('open-path', (_e, file) => file && openFile(file))
  ipcMain.on('open-dialog', showOpenDialog)
  ipcMain.on('rendered', (e) => e.sender === active?.view.webContents && findBar.refresh())

  app.whenReady().then(() => {
    buildMenu()
    createWindow()
    // macOS 只有 ad-hoc 签名, 无法通过更新时的签名校验, 自动更新仅在 Windows 启用
    if (process.platform === 'win32') electronUpdater.autoUpdater.checkForUpdates().catch(() => {})
    app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
  })

  app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
}
