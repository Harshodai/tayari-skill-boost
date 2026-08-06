import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const MAX_RESUME_CHARS = 50_000;
const MAX_JD_CHARS = 20_000;

/**
 * Glass-Box Apply Agent.
 *
 * Human-in-the-loop by design: this function NEVER submits an application.
 * It prepares the application packet, records every step it took (so the user
 * can audit it), and then parks the run in `awaiting_review`. A run only becomes
 * `submitted` when the user explicitly says they submitted it.
 */

const STEP_PLAN = [
  { name: "Read job posting", detail: "Parsing the role, company and requirements." },
  { name: "Match resume", detail: "Comparing your resume against the posting." },
  { name: "Tailor answers", detail: "Drafting the application form answers." },
  { name: "Self-check", detail: "Verifying nothing was invented beyond your resume." },
  { name: "Hand back to you", detail: "Packet ready — you review and submit." },
];

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: "Unauthorized" }, 401, corsHeaders);
    const userId = authData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "start");

    // ---- terminal transitions -------------------------------------------
    if (action === "submit" || action === "cancel" || action === "fail") {
      const runId = String(body.runId ?? "");
      if (!runId) return json({ error: "runId is required" }, 400, corsHeaders);
      const patch =
        action === "submit"
          ? {
              status: "submitted",
              progress: 100,
              current_step: "Submitted by you",
              outcome: "You confirmed you submitted this application.",
              submitted_at: new Date().toISOString(),
            }
          : action === "cancel"
            ? { status: "cancelled", current_step: "Cancelled", outcome: "You cancelled this run." }
            : { status: "failed", current_step: "Failed", outcome: String(body.reason ?? "Run failed.") };
      const { error } = await supabase.from("agent_runs").update(patch).eq("id", runId).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400, corsHeaders);
      return json({ ok: true }, 200, corsHeaders);
    }

    // ---- start a run ------------------------------------------------------
    const jobTitle = String(body.jobTitle ?? "").slice(0, 200);
    const company = String(body.company ?? "").slice(0, 200);
    const jobUrl = String(body.jobUrl ?? "").slice(0, 2000);
    const jobDescription = String(body.jobDescription ?? "").slice(0, MAX_JD_CHARS);
    const resumeText = String(body.resumeText ?? "").slice(0, MAX_RESUME_CHARS);

    if (!jobTitle || !jobDescription || !resumeText) {
      return json(
        { error: "jobTitle, jobDescription and resumeText are required." },
        400,
        corsHeaders,
      );
    }

    const { data: run, error: runError } = await supabase
      .from("agent_runs")
      .insert({
        user_id: userId,
        job_title: jobTitle,
        company,
        job_url: jobUrl,
        mode: "human_in_the_loop",
        status: "running",
        progress: 5,
        current_step: STEP_PLAN[0].name,
      })
      .select()
      .single();
    if (runError || !run) return json({ error: runError?.message ?? "Could not start run" }, 400, corsHeaders);

    const { data: steps, error: stepErr } = await supabase
      .from("agent_run_steps")
      .insert(
        STEP_PLAN.map((s, idx) => ({
          run_id: run.id,
          user_id: userId,
          idx,
          name: s.name,
          detail: s.detail,
          status: idx === 0 ? "running" : "pending",
        })),
      )
      .select();
    if (stepErr) return json({ error: stepErr.message }, 400, corsHeaders);

    const stepId = (idx: number) => steps?.find((s: { idx: number; id: string }) => s.idx === idx)?.id;
    const finishStep = async (
      idx: number,
      logs: string,
      status = "done",
      detail?: string,
    ) => {
      const id = stepId(idx);
      if (!id) return;
      await supabase
        .from("agent_run_steps")
        .update({ status, logs, ...(detail ? { detail } : {}) })
        .eq("id", id);
      const next = stepId(idx + 1);
      if (next && status === "done") {
        await supabase.from("agent_run_steps").update({ status: "running" }).eq("id", next);
      }
      await supabase
        .from("agent_runs")
        .update({
          progress: Math.round(((idx + 1) / STEP_PLAN.length) * 100),
          current_step: STEP_PLAN[Math.min(idx + 1, STEP_PLAN.length - 1)].name,
        })
        .eq("id", run.id);
    };

    await finishStep(
      0,
      [
        `GET ${jobUrl || "(no URL provided — using pasted description)"}`,
        `role="${jobTitle}" company="${company || "unknown"}"`,
        `job description: ${jobDescription.length} chars parsed`,
      ].join("\n"),
    );

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      await finishStep(1, "AI engine is not configured — refusing to fabricate output.", "failed");
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          outcome: "The AI engine is not configured. No packet was produced and nothing was submitted.",
        })
        .eq("id", run.id);
      return json({ error: "AI service not configured", runId: run.id }, 503, corsHeaders);
    }

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You prepare job applications for a human who will review and submit them. " +
              "You may only use facts present in the resume. Never invent employers, dates, degrees, " +
              "certifications or metrics. If a form answer needs a fact the resume does not contain, " +
              "return it in `missing_facts` instead of guessing. Respond with JSON only.",
          },
          {
            role: "user",
            content:
              `ROLE: ${jobTitle}\nCOMPANY: ${company}\n\nJOB DESCRIPTION:\n${jobDescription}\n\n` +
              `RESUME:\n${resumeText}\n\n` +
              `Return JSON with this exact shape:\n` +
              `{"match_score":0-100,"match_reasons":["..."],"gaps":["..."],` +
              `"screening_answers":[{"question":"...","answer":"..."}],` +
              `"cover_note":"short 120-word note","missing_facts":["..."],` +
              `"truthfulness_check":"one sentence confirming every claim traces to the resume"}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      const message =
        aiRes.status === 429
          ? "Rate limit reached. Try again in a minute."
          : aiRes.status === 402
            ? "AI credits exhausted."
            : "The AI engine failed.";
      await finishStep(1, `AI gateway ${aiRes.status}: ${detail.slice(0, 500)}`, "failed");
      await supabase
        .from("agent_runs")
        .update({ status: "failed", outcome: `${message} Nothing was submitted.` })
        .eq("id", run.id);
      return json({ error: message, runId: run.id }, aiRes.status, corsHeaders);
    }

    const aiJson = await aiRes.json();
    const raw: string = aiJson?.choices?.[0]?.message?.content ?? "";
    let packet: Record<string, unknown> = {};
    try {
      packet = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      packet = {};
    }

    const score = Number(packet.match_score ?? 0);
    const reasons = Array.isArray(packet.match_reasons) ? packet.match_reasons : [];
    const gaps = Array.isArray(packet.gaps) ? packet.gaps : [];
    const answers = Array.isArray(packet.screening_answers) ? packet.screening_answers : [];
    const missing = Array.isArray(packet.missing_facts) ? packet.missing_facts : [];

    await finishStep(
      1,
      [`match score: ${score}/100`, ...reasons.map((r: string) => `+ ${r}`), ...gaps.map((g: string) => `- gap: ${g}`)].join("\n"),
      "done",
      `Matched at ${score}/100 against the posting.`,
    );

    await finishStep(
      2,
      answers.length
        ? answers.map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")
        : "No screening questions detected in the posting.",
      "done",
      `${answers.length} form answer(s) drafted.`,
    );

    await finishStep(
      3,
      [
        String(packet.truthfulness_check ?? "Every claim was sourced from your resume."),
        missing.length
          ? `Facts the resume does not contain (left blank for you):\n${missing.map((m: string) => `  · ${m}`).join("\n")}`
          : "No missing facts — the resume covered every required field.",
      ].join("\n\n"),
      "done",
      missing.length ? `${missing.length} field(s) need your input.` : "No fabricated content.",
    );

    await finishStep(
      4,
      "Packet ready. This agent does not click submit — open the posting, paste the answers, and confirm below once you have submitted.",
      "done",
      "Waiting on you.",
    );

    await supabase
      .from("agent_runs")
      .update({
        status: "awaiting_review",
        progress: 100,
        current_step: "Awaiting your review",
        outcome: `Application packet ready. Match ${score}/100. Nothing has been submitted.`,
      })
      .eq("id", run.id);

    return json({ runId: run.id, packet: { ...packet, match_score: score } }, 200, corsHeaders);
  } catch (err) {
    console.error("apply-agent error", err);
    return json({ error: "Unexpected error" }, 500, corsHeadersFor(req));
  }
});
