const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const isDev = Boolean(process.env.ELECTRON_START_URL);
let staticServer;

function runtimeDir() {
  return isDev ? path.resolve(__dirname, "..") : path.join(process.resourcesPath, "tayari-runtime");
}

function appDistDir() {
  return path.join(__dirname, "..", "dist");
}

function settingsPath() {
  return path.join(app.getPath("userData"), "tayari-desktop-settings.json");
}

async function readSettings() {
  try {
    return JSON.parse(await fs.readFile(settingsPath(), "utf8"));
  } catch {
    return { apiBaseUrl: "http://127.0.0.1:8085/api" };
  }
}

async function writeSettings(next) {
  const current = await readSettings();
  const merged = { ...current, ...next };
  await fs.writeFile(settingsPath(), JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

function healthCheck(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 2500 }, (response) => {
      response.resume();
      resolve({ reachable: response.statusCode >= 200 && response.statusCode < 500, statusCode: response.statusCode });
    });
    request.once("timeout", () => request.destroy());
    request.once("error", () => resolve({ reachable: false, statusCode: null }));
  });
}

async function compose(args) {
  const root = runtimeDir();
  const composeFile = path.join(root, "docker-compose.yml");
  await fs.access(composeFile);
  return execFileAsync("docker", ["compose", "--profile", "dev", ...args], {
    cwd: root,
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
}

async function desktopStatus() {
  const settings = await readSettings();
  const healthUrl = settings.apiBaseUrl.replace(/\/api\/?$/, "/api/health");
  const health = await healthCheck(healthUrl);
  let dockerAvailable = true;
  try {
    await execFileAsync("docker", ["--version"], { timeout: 5000 });
  } catch {
    dockerAvailable = false;
  }
  return {
    apiBaseUrl: settings.apiBaseUrl,
    apiReachable: health.reachable,
    apiStatus: health.statusCode,
    dockerAvailable,
    runtimeDirectory: runtimeDir(),
  };
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".mp4")) return "video/mp4";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

async function createStaticServer() {
  if (staticServer) return staticServer.url;
  const root = path.resolve(appDistDir());
  await fs.access(path.join(root, "index.html"));
  staticServer = await new Promise((resolve, reject) => {
    const server = http.createServer(async (request, response) => {
      try {
        const requestPath = new URL(request.url || "/", "http://127.0.0.1").pathname;
        const decoded = decodeURIComponent(requestPath);
        const requestedFile = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
        const candidate = path.resolve(root, requestedFile);
        if (!candidate.startsWith(root + path.sep) && candidate !== root) {
          response.writeHead(400).end("Invalid path");
          return;
        }
        let target = candidate;
        try {
          const stat = await fs.stat(target);
          if (!stat.isFile()) throw new Error("not a file");
        } catch {
          target = path.join(root, "index.html");
        }
        response.writeHead(200, { "Content-Type": contentType(target), "Cache-Control": target.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" });
        response.end(await fs.readFile(target));
      } catch {
        response.writeHead(500).end("Unable to load application assets");
      }
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
  return staticServer.url;
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#080d1c",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    await window.loadURL(`${process.env.ELECTRON_START_URL}/desktop`);
  } else {
    await window.loadURL(`${await createStaticServer()}/desktop`);
  }
}

app.whenReady().then(async () => {
  ipcMain.handle("desktop:status", () => desktopStatus());

  ipcMain.handle("desktop:pick-files", async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose files for Job Tayari",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Career files", extensions: ["pdf", "doc", "docx", "txt", "md"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (result.canceled) return [];
    return result.filePaths.map((filePath) => ({ name: path.basename(filePath), path: filePath }));
  });

  ipcMain.handle("desktop:reveal-file", async (_event, filePath) => {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath)) throw new Error("A valid local file path is required.");
    return shell.showItemInFolder(filePath);
  });

  ipcMain.handle("desktop:open-external", async (_event, url) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) throw new Error("Only HTTP(S) links may be opened externally.");
    await shell.openExternal(url);
  });

  ipcMain.handle("desktop:start-services", async () => {
    const { stdout, stderr } = await compose(["up", "-d", "--build"]);
    return { stdout, stderr };
  });

  ipcMain.handle("desktop:stop-services", async () => {
    const { stdout, stderr } = await compose(["down"]);
    return { stdout, stderr };
  });

  ipcMain.handle("desktop:settings", async (_event, next) => {
    if (next && typeof next.apiBaseUrl === "string" && /^http:\/\/127\.0\.0\.1(:\d+)?\/api\/?$/.test(next.apiBaseUrl)) {
      return writeSettings({ apiBaseUrl: next.apiBaseUrl.replace(/\/$/, "") });
    }
    return readSettings();
  });

  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  staticServer?.server?.close();
});
