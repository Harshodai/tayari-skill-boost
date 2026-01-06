import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "job_tayari_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // For demo: any valid email/password works
    if (!email || password.length < 8) {
      return { error: "Invalid email or password" };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0],
    };

    setUser(newUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return { error: null };
  };

  const signUp = async (email: string, password: string, name: string): Promise<{ error: string | null }> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!email || password.length < 8) {
      return { error: "Invalid email or password must be at least 8 characters" };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name: name || email.split("@")[0],
    };

    setUser(newUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return { error: null };
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
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
