import type { PetState } from "./petFrames";

export interface PetAction {
  id: string;
  label: string;
  hint: string;
  /** Exact in-app route this action opens. */
  to: string;
  /** Routes where this action is most relevant (prefix match). */
  contexts?: string[];
  /** Requires a signed-in user — otherwise Tay routes through /auth?next=. */
  auth?: boolean;
}

/**
 * Every action maps to a route that actually exists in src/App.tsx. Keep this
 * list in sync with the router — a companion that opens a 404 destroys trust
 * faster than no companion at all.
 */
export const PET_ACTIONS: PetAction[] = [
  {
    id: "dashboard",
    label: "Open my dashboard",
    hint: "Pipeline, saved jobs and next actions",
    to: "/dashboard",
    auth: true,
  },
  {
    id: "onboarding",
    label: "Set up my profile (3 steps)",
    hint: "Role, location, resume — skippable",
    to: "/onboarding",
    contexts: ["/", "/landing", "/auth"],
  },
  {
    id: "jobs",
    label: "Find matching jobs",
    hint: "Smart Search ranks roles against your profile",
    to: "/jobs",
  },
  {
    id: "resume",
    label: "Upload / score my resume",
    hint: "ATS score against any job description",
    to: "/resume",
  },
  {
    id: "templates",
    label: "Pick a resume template",
    hint: "ATS-safe layouts you can export",
    to: "/resume/templates",
    auth: true,
    contexts: ["/resume"],
  },
  {
    id: "pipeline",
    label: "Track my applications",
    hint: "Kanban from Saved to Offer",
    to: "/pipeline",
    auth: true,
  },
  {
    id: "cover",
    label: "Draft a cover letter",
    hint: "Tailored to a specific job description",
    to: "/cover-letter",
    auth: true,
  },
  {
    id: "interview",
    label: "Prep for an interview",
    hint: "Questions generated from the real role",
    to: "/interview/prep",
    auth: true,
  },
  {
    id: "profile",
    label: "Complete my profile",
    hint: "Better profile, better match scores",
    to: "/profile",
    auth: true,
  },
  {
    id: "pricing",
    label: "See what's free vs. Pro",
    hint: "Plans and limits, no surprises",
    to: "/pricing",
  },
];

/** Actions ranked for the route the visitor is currently on. */
export function actionsForRoute(pathname: string): PetAction[] {
  const scored = PET_ACTIONS.map((a) => {
    let score = 0;
    if (a.contexts?.some((c) => pathname.startsWith(c))) score += 3;
    if (pathname.startsWith(a.to) && a.to !== "/") score -= 2; // already there
    if (a.to === "/dashboard" && pathname === "/") score += 1;
    return { a, score };
  });
  return scored
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map((s) => s.a);
}

export interface PetTopic {
  id: string;
  question: string;
  /** Tay's answer — plain, factual, no marketing fluff. */
  answer: string;
  mood: PetState;
  cta?: { label: string; to: string };
}

/**
 * The product, explained end to end by the pet. NN/g's chatbot guidance:
 * state capabilities plainly, offer concrete prompts, always give a next step.
 */
export const PET_TOPICS: PetTopic[] = [
  {
    id: "what",
    question: "What is Job Tayari?",
    answer:
      "One workspace for the whole job hunt: find roles, tailor your resume to each one, draft the cover letter, track the application, and prep for the interview. Instead of five tools that don't talk to each other, every step reuses the same profile and resume.",
    mood: "wave",
    cta: { label: "Show me the dashboard", to: "/dashboard" },
  },
  {
    id: "start",
    question: "Where do I start?",
    answer:
      "Three steps: tell me the role you want, upload a resume once, then run your first search. Setup is skippable — you can search first and fill in the profile later, the match scores just get sharper as you do.",
    mood: "thinking",
    cta: { label: "Start the 3-step setup", to: "/onboarding" },
  },
  {
    id: "match",
    question: "How does the match score work?",
    answer:
      "Every job is compared against your parsed resume and profile — skills, seniority, titles and location. You get a score plus the specific gaps, so you can see why a role is an 82 before you read the description.",
    mood: "thinking",
    cta: { label: "Try Smart Search", to: "/jobs" },
  },
  {
    id: "ats",
    question: "What does the ATS score check?",
    answer:
      "Keyword coverage against the job description, structure a parser can read, quantified impact in your bullets, and formatting traps like tables or graphics. You get the score plus a rewrite for the weakest lines.",
    mood: "idle",
    cta: { label: "Score my resume", to: "/resume" },
  },
  {
    id: "apply",
    question: "What is AutoPilot?",
    answer:
      "One click chains four real steps: save the job to your pipeline, tailor your resume to that JD, draft a matching cover letter, and file it under Applied. You approve each step, and the Activity drawer shows exactly what ran.",
    mood: "celebrate",
    cta: { label: "Open Smart Search", to: "/jobs" },
  },
  {
    id: "pipeline",
    question: "How do I track applications?",
    answer:
      "A Kanban board: Saved, Applied, Interviewing, Offer. Drag a card to move it, and anything you save from Smart Search or AutoPilot lands there automatically.",
    mood: "idle",
    cta: { label: "Open my pipeline", to: "/pipeline" },
  },
  {
    id: "interview",
    question: "Can you help me prep interviews?",
    answer:
      "Yes — questions are generated from the exact role and company you applied to, with STAR-shaped answers drawn from your own resume so you're not memorising someone else's stories.",
    mood: "thinking",
    cta: { label: "Prep an interview", to: "/interview/prep" },
  },
  {
    id: "privacy",
    question: "What happens to my data?",
    answer:
      "Your resume and profile stay in your account and are only sent to a model when you trigger an action that needs one. Nothing is shared with recruiters or employers unless you send it yourself.",
    mood: "idle",
    cta: { label: "Read the privacy page", to: "/privacy" },
  },
  {
    id: "cost",
    question: "What does it cost?",
    answer:
      "Core search, resume scoring and pipeline tracking are free to use. Pro unlocks higher AI limits and the automation-heavy surfaces. Everything is listed on the pricing page — no hidden per-action fees.",
    mood: "idle",
    cta: { label: "See plans", to: "/pricing" },
  },
];

export interface PetTourStep {
  id: string;
  title: string;
  body: string;
  mood: PetState;
  cta: { label: string; to: string };
}

/** The guided end-to-end walkthrough. Progress persists across sessions. */
export const PET_TOUR: PetTourStep[] = [
  {
    id: "tour-profile",
    title: "1. Tell me what you're aiming for",
    body: "Role, location, work style. Takes about a minute and every score after this gets sharper. You can skip any field.",
    mood: "wave",
    cta: { label: "Open setup", to: "/onboarding" },
  },
  {
    id: "tour-resume",
    title: "2. Bring your resume in once",
    body: "PDF or DOCX. I parse it and reuse it everywhere — tailoring, ATS scores, cover letters, interview answers.",
    mood: "thinking",
    cta: { label: "Upload resume", to: "/resume" },
  },
  {
    id: "tour-search",
    title: "3. Search roles that actually fit",
    body: "Smart Search ranks live roles against your profile and shows the gap list before you read a single description.",
    mood: "thinking",
    cta: { label: "Open Smart Search", to: "/jobs" },
  },
  {
    id: "tour-apply",
    title: "4. Run your first AutoPilot",
    body: "Save → tailor → cover letter → tracked. You approve each step and can stop the chain at any point.",
    mood: "celebrate",
    cta: { label: "Find a job to apply to", to: "/jobs" },
  },
  {
    id: "tour-track",
    title: "5. Work the pipeline",
    body: "Drag cards Saved → Applied → Interviewing → Offer, and prep interviews straight from the card.",
    mood: "idle",
    cta: { label: "Open pipeline", to: "/pipeline" },
  },
];
