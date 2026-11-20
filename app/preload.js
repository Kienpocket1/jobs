const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('api', {
  licInfo: () => ipcRenderer.invoke('lic:info'),
  licStatus: () => ipcRenderer.invoke('lic:status'),
  activate: (k) => ipcRenderer.invoke('lic:activate', k),
  copy: (t) => ipcRenderer.invoke('copy', t), // preload sandbox không có clipboard -> nhờ main
  loadTracks: () => ipcRenderer.invoke('tracks:load'),
  saveTracks: (l) => ipcRenderer.invoke('tracks:save', l),
  readFile: (p) => ipcRenderer.invoke('file:read', p),
  pickFiles: () => ipcRenderer.invoke('file:pick'),
  pathOf: (f) => webUtils.getPathForFile(f),
  smoke: () => ipcRenderer.invoke('smoke:get'),
  smokeLog: (m) => ipcRenderer.send('smoke:log', m),
  smokeDone: (ok) => ipcRenderer.send('smoke:done', ok),
});
