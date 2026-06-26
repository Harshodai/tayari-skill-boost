import { supabase } from "@/integrations/supabase/client";

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil: Date | null;
  message: string | null;
}

// In self-hosted mode, Supabase Edge Functions are not available.
// Skip all rate limit calls silently to avoid ERR_CONNECTION_REFUSED noise.
const USE_SELF_HOSTED = import.meta.env.VITE_USE_SELF_HOSTED === "true";

const RATE_LIMIT_OPEN: RateLimitResult = {
  allowed: true,
  remainingAttempts: 5,
  blockedUntil: null,
  message: null,
};

export async function checkRateLimit(email: string): Promise<RateLimitResult> {
  if (USE_SELF_HOSTED) return RATE_LIMIT_OPEN;
  try {
    const { data, error } = await supabase.functions.invoke('check-rate-limit', {
      body: { email, action: 'check' },
    });

    if (error) {
      // Fail open to avoid blocking legitimate users on system error
      return RATE_LIMIT_OPEN;
    }

    return {
      allowed: data.allowed,
      remainingAttempts: data.remainingAttempts,
      blockedUntil: data.blockedUntil ? new Date(data.blockedUntil) : null,
      message: data.allowed ? null : `Too many login attempts. Please try again later.`
    };
  } catch {
    return RATE_LIMIT_OPEN;
  }
}

export async function recordFailedAttempt(email: string): Promise<RateLimitResult> {
  if (USE_SELF_HOSTED) return { allowed: true, remainingAttempts: 0, blockedUntil: null, message: 'Invalid credentials.' };
  try {
    const { data, error } = await supabase.functions.invoke('check-rate-limit', {
      body: { email, action: 'record_failure' },
    });

    if (error) {
      return {
        allowed: true,
        remainingAttempts: 0,
        blockedUntil: null,
        message: 'Invalid credentials.'
      };
    }

    if (data.blockedUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: new Date(data.blockedUntil),
        message: `Too many failed attempts. Account temporarily locked.`
      };
    }

    return {
      allowed: true,
      remainingAttempts: data.remainingAttempts,
      blockedUntil: null,
      message: `Invalid credentials. ${data.remainingAttempts} attempts remaining.`
    };
  } catch {
    return {
      allowed: true,
      remainingAttempts: 0,
      blockedUntil: null,
      message: 'Invalid credentials.'
    };
  }
}

export async function resetRateLimit(email: string): Promise<void> {
  if (USE_SELF_HOSTED) return;
  try {
    await supabase.functions.invoke('check-rate-limit', {
      body: { email, action: 'reset' },
    });
  } catch {
    // Silently ignore in self-hosted mode or if Supabase is unavailable
  }
}

