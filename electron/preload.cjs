const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tayariDesktop", {
  status: () => ipcRenderer.invoke("desktop:status"),
  pickFiles: () => ipcRenderer.invoke("desktop:pick-files"),
  revealFile: (filePath) => ipcRenderer.invoke("desktop:reveal-file", filePath),
  openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
  openAuth: (url) => ipcRenderer.invoke("desktop:open-auth", url),
  onAuthCallback: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("desktop:auth-callback", listener);
    return () => ipcRenderer.removeListener("desktop:auth-callback", listener);
  },
  startServices: () => ipcRenderer.invoke("desktop:start-services"),
  stopServices: () => ipcRenderer.invoke("desktop:stop-services"),
  settings: (next) => ipcRenderer.invoke("desktop:settings", next),
});
