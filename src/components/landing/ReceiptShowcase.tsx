import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Receipt, Clock, CheckCircle2, FileText, Hash } from "lucide-react";

// Showcase mock — a hardcoded sample receipt rendered on the landing page to
// make the provenance/trust layer visible. NOT a live fetch: the frontend never
// calls Python directly (per CLAUDE.md). Values are clearly-placeholder but
// realistic-shaped so the reader recognises it as a captured receipt, not a
// designed graphic. Re-verify the receipt shape against
// `PipelineReceipt` in `src/components/pipeline/types.ts` when that changes.
const RECEIPT_SAMPLE = {
  jobTitle: "Senior Backend Engineer",
  company: "Acme Corp",
  atsVendor: "Greenhouse",
  confirmationNumber: "REF-2026-0811-AB7K",
  submittedAt: "2026-08-11 14:32:07 UTC",
  resumeRef: "resume_4f9c2b1d.pdf",
  answersRef: "answers_7e3a.json",
};

const DIFFERENTIATORS = [
  "Verified = the ATS printed a confirmation. Unverified = we tell you, not hide it.",
  "Failed = a distinct state, not a missing one. A missing receipt never looks like a pending one.",
  "Your resume + answers are stored immutably per submission. You can prove what was sent on your behalf.",
];

export function ReceiptShowcase() {
  return (
    <section className="py-20 lg:py-28 border-t border-border/40">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2 mb-4">
            <Receipt className="w-3.5 h-3.5" />
            Provenance, not promises
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            The only tool that proves what it sent.
          </h2>
        </div>

        {/* Receipt card — styled to look like a captured screenshot, not a designed card.
            Faint outer border + slight off-white "paper" tint + monospace meta to evoke a
            real confirmation page torn from the ATS. */}
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-2 shadow-sm">
            <div className="rounded-md border border-border/50 bg-background/95 backdrop-blur-sm overflow-hidden">
              {/* Screenshot "window" header — like a browser/print capture chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/40">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success/50" />
                </div>
                <div className="flex-1 mx-3 px-3 py-1 rounded bg-background/80 border border-border/40 text-[11px] text-muted-foreground text-center font-mono truncate">
                  greenhouse.io / confirmations / {RECEIPT_SAMPLE.confirmationNumber.toLowerCase()}
                </div>
              </div>

              {/* Receipt body */}
              <div className="p-6 md:p-8 text-left">
                {/* Verified badge — mirrors PipelineCard's visual language */}
                <div className="flex items-center justify-between mb-6">
                  <Badge variant="success" className="gap-1.5 px-2.5 py-1 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Submission verified
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-mono">
                    ATS: {RECEIPT_SAMPLE.atsVendor}
                  </Badge>
                </div>

                {/* Job line */}
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Submitted application
                  </p>
                  <p className="font-display text-xl md:text-2xl font-semibold text-foreground">
                    {RECEIPT_SAMPLE.jobTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    at {RECEIPT_SAMPLE.company} <span className="text-muted-foreground/60">(company redacted in this showcase)</span>
                  </p>
                </div>

                {/* Confirmation number */}
                <div className="rounded-md border border-border/50 bg-muted/30 p-4 mb-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" />
                    Confirmation number
                  </p>
                  <p className="font-mono text-base md:text-lg font-semibold text-foreground tracking-tight">
                    {RECEIPT_SAMPLE.confirmationNumber}
                  </p>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <MetaTile
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Submitted at"
                    value={RECEIPT_SAMPLE.submittedAt}
                    mono
                  />
                  <MetaTile
                    icon={<FileText className="w-3.5 h-3.5" />}
                    label="Resume"
                    value={RECEIPT_SAMPLE.resumeRef}
                    mono
                  />
                  <MetaTile
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    label="Answers"
                    value={RECEIPT_SAMPLE.answersRef}
                    mono
                  />
                </div>

                {/* Footer line — like a printed receipt's tail */}
                <div className="pt-4 border-t border-dashed border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">Captured by Job Tayari · immutable receipt</span>
                  <span className="font-mono">SHA-256: 7f3a…b29c</span>
                </div>
              </div>
            </div>
          </div>

          {/* Caption */}
          <p className="text-center text-sm text-muted-foreground mt-5 leading-relaxed">
            Every submission produces an immutable receipt with a screenshot + confirmation number.
            No silent failures, no dashboard lies.
          </p>

          {/* Differentiators */}
          <ul className="mt-10 space-y-3 max-w-xl mx-auto">
            {DIFFERENTIATORS.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
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
    <div className="rounded-md border border-border/40 bg-background/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={`text-xs text-foreground/90 truncate ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}