import type { ChainStep } from "@/contexts/AutomationContext";
import {
  listResumes,
  getResume,
  optimizeResume,
  generateCoverLetter,
  saveJob,
  createApplication,
} from "@/api";

export interface ApplyChainJob {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  url?: string;
  dedupe_key?: string;
  [k: string]: any;
}

const dedupeKeyFor = (job: ApplyChainJob) =>
  job.dedupe_key || `${job.company ?? "unknown"}-${job.title ?? "role"}-${job.location ?? ""}`;

/**
 * The real "AutoPilot" chain. Every step hits a live backend endpoint —
 * if a service is down the step fails visibly instead of faking progress.
 */
export function buildApplyChain(job: ApplyChainJob): ChainStep[] {
  const jd = job.description || `${job.title ?? ""} at ${job.company ?? ""}`;

  return [
    {
      label: "Saving job to your pipeline",
      run: async (ctx) => {
        const res = await saveJob({ dedupe_key: dedupeKeyFor(job), job, status: "saved" });
        ctx.savedId = res.saved_id;
        return "Added to Pipeline";
      },
    },
    {
      label: "Tailoring your resume to this job",
      run: async (ctx) => {
        const resumes = await listResumes();
        if (!resumes.length) throw new Error("No resume found — upload one in Resume Optimizer first.");
        const resume = resumes[0];
        ctx.resumeId = resume.id;
        // ponytail: object form required since the Task 2 signature change —
        // a raw string would silently drop the JD.
        const result = await optimizeResume(resume.id, { jobDescription: jd });
        ctx.optimizedText = result?.optimized_text || result?.text || "";
        const score = (result?.ats_score_after ?? result?.score) as number | undefined;
        return score ? `ATS match now ${Math.round(score)}%` : `Tailored "${resume.title}"`;
      },
    },
    {
      label: "Drafting a matching cover letter",
      optional: true,
      run: async (ctx) => {
        let resumeText: string = ctx.optimizedText;
        if (!resumeText && ctx.resumeId) {
          const full = await getResume(ctx.resumeId);
          resumeText = full.original_text || "";
        }
        if (!resumeText) throw new Error("No resume text available for the cover letter.");
        const letter = await generateCoverLetter({
          resume_text: resumeText,
          job_title: job.title || "the role",
          company: job.company || "the company",
          job_description: jd,
        });
        ctx.coverLetter = letter.cover_letter;
        return `${letter.word_count} words drafted`;
      },
    },
    {
      // AutoPilot only *prepares* an application — it never submits to an
      // ATS. Recording it as "applied" would be a lie the user acts on, so the
      // record lands in Saved until a real submission is proven.
      label: "Saving the prepared application",
      run: async (ctx) => {
        const app = await createApplication({
          job,
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          tailored_resume_text: ctx.optimizedText,
          cover_letter: ctx.coverLetter,
          status: "saved",
          stage: "saved",
        } as any);
        ctx.applicationId = app.application_id;
        return "Draft ready in Pipeline → Saved (not yet submitted)";
      },
    },

  ];
}
