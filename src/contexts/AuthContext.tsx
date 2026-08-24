import { API_URL, apiFetchRaw, apiFetchResponse } from "@/api";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getGenericAuthError } from "@/lib/auth-errors";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rate-limiter";

// Configuration for Auth Mode
const USE_SELF_HOSTED = import.meta.env.VITE_USE_SELF_HOSTED === 'true';
const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID || "tayari-extension-id";

interface LocalAuthUserData {
  id?: string;
  email?: string;
  full_name?: string;
  created_at?: string;
  role?: string;
}

type LocalAuthResponse = {
  error?: unknown;
  token?: unknown;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

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
  setUserFromToken: (token: string, userData: LocalAuthUserData) => void;
  completeAuthCallback: (callbackUrl: string) => Promise<{ error: string | null }>;
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
function createMockUser(userData: LocalAuthUserData): User {
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

// Extension sessions are established only by the extension-owned PKCE flow.
function syncTokenToExtension(_token: string | null) {
  // Deliberately disabled: web pages must never push bearer tokens to the extension.
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Exposed function to set user from token (used by AuthCallback)
  const setUserFromToken = (token: string, userData: LocalAuthUserData) => {
    const mockUser = createMockUser(userData);
    setUser(mockUser);
    setSession(createMockSession(token, mockUser) as Session);
    localStorage.setItem('auth_token', token);
    syncTokenToExtension(token);
  };

  const completeAuthCallback = useCallback(async (callbackUrl: string): Promise<{ error: string | null }> => {
    try {
      const parsed = new URL(callbackUrl, window.location.origin);
      const desktopCallback = parsed.protocol === "tayari:" && parsed.hostname === "auth" && parsed.pathname === "/callback";
      const webCallback = parsed.pathname === "/auth/callback" && parsed.origin === window.location.origin;
      if (!desktopCallback && !webCallback) return { error: "Invalid authentication callback." };
      const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
      const code = parsed.searchParams.get("code");
      if (code && !USE_SELF_HOSTED) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        return { error: error ? getGenericAuthError(error.message) : null };
      }
      const token = hashParams.get("token") || hashParams.get("access_token");
      if (!token) return { error: "No authentication token received." };
      if (!USE_SELF_HOSTED && hashParams.get("access_token")) {
        const { error } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: hashParams.get("refresh_token") || "",
        });
        return { error: error ? getGenericAuthError(error.message) : null };
      }
      localStorage.setItem("auth_token", token);
      const response = await apiFetchResponse("/me", { headers: { Authorization: `Bearer ${token}` } });
      const userData = await response.json();
      const mockUser = createMockUser(userData);
      setUser(mockUser);
      setSession(createMockSession(token, mockUser) as Session);
      syncTokenToExtension(token);
      return { error: null };
    } catch (error) {
      localStorage.removeItem("auth_token");
      setUser(null);
      setSession(null);
      syncTokenToExtension(null);
      return { error: error instanceof Error ? error.message : "Authentication failed." };
    }
  }, []);
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setSession(null);
      syncTokenToExtension(null);
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    const removeDesktopAuthListener = window.tayariDesktop?.onAuthCallback((url) => {
      void completeAuthCallback(url);
    });

    if (USE_SELF_HOSTED) {
      const controller = new AbortController();
      // Check for local JWT
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Verify token with backend
        apiFetchResponse(`/me`, {
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
            syncTokenToExtension(token);
          })
          .catch((err) => {
            if (err.name === 'AbortError') return;
            localStorage.removeItem('auth_token');
            setUser(null);
            setSession(null);
            syncTokenToExtension(null);
          })
          .finally(() => {
            if (!controller.signal.aborted) setIsLoading(false);
          });
      } else {
        setIsLoading(false);
        syncTokenToExtension(null);
      }
      return () => {
        controller.abort();
        removeDesktopAuthListener?.();
        window.removeEventListener("auth:unauthorized", onUnauthorized);
      };
    } else {
      // Supabase logic
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
          // api/index.ts's apiFetch reads the Go-backend auth token from this
          // exact localStorage key, not from the Supabase client's own
          // session storage -- without this, every apiFetch call in Supabase
          // mode goes out with no Authorization header and 401s.
          if (session?.access_token) {
            localStorage.setItem('auth_token', session.access_token);
          } else {
            localStorage.removeItem('auth_token');
          }
          syncTokenToExtension(session?.access_token ?? null);
        }
      );

      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        if (session?.access_token) {
          localStorage.setItem('auth_token', session.access_token);
        } else {
          localStorage.removeItem('auth_token');
        }
        syncTokenToExtension(session?.access_token ?? null);
      });

      return () => {
        subscription.unsubscribe();
        removeDesktopAuthListener?.();
        window.removeEventListener("auth:unauthorized", onUnauthorized);
      };
    }
  }, [completeAuthCallback]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      if (USE_SELF_HOSTED) {
        // Note: For self-hosted, we allow the server to handle rate limiting (429)

        // apiFetchRaw: a 401 here means "wrong password", not an expired
        // session — it must not trigger the global logout handler.
        const res = await apiFetchRaw(`/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        // Handle rate limiting from server
        if (res.status === 429) {
          return { error: 'Too many login attempts. Please try again later.' };
        }

        const contentType = res.headers.get("content-type");
        let data: LocalAuthResponse = {};
        let rawBody = "";

        if (contentType && contentType.includes("application/json")) {
          data = await res.json() as LocalAuthResponse;
        } else {
          rawBody = await res.text();
        }

        const serverError = typeof data.error === "string" ? data.error : "";
        if (res.status === 401) {
          return { error: serverError || 'Invalid email or password. Please try again.' };
        }

        if (!res.ok) {
          return { error: serverError || rawBody || `Authentication failed (HTTP ${res.status})` };
        }

        if (typeof data.token !== "string" || !data.token) {
          return { error: "Invalid server response: missing token" };
        }

        const token = data.token;
        localStorage.setItem('auth_token', token);
        syncTokenToExtension(token);

        // Fetch user data to set state properly
        try {
          const userRes = await apiFetchResponse(`/me`, {
                          headers: { Authorization: `Bearer ${token}` }

          });

          if (!userRes.ok) {
            // Failed to get user profile, rollback
            localStorage.removeItem('auth_token');
            setUser(null);
            setSession(null);
            syncTokenToExtension(null);
            return { error: 'Failed to retrieve user profile' };
          }

          const userData = await userRes.json();
          const mockUser = createMockUser(userData);
          setUser(mockUser);
          setSession(createMockSession(token, mockUser) as Session);
          syncTokenToExtension(token);
          return { error: null };
        } catch (err) {
          localStorage.removeItem('auth_token');
          setUser(null);
          setSession(null);
          syncTokenToExtension(null);
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
    } catch (err: unknown) {
      return { error: errorMessage(err, 'Authentication failed') };
    }
  };

  const signUp = async (email: string, password: string, name: string): Promise<{ error: string | null }> => {
    try {
      if (USE_SELF_HOSTED) {
        const res = await apiFetchRaw(`/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name })
        });
        const data = await res.json().catch(() => ({} as { error?: string }));
        if (res.status === 429) return { error: 'Too many attempts. Please try again later.' };
        if (!res.ok) return { error: data.error || `Signup failed (HTTP ${res.status})` };
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
    } catch (err: unknown) {
      return { error: errorMessage(err, 'Signup failed') };
    }
  };

  const isDesktop = () => Boolean(window.tayariDesktop);
  const openSelfHostedOAuth = async (provider: "google" | "github" | "linkedin"): Promise<{ error: string | null }> => {
    if (!isDesktop()) {
      window.location.href = `/auth/${provider}`;
      return { error: null };
    }
    try {
      const oauthUrl = new URL(`${API_URL.replace(/\/$/, "")}/auth/${provider}`);
      oauthUrl.searchParams.set("return_to", "tayari://auth/callback");
      await window.tayariDesktop!.openAuth(oauthUrl.toString());
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to open sign-in." };
    }
  };
  const signInWithGithub = async (): Promise<{ error: string | null }> => {
    if (USE_SELF_HOSTED) return openSelfHostedOAuth("github");
    return socialLogin("github");
  };
  const signInWithLinkedin = async (): Promise<{ error: string | null }> => {
    if (USE_SELF_HOSTED) return openSelfHostedOAuth("linkedin");
    return socialLogin("linkedin_oidc");
  };
  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (USE_SELF_HOSTED) return openSelfHostedOAuth("google");
    if (isDesktop()) return socialLogin("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        return { error: getGenericAuthError(msg) };
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: getGenericAuthError(errorMessage(err, "Google sign-in failed")) };
    }
  };
  const socialLogin = async (provider: "google" | "github" | "linkedin_oidc"): Promise<{ error: string | null }> => {
    try {
      const redirectTo = isDesktop() ? "tayari://auth/callback" : `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: isDesktop() } });
      if (error) return { error: getGenericAuthError(error.message) };
      if (isDesktop() && data?.url) await window.tayariDesktop!.openAuth(data.url);
      return { error: null };
    } catch {
      return { error: "Social login failed" };
    }
  };
  const signOut = async () => {
    if (USE_SELF_HOSTED) {
      localStorage.removeItem('auth_token');
      setUser(null);
      setSession(null);
      syncTokenToExtension(null);
    } else {
      await supabase.auth.signOut();
      syncTokenToExtension(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signInWithGoogle, signInWithGithub, signInWithLinkedin, signOut, setUserFromToken, completeAuthCallback }}>
      {children}
    </AuthContext.Provider>
  );
}

// This hook intentionally shares the context module so existing consumers keep one auth contract.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
