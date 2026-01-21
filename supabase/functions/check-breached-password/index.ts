import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tayari-skill-boost.lovable.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SHA-1 hash function using Web Crypto API
async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    if (!password || typeof password !== "string") {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Generate SHA-1 hash of the password
    const hash = await sha1(password);
    const hashPrefix = hash.substring(0, 5).toUpperCase();
    const hashSuffix = hash.substring(5).toUpperCase();

    console.log(`Checking password breach status (prefix: ${hashPrefix}...)`);

    // Query Have I Been Pwned API using k-Anonymity
    // Only the first 5 characters of the hash are sent
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
