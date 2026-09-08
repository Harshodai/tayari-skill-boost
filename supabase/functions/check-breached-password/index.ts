import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";

// In-memory sliding-window rate limit per client IP. This endpoint is public
// (no JWT) and proxies an upstream API, so it must not be usable as a free
// unmetered relay or brute-force oracle.
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const hits = new Map<string, number[]>();

function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    // bound memory: drop entries whose window has fully expired
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT;
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (rateLimited(req)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again shortly." }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      }
    );
  }


  try {
    const body = await req.json();
    let hashPrefix: string | undefined = body.hashPrefix;
    let hashSuffix: string | undefined = body.hashSuffix;

    // Hash-only contract (k-Anonymity). Plaintext passwords are rejected to
    // prevent credentials reaching server logs/monitoring.
    if (typeof hashPrefix !== "string" || typeof hashSuffix !== "string") {
      return new Response(
        JSON.stringify({ error: "hashPrefix and hashSuffix are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    hashPrefix = hashPrefix.toUpperCase();
    hashSuffix = hashSuffix.toUpperCase();
    if (!/^[0-9A-F]{5}$/.test(hashPrefix) || !/^[0-9A-F]{35}$/.test(hashSuffix)) {
      return new Response(
        JSON.stringify({ error: "Invalid hash format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking password breach status (prefix: ${hashPrefix}...)`);

    // Query Have I Been Pwned API using k-Anonymity
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${hashPrefix}`,
      {
        headers: {
          "Add-Padding": "true", // Adds random padding to prevent timing attacks
          "User-Agent": "Tayari-Resume-Optimizer",
        },
      }
    );

    if (!response.ok) {
      console.error("HIBP API error:", response.status);
      // On API error, don't block the user - just return false
      return new Response(
        JSON.stringify({
          breached: false,
          error: "Could not verify password security",
          count: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const text = await response.text();
    const lines = text.split("\n");

    // Check if our hash suffix appears in the results
    let breached = false;
    let count = 0;

    for (const line of lines) {
      const [suffix, countStr] = line.split(":");
      if (suffix && suffix.trim() === hashSuffix) {
        breached = true;
        count = parseInt(countStr.trim(), 10) || 0;
        break;
      }
    }

    console.log(`Password breach check complete: breached=${breached}, count=${count}`);

    return new Response(
      JSON.stringify({
        breached,
        count,
        message: breached
          ? `This password has been found in ${count.toLocaleString()} data breaches. Please choose a different password.`
          : "Password has not been found in known data breaches."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error checking breached password:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to check password security",
        breached: false,
        count: 0
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
