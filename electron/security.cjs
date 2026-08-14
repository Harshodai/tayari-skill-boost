const LOCAL_API_PATTERN = /^http:\/\/127\.0\.0\.1(?::\d+)?\/api\/?$/;

const SAFE_EXTERNAL_HOSTS = new Set([
  "tayari.app",
  "www.tayari.app",
  "linkedin.com",
  "www.linkedin.com",
  "indeed.com",
  "www.indeed.com",
  "greenhouse.io",
  "boards.greenhouse.io",
  "lever.co",
  "jobs.lever.co",
  "supabase.co",
  "github.com",
  "www.github.com",
]);

const SECURITY_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* https://*.supabase.co wss://*.supabase.co https://api.tayari.app",
].join("; ");

function normalizeApiBaseUrl(value, isDev) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("A valid API base URL is required.");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("API base URL must be a valid URL.");
  }
  const normalized = parsed.toString().replace(/\/$/, "");
  if (!parsed.pathname.replace(/\/$/, "").endsWith("/api")) {
    throw new Error("API base URL must end in /api.");
  }
  if (isDev ? !LOCAL_API_PATTERN.test(normalized) : parsed.protocol !== "https:") {
    throw new Error(isDev ? "Development API must use the local loopback gateway." : "Packaged API must use HTTPS.");
  }
  return normalized;
}

function hostMatchesAllowlist(hostname) {
  return [...SAFE_EXTERNAL_HOSTS].some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

function validateExternalUrl(value) {
  if (typeof value !== "string" || value.length > 4096) throw new Error("A valid external URL is required.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("External URL must be a valid URL.");
  }
  if (parsed.protocol !== "https:" || !hostMatchesAllowlist(parsed.hostname)) {
    throw new Error("External URL is not on the approved HTTPS host allowlist.");
  }
  return parsed.toString();
}

function validateAuthUrl(value, isDev) {
  if (typeof value !== "string" || value.length > 4096) throw new Error("A valid authentication URL is required.");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Authentication URL must be a valid URL."); }
  const loopback = isDev && parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (!loopback && (parsed.protocol !== "https:" || !hostMatchesAllowlist(parsed.hostname))) {
    throw new Error("Authentication URL is not approved.");
  }
  if (parsed.hash) throw new Error("Authentication URL must not contain a fragment.");
  return parsed.toString();
}
function assertSettingsPayload(next) {
  if (!next || typeof next !== "object" || Array.isArray(next) || Object.keys(next).some((key) => key !== "apiBaseUrl")) {
    throw new Error("Settings payload is invalid.");
  }
  return next;
}

module.exports = {
  LOCAL_API_PATTERN,
  SAFE_EXTERNAL_HOSTS,
  SECURITY_CSP,
  assertSettingsPayload,
  hostMatchesAllowlist,
  normalizeApiBaseUrl,
  validateAuthUrl,
  validateExternalUrl,
};
