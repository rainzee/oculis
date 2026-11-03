const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('tabs', {
  onUpdate: (callback) => ipcRenderer.on('tabs', (_e, tabs) => callback(tabs)),
  activate: (id) => ipcRenderer.send('activate', id),
  close: (id) => ipcRenderer.send('close', id),
  focusPage: () => ipcRenderer.send('focus-page'),
  openFile: (file) => ipcRenderer.send('open-path', webUtils.getPathForFile(file)),
})
