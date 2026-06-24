import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

/**
 * AuthCallback handles the OAuth callback from the backend.
 * The token is passed in the URL fragment (#token=...) for security.
 * This component extracts it, stores it, and redirects to dashboard.
 */
const AuthCallback = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Processing authentication...");
    const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        // Cleanup function to clear all timers on unmount
        return () => {
            timerRefs.current.forEach(timer => { clearTimeout(timer); });
        };
    }, []);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Extract token from URL fragment (hash)
                const hash = window.location.hash.substring(1); // Remove #
                const params = new URLSearchParams(hash);
                const token = params.get("token");

                if (!token) {
                    throw new Error("No token received from authentication");
                }

                // Store token
                localStorage.setItem("auth_token", token);

                // Clear the hash from URL for security
                window.history.replaceState(null, "", window.location.pathname);

                setStatus("success");
                setMessage("Authentication successful! Redirecting...");

                // Redirect to dashboard - store timer for cleanup
                const redirectTimer = setTimeout(() => {
                    navigate("/dashboard", { replace: true });
                }, 1500);
                timerRefs.current.push(redirectTimer);

            } catch (error) {
                console.error("Auth callback error:", error);
                setStatus("error");
                setMessage(error instanceof Error ? error.message : "Authentication failed");

                // Redirect to auth page after delay - store timer for cleanup
                const errorTimer = setTimeout(() => {
                    navigate("/auth", { replace: true });
                }, 3000);
                timerRefs.current.push(errorTimer);
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
            <div className="glass border border-border/50 rounded-2xl p-8 shadow-card text-center max-w-md w-full mx-4 animate-scale-in-center">
                {status === "loading" && (
                    <>
                        <Loader2 className="w-16 h-16 text-info mx-auto animate-spin mb-4" />
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            Completing Sign In
                        </h2>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4 animate-bounce-subtle" />
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            Welcome Back!
                        </h2>
                    </>
                )}

                {status === "error" && (
                    <>
                        <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            Authentication Failed
                        </h2>
                    </>
                )}

                <p className="text-muted-foreground text-sm">{message}</p>
            </div>
        </div>
    );
};

export default AuthCallback;
