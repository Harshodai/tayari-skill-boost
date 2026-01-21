import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tayari-skill-boost.lovable.app", // Strictly restricted
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

interface ParsedResume {
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  summary?: string;
  experience: {
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description?: string;
    achievements: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
    gpa?: string;
  }[];
  skills: string[];
  projects?: {
    name: string;
    description?: string;
    technologies: string[];
  }[];
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

    // Step 1: Analyze resume
    const analysisResponse = await fetch(LOVABLE_AI_URL, {
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

    if (!analysisResponse.ok) {
      const status = analysisResponse.status;
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

      const errorText = await analysisResponse.text();
      console.error("AI error response:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to analyze resume. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiAnalysisResponse = await analysisResponse.json();
    const analysisContent = aiAnalysisResponse.choices?.[0]?.message?.content;

    if (!analysisContent) {
      console.error("No content in AI response:", aiAnalysisResponse);
      return new Response(
        JSON.stringify({ success: false, error: "Empty response from AI. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI analysis received, parsing...");

    // Parse the analysis JSON response
    let analysisResult;
    try {
      let cleanedContent = analysisContent.trim();
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
      console.error("Failed to parse AI analysis response as JSON:", analysisContent);
      console.error("Parse error:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the analysis response structure
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

    // Step 2: Extract structured resume data
    console.log("Extracting structured resume data...");

    const parseSystemPrompt = `You are an expert resume parser. Extract structured data from the resume text.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in this format:
{
  "name": "Full name of the candidate",
  "email": "email@example.com or null if not found",
  "phone": "phone number or null if not found",
  "linkedin": "LinkedIn URL/username or null if not found",
  "summary": "Professional summary or objective if present, or null",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "startDate": "Start date (e.g., Jan 2020)",
      "endDate": "End date or Present",
      "description": "Brief description if available",
      "achievements": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "Institution name",
      "year": "Graduation year or date range",
      "gpa": "GPA if mentioned or null"
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["Tech 1", "Tech 2"]
    }
  ]
}

Extract as much information as possible. Use null for fields that cannot be found.
For arrays, use empty arrays [] if no items found.`;

    const parseUserPrompt = `Extract structured data from this resume:

${resumeText}

Remember: Respond with ONLY valid JSON, no other text.`;

    const parseResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: parseSystemPrompt },
          { role: "user", content: parseUserPrompt }
        ],
        temperature: 0.1,
        max_tokens: 3000,
      }),
    });

    let parsedResume: ParsedResume | null = null;

    if (parseResponse.ok) {
      const parseAiResponse = await parseResponse.json();
      const parseContent = parseAiResponse.choices?.[0]?.message?.content;

      if (parseContent) {
        try {
          let cleanedParseContent = parseContent.trim();
          if (cleanedParseContent.startsWith("```json")) {
            cleanedParseContent = cleanedParseContent.slice(7);
          } else if (cleanedParseContent.startsWith("```")) {
            cleanedParseContent = cleanedParseContent.slice(3);
          }
          if (cleanedParseContent.endsWith("```")) {
            cleanedParseContent = cleanedParseContent.slice(0, -3);
          }
          cleanedParseContent = cleanedParseContent.trim();

          parsedResume = JSON.parse(cleanedParseContent);
          console.log("Successfully parsed resume structure");
        } catch (parseError) {
          console.error("Failed to parse structured resume:", parseError);
          // Continue without parsed resume - not critical
        }
      }
    } else {
      console.error("Failed to extract structured resume data:", await parseResponse.text());
      // Continue without parsed resume - not critical
    }

    console.log("Resume analysis completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisResult,
        parsedResume: parsedResume
      }),
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