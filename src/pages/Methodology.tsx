import { Layout } from "@/components/layout";
import { ShieldCheck, Gauge, AlertTriangle, ExternalLink } from "lucide-react";

// ponytail: static page, no backend, no fetch. Cites the studies named in
// research/DIFFERENTIATION_STRATEGY.md K2 / PRODUCT_GRILL §12.3.
const Methodology = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Our ATS Score <span className="text-gradient">Methodology</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Why we show a per-ATS breakdown and a confidence band instead of one number.
            </p>
          </div>

          <section className="glass rounded-2xl p-8 border border-border mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              The problem with "one ATS score"
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
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

          <section className="glass rounded-2xl p-8 border border-border mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              What we show instead
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
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

          <section className="glass rounded-2xl p-8 border border-border mb-8">
            <h2 className="text-2xl font-bold mb-4">How the estimate is computed</h2>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed">
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

          <section className="glass rounded-2xl p-8 border border-border">
            <h2 className="text-2xl font-bold mb-4">References</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0" />
                <span>Resumly — ATS scoring variance study</span>
              </li>
              <li className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0" />
                <span>Ajusta — cross-ATS comparison</span>
              </li>
              <li className="flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-1 flex-shrink-0" />
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