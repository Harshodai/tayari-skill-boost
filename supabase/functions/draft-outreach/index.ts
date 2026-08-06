import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

/**
 * Networking & referrals drafter.
 *
 * Drafts intro / referral / follow-up messages for a specific contact.
 * It never sends anything: the user copies or opens the draft in their own
 * mail client. No scraping, no automated LinkedIn actions.
 */
serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (b: unknown, s: number) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: authData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !authData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const contactName = String(body.contactName ?? "").slice(0, 200);
    const contactTitle = String(body.contactTitle ?? "").slice(0, 200);
    const company = String(body.company ?? "").slice(0, 200);
    const relationship = String(body.relationship ?? "cold").slice(0, 40);
    const kind = String(body.kind ?? "intro");
    const targetRole = String(body.targetRole ?? "").slice(0, 200);
    const candidateName = String(body.candidateName ?? "").slice(0, 120);
    const proofPoints = String(body.proofPoints ?? "").slice(0, 4000);

    if (!contactName || !company) return json({ error: "contactName and company are required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI service not configured" }, 503);

    const kindBrief: Record<string, string> = {
      intro: "a first-touch introduction that earns a reply, not a favour",
      referral: "a polite, low-pressure referral request that makes it easy to say yes or no",
      followup: "a single short follow-up that adds one new piece of value",
      thanks: "a short thank-you that keeps the relationship warm",
    };

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You write short, specific, human outreach messages for job seekers. " +
              "Never invent shared history, mutual connections, or achievements not given to you. " +
              "No flattery padding, no 'I hope this finds you well'. Under 120 words for email, " +
              "under 280 characters for LinkedIn. Respond with JSON only.",
          },
          {
            role: "user",
            content:
              `CONTACT: ${contactName}${contactTitle ? `, ${contactTitle}` : ""} at ${company}\n` +
              `RELATIONSHIP: ${relationship}\nTARGET ROLE: ${targetRole || "not specified"}\n` +
              `SENDER: ${candidateName || "the candidate"}\nEVIDENCE THE SENDER CAN CLAIM:\n${proofPoints || "(none provided — stay generic rather than inventing)"}\n\n` +
              `Write ${kindBrief[kind] ?? kindBrief.intro}.\n` +
              `Return JSON: {"subject":"...","email":"...","linkedin":"...","why_this_works":"one sentence"}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const message =
        res.status === 429 ? "Rate limit reached. Try again shortly." : res.status === 402 ? "AI credits exhausted." : "The AI engine failed.";
      return json({ error: message }, res.status);
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { subject: `${targetRole || "Quick question"} — ${company}`, email: raw, linkedin: "" };
    }

    return json(parsed, 200);
  } catch (err) {
    console.error("draft-outreach error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});
