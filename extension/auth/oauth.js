(() => {
  const PENDING_KEY = 'tayari_extension_oauth_pending_v1';
  const PROVIDERS = new Set(['google', 'github', 'linkedin']);
  const MAX_PENDING_AGE_MS = 10 * 60 * 1000;
  async function getPending() {
    const result = await chrome.storage.session.get(PENDING_KEY);
    return result[PENDING_KEY] || null;
  }
  async function clearPending() {
    await chrome.storage.session.remove(PENDING_KEY);
  }
  function safeConfig(config) {
    if (!config?.supabaseUrl || !config?.supabaseKey) {
      throw new Error('Job Tayari authentication is not configured for this extension build.');
    }
    const authOrigin = new URL(config.supabaseUrl).origin;
    if (!/^https:\/\//i.test(authOrigin)) throw new Error('Authentication provider must use HTTPS.');
    return { ...config, supabaseUrl: authOrigin };
  }
  async function begin(config, provider = 'google') {
    config = safeConfig(config);
    if (!PROVIDERS.has(provider)) throw new Error('Unsupported sign-in provider.');
    const pkce = await globalThis.TayariPKCE.create();
    const redirectTo = chrome.identity.getRedirectURL('auth/callback');
    await chrome.storage.session.set({ [PENDING_KEY]: { state: pkce.state, verifier: pkce.verifier, redirectTo, createdAt: Date.now() } });
    try {
      const authUrl = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
      authUrl.searchParams.set('provider', provider);
      authUrl.searchParams.set('redirect_to', redirectTo);
      authUrl.searchParams.set('code_challenge', pkce.challenge);
      authUrl.searchParams.set('code_challenge_method', 's256');
      authUrl.searchParams.set('state', pkce.state);
      const callbackUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
      if (!callbackUrl) throw new Error('The authentication window closed before completing sign-in.');
      return await complete(config, callbackUrl);
    } catch (error) {
      await clearPending();
      throw error;
    }
  }
  async function complete(config, callbackUrl) {
    config = safeConfig(config);
    const pending = await getPending();
    try {
      if (!pending || Date.now() - pending.createdAt > MAX_PENDING_AGE_MS) throw new Error('The authentication request expired.');
      const url = new URL(callbackUrl);
      const expected = new URL(pending.redirectTo);
      if (url.origin !== expected.origin || url.pathname !== expected.pathname) throw new Error('Unexpected authentication callback origin.');
      if (url.searchParams.get('state') !== pending.state) throw new Error('Authentication state validation failed.');
      const error = url.searchParams.get('error_description') || url.searchParams.get('error');
      if (error) throw new Error(error);
      const code = url.searchParams.get('code');
      if (!code) throw new Error('Authentication provider did not return a code.');
      const tokenResponse = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: { apikey: config.supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: code, code_verifier: pending.verifier }),
      });
      if (!tokenResponse.ok) throw new Error('Job Tayari could not exchange the authentication code.');
      return await globalThis.TayariSession.write(await tokenResponse.json());
    } finally {
      await clearPending();
    }
  }
  async function signOut(config) {
    const session = await globalThis.TayariSession.read();
    if (session?.access_token && config?.supabaseUrl && config?.supabaseKey) {
      await fetch(`${String(config.supabaseUrl).replace(/\/$/, '')}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: config.supabaseKey, Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
    await clearPending();
    await globalThis.TayariSession.clear();
  }
  globalThis.TayariOAuth = { begin, complete, signOut };
})();
