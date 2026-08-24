import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Receipt, Clock, CheckCircle2, FileText, Hash } from "lucide-react";

// Illustrative mock — this hardcoded card is not a live submission or customer
// receipt. It demonstrates the fields a supported workflow may record after an
// external system returns a confirmation. Re-verify the shape against
// `PipelineReceipt` in `src/components/pipeline/types.ts` when that changes.
const RECEIPT_SAMPLE = {
  jobTitle: "Senior Backend Engineer",
  company: "Example Corp",
  "atsVendor": "Example ATS",
  "confirmationNumber": "EXAMPLE-ONLY",
  "submittedAt": "Example timestamp — not a live submission",
  "resumeRef": "example-resume.pdf",
  "answersRef": "example-answers.json",
};

const DIFFERENTIATORS = [
  "A verified state means the external system returned a confirmation; otherwise the record stays explicitly unverified.",
  "Failed and missing receipts remain distinct, so uncertainty is not disguised as progress.",
  "Receipt fields and retention depend on the enabled workflow and deployment configuration.",
];

export function ReceiptShowcase() {
  return (
    <section className="py-20 lg:py-28 border-t border-border/40">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2 mb-4">
            <Receipt className="w-3.5 h-3.5" />
            Context you can return to
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Keep the context that makes the next move clearer.
          </h2>
        </div>

        {/* Receipt card — styled to look like a captured screenshot, not a designed card.
            Faint outer border + slight off-white "paper" tint + monospace meta to evoke a
            real confirmation page torn from the ATS. */}
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Illustrative UI example — no application was submitted
          </p>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-2 shadow-sm" aria-label="Illustrative submission receipt example; not a live receipt">
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
                    Illustrative receipt
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
                    at {RECEIPT_SAMPLE.company}
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
                  <span className="font-mono">Example only · no submission made</span>
                  <span className="font-mono">Digest: example-only</span>
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