import type { PetState } from "./petFrames";

export interface PetTip {
  /** Short line shown in the speech bubble. */
  text: string;
  /** Pet mood while this tip is on screen. */
  mood: PetState;
}

/**
 * What the pet tells the user about Job Tayari. Kept factual — every line maps
 * to a surface that actually exists in the app.
 */
export const PET_TIPS: PetTip[] = [
  { text: "Hi, I'm Tay — your Job Tayari companion.", mood: "wave" },
  { text: "Upload a resume and I'll score it against any job description.", mood: "idle" },
  { text: "Smart Search ranks live roles by how well they match your profile.", mood: "thinking" },
  { text: "AutoPilot chains it all: save the job, tailor the resume, draft the cover letter.", mood: "thinking" },
  { text: "Your pipeline is a Kanban board — drag roles from Saved to Offer.", mood: "idle" },
  { text: "Interview prep generates questions from the exact role you applied to.", mood: "idle" },
  { text: "Everything runs on your account. Nothing is shared without you asking.", mood: "idle" },
  { text: "Click me and I'll take you to your dashboard.", mood: "celebrate" },
];
