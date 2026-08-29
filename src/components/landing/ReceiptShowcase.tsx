import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Receipt, Clock, CheckCircle2, FileText, Hash, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE_RECEIPTS = [
  {
    id: "stripe-gh",
    atsVendor: "Greenhouse",
    jobTitle: "Senior Backend Engineer",
    company: "Example Corp",
    confirmationNumber: "EXAMPLE-ONLY",
    submittedAt: "Example timestamp — not a live submission",
    resumeRef: "example-resume.pdf",
    answersRef: "example-answers.json",
    digest: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    urlPath: "greenhouse.io / confirmations / example-only",
  },
  {
    id: "cloudflare-lev",
    atsVendor: "Lever",
    jobTitle: "Staff Systems Engineer",
    company: "Cloudflare",
    confirmationNumber: "LEV-CLOUDFLARE-5521",
    submittedAt: "2026-08-28 09:18 UTC",
    resumeRef: "cf_systems_lead_v2.pdf",
    answersRef: "cf_technical_q_signed.json",
    digest: "sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    urlPath: "jobs.lever.co / confirmations / 5521",
  },
  {
    id: "linear-ash",
    atsVendor: "Ashby",
    jobTitle: "AI Infrastructure Specialist",
    company: "Linear",
    confirmationNumber: "ASH-LINEAR-902",
    submittedAt: "2026-08-28 08:30 UTC",
    resumeRef: "linear_ai_infra_v3.pdf",
    answersRef: "linear_answers_signed.json",
    digest: "sha256:ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
    urlPath: "jobs.ashbyhq.com / receipt / 902",
  },
];

const DIFFERENTIATORS = [
  "A verified state means the external system returned a real confirmation; otherwise the record stays explicitly unverified.",
  "Failed, paused, and missing receipts remain distinct, so uncertainty is never disguised as progress.",
  "Receipt fields, attachments, and sha256 digests are stored locally in your private candidate ledger.",
];

export function ReceiptShowcase() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const receipt = SAMPLE_RECEIPTS[selectedIdx];

  const copyDigest = () => {
    navigator.clipboard.writeText(receipt.digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-20 lg:py-28 border-t border-border/40 bg-background/40">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold inline-flex items-center gap-2 mb-4">
            <Receipt className="w-3.5 h-3.5" />
            Audit Trail & Verifiable Receipts
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Keep the context that makes your next move clearer.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            When a supported workflow completes, Job Tayari retains an immutable cryptographic record alongside the exact resume variant and form answers used.
          </p>
        </div>

        {/* ATS Selection Tabs */}
        <div className="flex justify-center gap-2 mb-6">
          {SAMPLE_RECEIPTS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedIdx(i)}
              className={cn(
                "rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]",
                selectedIdx === i
                  ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
              )}
            >
              {r.company} ({r.atsVendor})
            </button>
          ))}
        </div>

        {/* Receipt card */}
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Illustrative UI example — no application was submitted
          </p>
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-2 shadow-2xl backdrop-blur-md" aria-label="Illustrative submission receipt example; not a live receipt">
            <div className="rounded-xl border border-border/60 bg-background/95 overflow-hidden">
              {/* Browser window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/40">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 mx-3 px-3 py-1 rounded-md bg-background/90 border border-border/40 text-[11px] text-muted-foreground text-center font-mono truncate">
                  {receipt.urlPath}
                </div>
              </div>

              {/* Receipt body */}
              <div className="p-6 md:p-8 text-left space-y-6">
                <div className="flex items-center justify-between">
                  <Badge variant="success" className="gap-1.5 px-3 py-1 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Illustrative receipt
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-mono">
                    ATS: {receipt.atsVendor}
                  </Badge>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 font-mono">
                    Submitted application
                  </p>
                  <p className="font-display text-2xl font-bold text-foreground">
                    {receipt.jobTitle}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">
                    at {receipt.company}
                  </p>
                </div>

                {/* Confirmation token */}
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5 font-mono">
                    <Hash className="w-3 h-3 text-primary" />
                    Confirmation number
                  </p>
                  <p className="font-mono text-lg font-bold text-foreground tracking-tight">
                    {receipt.confirmationNumber}
                  </p>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MetaTile
                    icon={<Clock className="w-3.5 h-3.5 text-cyan-500" />}
                    label="Submitted at"
                    value={receipt.submittedAt}
                    mono
                  />
                  <MetaTile
                    icon={<FileText className="w-3.5 h-3.5 text-primary" />}
                    label="Resume"
                    value={receipt.resumeRef}
                    mono
                  />
                  <MetaTile
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    label="Answers"
                    value={receipt.answersRef}
                    mono
                  />
                </div>

                {/* Cryptographic Proof row */}
                <div className="rounded-lg border border-border/40 bg-muted/40 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block uppercase font-mono font-semibold">
                      Proof Digest:
                    </span>
                    <p className="font-mono text-xs text-foreground truncate">
                      {receipt.digest}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyDigest}
                    className="h-8 text-xs font-semibold shrink-0 active:scale-[0.98]"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Digest
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Caption */}
          <p className="text-center text-sm text-muted-foreground mt-5 leading-relaxed">
            When a supported workflow receives an external confirmation, Job Tayari can retain a receipt alongside the role and materials. That context helps you retrace the work, not just count another submission. Fields, screenshots, and retention depend on the workflow and deployment; this card is illustrative, not a live receipt.
          </p>

          {/* Differentiators */}
          <ul className="mt-10 space-y-3 max-w-xl mx-auto">
            {DIFFERENTIATORS.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-sm text-foreground/90 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function MetaTile({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5 font-semibold">
        {icon}
        {label}
      </p>
      <p className={`text-xs text-foreground/90 truncate font-semibold ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export default ReceiptShowcase;