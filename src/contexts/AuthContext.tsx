import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getGenericAuthError } from "@/lib/auth-errors";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rate-limiter";

// Configuration for Auth Mode
const USE_SELF_HOSTED = import.meta.env.VITE_USE_SELF_HOSTED === 'true';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithGithub: () => Promise<{ error: string | null }>;
  signInWithLinkedin: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setUserFromToken: (token: string, userData: any) => void;
}

// Helper to create a mock session with all required fields
function createMockSession(token: string, user: User): Partial<Session> {
  return {
    access_token: token,
    refresh_token: '',
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    expires_in: 86400 * 7,
    token_type: 'bearer',
    user: user,
  };
}

// Helper to create a mock user from backend data
function createMockUser(userData: any): User {
  return {
    id: userData.id || 'local-user',
    email: userData.email,
    app_metadata: { provider: 'local' },
    user_metadata: { full_name: userData.full_name },
    aud: 'authenticated',
    created_at: userData.created_at || new Date().toISOString(),
    role: userData.role || 'authenticated',
  } as User;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Exposed function to set user from token (used by AuthCallback)
  const setUserFromToken = (token: string, userData: any) => {
    const mockUser = createMockUser(userData);
    setUser(mockUser);
    setSession(createMockSession(token, mockUser) as Session);
    localStorage.setItem('auth_token', token);
  };

  useEffect(() => {
    if (USE_SELF_HOSTED) {
      const controller = new AbortController();
      // Check for local JWT
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Verify token with backend
        fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        })
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Invalid token');
          })
          .then(userData => {
            if (controller.signal.aborted) return;
            const mockUser = createMockUser(userData);
            setUser(mockUser);
            setSession(createMockSession(token, mockUser) as Session);
          })
          .catch((err) => {
            if (err.name === 'AbortError') return;
            localStorage.removeItem('auth_token');
            setUser(null);
            setSession(null);
          })
          .finally(() => {
            if (!controller.signal.aborted) setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
      return () => controller.abort();
    } else {
      // Supabase logic
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      );

      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      if (USE_SELF_HOSTED) {
        // Note: For self-hosted, we allow the server to handle rate limiting (429)

        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        // Handle rate limiting from server
        if (res.status === 429) {
          return { error: 'Too many login attempts. Please try again later.' };
        }

        const contentType = res.headers.get("content-type");
        let data: any = {};
        let rawBody = "";

        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          rawBody = await res.text();
        }

        if (!res.ok) {
          return { error: data.error || rawBody || `Authentication failed (HTTP ${res.status})` };
        }

        if (!data.token) {
          return { error: "Invalid server response: missing token" };
        }

        localStorage.setItem('auth_token', data.token);

        // Fetch user data to set state properly
        try {
          const userRes = await fetch(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${data.token}` }
          });

          if (!userRes.ok) {
            // Failed to get user profile, rollback
            localStorage.removeItem('auth_token');
            setUser(null);
            setSession(null);
            return { error: 'Failed to retrieve user profile' };
          }

          const userData = await userRes.json();
          const mockUser = createMockUser(userData);
          setUser(mockUser);
          setSession(createMockSession(data.token, mockUser) as Session);
          return { error: null };
        } catch (err) {
          localStorage.removeItem('auth_token');
          setUser(null);
          setSession(null);
          return { error: 'Network error retrieving profile' };
        }
      }

      // Supabase Logic
      // Only use client-side rate limiter for Cloud Supabase
      const rateLimitCheck = await checkRateLimit(email);
      if (!rateLimitCheck.allowed) return { error: rateLimitCheck.message };

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        await recordFailedAttempt(email);
        return { error: error.message };
      }
      await resetRateLimit(email);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Authentication failed' };
    }
  };

  const signUp = async (email: string, password: string, name: string): Promise<{ error: string | null }> => {
    try {
      if (USE_SELF_HOSTED) {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');
        return { error: null }; // Usually requires login after
      }

      // Supabase Logic
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { name: name || email.split("@")[0] },
        },
      });
      if (error) return { error: getGenericAuthError(error.message) };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Signup failed' };
    }
  };

  const signInWithGithub = async (): Promise<{ error: string | null }> => {
    if (USE_SELF_HOSTED) {
      window.location.href = `${API_URL}/auth/github`;
      return { error: null };
    }
    return socialLogin('github');
  };

  const signInWithLinkedin = async (): Promise<{ error: string | null }> => {
    if (USE_SELF_HOSTED) {
      window.location.href = `${API_URL}/auth/linkedin`;
      return { error: null };
    }
    return socialLogin('linkedin_oidc');
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (USE_SELF_HOSTED) {
      window.location.href = `${API_URL}/auth/google`;
      return { error: null };
    }
    // Lovable Cloud managed Google OAuth — works in both preview and production
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        return { error: getGenericAuthError(msg) };
      }
      return { error: null };
    } catch (err: any) {
      return { error: getGenericAuthError(err?.message || "Google sign-in failed") };
    }
  };

  const socialLogin = async (provider: any): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/resume` },
      });
      if (error) return { error: getGenericAuthError(error.message) };
      return { error: null };
    } catch (err: any) {
      return { error: 'Social login failed' };
    }
  }

  const signOut = async () => {
    if (USE_SELF_HOSTED) {
      localStorage.removeItem('auth_token');
      setUser(null);
      setSession(null);
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signInWithGoogle, signInWithGithub, signInWithLinkedin, signOut, setUserFromToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
