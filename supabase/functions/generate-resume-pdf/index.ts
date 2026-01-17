import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LATEX_ONLINE_URL = "https://latexonline.cc/compile";

interface ResumeSection {
  name: string;
  score: number;
  suggestions: string[];
}

interface ResumeAnalysisResult {
  overallScore: number;
  sections: ResumeSection[];
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryRecommendation: string;
}

interface GenerateResumeRequest {
  resumeText: string;
  analysisResults: ResumeAnalysisResult;
  appliedSuggestions: string[];
  template: string;
  jobDescription?: string;
}

// LaTeX template preambles for each template type
const templatePreambles: Record<string, string> = {
  modern: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{fontawesome5}
\\usepackage{multicol}

\\geometry{left=0.75in,right=0.75in,top=0.5in,bottom=0.5in}
\\definecolor{primary}{HTML}{6366F1}
\\definecolor{secondary}{HTML}{64748B}

\\titleformat{\\section}{\\large\\bfseries\\color{primary}}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{12pt}{6pt}

\\setlength{\\parindent}{0pt}
\\pagestyle{empty}

\\newcommand{\\resumeitem}[1]{\\item[\\textcolor{primary}{\\textbullet}] #1}
\\newcommand{\\jobtitle}[4]{\\textbf{#1} \\hfill #2 \\\\ \\textit{#3} \\hfill \\textit{#4}}`,

  professional: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}

\\geometry{left=1in,right=1in,top=0.75in,bottom=0.75in}

\\titleformat{\\section}{\\Large\\bfseries}{}{0em}{}[\\hrule]
\\titlespacing*{\\section}{0pt}{14pt}{8pt}

\\setlength{\\parindent}{0pt}
\\pagestyle{empty}

\\newcommand{\\jobtitle}[4]{\\textbf{#1} \\hfill #2 \\\\ \\textit{#3} \\hfill \\textit{#4}}`,

  creative: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{tikz}
\\usepackage{fontawesome5}

\\geometry{left=0.6in,right=0.6in,top=0.5in,bottom=0.5in}
\\definecolor{accent}{HTML}{F59E0B}
\\definecolor{dark}{HTML}{1E293B}

\\titleformat{\\section}{\\large\\bfseries\\color{dark}}{}{0em}{\\colorbox{accent!20}{\\parbox{\\dimexpr\\textwidth-2\\fboxsep}{}}}
\\titlespacing*{\\section}{0pt}{10pt}{6pt}

\\setlength{\\parindent}{0pt}
\\pagestyle{empty}`,

  minimal: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}

\\geometry{left=1.25in,right=1.25in,top=1in,bottom=1in}

\\titleformat{\\section}{\\normalsize\\bfseries\\uppercase}{}{0em}{}
\\titlespacing*{\\section}{0pt}{18pt}{10pt}

\\setlength{\\parindent}{0pt}
\\pagestyle{empty}`,

  tech: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{fontawesome5}
\\usepackage{multicol}

\\geometry{left=0.7in,right=0.7in,top=0.5in,bottom=0.5in}
\\definecolor{techblue}{HTML}{3B82F6}
\\definecolor{techgray}{HTML}{374151}

\\titleformat{\\section}{\\large\\bfseries\\color{techblue}}{\\faCode\\hspace{0.5em}}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{12pt}{6pt}

\\setlength{\\parindent}{0pt}
\\pagestyle{empty}

\\newcommand{\\skill}[1]{\\colorbox{techblue!15}{\\texttt{#1}}}`,

  executive: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}

\\geometry{left=1in,right=1in,top=0.75in,bottom=0.75in}
\\definecolor{navy}{HTML}{1E3A5F}
\\definecolor{gold}{HTML}{B8860B}

\\titleformat{\\section}{\\large\\bfseries\\color{navy}}{}{0em}{}[{\\color{gold}\\titlerule[0.5pt]}]
\\titlespacing*{\\section}{0pt}{14pt}{8pt}

\\setlength{\\parindent}{0pt}
\\pagestyle{empty}`,
};

serve(async (req) => {
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

    const body: GenerateResumeRequest = await req.json();
    const { resumeText, analysisResults, appliedSuggestions, template, jobDescription } = body;

    if (!resumeText || !analysisResults || !template) {
      return new Response(
        JSON.stringify({ success: false, error: "Resume text, analysis results, and template are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating resume with template: ${template}`);
    console.log(`Applied suggestions: ${appliedSuggestions.length}`);
    console.log(`Overall score: ${analysisResults.overallScore}`);

    // Step 1: Generate optimized resume content
    console.log("Step 1: Generating optimized content...");
    const optimizedContent = await generateOptimizedContent(
      apiKey,
      resumeText,
      analysisResults,
      appliedSuggestions,
      jobDescription
    );

    if (!optimizedContent.success) {
      return new Response(
        JSON.stringify({ success: false, error: optimizedContent.error }),
        { status: optimizedContent.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Convert to LaTeX
    console.log("Step 2: Converting to LaTeX...");
    let latexCode = await convertToLatex(
      apiKey,
      optimizedContent.content!,
      template,
      analysisResults.overallScore < 80 ? analysisResults : null
    );

    if (!latexCode.success) {
      return new Response(
        JSON.stringify({ success: false, error: latexCode.error }),
        { status: latexCode.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Compile LaTeX to PDF with retry logic
    console.log("Step 3: Compiling LaTeX to PDF...");
    let pdfResult;
    let attempts = 0;
    const maxAttempts = 3;
    let currentLatex = latexCode.latex!;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Compilation attempt ${attempts}/${maxAttempts}`);
      
      pdfResult = await compileLatexToPdf(currentLatex);
      
      if (pdfResult.success) {
        console.log("PDF compilation successful!");
        break;
      }

      console.log(`Compilation failed: ${pdfResult.error}`);
      
      if (attempts < maxAttempts) {
        console.log("Attempting to fix LaTeX errors with AI...");
        const fixedLatex = await fixLatexErrors(apiKey, currentLatex, pdfResult.log || pdfResult.error || "Unknown compilation error");
        
        if (fixedLatex.success) {
          currentLatex = fixedLatex.latex!;
        } else {
          console.log("Failed to fix LaTeX errors");
          break;
        }
      }
    }

    if (!pdfResult?.success) {
      // Return LaTeX source if PDF compilation fails
      console.log("PDF compilation failed after all attempts, returning LaTeX source");
      return new Response(
        JSON.stringify({ 
          success: true, 
          pdfGenerated: false,
          latexSource: currentLatex,
          message: "PDF compilation failed, returning LaTeX source for manual compilation",
          compilationLog: pdfResult?.log
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Resume PDF generated successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfGenerated: true,
        pdfBase64: pdfResult.pdfBase64,
        latexSource: currentLatex
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-resume-pdf function:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateOptimizedContent(
  apiKey: string,
  resumeText: string,
  analysisResults: ResumeAnalysisResult,
  appliedSuggestions: string[],
  jobDescription?: string
): Promise<{ success: boolean; content?: string; error?: string; status?: number }> {
  const systemPrompt = `You are an expert resume writer. Your task is to optimize and improve the given resume based on the analysis feedback and applied suggestions.

IMPORTANT: Return the optimized resume content as structured text that can be converted to LaTeX. Format the output with clear sections:

1. HEADER (name, contact info)
2. SUMMARY (professional summary)
3. EXPERIENCE (job history with achievements)
4. EDUCATION (degrees, institutions)
5. SKILLS (technical and soft skills)
6. PROJECTS (if applicable)

Use bullet points for achievements. Make improvements subtle but impactful.
Add missing keywords naturally where appropriate.
Quantify achievements with specific numbers where possible.`;

  const suggestionsList = appliedSuggestions.length > 0 
    ? `\n\nApplied suggestions to incorporate:\n${appliedSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  const missingKeywords = analysisResults.missingKeywords.length > 0
    ? `\n\nMissing keywords to naturally incorporate: ${analysisResults.missingKeywords.join(', ')}`
    : '';

  const userPrompt = `Original Resume:
${resumeText}

${jobDescription ? `Target Job Description:\n${jobDescription}\n` : ''}

Analysis Summary:
- Overall Score: ${analysisResults.overallScore}/100
- ${analysisResults.summaryRecommendation}
${missingKeywords}${suggestionsList}

Please optimize this resume content while maintaining authenticity. Return the improved resume text.`;

  try {
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
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { success: false, error: "Too many requests. Please wait a moment and try again.", status: 429 };
      }
      if (response.status === 402) {
        return { success: false, error: "AI credits depleted. Please add more credits to continue.", status: 402 };
      }
      return { success: false, error: "Failed to optimize resume content.", status: 500 };
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: "Empty response from AI.", status: 500 };
    }

    return { success: true, content };
  } catch (error) {
    console.error("Error generating optimized content:", error);
    return { success: false, error: "Failed to generate optimized content.", status: 500 };
  }
}

async function convertToLatex(
  apiKey: string,
  optimizedContent: string,
  template: string,
  feedbackResults: ResumeAnalysisResult | null
): Promise<{ success: boolean; latex?: string; error?: string; status?: number }> {
  const preamble = templatePreambles[template] || templatePreambles.professional;
  
  const feedbackSection = feedbackResults ? `

IMPORTANT: Since the overall score is below 80 (${feedbackResults.overallScore}), add a "Suggested Improvements" section at the END of the document (before \\end{document}) with these items:
${feedbackResults.sections.filter(s => s.score < 80).flatMap(s => s.suggestions.slice(0, 2)).join('\n- ')}
${feedbackResults.missingKeywords.length > 0 ? `\nConsider adding these keywords: ${feedbackResults.missingKeywords.slice(0, 5).join(', ')}` : ''}` : '';

  const systemPrompt = `You are an expert LaTeX resume generator. Convert the given resume content into valid, compilable LaTeX code.

RULES:
1. Use ONLY the provided preamble - do not add or modify packages
2. Escape special LaTeX characters: & becomes \\&, % becomes \\%, $ becomes \\$, # becomes \\#, _ becomes \\_
3. Use proper LaTeX commands for formatting
4. Keep the content professional and clean
5. Ensure the document compiles without errors
6. Return ONLY the complete LaTeX document, starting with \\begin{document}

TEMPLATE PREAMBLE (use exactly this):
${preamble}

Return the complete LaTeX document including \\begin{document} and \\end{document}.${feedbackSection}`;

  const userPrompt = `Convert this resume content to LaTeX:

${optimizedContent}

Remember: Return ONLY valid LaTeX code, nothing else. Start with \\begin{document}.`;

  try {
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
        temperature: 0.2,
        max_tokens: 5000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { success: false, error: "Too many requests. Please wait a moment and try again.", status: 429 };
      }
      if (response.status === 402) {
        return { success: false, error: "AI credits depleted. Please add more credits to continue.", status: 402 };
      }
      return { success: false, error: "Failed to generate LaTeX.", status: 500 };
    }

    const aiResponse = await response.json();
    let latexContent = aiResponse.choices?.[0]?.message?.content;

    if (!latexContent) {
      return { success: false, error: "Empty response from AI.", status: 500 };
    }

    // Clean the response - remove markdown code blocks if present
    latexContent = latexContent.trim();
    if (latexContent.startsWith("```latex")) {
      latexContent = latexContent.slice(8);
    } else if (latexContent.startsWith("```")) {
      latexContent = latexContent.slice(3);
    }
    if (latexContent.endsWith("```")) {
      latexContent = latexContent.slice(0, -3);
    }
    latexContent = latexContent.trim();

    // Combine preamble with document body
    const fullLatex = preamble + "\n\n" + latexContent;

    return { success: true, latex: fullLatex };
  } catch (error) {
    console.error("Error converting to LaTeX:", error);
    return { success: false, error: "Failed to convert to LaTeX.", status: 500 };
  }
}

async function compileLatexToPdf(latexSource: string): Promise<{ success: boolean; pdfBase64?: string; log?: string; error?: string }> {
  try {
    // Use latexonline.cc for compilation
    const response = await fetch(LATEX_ONLINE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text: latexSource,
        compiler: "pdflatex",
        output: "pdf"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LaTeX compilation error:", errorText);
      return { 
        success: false, 
        error: "LaTeX compilation failed", 
        log: errorText.substring(0, 1000) 
      };
    }

    const contentType = response.headers.get("content-type");
    
    if (contentType?.includes("application/pdf")) {
      const pdfBuffer = await response.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
      return { success: true, pdfBase64 };
    } else {
      // Compilation returned an error page
      const errorText = await response.text();
      return { 
        success: false, 
        error: "LaTeX compilation returned errors", 
        log: errorText.substring(0, 1000) 
      };
    }
  } catch (error) {
    console.error("Error compiling LaTeX:", error);
    return { success: false, error: "Failed to compile LaTeX to PDF" };
  }
}

async function fixLatexErrors(
  apiKey: string,
  latexSource: string,
  errorLog: string
): Promise<{ success: boolean; latex?: string; error?: string }> {
  const systemPrompt = `You are a LaTeX debugging expert. Fix the provided LaTeX code based on the error log.

RULES:
1. Return ONLY the fixed LaTeX code
2. Do not change the document structure or content, only fix errors
3. Common fixes include:
   - Missing packages
   - Undefined commands
   - Special character escaping
   - Bracket matching
4. Ensure the document compiles correctly`;

  const userPrompt = `Fix this LaTeX document:

=== LaTeX Source ===
${latexSource}

=== Error Log ===
${errorLog}

Return ONLY the fixed LaTeX code.`;

  try {
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
        temperature: 0.1,
        max_tokens: 5000,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to fix LaTeX errors." };
    }

    const aiResponse = await response.json();
    let fixedLatex = aiResponse.choices?.[0]?.message?.content;

    if (!fixedLatex) {
      return { success: false, error: "Empty response from AI." };
    }

    // Clean the response
    fixedLatex = fixedLatex.trim();
    if (fixedLatex.startsWith("```latex")) {
      fixedLatex = fixedLatex.slice(8);
    } else if (fixedLatex.startsWith("```")) {
      fixedLatex = fixedLatex.slice(3);
    }
    if (fixedLatex.endsWith("```")) {
      fixedLatex = fixedLatex.slice(0, -3);
    }
    fixedLatex = fixedLatex.trim();

    return { success: true, latex: fixedLatex };
  } catch (error) {
    console.error("Error fixing LaTeX:", error);
    return { success: false, error: "Failed to fix LaTeX errors." };
  }
}
