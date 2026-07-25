document.addEventListener("DOMContentLoaded", () => {
  const backendUrlInput = document.getElementById("backendUrl");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");

  // Load existing options: backendUrl from sync, apiKey from local
  if (typeof chrome !== "undefined" && chrome.storage) {
    if (chrome.storage.sync) {
      chrome.storage.sync.get(["backendUrl"], (items) => {
        if (items.backendUrl) backendUrlInput.value = items.backendUrl;
      });
    }
    if (chrome.storage.local) {
      chrome.storage.local.get(["apiKey"], (items) => {
        if (items.apiKey) apiKeyInput.value = items.apiKey;
      });
    }
  }

  saveBtn.addEventListener("click", () => {
    const backendUrl = (backendUrlInput.value || "http://localhost:8085").replace(/\/$/, "");
    const apiKey = apiKeyInput.value.trim();

    if (typeof chrome !== "undefined" && chrome.storage) {
      if (chrome.storage.sync) {
        chrome.storage.sync.set({ backendUrl });
      }
      if (chrome.storage.local) {
        chrome.storage.local.set({ apiKey });
      }
      statusDiv.textContent = "Settings saved successfully! (API Key stored locally)";
      statusDiv.className = "status success";
      setTimeout(() => { statusDiv.textContent = ""; }, 3000);
    } else {
      statusDiv.textContent = "Saved (local mode)";
      statusDiv.className = "status success";
    }
  });
});
