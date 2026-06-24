declare const chrome: any;
declare const process: { env: Record<string, string | undefined> };

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Download, ArrowRight, Puzzle, Shield, Zap, Globe } from "lucide-react";

export default function ExtensionOnboarding() {
  const navigate = useNavigate();
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkExtension();
  }, []);

  const checkExtension = async () => {
    try {
      // Try to communicate with the extension
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          "tayari-extension-id", // Will be replaced with actual extension ID
          { action: "get_version" },
          (response) => {
            if (response && response.version) {
              setIsInstalled(true);
            } else {
              setIsInstalled(false);
            }
          }
        );
        // Fallback: set false after timeout if no response
        setTimeout(() => {
          if (isInstalled === null) setIsInstalled(false);
        }, 2000);
      } else {
        setIsInstalled(false);
      }
    } catch (e) {
      setIsInstalled(false);
    }
  };

  const handleInstall = () => {
    setIsLoading(true);
    // In production, this would redirect to Chrome Web Store
    // For dev, show instructions
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const handleGoToDashboard = () => {
    navigate("/dashboard");
  };

  const features = [
    {
      icon: <Zap className="w-5 h-5 text-warning" />,
      title: "Autofill Applications",
      description: "Automatically fill job application forms with your profile data",
    },
    {
      icon: <Puzzle className="w-5 h-5 text-info" />,
      title: "Job Detection",
      description: "Detects jobs on LinkedIn, Indeed, Greenhouse, and 8+ platforms",
    },
    {
      icon: <Shield className="w-5 h-5 text-success" />,
      title: "Application Tracking",
      description: "Track your applications with one click from any job page",
    },
    {
      icon: <Globe className="w-5 h-5 text-primary" />,
      title: "Save Any Job",
      description: "Save jobs from any website to your Tayari dashboard",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg mb-4">
            <Puzzle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tayari Browser Extension</h1>
          <p className="text-muted-foreground text-lg">
            Supercharge your job search with the Tayari browser companion
          </p>
        </div>

        <div className="grid gap-4">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="mt-1">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Installation</CardTitle>
            <CardDescription>
              Install the extension to get started with automated job application tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled === true ? (
              <div className="flex items-center gap-3 text-success border border-success/20 bg-success/5 p-4 rounded-lg">
                <CheckCircle className="w-5 h-5 animate-pulse-slow" />
                <div>
                  <p className="font-medium">Extension is installed!</p>
                  <p className="text-sm text-success/90">You're ready to start tracking applications.</p>
                </div>
              </div>
            ) : isInstalled === false ? (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Development Mode Installation
                  </h4>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Open Chrome and navigate to <code className="bg-background px-1.5 py-0.5 rounded">chrome://extensions/</code></li>
                    <li>Enable <strong>Developer mode</strong> (toggle in top right)</li>
                    <li>Click <strong>Load unpacked</strong></li>
                    <li>Select the <code className="bg-background px-1.5 py-0.5 rounded">/extension</code> directory</li>
                    <li>The Tayari icon will appear in your toolbar</li>
                  </ol>
                </div>
                <Button
                  onClick={handleInstall}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? "Loading..." : "Open Chrome Extensions"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Chrome Web Store release coming soon. For now, use developer mode.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={handleGoToDashboard}>
            Go to Dashboard
          </Button>
          <Button onClick={() => navigate("/profile")}>
            Complete Your Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
