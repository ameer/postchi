const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  startSession: (config) => ipcRenderer.invoke('start-session', config),
  stopSession: (id) => ipcRenderer.invoke('stop-session', id),
  setGlobalCookies: (data) => ipcRenderer.invoke('set-global-cookies', data),
  onLog: (callback) => {
    ipcRenderer.on('backend-log', (event, logData) => callback(logData));
  }
});