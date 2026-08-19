(() => {
  const CONTENT_SCRIPT_HOSTS = new Set([
    "www.linkedin.com",
    "linkedin.com",
    "indeed.com",
    "greenhouse.io",
    "workday.com",
    "lever.co",
    "ashbyhq.com",
  ]);

  const CONTENT_SCRIPT_ACTIONS = new Set([
    'get_profile_data',
    'save_job',
    'quick_ats',
    'track_application',
    'queue_for_review',
    'open_tayari',
  ]);

  // Origins the Tayari web app is served from (must stay in sync with the
  // `externally_connectable.matches` allowlist in manifest.json). Messages
  // from these origins may only request WEB_APP_ACTIONS — never the
  // content-script or extension-page actions above.
  const TRUSTED_APP_ORIGINS = new Set([
    'https://tayari.app',
    'https://www.tayari.app',
    'https://tayari-skill-boost.lovable.app',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8083',
    'http://127.0.0.1:8083',
    'http://localhost:8085',
  ]);

  const WEB_APP_ACTIONS = new Set([
    'get_version',
    'omnisave_preferences_get',
    'omnisave_preferences_set',
    'omnisave_sync_now',
  ]);

  function isExtensionUrl(url, extensionId) {
    return typeof url === 'string' && url === `chrome-extension://${extensionId}/` ||
      typeof url === 'string' && url.startsWith(`chrome-extension://${extensionId}/`);
  }

  function isAllowedContentScriptUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && [...CONTENT_SCRIPT_HOSTS].some((host) => parsed.hostname === host || parsed.hostname.endsWith("." + host));
    } catch {
      return false;
    }
  }

  function isTrustedAppOrigin(url) {
    try {
      return TRUSTED_APP_ORIGINS.has(new URL(url).origin);
    } catch {
      return false;
    }
  }

  function isAuthorized(request, sender, extensionId) {
    const action = request?.action;
    if (!action || !sender) return false;

    // Web-app senders (externally_connectable): the frontend may request only
    // its own WEB_APP_ACTIONS, and only from a TRUSTED_APP_ORIGINS origin.
    // This is checked before the extension-id gate so legitimate frontend
    // messages are never rejected purely because sender.id is absent or
    // foreign, while any other origin stays denied by default.
    if (sender.id !== extensionId) {
      return WEB_APP_ACTIONS.has(action) && isTrustedAppOrigin(sender.url || '');
    }

    // Messages from the service worker itself have no tab. Extension pages
    // include a chrome-extension:// sender URL. Both are trusted extension
    // contexts, unlike a content script running on an arbitrary web origin.
    if (!sender.tab) {
      return !sender.url || isExtensionUrl(sender.url, extensionId);
    }

    // The secure page bridge is itself a content script injected into trusted
    // JobTayari app pages. It may forward only the narrow WEB_APP_ACTIONS set;
    // it must never gain content-script UI, native, or agent-control actions.
    if (isTrustedAppOrigin(sender.url || '')) return WEB_APP_ACTIONS.has(action);

    // Other content scripts receive only the legacy page-UI actions they need.
    // They must never invoke task approval, native messaging, sync, or agent control.
    if (!CONTENT_SCRIPT_ACTIONS.has(action)) return false;
    return isAllowedContentScriptUrl(sender.url);
  }

  globalThis.TayariMessagePolicy = Object.freeze({
    CONTENT_SCRIPT_HOSTS,
    CONTENT_SCRIPT_ACTIONS,
    TRUSTED_APP_ORIGINS,
    WEB_APP_ACTIONS,
    isAllowedContentScriptUrl,
    isExtensionUrl,
    isTrustedAppOrigin,
    isAuthorized,
  });
})();
