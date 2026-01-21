import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getGenericAuthError } from "@/lib/auth-errors";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rate-limiter";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      // Check rate limit before attempting login
      const rateLimitCheck = await checkRateLimit(email);
      if (!rateLimitCheck.allowed) {
        return { error: rateLimitCheck.message };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Record failed attempt and get rate limit message
        const failureResult = await recordFailedAttempt(email);
        return { error: failureResult.message };
      }

      // Reset rate limit on successful login
      await resetRateLimit(email);
      return { error: null };
    } catch (err) {
      await recordFailedAttempt(email);
      return { error: 'Authentication failed. Please try again.' };
    }
  };

  const signUp = async (email: string, password: string, name: string): Promise<{ error: string | null }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name || email.split("@")[0],
          },
        },
      });

      if (error) {
        return { error: getGenericAuthError(error.message) };
      }
      return { error: null };
    } catch (err) {
      return { error: 'Unable to create account. Please try again.' };
    }
  };

  const signInWithGithub = async (): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/resume`,
        },
      });

      if (error) {
        return { error: getGenericAuthError(error.message) };
      }
      return { error: null };
    } catch (err) {
      return { error: 'Social login failed. Please try again.' };
    }
  };

  const signInWithLinkedin = async (): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}/resume`,
        },
      });

      if (error) {
        return { error: getGenericAuthError(error.message) };
      }
      return { error: null };
    } catch (err) {
      return { error: 'Unable to create account. Please try again.' };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/resume`,
        },
      });

      if (error) {
        return { error: getGenericAuthError(error.message) };
      }
      return { error: null };
    } catch (err) {
      return { error: 'Social login failed. Please try again.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signInWithGoogle, signInWithGithub, signInWithLinkedin, signOut }}>
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
