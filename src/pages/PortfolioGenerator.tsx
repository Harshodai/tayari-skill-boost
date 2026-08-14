import { apiFetchResponse } from "@/api";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Code, Download, ExternalLink, Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import { AppShell } from "@/components/layout";

export function PortfolioGenerator() {
  const [fullName, setFullName] = useState("Harshodai Kolluru");
  const [headline, setHeadline] = useState("Full Stack AI Engineer & Systems Architect");
  const [skills, setSkills] = useState("Go, Python, React, TypeScript, Docker, Kubernetes, PostgreSQL, AWS");
  const [summary, setSummary] = useState(
    "Building high-concurrency cloud microservices, autonomous AI agents, and production-grade web applications. Experienced in optimizing LLM inference, WebSockets, and real-time data pipelines."
  );
  const [generating, setGenerating] = useState(false);
  const [htmlOutput, setHtmlOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const resp = await apiFetchResponse("/v1/portfolio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          headline,
          summary,
          skills: skills.split(",").map((s) => s.trim()),
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setHtmlOutput(data.html || data);
      } else {
        // Fallback default HTML
        setHtmlOutput(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-white p-12"><h1 class="text-4xl font-bold">${fullName}</h1><p class="text-blue-400 text-lg mt-2">${headline}</p><p class="text-slate-300 mt-4">${summary}</p></body></html>`);
      }
    } catch {
      setHtmlOutput(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-white p-12"><h1 class="text-4xl font-bold">${fullName}</h1><p class="text-blue-400 text-lg mt-2">${headline}</p><p class="text-slate-300 mt-4">${summary}</p></body></html>`);
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
