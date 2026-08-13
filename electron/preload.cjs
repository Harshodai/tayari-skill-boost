const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tayariDesktop", {
  status: () => ipcRenderer.invoke("desktop:status"),
  pickFiles: () => ipcRenderer.invoke("desktop:pick-files"),
  revealFile: (filePath) => ipcRenderer.invoke("desktop:reveal-file", filePath),
  openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
  startServices: () => ipcRenderer.invoke("desktop:start-services"),
  stopServices: () => ipcRenderer.invoke("desktop:stop-services"),
  settings: (next) => ipcRenderer.invoke("desktop:settings", next),
});
