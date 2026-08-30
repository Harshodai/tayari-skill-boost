import { apiFetchResponse } from "@/api";
import { useState } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileCode, Download, Eye, Sparkles, CheckCircle2, Copy, RefreshCw, Layers, SlidersHorizontal, UserCheck } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = [
  { id: "modern_tech", name: "Modern Tech", desc: "Clean blue accent design optimized for software & data roles." },
  { id: "minimalist_ats", name: "Minimalist ATS", desc: "High-contrast single-column format designed for parser compatibility." },
  { id: "executive_slate", name: "Executive Slate", desc: "Serif typography for director and leadership profiles." },
  { id: "faang_single_page", name: "Single Page", desc: "Compact single-page layout for high-density engineering CVs." },
  { id: "creative_compact", name: "Creative Compact", desc: "Split-sidebar layout for design and product-management profiles." },
  { id: "academic_cv", name: "Academic CV", desc: "Formal layout with research and publication emphasis." },
];

export const TypstResumeStudio = () => {
  const [selectedTemplate, setSelectedTemplate] = useState("modern_tech");
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [summary, setSummary] = useState("");
  const [experienceText, setExperienceText] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);

  const loadSampleProfile = () => {
    setFullName("Taylor Vance");
    setHeadline("Staff Systems Engineer");
    setEmail("taylor.vance@example.org");
    setPhone("+1 (555) 019-2831");
    setLocation("Seattle, WA");
    setSkills("Go, Rust, TypeScript, React 19, PostgreSQL, Redis, Kafka, Docker, Kubernetes, AWS");
    setSummary("Staff Software Engineer with 8+ years designing high-throughput distributed systems and sub-50ms web interfaces.");
    setExperienceText(`• Staff Systems Engineer — Scale Systems (2022 – Present)\n  - Architected distributed event-stream ingestion in Go and Kafka handling 250k events/sec.\n  - Implemented multi-region Redis cache mesh, reducing database read contention by 78%.\n\n• Senior Frontend Lead — CloudMetrics (2019 – 2022)\n  - Spearheaded design system migration to React 19 and strict TypeScript across 60+ micro-frontends.`);
    toast.success("Sample template fields populated for testing");
  };

  const generateTypstPreviewCode = () => {
    return `#set page(paper: "us-letter", margin: (x: 0.4in, y: 0.4in))
#set text(font: "DejaVu Sans", size: 9.5pt)
#set par(justify: true)

#align(center)[
  #text(size: 16pt, weight: "bold")[${fullName || "Your Name"}] \\
  #text(size: 9pt)[${email || "email@example.com"} | ${phone || "phone"} | ${location || "location"}]
]

#v(4pt)
#line(length: 100%, stroke: 1pt + rgb("#2563eb"))

== Professional Summary
${summary || "Your professional summary will appear here."}

== Technical Skills
${skills || "Your technical skills will appear here."}

== Professional Experience
${experienceText || "Your professional experience bullets will appear here."}
`;
  };

  const handleCompilePdf = async () => {
    if (!fullName.trim() || !headline.trim() || !summary.trim() || !experienceText.trim()) {
      toast.error("Add your name, headline, summary, and experience before compiling.");
      return;
    }
    setIsCompiling(true);
    try {
      const resp = await apiFetchResponse("/v1/typst/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTemplate,
          resume_data: {
            full_name: fullName,
            headline,
            email,
            phone,
            location,
            skills: skills.split(",").map((s) => s.trim()),
            summary,
            experience: experienceText,
          },
        }),
      });
      if (!resp.ok) throw new Error(resp.statusText);
      const data = await resp.json();
      if (data.pdf_available && data.pdf_data) {
        const binary = atob(data.pdf_data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `resume_${selectedTemplate}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Typst PDF Compiled Successfully!", {
          description: `Template '${selectedTemplate}' compiled into single-page PDF.`,
        });
      } else {
        toast.error(data.error || "Compilation produced no PDF output");
      }
    } catch (err) {
      toast.error("Compilation failed");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateTypstPreviewCode());
    toast.success("Typst Code Copied to Clipboard");
  };

  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Typst Resume Studio</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Rust-Based Typesetting
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Single-page vector PDF generation using Typst. Zero font distortion, instant compiling, and strict ATS parser compatibility.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadSampleProfile} className="text-xs">
              <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Sample Profile
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyCode} className="text-xs">
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Code
            </Button>
            <Button size="sm" onClick={handleCompilePdf} disabled={isCompiling} className="font-semibold shadow-md active:scale-[0.98]">
              {isCompiling ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Compile Typst PDF
            </Button>
          </div>
        </div>

        {/* Template Selector Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {TEMPLATES.map((tmpl) => (
            <Card
              key={tmpl.id}
              className={`cursor-pointer transition-all duration-200 hover:border-primary ${
                selectedTemplate === tmpl.id ? "border-2 border-primary bg-primary/5 shadow-md" : "border-border"
              }`}
              onClick={() => setSelectedTemplate(tmpl.id)}
            >
              <CardContent className="p-3 text-center space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground truncate">{tmpl.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    Template
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{tmpl.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Editor vs Live Preview split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Editor Form */}
          <div className="lg:col-span-6 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" /> Candidate Data & Content
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono text-success border-success/20">
                    ATS Sanitized
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Target Role / Headline</label>
                    <Input value={headline} onChange={(e) => setHeadline(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Phone</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Location</label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Technical Skills</label>
                  <Input value={skills} onChange={(e) => setSkills(e.target.value)} className="mt-1" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Executive Summary</label>
                  <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="mt-1" />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Experience & Achievements (Bullet format)</label>
                  <Textarea value={experienceText} onChange={(e) => setExperienceText(e.target.value)} rows={6} className="mt-1 font-mono text-xs leading-relaxed" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Typst Preview Pane */}
          <div className="lg:col-span-6 space-y-4">
            <Card className="h-full flex flex-col shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" /> Live Typst Document Preview
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  Template: {selectedTemplate}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 flex-1">
                <Tabs defaultValue="preview" className="w-full h-full flex flex-col">
                  <TabsList className="mb-3">
                    <TabsTrigger value="preview">Formatted Document</TabsTrigger>
                    <TabsTrigger value="source">Typst Markup Code</TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="flex-1">
                    <div className="bg-white text-slate-900 p-6 rounded-lg border shadow-inner min-h-[500px] font-sans text-xs space-y-3">
                      <div className="text-center border-b pb-3">
                        <h2 className="text-xl font-bold text-slate-900">{fullName || "Your Name"}</h2>
                        <p className="text-slate-600 text-xs font-semibold mt-0.5">{headline || "Your Target Headline"}</p>
                        <p className="text-muted-foreground text-[10px] mt-1 font-mono">{email || "email@example.com"} | {phone || "phone"} | {location || "location"}</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-blue-700 uppercase tracking-wider text-[11px] border-b pb-0.5">Professional Summary</h3>
                        <p className="mt-1.5 text-slate-700 leading-relaxed">{summary || "Enter your summary to view live formatting..."}</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-blue-700 uppercase tracking-wider text-[11px] border-b pb-0.5 mt-3">Technical Skills</h3>
                        <p className="mt-1.5 text-slate-700">{skills || "Enter your technical skills..."}</p>
                      </div>

                      <div>
                        <h3 className="font-bold text-blue-700 uppercase tracking-wider text-[11px] border-b pb-0.5 mt-3">Experience</h3>
                        <div className="mt-1.5 space-y-2 text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {experienceText || "Enter your experience bullets..."}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="source" className="flex-1">
                    <pre className="bg-card text-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto min-h-[500px] leading-relaxed">
                      {generateTypstPreviewCode()}
                    </pre>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default TypstResumeStudio;
