// LaTeX template configurations for different resume styles

export interface LatexTemplate {
  id: string;
  name: string;
  description: string;
  preamble: string;
  features: string[];
}

export const latexTemplates: Record<string, LatexTemplate> = {
  modern: {
    id: "modern",
    name: "Modern",
    description: "Clean and contemporary design with a focus on readability",
    features: ["ATS-friendly", "Two-column layout", "Skills section"],
    preamble: `\\documentclass[11pt,a4paper]{article}
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
  },

  professional: {
    id: "professional",
    name: "Professional",
    description: "Classic layout perfect for traditional industries",
    features: ["ATS-friendly", "Single column", "Formal styling"],
    preamble: `\\documentclass[11pt,a4paper]{article}
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
  },

  creative: {
    id: "creative",
    name: "Creative",
    description: "Stand out with a unique and eye-catching design",
    features: ["Visual accents", "Infographic elements", "Bold typography"],
    preamble: `\\documentclass[11pt,a4paper]{article}
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
  },

  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Simple and elegant with plenty of white space",
    features: ["ATS-friendly", "Clean layout", "Typography focused"],
    preamble: `\\documentclass[11pt,a4paper]{article}
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
  },

  tech: {
    id: "tech",
    name: "Tech",
    description: "Designed specifically for software engineering roles",
    features: ["Skills emphasis", "Project showcase", "GitHub integration"],
    preamble: `\\documentclass[11pt,a4paper]{article}
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
  },

  executive: {
    id: "executive",
    name: "Executive",
    description: "Sophisticated design for senior-level positions",
    features: ["Leadership focus", "Achievement highlights", "Premium styling"],
    preamble: `\\documentclass[11pt,a4paper]{article}
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
  },
};

export function getTemplatePreamble(templateId: string): string {
  return latexTemplates[templateId]?.preamble || latexTemplates.professional.preamble;
}

export function getTemplateById(templateId: string): LatexTemplate | undefined {
  return latexTemplates[templateId];
}

export function getAllTemplates(): LatexTemplate[] {
  return Object.values(latexTemplates);
}
