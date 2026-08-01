import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowLeft, ShieldCheck, ShieldAlert, Shield, Github, Linkedin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordStrengthMeter } from "@/components/auth";
import { isPasswordValid } from "@/lib/password-validator";
import { apiFetch } from "@/api";
import { loginSchema, signupSchema } from "@/lib/schemas";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rate-limiter";
import { FadeIn } from "@/components/ui/motion";

interface BreachResult {
  breached: boolean;
  count?: number;
}

const Auth = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, signIn, signUp, signInWithGoogle, signInWithGithub, signInWithLinkedin } = useAuth();

  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");


  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  // Password breach checking state
  const [isCheckingBreach, setIsCheckingBreach] = useState(false);
  const [breachResult, setBreachResult] = useState<BreachResult | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      const nextParam = searchParams.get("next");
      const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
      const from = safeNext ?? (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/resume";
      navigate(from, { replace: true });
    }
  }, [user, navigate, location, searchParams]);

  // Debounced breach check (client hashes password; only SHA-1 prefix leaves the browser)
  const checkPasswordBreach = useCallback(async (password: string) => {
    if (password.length < 8) {
      setBreachResult(null);
      return;
    }

    setIsCheckingBreach(true);
    try {
      // Hash password locally so plaintext never reaches the server (k-Anonymity)
      const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
      const hash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
      const hashPrefix = hash.substring(0, 5);
      const hashSuffix = hash.substring(5);

      // Go backend, not a Supabase Edge Function: this feature has no
      // Cloud/self-hosted split (see routes_security.go) and works in both
      // auth modes the same way.
      const data = await apiFetch<{ breached: boolean; count?: number; error?: string }>(
        "/v1/security/check-breached-password",
        { method: "POST", body: JSON.stringify({ hashPrefix, hashSuffix }) }
      );

      if (typeof data.breached === "boolean") {
        setBreachResult({ breached: data.breached, count: data.count });
      } else {
        console.warn("Breach check failed:", data.error);
        setBreachResult(null);
      }
    } catch (error) {
      console.error("Error checking password breach:", error);
      setBreachResult(null);
    } finally {
      setIsCheckingBreach(false);
    }
  }, []);

  // Handle password change with debounced breach check
  useEffect(() => {
    if (isLogin) return; // Only check on signup

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (formData.password.length >= 8) {
      debounceTimerRef.current = setTimeout(() => {
        checkPasswordBreach(formData.password);
      }, 500);
    } else {
      setBreachResult(null);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData.password, isLogin, checkPasswordBreach]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { email, password, name } = formData;

    // Zod Validation
    const validationSchema = isLogin ? loginSchema : signupSchema;
    const validationResult = validationSchema.safeParse(isLogin ? { email, password } : { email, password, name });

    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues[0].message;
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Additional check for breach if signing up
    if (!isLogin && breachResult?.breached) {
      toast({
        title: "Password compromised",
        description: "This password has been exposed in a data breach. Please choose a different password.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Rate Limit Check
    if (isLogin) {
      const rateLimit = await checkRateLimit(email);
      if (!rateLimit.allowed) {
        toast({
          title: "Too many attempts",
          description: rateLimit.message || "Please try again later.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }

    let result;
    if (isLogin) {
      result = await signIn(email, password);
    } else {
      result = await signUp(email, password, name);
    }

    if (result.error) {
      if (isLogin) {
        await recordFailedAttempt(email);
      }
      toast({
        title: "Authentication Error",
        description: result.error,
        variant: "destructive",
      });
      setIsLoading(false);
    } else {
      toast({
        title: isLogin ? "Welcome back!" : "Account created!",
        description: isLogin
          ? "You've successfully signed in."
          : "Welcome to Job Tayari. Let's get started!",
      });
      if (!isLogin) {
        // Auto-login after successful registration
        const loginResult = await signIn(email, password);
        if (loginResult.error) {
          toast({
            title: "Sign In Required",
            description: "Please sign in with your new account.",
          });
          setIsLogin(true);
          setIsLoading(false);
        }
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Reset breach result when switching modes
  useEffect(() => {
    setBreachResult(null);
    setFormData(prev => ({ ...prev, password: "" }));
  }, [isLogin]);

  // Don't render if already logged in (will redirect)
  if (user) {
    return null;
  }

  const getBreachIndicator = () => {
    if (isLogin || formData.password.length < 8) return null;

    if (isCheckingBreach) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Shield className="w-4 h-4" />
          <span>Checking password security...</span>
        </div>
      );
    }

    if (breachResult?.breached) {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <ShieldAlert className="w-4 h-4" />
          <span>
            ⚠️ This password was found in {breachResult.count?.toLocaleString()} data breaches.
            Please choose a different password.
          </span>
        </div>
      );
    }

    if (breachResult && !breachResult.breached) {
      return (
        <div className="flex items-center gap-2 text-sm text-success">
          <ShieldCheck className="w-4 h-4" />
          <span>Password not found in known data breaches ✓</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-hero">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="p-4 relative z-10">
        <div className="container mx-auto flex items-center justify-between">
          <Logo />
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <FadeIn className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {isLogin ? "Welcome Back" : "Create Your Account"}
              </CardTitle>
              <CardDescription>
                {isLogin
                  ? "Sign in to continue your job preparation journey"
                  : "Join thousands of engineers landing their dream jobs"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="name"
                        name="name"
                        placeholder="John Doe"
                        className="pl-10"
                        value={formData.name}
                        onChange={handleChange}
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={isLogin ? "••••••••" : "Min 12 characters"}
                      className="pl-10 pr-10"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter - Only on signup */}
                  {!isLogin && formData.password.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <PasswordStrengthMeter
                        password={formData.password}
                        showRequirements={true}
                      />
                      {/* Breach Check Indicator */}
                      <div className="transition-all duration-300">
                        {getBreachIndicator()}
                      </div>
                    </div>
                  )}
                </div>

                {isLogin && (
                  <div className="flex items-center justify-end">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading || (!isLogin && (isCheckingBreach || breachResult?.breached))}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isLogin ? "Signing in..." : "Creating account..."}
                    </>
                  ) : (
                    isLogin ? "Sign In" : "Create Account"
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {/* Social Login */}
              <div className="w-full space-y-3">
                <Button
                  variant="outline"
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    const result = await signInWithGoogle();
                    if (result.error) {
                      toast({
                        title: "Google Sign-In Error",
                        description: result.error,
                        variant: "destructive",
                      });
                      setIsLoading(false);
                    }
                  }}
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    const result = await signInWithGithub();
                    if (result.error) {
                      toast({
                        title: "GitHub Sign-In Error",
                        description: result.error,
                        variant: "destructive",
                      });
                      setIsLoading(false);
                    }
                  }}
                  className="w-full"
                >
                  <Github className="w-4 h-4 mr-2" />
                  Continue with GitHub
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    const result = await signInWithLinkedin();
                    if (result.error) {
                      toast({
                        title: "LinkedIn Sign-In Error",
                        description: result.error,
                        variant: "destructive",
                      });
                      setIsLoading(false);
                    }
                  }}
                  className="w-full"
                >
                  <Linkedin className="w-4 h-4 mr-2 text-[#0077B5]" />
                  Continue with LinkedIn
                </Button>
              </div>
            </CardContent>

            <CardFooter className="justify-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => { const next = !isLogin; if (next) { setSearchParams({}); navigate('/auth', { replace: true }); } else { navigate('/auth?mode=signup', { replace: true }); } setIsLogin(next); }}
                  className="text-primary hover:underline font-medium"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </CardFooter>
          </Card>
        </FadeIn>
      </main>
    </div>
  );
};

export default Auth;
