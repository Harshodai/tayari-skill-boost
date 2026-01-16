import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AnalyzeResumeRequest {
  resumeText: string;
  jobDescription: string;
  customInstructions?: string;
  aiOptions: {
    emphasizeKeywords: boolean;
    quantifyAchievements: boolean;
    optimizeFormat: boolean;
    tailorSummary: boolean;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AnalyzeResumeRequest = await req.json();
    const { resumeText, jobDescription, customInstructions, aiOptions } = body;

    if (!resumeText || !jobDescription) {
      return new Response(
        JSON.stringify({ success: false, error: "Resume text and job description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the analysis prompt
    const optionsText = buildOptionsText(aiOptions);
    const customText = customInstructions ? `\n\nAdditional user instructions: ${customInstructions}` : '';

    const systemPrompt = `You are an expert resume analyst and career coach. Your job is to analyze resumes against job descriptions and provide detailed, actionable feedback.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in exactly this format:
{
  "overallScore": <number 0-100>,
  "sections": [
    {
      "name": "Skills Match",
      "score": <number 0-100>,
      "suggestions": ["suggestion1", "suggestion2", ...]
    },
    {
      "name": "Experience Relevance",
      "score": <number 0-100>,
      "suggestions": ["suggestion1", "suggestion2", ...]
    },
    {
      "name": "Education Fit",
      "score": <number 0-100>,
      "suggestions": ["suggestion1", "suggestion2", ...]
    },
    {
      "name": "Formatting",
      "score": <number 0-100>,
      "suggestions": ["suggestion1", "suggestion2", ...]
    }
  ],
  "matchedKeywords": ["keyword1", "keyword2", ...],
  "missingKeywords": ["keyword1", "keyword2", ...],
  "summaryRecommendation": "A 2-3 sentence summary of the main improvements needed"
}

Scoring guidelines:
- 80-100: Excellent match, minor improvements possible
- 60-79: Good match, some improvements needed
- 40-59: Fair match, significant improvements needed
- 0-39: Poor match, major revisions required

${optionsText}`;

    const userPrompt = `Please analyze this resume against the job description:

=== RESUME ===
${resumeText}

=== JOB DESCRIPTION ===
${jobDescription}
${customText}

Remember: Respond with ONLY valid JSON, no other text.`;

    console.log("Calling Lovable AI Gateway for resume analysis...");

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error(`AI Gateway error: ${status}`);
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Too many requests. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits depleted. Please add more credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await response.text();
      console.error("AI error response:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to analyze resume. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response:", aiResponse);
      return new Response(
        JSON.stringify({ success: false, error: "Empty response from AI. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response received, parsing...");

    // Parse the JSON response
    let analysisResult;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith("```")) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();

      analysisResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content);
      console.error("Parse error:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the response structure
    if (
      typeof analysisResult.overallScore !== 'number' ||
      !Array.isArray(analysisResult.sections) ||
      !Array.isArray(analysisResult.matchedKeywords) ||
      !Array.isArray(analysisResult.missingKeywords)
    ) {
      console.error("Invalid AI response structure:", analysisResult);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid response format from AI. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Resume analysis completed successfully");

    return new Response(
      JSON.stringify({ success: true, data: analysisResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-resume function:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildOptionsText(options: AnalyzeResumeRequest['aiOptions']): string {
  const parts: string[] = [];
  
  if (options.emphasizeKeywords) {
    parts.push("- Pay special attention to keyword matching between resume and job description. Identify specific keywords that are present and missing.");
  }
  
  if (options.quantifyAchievements) {
    parts.push("- Look for opportunities to add quantifiable metrics and numbers to achievements. Suggest specific ways to quantify accomplishments.");
  }
  
  if (options.optimizeFormat) {
    parts.push("- Evaluate formatting, structure, and readability. Suggest formatting improvements.");
  }
  
  if (options.tailorSummary) {
    parts.push("- Provide suggestions for tailoring the resume summary/objective to better match this specific job.");
  }
  
  if (parts.length === 0) {
    return "";
  }
  
  return `Focus areas based on user preferences:\n${parts.join('\n')}`;
}
