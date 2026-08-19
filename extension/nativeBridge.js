(() => {
  const HOST = 'com.jobtayari.browser';
  const REQUEST_TIMEOUT_MS = 15_000;
  const MAX_PARAMS_BYTES = 128 * 1024;
  const METHOD_PATTERN = /^[a-z][a-z0-9_.:-]{0,96}$/i;
  let port = null;
  let status = 'not_installed';
  let nextId = 1;
  const pending = new Map();

  function setStatus(next) {
    status = next;
    chrome.runtime.sendMessage({ action: 'native_status', status }).catch(() => {});
  }

  function rejectPending(id, error) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    entry.reject(error);
  }

  function resolvePending(id, value, error) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    if (error) entry.reject(error);
    else entry.resolve(value);
  }

  function disconnect() {
    for (const [id] of pending) rejectPending(id, new Error('Native bridge disconnected.'));
    const active = port;
    port = null;
    try { active?.disconnect(); } catch {}
    setStatus('installed_disconnected');
  }

  function ensure() {
    if (port) return port;
    try {
      port = chrome.runtime.connectNative(HOST);
      setStatus('connected');
      port.onMessage.addListener((message) => {
        const id = String(message?.id || '');
        if (!id) return;
        if (message.error) resolvePending(id, null, new Error(String(message.error)));
        else resolvePending(id, message.result);
      });
      port.onDisconnect.addListener(() => disconnect());
    } catch (error) {
      port = null;
      setStatus('not_installed');
      throw error;
    }
    return port;
  }

  function request(method, params = {}, capability = null) {
    const normalizedMethod = String(method || '').trim();
    if (!METHOD_PATTERN.test(normalizedMethod)) return Promise.reject(new Error('Invalid native bridge method.'));
    let serializedParams;
    try { serializedParams = JSON.stringify(params ?? {}); }
    catch { return Promise.reject(new Error('Native bridge parameters must be JSON serializable.')); }
    if (serializedParams.length > MAX_PARAMS_BYTES) return Promise.reject(new Error('Native bridge parameters are too large.'));

    const active = ensure();
    const id = `${Date.now()}-${nextId++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => rejectPending(id, new Error('Native bridge request timed out.')), REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      try {
        active.postMessage({
          id,
          method: normalizedMethod,
          params: JSON.parse(serializedParams),
          capability: String(capability || '').slice(0, 160) || null,
          timestamp: Date.now(),
        });
      } catch (error) {
        rejectPending(id, error instanceof Error ? error : new Error('Native bridge request failed.'));
      }
    });
  }

  globalThis.TayariNativeBridge = { HOST, ensure, request, disconnect, getStatus: () => status };
})();
