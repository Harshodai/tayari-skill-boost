(() => {
  const encoder = new TextEncoder();
  function randomBytes(length = 32) { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return bytes; }
  function base64Url(bytes) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
  async function sha256Base64Url(value) { const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value)); return base64Url(new Uint8Array(digest)); }
  async function create() { const verifier = base64Url(randomBytes(48)); return { state: base64Url(randomBytes(24)), verifier, challenge: await sha256Base64Url(verifier) }; }
  globalThis.TayariPKCE = { create, sha256Base64Url };
})();
