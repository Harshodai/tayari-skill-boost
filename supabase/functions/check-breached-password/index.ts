import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
