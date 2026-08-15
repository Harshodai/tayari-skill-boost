const STORAGE_KEY = "tayari_config";
const DEFAULT_CONFIG = { apiUrl: "http://localhost:8085/api", appUrl: "http://localhost:8083" };
const normalizeUrl = (value, fallback) => (String(value || "").trim() || fallback).replace(/\/+$/, "");
const storageGet = (key) => new Promise((resolve) => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return resolve({});
  chrome.storage.local.get([key], resolve);
});
const storageSet = (value) => new Promise((resolve, reject) => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return resolve();
  chrome.storage.local.set(value, () => chrome.runtime?.lastError ? reject(chrome.runtime.lastError) : resolve());
});
document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl");
  const appUrlInput = document.getElementById("appUrl");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const statusDiv = document.getElementById("status");
  const stored = await storageGet(STORAGE_KEY);
  const config = { ...DEFAULT_CONFIG, ...(stored[STORAGE_KEY] || {}) };
  apiUrlInput.value = normalizeUrl(config.apiUrl, DEFAULT_CONFIG.apiUrl);
  appUrlInput.value = normalizeUrl(config.appUrl, DEFAULT_CONFIG.appUrl);
  saveBtn.addEventListener("click", async () => {
    const apiUrl = normalizeUrl(apiUrlInput.value, DEFAULT_CONFIG.apiUrl);
    const appUrl = normalizeUrl(appUrlInput.value, DEFAULT_CONFIG.appUrl);
    try { await storageSet({ [STORAGE_KEY]: { ...config, apiUrl, appUrl } }); apiUrlInput.value = apiUrl; appUrlInput.value = appUrl; statusDiv.textContent = "Settings saved successfully."; statusDiv.className = "status success"; setTimeout(() => { statusDiv.textContent = ""; }, 3000); }
    catch (error) { statusDiv.textContent = `Could not save settings: ${error?.message || "storage error"}`; statusDiv.className = "status error"; }
  });
  testBtn.addEventListener("click", async () => {
    const apiUrl = normalizeUrl(apiUrlInput.value, DEFAULT_CONFIG.apiUrl);
    statusDiv.textContent = "Testing connection..."; statusDiv.className = "status";
    try { const response = await fetch(`${apiUrl}/health`); if (!response.ok) throw new Error(`server status ${response.status}`); const data = await response.json(); statusDiv.textContent = `Connection successful! Service: ${data.status || "healthy"}`; statusDiv.className = "status success"; }
    catch (error) { statusDiv.textContent = `Connection failed: ${error?.message || "Network error"}`; statusDiv.className = "status error"; }
  });
});
