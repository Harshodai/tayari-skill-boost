import { supabase } from "@/integrations/supabase/client";

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil: Date | null;
  message: string | null;
}

export async function checkRateLimit(email: string): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-rate-limit', {
      body: { email, action: 'check' },
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // Fail open to avoid blocking legitimate users on system error
      return {
        allowed: true,
        remainingAttempts: 5,
        blockedUntil: null,
        message: null
      };
    }

    return {
      allowed: data.allowed,
      remainingAttempts: data.remainingAttempts,
      blockedUntil: data.blockedUntil ? new Date(data.blockedUntil) : null,
      message: data.allowed ? null : `Too many login attempts. Please try again later.`
    };
  } catch (err) {
    console.error('Rate limit check exception:', err);
    return {
      allowed: true,
      remainingAttempts: 5,
      blockedUntil: null,
      message: null
    };
  }
}

export async function recordFailedAttempt(email: string): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-rate-limit', {
      body: { email, action: 'record_failure' },
    });

    if (error) {
      console.error('Rate limit record error:', error);
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
  } catch (err) {
    return {
      allowed: true,
      remainingAttempts: 0,
      blockedUntil: null,
      message: 'Invalid credentials.'
    };
  }
}

export async function resetRateLimit(email: string): Promise<void> {
  try {
    await supabase.functions.invoke('check-rate-limit', {
      body: { email, action: 'reset' },
    });
  } catch (err) {
    console.error('Rate limit reset error:', err);
  }
}
