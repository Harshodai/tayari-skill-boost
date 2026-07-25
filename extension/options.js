document.addEventListener("DOMContentLoaded", () => {
  const backendUrlInput = document.getElementById("backendUrl");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const statusDiv = document.getElementById("status");

  // Load existing options
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

  testBtn.addEventListener("click", async () => {
    const backendUrl = (backendUrlInput.value || "http://localhost:8085").replace(/\/$/, "");
    statusDiv.textContent = "Testing connection...";
    statusDiv.className = "status";

    try {
      const res = await fetch(`${backendUrl}/api/v1/health`);
      if (res.ok) {
        const data = await res.json();
        statusDiv.textContent = `Connection successful! Service: ${data.status || "healthy"}`;
        statusDiv.className = "status success";
      } else {
        statusDiv.textContent = `Server responded with status: ${res.status}`;
        statusDiv.className = "status error";
      }
    } catch (err) {
      statusDiv.textContent = `Connection failed: ${err.message || "Network error"}`;
      statusDiv.className = "status error";
    }
  });
});
