// Shared CORS helper for Lovable edge functions.
// Allows: production app, any Lovable preview subdomain, and localhost dev.
// Avoids hardcoding a single origin (which breaks the Lovable preview iframe
// and any local development).

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/tayari-skill-boost\.lovable\.app$/,
  // Lovable preview/sandbox subdomains: id-preview--…lovable.app, lovableproject.com, sandbox.lovable.dev
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https:\/\/[a-z0-9-]+\.sandbox\.lovable\.dev$/,
  // Local dev (vite default + common alternates)
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const FALLBACK_ORIGIN = "https://tayari-skill-boost.lovable.app";

function pickOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? "";
  if (ALLOWED_ORIGIN_PATTERNS.some((rx) => rx.test(origin))) return origin;
  return FALLBACK_ORIGIN;
}

export function corsHeadersFor(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": pickOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Vary": "Origin",
  };
}
