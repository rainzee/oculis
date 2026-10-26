const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('finder', {
  query: (text) => ipcRenderer.send('query', text),
  step: (forward) => ipcRenderer.send('step', forward),
  close: () => ipcRenderer.send('close'),
  onOpen: (callback) => ipcRenderer.on('open', () => callback()),
  onResult: (callback) => ipcRenderer.on('result', (_e, result) => callback(result)),
})
