import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { completeAuthCallback } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing authentication...");
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    timerRefs.current.forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    let active = true;
    const handleCallback = async () => {
      const result = await completeAuthCallback(window.location.href);
      if (!active) return;
      if (result.error) {
        setStatus("error");
        setMessage(result.error);
        timerRefs.current.push(setTimeout(() => navigate("/auth", { replace: true }), 3000));
        return;
      }
      window.history.replaceState(null, "", "/auth/callback");
      setStatus("success");
      setMessage("Authentication successful! Redirecting...");
      timerRefs.current.push(setTimeout(() => navigate("/resume", { replace: true }), 700));
    };
    void handleCallback();
    return () => {
      active = false;
    };
  }, [completeAuthCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
      <div className="glass border border-border/50 rounded-2xl p-8 shadow-card text-center max-w-md w-full mx-4 animate-scale-in-center">
        {status === "loading" && <Loader2 className="w-16 h-16 text-info mx-auto animate-spin mb-4" />}
        {status === "success" && <CheckCircle className="w-16 h-16 text-success mx-auto mb-4 animate-bounce-subtle" />}
        {status === "error" && <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {status === "loading" ? "Completing Sign In" : status === "success" ? "Welcome Back!" : "Authentication Failed"}
        </h2>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
