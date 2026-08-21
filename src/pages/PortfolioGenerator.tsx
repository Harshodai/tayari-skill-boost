import { apiFetchResponse } from "@/api";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Code, Download, ExternalLink, Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import { AppShell } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/api";

export function PortfolioGenerator() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [skills, setSkills] = useState("");
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [htmlOutput, setHtmlOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await apiFetch<any>("/v1/profile").catch(() => null);
        if (profile) {
          if (profile.full_name) setFullName(profile.full_name);
          if (profile.headline) setHeadline(profile.headline);
          if (profile.summary) setSummary(profile.summary);
          if (profile.skills && Array.isArray(profile.skills)) {
            setSkills(profile.skills.join(", "));
          }
        } else if (user?.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name);
        }
      } catch {
        // profile load optional
      }
    }
    loadProfile();
  }, [user]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !headline.trim()) {
      toast({ title: "Incomplete details", description: "Please enter your name and headline." });
      return;
    }
    setGenerating(true);
    setError(null);

    try {
      const resp = await apiFetchResponse("/v1/portfolio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          headline,
          summary,
          skills: skills ? skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setHtmlOutput(data.html || data);
      } else {
        const message = "The AI service could not generate a portfolio. No new artifact was recorded.";
        setError(message);
        toast({ title: "Portfolio Generation Failed", description: message });
      }
    } catch {
      const message = "The portfolio service is unavailable. Check the backend and provider configuration, then retry.";
      setError(message);
      toast({ title: "Generation Error", description: message });
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (!htmlOutput) return;
    navigator.clipboard.writeText(htmlOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Portfolio HTML Copied to Clipboard!" });
  };

  const downloadHtml = () => {
    if (!htmlOutput) return;
    const blob = new Blob([htmlOutput], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Portfolio generation unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Globe className="h-8 w-8 text-blue-500" />
            AI Interactive Portfolio Page Generator
          </h1>
          <p className="text-muted-foreground">
            Turn your Knowledge Graph and career accomplishments into a responsive, single-page interactive portfolio website in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Portfolio Content</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Professional Headline</Label>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Core Skills (comma separated)</Label>
                  <Input value={skills} onChange={(e) => setSkills(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Summary</Label>
                  <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1" />
                </div>
                <Button type="submit" disabled={generating} className="w-full font-semibold">
                  <Sparkles className="h-4 w-4 mr-2" /> {generating ? "Generating Site..." : "Generate Portfolio Site"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Live Preview / HTML Code */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Live Website Code & Export</span>
                {htmlOutput && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={copyCode}>
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 mr-1" />}
                      Copy HTML
                    </Button>
                    <Button size="sm" onClick={downloadHtml}>
                      <Download className="h-4 w-4 mr-1" /> Download .html
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!htmlOutput ? (
                <div className="py-16 text-center text-muted-foreground">Fill in your details and click "Generate Portfolio Site" to render your live code.</div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Standalone HTML Code</div>
                  <div className="p-4 rounded-lg bg-muted border max-h-96 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
                    {htmlOutput}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default PortfolioGenerator;
