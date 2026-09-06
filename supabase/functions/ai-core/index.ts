import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

/**
 * ai-core — hosted AI fallback for Job Tayari.
 *
 * The Go gateway + Python engine are only present in a self-hosted deployment.
 * In the hosted app those calls fail, which used to leave every AI feature dead.
 * This function runs the same four candidate-facing AI operations on Lovable AI
 * so the product works online, with the identical response shapes the frontend
 * already expects from the gateway.
 *
 * Grounding rule: the model must never invent employers, dates, titles or
 * metrics that are not present in the candidate's own resume text.
 */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "openai/gpt-5.6-sol";

const MAX_RESUME_CHARS = 50_000;
const MAX_JD_CHARS = 20_000;

type Cors = Record<string, string>;

function json(body: unknown, status: number, cors: Cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function clamp(value: unknown, max: number): string {
  return String(value ?? "").slice(0, max);
}

async function callModel(
  system: string,
  user: string,
  cors: Cors,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: Response }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      response: json({ error: "AI is not configured for this deployment." }, 500, cors),
    };
  }

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (res.status === 429) {
    return {
      ok: false,
      response: json(
        { error: "The AI service is busy right now. Please try again in a moment." },
        429,
        cors,
      ),
    };
  }
  if (res.status === 402) {
    return {
      ok: false,
      response: json(
        { error: "AI credits for this workspace are exhausted. Add credits to continue." },
        402,
        cors,
      ),
    };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      response: json({ error: detail || `AI request failed (${res.status}).` }, 502, cors),
    };
  }

  const payload = await res.json();
  const content = payload?.choices?.[0]?.message?.content ?? "{}";
  try {
    return { ok: true, data: JSON.parse(content) as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: json({ error: "The AI returned an unreadable response. Please retry." }, 502, cors),
    };
  }
}

const GROUNDING =
  "You are an expert career coach and ATS analyst. Ground every statement strictly in the candidate's " +
  "resume text. Never invent employers, job titles, dates, degrees, certifications or metrics that are " +
  "not present in the resume. If evidence is missing, say so explicitly rather than filling the gap. " +
  "Reply with a single JSON object and nothing else.";

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Please sign in to use AI features." }, 401, corsHeaders);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !authData?.user) {
      return json({ error: "Please sign in to use AI features." }, 401, corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const op = String(body.op ?? "");
    const resumeText = clamp(body.resume_text, MAX_RESUME_CHARS);
    const jobDescription = clamp(body.job_description, MAX_JD_CHARS);

    if (op !== "cover_letter" && op !== "interview_prep" && !resumeText.trim()) {
      return json({ error: "Add your resume text first." }, 400, corsHeaders);
    }

    if (op === "analyze") {
      const result = await callModel(
        GROUNDING,
        `Score this resume against the job description for ATS fit.\n\n` +
          `Return JSON: {"score": number 0-100, "breakdown": {"keywords": number, "experience": number, "skills": number, "formatting": number}, ` +
          `"keyword_matches": string[], "missing_keywords": string[], "recommendations": string[] (max 6, each concrete and actionable)}.\n\n` +
          `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription || "(none provided — score general ATS readiness)"}`,
        corsHeaders,
      );
      if (!result.ok) return result.response;
      const d = result.data;
      return json(
        {
          id: 0,
          user_id: authData.user.id,
          resume_id: Number(body.resume_id ?? 0) || 0,
          job_description_id: 0,
          score: Number(d.score ?? 0),
          breakdown: d.breakdown ?? {},
          keyword_matches: d.keyword_matches ?? [],
          missing_keywords: d.missing_keywords ?? [],
          recommendations: d.recommendations ?? [],
          created_at: new Date().toISOString(),
          source: "lovable_ai",
        },
        200,
        corsHeaders,
      );
    }

    if (op === "optimize") {
      const result = await callModel(
        GROUNDING,
        `Rewrite this resume so it reads stronger and passes ATS screening for the target role. ` +
          `Keep every fact truthful — you may rephrase and reorder, never fabricate.\n\n` +
          `Return JSON: {"optimized_text": string (full rewritten resume, plain text), ` +
          `"changes": string[] (what you changed and why), "score_before": number, "score_after": number, ` +
          `"missing_keywords": string[]}.\n\n` +
          `TARGET ROLE: ${clamp(body.target_role, 200) || "(unspecified)"}\n` +
          `EXTRA INSTRUCTIONS: ${clamp(body.custom_instructions, 2000) || "(none)"}\n\n` +
          `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription || "(none provided)"}`,
        corsHeaders,
      );
      if (!result.ok) return result.response;
      const d = result.data;
      return json(
        {
          optimized_text: String(d.optimized_text ?? ""),
          changes: d.changes ?? [],
          score_before: Number(d.score_before ?? 0),
          score_after: Number(d.score_after ?? 0),
          missing_keywords: d.missing_keywords ?? [],
          source: "lovable_ai",
        },
        200,
        corsHeaders,
      );
    }

    if (op === "cover_letter") {
      const result = await callModel(
        GROUNDING,
        `Write a cover letter for this role, evidenced only by the resume.\n\n` +
          `Return JSON: {"cover_letter": string, "word_count": number, "bullet_references": string[] ` +
          `(the exact resume lines you drew on)}.\n\n` +
          `ROLE: ${clamp(body.job_title, 200)} at ${clamp(body.company, 200)}\n` +
          `TONE: ${clamp(body.tone, 50) || "professional"}\n` +
          `CANDIDATE NOTES: ${clamp(body.personal_notes, 2000) || "(none)"}\n\n` +
          `RESUME:\n${resumeText || "(no resume on file — say so instead of inventing experience)"}\n\n` +
          `JOB DESCRIPTION:\n${jobDescription || "(none provided)"}`,
        corsHeaders,
      );
      if (!result.ok) return result.response;
      const d = result.data;
      const letter = String(d.cover_letter ?? "");
      return json(
        {
          cover_letter: letter,
          word_count: Number(d.word_count ?? letter.split(/\s+/).filter(Boolean).length),
          bullet_references: d.bullet_references ?? [],
          tone: String(body.tone ?? "professional"),
          job_title: String(body.job_title ?? ""),
          company_name: String(body.company ?? ""),
          source: "lovable_ai",
        },
        200,
        corsHeaders,
      );
    }

    if (op === "interview_prep") {
      const result = await callModel(
        GROUNDING,
        `Produce interview preparation for this candidate.\n\n` +
          `Return JSON: {"questions": [{"question": string, "category": string, "source_bullet": string, ` +
          `"skill": string, "suggested_answer": string, "star_suggested": {"situation": string, "task": string, ` +
          `"action": string, "result": string}}] (8 to 12 questions), "skills_tested": string[]}.\n\n` +
          `INTERVIEW TYPE: ${clamp(body.interview_type, 100) || "general"}\n` +
          `ROLE: ${clamp(body.job_title, 200)} at ${clamp(body.company_name, 200)}\n\n` +
          `RESUME:\n${resumeText || "(no resume on file — keep questions role-generic and say so)"}\n\n` +
          `JOB DESCRIPTION:\n${jobDescription || "(none provided)"}`,
        corsHeaders,
      );
      if (!result.ok) return result.response;
      const d = result.data;
      return json(
        {
          questions: d.questions ?? [],
          interview_type: String(body.interview_type ?? "general"),
          skills_tested: d.skills_tested ?? [],
          source: "lovable_ai",
        },
        200,
        corsHeaders,
      );
    }

    return json({ error: `Unknown operation: ${op || "(missing)"}` }, 400, corsHeaders);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
      corsHeaders,
    );
  }
});
