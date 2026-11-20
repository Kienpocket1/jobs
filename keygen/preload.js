const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('keygen', {
  make: (form) => ipcRenderer.invoke('make-key', form),
  history: () => ipcRenderer.invoke('history'),
  copy: (t) => ipcRenderer.invoke('copy', t), // preload sandbox không có clipboard -> nhờ main
});
