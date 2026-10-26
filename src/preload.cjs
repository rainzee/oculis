const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('oculis', {
  onRender: (callback) => ipcRenderer.on('render', (_e, payload) => callback(payload)),
  openFile: (file) => ipcRenderer.send('open-path', webUtils.getPathForFile(file)),
  openDialog: () => ipcRenderer.send('open-dialog'),
  rendered: () => ipcRenderer.send('rendered'),
})
