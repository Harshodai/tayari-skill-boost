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
  onTaskDeepLink: (callback) => {
    const listener = (_event, path) => callback(path);
    ipcRenderer.on("desktop:task-deeplink", listener);
    return () => ipcRenderer.removeListener("desktop:task-deeplink", listener);
  },
  startServices: () => ipcRenderer.invoke("desktop:start-services"),
  stopServices: () => ipcRenderer.invoke("desktop:stop-services"),
  settings: (next) => ipcRenderer.invoke("desktop:settings", next),
  sessionGet: () => ipcRenderer.invoke("desktop:session:get"),
  sessionSet: (value) => ipcRenderer.invoke("desktop:session:set", value),
  sessionClear: () => ipcRenderer.invoke("desktop:session:clear"),
});
