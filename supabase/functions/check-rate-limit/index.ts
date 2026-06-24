import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor } from '../_shared/cors.ts';

// In-memory IP throttle for `record_failure` to prevent account-lockout DoS
// (an unauthenticated attacker repeatedly recording failures for a victim's
// email). Per-instance; combined with the per-email lockout this bounds abuse.
const IP_FAILURE_WINDOW_MS = 60_000;
const IP_FAILURE_MAX = 5;
const ipFailureLog = new Map<string, number[]>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

function ipRateLimitExceeded(ip: string): boolean {
  const now = Date.now();
  const recent = (ipFailureLog.get(ip) ?? []).filter(
    (t) => now - t < IP_FAILURE_WINDOW_MS
  );
  if (recent.length >= IP_FAILURE_MAX) {
    ipFailureLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipFailureLog.set(ip, recent);
  return false;
}

interface RateLimitRequest {
  email: string;
  action: 'check' | 'record_failure' | 'reset';
  ip_hash?: string;
}

const RATE_LIMIT_CONFIG = {
  maxAttempts: 10,
  lockoutDurations: [
    { attempts: 3, duration: 30 },        // 30 seconds after 3 attempts
    { attempts: 5, duration: 120 },       // 2 minutes after 5 attempts
    { attempts: 10, duration: 1800 },     // 30 minutes after 10 attempts
  ],
};

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, action, ip_hash }: RateLimitRequest = await req.json();

    if (!email || !action) {
      return new Response(
        JSON.stringify({ error: 'Email and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format to prevent abuse (e.g. DoS-locking arbitrary inputs)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || email.length > 254 || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Rate limit ${action} for email: ${normalizedEmail.substring(0, 3)}***`);

    // The 'reset' action must only be callable by an authenticated user
    // (it's invoked client-side after a successful login). This prevents
    // unauthenticated attackers from clearing brute-force lockouts.
    if (action === 'reset') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: authData, error: authError } = await authClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (authError || !authData?.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Only allow resetting the lockout for the caller's own email
      if (authData.user.email?.toLowerCase() !== normalizedEmail) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'check') {
      // Check if user is rate limited
      const { data: attempts, error } = await supabase
        .from('auth_attempts')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking rate limit:', error);
        // Allow on error to not block legitimate users
        return new Response(
          JSON.stringify({ allowed: true, remainingAttempts: 5 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!attempts) {
        return new Response(
          JSON.stringify({ allowed: true, remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if blocked
      if (attempts.blocked_until) {
        const blockedUntil = new Date(attempts.blocked_until);
        if (blockedUntil > new Date()) {
          const remainingSeconds = Math.ceil((blockedUntil.getTime() - Date.now()) / 1000);
          return new Response(
            JSON.stringify({
              allowed: false,
              remainingAttempts: 0,
              blockedUntil: attempts.blocked_until,
              remainingSeconds,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const remainingAttempts = Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - attempts.attempt_count);
      return new Response(
        JSON.stringify({ allowed: true, remainingAttempts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'record_failure') {
      // Per-IP throttle: prevent unauthenticated attackers from spamming
      // record_failure to lock out arbitrary accounts.
      const ip = getClientIp(req);
      if (ipRateLimitExceeded(ip)) {
        return new Response(
          JSON.stringify({ error: 'Too many requests' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }
      // Get existing attempts
      const { data: existing } = await supabase
        .from('auth_attempts')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      const newAttemptCount = (existing?.attempt_count || 0) + 1;

      // Calculate lockout duration
      let lockoutSeconds = 0;
      for (const config of RATE_LIMIT_CONFIG.lockoutDurations) {
        if (newAttemptCount >= config.attempts) {
          lockoutSeconds = config.duration;
        }
      }

      const blockedUntil = lockoutSeconds > 0
        ? new Date(Date.now() + lockoutSeconds * 1000).toISOString()
        : null;

      if (existing) {
        const { error } = await supabase
          .from('auth_attempts')
          .update({
            attempt_count: newAttemptCount,
            last_attempt_at: new Date().toISOString(),
            blocked_until: blockedUntil,
            ip_hash: ip_hash || existing.ip_hash,
          })
          .eq('email', normalizedEmail);

        if (error) {
          console.error('Error updating attempt:', error);
        }
      } else {
        const { error } = await supabase
          .from('auth_attempts')
          .insert({
            email: normalizedEmail,
            attempt_count: 1,
            ip_hash,
            blocked_until: null,
          });

        if (error) {
          console.error('Error inserting attempt:', error);
        }
      }

      const remainingAttempts = Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - newAttemptCount);

      return new Response(
        JSON.stringify({
          recorded: true,
          remainingAttempts,
          blockedUntil,
          lockoutSeconds,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reset') {
      const { error } = await supabase
        .from('auth_attempts')
        .delete()
        .eq('email', normalizedEmail);

      if (error) {
        console.error('Error resetting attempts:', error);
      }

      return new Response(
        JSON.stringify({ reset: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Rate limit error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', allowed: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
