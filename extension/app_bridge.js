(() => {
  const SOURCE = 'jobtayari-extension-page-bridge-v1';
  const ALLOWED_ACTIONS = new Set([
    'get_version',
    'omnisave_preferences_get',
    'omnisave_preferences_set',
    'omnisave_sync_now',
    'extension_session_handoff',
  ]);
  const MAX_REQUEST_ID = 96;
  const MAX_PLATFORMS = 8;

  function boundedRequestId(value) {
    const requestId = String(value || '').trim();
    return requestId && requestId.length <= MAX_REQUEST_ID ? requestId : null;
  }

  function safePreferences(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const preferences = {};
    if ('enabled' in value) preferences.enabled = Boolean(value.enabled);
    if ('fullHistoryEnabled' in value) preferences.fullHistoryEnabled = Boolean(value.fullHistoryEnabled);
    if ('consentAcknowledged' in value) preferences.consentAcknowledged = Boolean(value.consentAcknowledged);
    if ('intervalMinutes' in value) preferences.intervalMinutes = Number(value.intervalMinutes);
    if ('maxItems' in value) preferences.maxItems = Number(value.maxItems);
    if (Array.isArray(value.platforms)) preferences.platforms = value.platforms.map((platform) => String(platform).slice(0, 32)).filter(Boolean).slice(0, MAX_PLATFORMS);
    return preferences;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const request = event.data;
    if (!request || request.source !== SOURCE || !ALLOWED_ACTIONS.has(request.action)) return;
    const requestId = boundedRequestId(request.requestId);
    if (!requestId) return;

    const payload = { action: request.action };
    if (request.action === 'omnisave_preferences_set') {
      const preferences = safePreferences(request.preferences);
      if (!preferences) return;
      payload.preferences = preferences;
    }
    if (request.action === 'extension_session_handoff') {
      const code = String(request.code || '').trim();
      if (!/^[a-f0-9]{64}$/i.test(code)) return;
      payload.code = code;
    }

    chrome.runtime.sendMessage(payload, (response) => {
      const error = chrome.runtime.lastError;
      window.postMessage({
        source: SOURCE,
        responseTo: requestId,
        response: error ? { success: false, error: error.message || 'Extension bridge request failed.' } : (response || { success: false, error: 'Extension bridge returned no response.' }),
      }, window.location.origin);
    });
  });
})();
