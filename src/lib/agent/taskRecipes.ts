export type TaskRecipeId =
  | "application_packet"
  | "opportunity_sweep"
  | "interview_sprint"
  | "follow_up_radar";

export type TaskRecipe = {
  id: TaskRecipeId;
  eyebrow: string;
  title: string;
  description: string;
  objective: string;
  promise: string;
  accent: "violet" | "cyan" | "emerald" | "amber";
  steps: Array<{
    id: string;
    title: string;
    detail: string;
    tool?: "candidate_context.read";
    risk_tier?: "read" | "navigation" | "draft" | "sensitive" | "external_write";
    requires_approval: boolean;
  }>;
};

export const TASK_RECIPES: TaskRecipe[] = [
  {
    id: "application_packet",
    eyebrow: "Apply preparation",
    title: "Build an application packet",
    description: "Turn one role into a grounded resume, cover letter, answers, and review queue.",
    objective: "Prepare a complete, evidence-backed application packet for one target role. Preserve resume facts, surface gaps, and pause before any external action.",
    promise: "Resume + fit audit + cover letter + answers",
    accent: "violet",
    steps: [
      { id: "target", title: "Confirm the role and hard constraints", detail: "Lock the target job, source, location, seniority, and unknowns before drafting.", requires_approval: false },
      { id: "context", title: "Read the latest candidate context", detail: "Use the saved profile and latest resume as the only source of candidate facts.", tool: "candidate_context.read", risk_tier: "read", requires_approval: false },
      { id: "fit", title: "Run the fit and evidence audit", detail: "Separate hard constraints, transferable skills, missing evidence, and uncertainty.", requires_approval: false },
      { id: "draft", title: "Draft the application materials", detail: "Prepare role-specific materials without inventing claims or sensitive answers.", risk_tier: "draft", requires_approval: true },
      { id: "review", title: "Assemble a versioned review packet", detail: "Bind the role, inputs, artifact versions, provenance, and unresolved questions.", risk_tier: "sensitive", requires_approval: true },
      { id: "handoff", title: "Pause for candidate review", detail: "No submission, messaging, credential entry, CAPTCHA, or legal declaration is automated.", risk_tier: "external_write", requires_approval: true },
    ],
  },
  {
    id: "opportunity_sweep",
    eyebrow: "Opportunity intelligence",
    title: "Sweep for better-fit roles",
    description: "Find, deduplicate, explain, and shortlist roles against your current search strategy.",
    objective: "Run a bounded opportunity sweep against my saved career strategy. Deduplicate stale or repeated postings, explain fit, and return a reviewable shortlist without applying or contacting anyone.",
    promise: "Fresh roles + explainable fit + no auto-apply",
    accent: "cyan",
    steps: [
      { id: "strategy", title: "Load the active search strategy", detail: "Read target roles, location, work model, compensation floor, and must-have constraints.", tool: "candidate_context.read", risk_tier: "read", requires_approval: false },
      { id: "discover", title: "Discover bounded opportunity candidates", detail: "Use configured sources within provider, freshness, and cost budgets.", risk_tier: "navigation", requires_approval: false },
      { id: "dedupe", title: "Canonicalize and freshness-check postings", detail: "Collapse duplicates and flag expired, suspicious, or unverifiable listings.", requires_approval: false },
      { id: "rank", title: "Explain the shortlist", detail: "Show hard constraints, skill evidence, gaps, confidence, source, and observed time.", risk_tier: "draft", requires_approval: true },
      { id: "review", title: "Queue your next decisions", detail: "Save only the opportunities you explicitly choose to keep in your working set.", risk_tier: "sensitive", requires_approval: true },
    ],
  },
  {
    id: "interview_sprint",
    eyebrow: "Role-specific coaching",
    title: "Run an interview sprint",
    description: "Generate a role-specific practice loop from the approved application context.",
    objective: "Create a role-specific interview preparation sprint grounded in my selected job and approved resume. Generate drills, story prompts, and an improvement plan, then wait for my review.",
    promise: "Targeted questions + story drills + progress",
    accent: "emerald",
    steps: [
      { id: "context", title: "Load the selected application context", detail: "Use the approved job snapshot, resume version, and evidence summary.", tool: "candidate_context.read", risk_tier: "read", requires_approval: false },
      { id: "map", title: "Map requirements to stories and drills", detail: "Identify likely questions, evidence gaps, technical areas, and behavioral themes.", requires_approval: false },
      { id: "practice", title: "Prepare an adaptive practice session", detail: "Create follow-up questions and concise drills that respond to the candidate’s answers.", risk_tier: "draft", requires_approval: true },
      { id: "score", title: "Create a progress baseline", detail: "Record transparent dimensions such as structure, evidence, clarity, and timing—not hiring probability.", requires_approval: true },
      { id: "review", title: "Pause with the next three drills", detail: "The candidate decides what to practice, repeat, correct, or discard.", risk_tier: "sensitive", requires_approval: true },
    ],
  },
  {
    id: "follow_up_radar",
    eyebrow: "Pipeline maintenance",
    title: "Prepare follow-up actions",
    description: "Find stale pipeline moments and draft the next move without sending anything.",
    objective: "Review my application pipeline for stale or time-sensitive moments. Prepare a prioritized follow-up plan and drafts, but never send a message or change an external record.",
    promise: "Stale-item detection + drafts + reminders",
    accent: "amber",
    steps: [
      { id: "pipeline", title: "Read the current application pipeline", detail: "Review candidate-owned statuses, timestamps, contacts, and known deadlines.", tool: "candidate_context.read", risk_tier: "read", requires_approval: false },
      { id: "triage", title: "Detect stale and time-sensitive items", detail: "Separate overdue follow-ups, waiting states, upcoming interviews, and unknown outcomes.", requires_approval: false },
      { id: "draft", title: "Draft concise follow-up options", detail: "Use only verified context and clearly mark missing recipient or timing facts.", risk_tier: "draft", requires_approval: true },
      { id: "plan", title: "Create a reviewable follow-up plan", detail: "Rank the next actions by urgency, confidence, effort, and candidate intent.", risk_tier: "sensitive", requires_approval: true },
      { id: "handoff", title: "Pause before any send or external write", detail: "Every message remains a draft until the candidate reviews the recipient, content, and timing.", risk_tier: "external_write", requires_approval: true },
    ],
  },
];

export const isTaskRecipeId = (value: string | null): value is TaskRecipeId =>
  value !== null && TASK_RECIPES.some((recipe) => recipe.id === value);

export const getTaskRecipe = (id: TaskRecipeId) =>
  TASK_RECIPES.find((recipe) => recipe.id === id) ?? TASK_RECIPES[0];

export const toTaskPlanSteps = (recipe: TaskRecipe) =>
  recipe.steps.map(({ id, title, detail, tool, risk_tier, requires_approval }) => ({
    id,
    title,
    detail,
    ...(tool ? { tool } : {}),
    ...(risk_tier ? { risk_tier } : {}),
    requires_approval,
  }));
