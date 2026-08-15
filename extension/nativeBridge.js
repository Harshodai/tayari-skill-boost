(() => {
  const HOST = 'com.jobtayari.browser'; let port = null; let status = 'not_installed'; let nextId = 1; const pending = new Map();
  function setStatus(next) { status = next; chrome.runtime.sendMessage({ action: 'native_status', status }).catch(() => {}); }
  function disconnect() { for (const [, entry] of pending) entry.reject(new Error('Native bridge disconnected.')); pending.clear(); try { port?.disconnect(); } catch {} port = null; setStatus('installed_disconnected'); }
  function ensure() { if (port) return port; try { port = chrome.runtime.connectNative(HOST); setStatus('connected'); port.onMessage.addListener((message) => { const entry = pending.get(message?.id); if (!entry) return; pending.delete(message.id); if (message.error) entry.reject(new Error(message.error)); else entry.resolve(message.result); }); port.onDisconnect.addListener(() => disconnect()); } catch (error) { port = null; setStatus('not_installed'); throw error; } return port; }
  function request(method, params = {}, capability = null) { const active = ensure(); const id = `${Date.now()}-${nextId++}`; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); active.postMessage({ id, method, params, capability, timestamp: Date.now() }); }); }
  globalThis.TayariNativeBridge = { HOST, ensure, request, disconnect, getStatus: () => status };
})();
