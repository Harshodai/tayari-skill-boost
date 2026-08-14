const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");
const {
  SECURITY_CSP,
  assertSettingsPayload,
  normalizeApiBaseUrl,
  validateExternalUrl,
} = require("./security.cjs");

const execFileAsync = promisify(execFile);
const isDev = Boolean(process.env.ELECTRON_START_URL);
const trustedOrigins = new Set();
const selectedFilePaths = new Set();
let staticServer;
let shuttingDown = false;

const execFileWithTimeout = (file, args, options) => execFileAsync(file, args, options);

function runtimeDir() {
  return isDev ? path.resolve(__dirname, "..") : path.join(process.resourcesPath, "tayari-runtime");
}

function appDistDir() {
  return path.join(__dirname, "..", "dist");
}

function settingsPath() {
  return path.join(app.getPath("userData"), "tayari-desktop-settings.json");
}

function defaultApiBaseUrl() {
  if (isDev) return "http://127.0.0.1:8085/api";
  return process.env.TAYARI_DESKTOP_API_URL || "";
}

async function readSettings() {
  try {
    const stored = JSON.parse(await fs.readFile(settingsPath(), "utf8"));
    return { apiBaseUrl: normalizeApiBaseUrl(stored.apiBaseUrl, isDev) };
  } catch {
    return { apiBaseUrl: defaultApiBaseUrl() };
  }
}

async function writeSettings(next) {
  const current = await readSettings();
  const merged = { ...current, apiBaseUrl: normalizeApiBaseUrl(next.apiBaseUrl, isDev) };
  await fs.writeFile(settingsPath(), JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

function assertTrustedSender(event) {
  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || "";
  let origin;
  try {
    origin = new URL(senderUrl).origin;
  } catch {
    throw new Error("Untrusted IPC sender.");
  }
  if (!trustedOrigins.has(origin)) throw new Error("Untrusted IPC sender.");
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
  if (!isDev) throw new Error("Local service orchestration is disabled in packaged builds.");
  const root = runtimeDir();
  const composeFile = path.join(root, "docker-compose.yml");
  await fs.access(composeFile);
  return execFileWithTimeout("docker", ["compose", "--profile", "dev", ...args], {
    cwd: root,
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
}

async function desktopStatus() {
  const settings = await readSettings();
  if (!settings.apiBaseUrl) {
    return {
      apiBaseUrl: "",
      apiReachable: false,
      apiStatus: null,
      dockerAvailable: false,
      runtimeDirectory: runtimeDir(),
    };
  }
  const healthUrl = settings.apiBaseUrl.replace(/\/api\/?$/, "/healthz");
  const health = healthUrl.startsWith("http://127.0.0.1") ? await healthCheck(healthUrl) : { reachable: false, statusCode: null };
  let dockerAvailable = true;
  try {
    await execFileWithTimeout("docker", ["--version"], { timeout: 5000 });
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
        response.writeHead(200, {
          "Content-Type": contentType(target),
          "Cache-Control": target.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
          "Content-Security-Policy": SECURITY_CSP,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        });
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

function isTrustedNavigation(url) {
  try {
    return trustedOrigins.has(new URL(url).origin);
  } catch {
    return false;
  }
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
      webSecurity: true,
    },
  });

  const loadUrl = isDev ? `${process.env.ELECTRON_START_URL}/desktop` : `${await createStaticServer()}/desktop`;
  trustedOrigins.add(new URL(loadUrl).origin);

  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedNavigation(url)) event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!isTrustedNavigation(url)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      void shell.openExternal(validateExternalUrl(url));
    } catch {
      // Deny-by-default: unknown popup destinations never leave the app.
    }
    return { action: "deny" };
  });
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [SECURITY_CSP],
        "X-Content-Type-Options": ["nosniff"],
        "Referrer-Policy": ["no-referrer"],
      },
    });
  });

  await window.loadURL(loadUrl);
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:status", (event) => {
    assertTrustedSender(event);
    return desktopStatus();
  });

  ipcMain.handle("desktop:pick-files", async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({
      title: "Choose files for Job Tayari",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Career files", extensions: ["pdf", "doc", "docx", "txt", "md"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (result.canceled) return [];
    selectedFilePaths.clear();
    for (const filePath of result.filePaths) selectedFilePaths.add(path.resolve(filePath));
    return result.filePaths.map((filePath) => ({ name: path.basename(filePath), path: filePath }));
  });

  ipcMain.handle("desktop:reveal-file", async (event, filePath) => {
    assertTrustedSender(event);
    if (typeof filePath !== "string" || !path.isAbsolute(filePath)) throw new Error("A valid local file path is required.");
    const normalized = path.resolve(filePath);
    if (!selectedFilePaths.has(normalized)) throw new Error("Only files selected in this session may be revealed.");
    return shell.showItemInFolder(normalized);
  });

  ipcMain.handle("desktop:open-external", async (event, url) => {
    assertTrustedSender(event);
    await shell.openExternal(validateExternalUrl(url));
  });

  ipcMain.handle("desktop:start-services", async (event) => {
    assertTrustedSender(event);
    const { stdout, stderr } = await compose(["up", "-d", "--build"]);
    return { stdout, stderr };
  });

  ipcMain.handle("desktop:stop-services", async (event) => {
    assertTrustedSender(event);
    const { stdout, stderr } = await compose(["down"]);
    return { stdout, stderr };
  });

  ipcMain.handle("desktop:settings", async (event, next) => {
    assertTrustedSender(event);
    if (next === undefined) return readSettings();
    assertSettingsPayload(next);
    return writeSettings({ apiBaseUrl: next.apiBaseUrl });
  });
}

async function stopServicesBestEffort() {
  if (!isDev || shuttingDown) return;
  shuttingDown = true;
  try {
    await compose(["down"]);
  } catch {
    // Shutdown must not prevent the desktop process from exiting.
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (!isDev || shuttingDown) {
    staticServer?.server?.close();
    return;
  }
  event.preventDefault();
  void stopServicesBestEffort().finally(() => {
    staticServer?.server?.close();
    app.quit();
  });
});
