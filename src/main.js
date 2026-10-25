import { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme } from 'electron'
import { readFile } from 'node:fs/promises'
import { watch, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderMarkdown } from './render.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const MD_EXT = /\.(md|markdown|mdown|mkd|mkdn|mdx|txt)$/i

let win = null
let currentFile = null
let watcher = null
let pendingFile = findFileArg(process.argv)

function findFileArg(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2)
  return args.find((a) => !a.startsWith('-') && existsSync(a) && statSync(a).isFile()) ?? null
}

async function openFile(file) {
  if (!win) {
    pendingFile = file
    return
  }
  file = path.resolve(file)
  let source
  try {
    source = await readFile(file, 'utf8')
  } catch (err) {
    dialog.showErrorBox('无法打开文件', `${file}\n\n${err.message}`)
    return
  }
  const sameFile = file === currentFile
  currentFile = file
  win.setTitle(path.basename(file))
  win.setRepresentedFilename?.(file)
  app.addRecentDocument(file)
  win.webContents.send('render', {
    html: renderMarkdown(source),
    baseUrl: pathToFileURL(path.dirname(file) + path.sep).href,
    keepScroll: sameFile,
  })
  if (!sameFile) watchFile(file)
}

function watchFile(file) {
  watcher?.close()
  let timer = null
  try {
    watcher = watch(file, () => {
      clearTimeout(timer)
      timer = setTimeout(() => existsSync(file) && file === currentFile && openFile(file), 120)
    })
  } catch {
    watcher = null
  }
}

async function showOpenDialog() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (!canceled && filePaths[0]) openFile(filePaths[0])
}

/** 处理文档内链接点击: 站内 Markdown 在本窗口打开, 其他交给系统 */
function handleLink(url) {
  let target
  try {
    target = new URL(url)
  } catch {
    return
  }
  if (target.protocol === 'file:') {
    const file = fileURLToPath(target)
    if (MD_EXT.test(file) && existsSync(file)) return openFile(file)
    if (existsSync(file)) return shell.openPath(file)
    return
  }
  if (['http:', 'https:', 'mailto:'].includes(target.protocol)) shell.openExternal(url)
}

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 1000,
    minWidth: 420,
    minHeight: 300,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#ffffff',
    // 打包后图标来自可执行文件, 开发时用 build/icon.png
    icon: app.isPackaged ? undefined : path.join(here, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    handleLink(url)
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    handleLink(url)
    return { action: 'deny' }
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.once('did-finish-load', () => {
    if (pendingFile) openFile(pendingFile)
    pendingFile = null
  })
  win.on('closed', () => {
    win = null
    watcher?.close()
  })
  win.loadFile(path.join(here, 'index.html'))
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: showOpenDialog },
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => currentFile && openFile(currentFile) },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'copy', label: '复制' },
        { role: 'selectAll', label: '全选' },
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
  app.on('second-instance', (_e, argv) => {
    const file = findFileArg(argv)
    if (file) openFile(file)
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

  app.whenReady().then(() => {
    buildMenu()
    createWindow()
    app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
  })

  app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
}
