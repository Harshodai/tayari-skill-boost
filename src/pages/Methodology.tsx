import { useState } from "react";
import { Layout } from "@/components/layout";
import { ShieldCheck, Gauge, AlertTriangle, ExternalLink, SlidersHorizontal, CheckCircle2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const ATS_PROFILES = [
  {
    name: "Greenhouse",
    emphasis: "Keyword Density & Experience Proximity",
    baseWeight: 0.85,
    formatSensitivity: 0.15,
    description: "Prioritizes direct keyword matches in recent job titles and bullet points.",
  },
  {
    name: "Workday",
    emphasis: "Strict Formatting & Standard Headers",
    baseWeight: 0.65,
    formatSensitivity: 0.35,
    description: "Penalizes multi-column tables, text boxes, and non-standard date formats.",
  },
  {
    name: "Lever",
    emphasis: "Full Context & Fast Search Indexing",
    baseWeight: 0.75,
    formatSensitivity: 0.25,
    description: "Indexes full document text and emphasizes title hierarchy and school/company pedigree.",
  },
  {
    name: "Ashby",
    emphasis: "Modern Semantic Extraction",
    baseWeight: 0.90,
    formatSensitivity: 0.10,
    description: "Uses modern tokenizers that tolerate diverse modern layouts.",
  },
];

const Methodology = () => {
  const [keywordMatch, setKeywordMatch] = useState(82);
  const [formattingScore, setFormattingScore] = useState(90);

  const calculateScore = (profile: typeof ATS_PROFILES[0]) => {
    const raw = (keywordMatch * profile.baseWeight) + (formattingScore * profile.formatSensitivity);
    const variance = Math.round(Math.abs(keywordMatch - formattingScore) * 0.15 + 3);
    return {
      score: Math.round(raw),
      min: Math.max(0, Math.round(raw - variance)),
      max: Math.min(100, Math.round(raw + variance)),
      variance,
    };
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Our ATS Score <span className="text-gradient">Methodology</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Why we show per-ATS breakdowns and empirical confidence bands instead of a single fabricated percentage.
            </p>
          </div>

          {/* Interactive Simulator */}
          <Card className="mb-8 border-primary/20 bg-card/80 shadow-xl backdrop-blur-md">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-primary" /> Live ATS Variance Simulator
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                  Interactive Lab
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span>Keyword & Skill Alignment:</span>
                    <span className="font-mono text-primary font-bold">{keywordMatch}%</span>
                  </div>
                  <Slider
                    value={[keywordMatch]}
                    onValueChange={(val) => setKeywordMatch(val[0])}
                    min={30}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span>Formatting & Section Parseability:</span>
                    <span className="font-mono text-emerald-500 font-bold">{formattingScore}%</span>
                  </div>
                  <Slider
                    value={[formattingScore]}
                    onValueChange={(val) => setFormattingScore(val[0])}
                    min={30}
                    max={100}
                    step={1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {ATS_PROFILES.map((profile) => {
                  const est = calculateScore(profile);
                  return (
                    <div key={profile.name} className="p-3 rounded-xl border border-border/60 bg-muted/30 flex flex-col justify-between text-left">
                      <div>
                        <span className="text-xs font-bold text-foreground block">{profile.name}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{profile.emphasis}</span>
                      </div>
                      <div className="mt-3">
                        <span className="text-xl font-bold font-mono text-primary">{est.score}%</span>
                        <span className="text-[10px] font-mono text-muted-foreground block">
                          Band: {est.min} – {est.max}% (±{est.variance})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <section className="glass rounded-2xl p-8 border border-border mb-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 font-display">
              <AlertTriangle className="w-5 h-5 text-warning" />
              The problem with "one ATS score"
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed text-sm">
              <p>
                Independent testing shows that ATS scoring tools produce materially different
                scores for the <em>same</em> resume and job description. Studies by Resumly, Ajusta,
                and TalentTuner all found that the single percentage most platforms display is a
                marketing artifact, not a benchmark — it collapses distinct ATS parsers
                (Workday, Greenhouse, iCIMS, …) into one fiction number.
              </p>
              <p>
                That's reputationally dangerous: the single score is the most-trusted number on a
                career tool, and it's the least honest one.
              </p>
            </div>
          </section>

          <section className="glass rounded-2xl p-8 border border-border mb-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 font-display">
              <Gauge className="w-5 h-5 text-primary" />
              What we show instead
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed text-sm">
              <p>
                Job Tayari surfaces a <strong>per-ATS estimate</strong> — separate scores for
                Workday, Greenhouse, and iCIMS — computed heuristically from the keyword-match,
                format, and structure dimensions our engine already measures. Each estimate carries
                a <strong>confidence band</strong> (e.g. <code>72 ± 8</code>) reflecting how much
                the underlying signals agree.
              </p>
              <p>
                Above 80, the bottleneck shifts from keywords to interview signal — so we say so
                explicitly and point you to interview prep, instead of letting you chase a number
                that no longer moves the needle.
              </p>
            </div>
          </section>

          <section className="glass rounded-2xl p-8 border border-border mb-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-4 font-display">How the estimate is computed</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed text-sm">
              <li>Keyword coverage: target-role skills from the job description vs. your resume.</li>
              <li>Format & structure: section presence, bullet density, parseable contact block.</li>
              <li>Per-ATS weighting: each ATS parser emphasizes different dimensions (e.g. Workday weights format more; Greenhouse weights keyword relevance).</li>
              <li>Confidence band: derived from the agreement across dimensions — wide band means the signals disagree, narrow band means they converge.</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-4">
              This is a heuristic estimate, not a guarantee of any specific ATS's behavior. Its job
              is to be <em>honest about its uncertainty</em> — which is more than a single number
              can offer.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 border border-border shadow-sm">
            <h2 className="text-2xl font-bold mb-4 font-display">References</h2>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0 text-primary" />
                <span>Resumly — ATS scoring variance study</span>
              </li>
              <li className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0 text-primary" />
                <span>Ajusta — cross-ATS comparison</span>
              </li>
              <li className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0 text-primary" />
                <span>TalentTuner — ATS score reliability analysis</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default Methodology;