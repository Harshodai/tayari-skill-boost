export type AtsEngineType = "workday" | "greenhouse" | "lever";

export interface ContactField {
  label: string;
  value: string | null;
  status: "clean" | "warning" | "failed";
  note: string;
}

export interface CandidateIdentity {
  name: ContactField;
  email: ContactField;
  phone: ContactField;
  location: ContactField;
  linkedin: ContactField;
  github: ContactField;
  sectionStatus: "clean" | "warning" | "failed";
  cleanlinessPercent: number;
}

export interface ParsedExperience {
  id: string;
  company: string;
  title: string;
  dateSpan: string;
  bullets: string[];
  status: "clean" | "warning" | "failed";
  engineNote: string;
}

export interface ParsedEducation {
  id: string;
  degree: string;
  institution: string;
  graduationYear: string;
  status: "clean" | "warning" | "failed";
  engineNote: string;
}

export interface HazardFlag {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  affectedEngine: string;
  detected: boolean;
  recommendation: string;
}

export interface AtsEngineConfig {
  id: AtsEngineType;
  label: string;
  vendor: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
}

export interface AtsSimulationResult {
  engine: AtsEngineType;
  config: AtsEngineConfig;
  fidelityScore: number;
  overallStatus: "clean" | "warning" | "failed";
  identity: CandidateIdentity;
  experiences: ParsedExperience[];
  education: ParsedEducation[];
  skillsBag: string[];
  hazards: HazardFlag[];
  rawTextPreview: string;
  engineNotes: string[];
}

export const ATS_ENGINES: Record<AtsEngineType, AtsEngineConfig> = {
  workday: {
    id: "workday",
    label: "Workday Parser (Sovren/Textkernel simulation)",
    vendor: "Sovren / Textkernel XML Semantic Extraction",
    description:
      "Enterprise standard used by Fortune 500 organizations. Strict hierarchical XML parsing with normalized chronological work spans. Highly vulnerable to multi-column tables, missing standard section headers, and month-less date formats.",
    strengths: [
      "Rigorous role hierarchy and seniority scoring",
      "Standard ontology keyword normalization",
      "Detailed candidate profile XML generation",
    ],
    weaknesses: [
      "Interleaves multi-column text across tables",
      "Strips contact info from PDF/DOCX headers and footers",
      "Flags warning or miscalculates tenure on year-only dates",
    ],
  },
  greenhouse: {
    id: "greenhouse",
    label: "Greenhouse Parser",
    vendor: "Greenhouse Automated Document Ingestion Pipeline",
    description:
      "Modern high-growth tech ATS standard. Reads documents in a linear stream, tokenizing company and contact data effectively, but converts non-standard unicode bullets into garbled question marks or raw symbols.",
    strengths: [
      "High accuracy contact and social link extraction",
      "Tolerant of modern linear markdown and pipe separators",
      "Fast candidate profile field pre-filling",
    ],
    weaknesses: [
      "Degrades non-ASCII bullet glyphs (❖, ★, ✓) to mojibake or '?'",
      "Flattens nested bullet points into flat text blocks",
      "Can misidentify company vs role in complex layouts",
    ],
  },
  lever: {
    id: "lever",
    label: "Lever Plaintext Parser",
    vendor: "Lever Raw Plaintext Normalization Engine",
    description:
      "Ultra-minimalist parser that aggressively converts candidate resumes into a single unformatted UTF-8 plaintext buffer before regex extraction. Extreme vulnerability to multi-column layouts and pipe-separated lines.",
    strengths: [
      "Instant plaintext regex extraction with zero styling dependencies",
      "Fast search indexing across recruiter database",
      "High fidelity on clean single-column text files",
    ],
    weaknesses: [
      "Reads across multi-column tables, concatenating disparate words",
      "Collapses unbulleted paragraphs into run-on text",
      "Frequently confuses pipe separators (|) with company/title names",
    ],
  },
};

// Common technical and business skills lexicon for normalized extraction
const SKILLS_LEXICON: Record<string, string> = {
  react: "React",
  "react.js": "React",
  "react 19": "React",
  typescript: "TypeScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  "node.js": "Node.js",
  node: "Node.js",
  python: "Python",
  go: "Go",
  golang: "Go",
  rust: "Rust",
  java: "Java",
  c: "C",
  "c++": "C++",
  sql: "SQL",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  redis: "Redis",
  mongodb: "MongoDB",
  dynamodb: "DynamoDB",
  cassandra: "Cassandra",
  scylladb: "ScyllaDB",
  graphql: "GraphQL",
  rest: "REST APIs",
  kafka: "Kafka",
  pulsar: "Pulsar",
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  terraform: "Terraform",
  playwright: "Playwright",
  vitest: "Vitest",
  jest: "Jest",
  git: "Git",
  vite: "Vite",
  opentelemetry: "OpenTelemetry",
  prometheus: "Prometheus",
  grafana: "Grafana",
  pytorch: "PyTorch",
  huggingface: "Hugging Face",
  transformers: "Transformers",
  langchain: "LangChain",
  llamaindex: "LlamaIndex",
  rag: "RAG",
  pgvector: "pgvector",
  pinecone: "Pinecone",
  qdrant: "Qdrant",
  lora: "LoRA/QLoRA",
  vllm: "vLLM",
  fastapi: "FastAPI",
  amplitude: "Amplitude",
  mixpanel: "Mixpanel",
  jira: "Jira",
  linear: "Linear",
  figma: "Figma",
  confluence: "Confluence",
  html: "HTML5",
  html5: "HTML5",
  css: "CSS3",
  css3: "CSS3",
  tailwind: "Tailwind CSS",
  grpc: "gRPC",
  protobuf: "Protobuf",
  ci: "CI/CD",
  "ci/cd": "CI/CD",
  microservices: "Microservices",
  raft: "Raft Consensus",
};

/**
 * Extracts candidate contact details from top lines of the resume text.
 */
function extractIdentity(text: string, engine: AtsEngineType): CandidateIdentity {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const headerLines = lines.slice(0, 10);
  const headerJoined = headerLines.join("\n");

  // 1. Name: First non-empty line that looks like a person's name
  let nameValue: string | null = null;
  let nameStatus: "clean" | "warning" | "failed" = "failed";
  let nameNote = "No candidate name detected at top of resume.";

  for (const line of headerLines.slice(0, 3)) {
    if (
      !/@/.test(line) &&
      !/http|www\.|\.com/i.test(line) &&
      !/^(resume|curriculum|summary|objective|profile|experience)/i.test(line) &&
      line.length < 50
    ) {
      const parts = line.split(/[|•,]/)[0].trim();
      const words = parts.split(/\s+/);
      if (words.length >= 2 && words.length <= 5) {
        nameValue = parts;
        nameStatus = "clean";
        nameNote = "Cleanly parsed from document header.";
        break;
      }
    }
  }

  // 2. Email
  let emailValue: string | null = null;
  let emailStatus: "clean" | "warning" | "failed" = "failed";
  let emailNote = "Missing candidate email address.";
  const emailMatch = headerJoined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  if (emailMatch) {
    emailValue = emailMatch[0];
    emailStatus = "clean";
    emailNote = "Valid email pattern cleanly indexed.";
  }

  // 3. Phone
  let phoneValue: string | null = null;
  let phoneStatus: "clean" | "warning" | "failed" = "failed";
  let phoneNote = "No phone number detected in header.";
  const phoneMatch = headerJoined.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    phoneValue = phoneMatch[0];
    phoneStatus = "clean";
    phoneNote = "Normalized phone string detected.";
  } else {
    phoneStatus = "warning";
    phoneNote = "Phone number absent; some ATS portals require manual candidate entry.";
  }

  // 4. Location
  let locationValue: string | null = null;
  let locationStatus: "clean" | "warning" | "failed" = "failed";
  let locationNote = "No primary location detected.";

  // Sanitize header to avoid extracting geographic tokens from email addresses, URLs, or handles
  const sanitizedHeader = headerJoined
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/(?:linkedin|github)\.com\/\S+/gi, " ");

  // Constrain generic City, Region branch using explicit delimiters/known regions (case-sensitive)
  // while restricting case-insensitive matching to intended geographic alternatives with word boundaries.
  const cityRegionMatch = sanitizedHeader.match(
    /(?:^|[|•;/\n\-–—])\s*([A-Z][a-zA-Z.-]+(?:[ \t]+[A-Z][a-zA-Z.-]+){0,2},\s*(?:[A-Z]{2}|[A-Z][a-zA-Z]+(?:[ \t]+[A-Z][a-zA-Z]+)?))\b/
  );
  const geoAltMatch = sanitizedHeader.match(
    /(?:^|[|•;/\n\-–—,\s])\b(Remote|United States|USA|Canada|UK|India)\b(?=[|•;/\n\-–—,\s]|$)/i
  );

  const locationMatch = cityRegionMatch
    ? [cityRegionMatch[1].trim()]
    : (geoAltMatch ? [geoAltMatch[1].trim()] : null);

  if (locationMatch && !locationMatch[0].toLowerCase().includes("resume")) {
    locationValue = locationMatch[0].trim();
    locationStatus = "clean";
    locationNote = "Clean geographic token parsed.";
  } else {
    locationStatus = "warning";
    locationNote = "Location inferred or missing.";
  }

  // 5. LinkedIn
  let linkedinValue: string | null = null;
  let linkedinStatus: "clean" | "warning" | "failed" = "failed";
  let linkedinNote = "No LinkedIn profile link detected.";
  const linkedinMatch = headerJoined.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  if (linkedinMatch) {
    linkedinValue = linkedinMatch[0];
    linkedinStatus = "clean";
    linkedinNote = "Valid LinkedIn handle identified.";
  } else {
    linkedinStatus = "warning";
    linkedinNote = "Missing LinkedIn URL in header.";
  }

  // 6. GitHub or Portfolio
  let githubValue: string | null = null;
  let githubStatus: "clean" | "warning" | "failed" = "failed";
  let githubNote = "No GitHub or developer portfolio link detected.";
  const githubMatch = headerJoined.match(/github\.com\/[a-zA-Z0-9_-]+/i);
  if (githubMatch) {
    githubValue = githubMatch[0];
    githubStatus = "clean";
    githubNote = "Developer portfolio recognized.";
  } else {
    githubStatus = "warning";
    githubNote = "Developer portfolio absent from header.";
  }

  // Adjust status based on engine characteristics
  if (engine === "workday" && lines.length > 0 && lines[0].includes("|")) {
    nameNote += " (Workday: Delimited line 1 format increases risk of name/location token merging)";
  } else if (engine === "lever" && headerLines.length > 5) {
    nameNote += " (Lever: Plaintext stripping will flatten contact header lines)";
  }

  const fields = [nameStatus, emailStatus, phoneStatus, locationStatus, linkedinStatus, githubStatus];
  const cleanCount = fields.filter((s) => s === "clean").length;
  const cleanlinessPercent = Math.round((cleanCount / fields.length) * 100);

  let sectionStatus: "clean" | "warning" | "failed" = "clean";
  if (!nameValue || !emailValue) {
    sectionStatus = "failed";
  } else if (cleanlinessPercent < 60) {
    sectionStatus = "warning";
  }

  return {
    name: { label: "Candidate Name", value: nameValue, status: nameStatus, note: nameNote },
    email: { label: "Email Address", value: emailValue, status: emailStatus, note: emailNote },
    phone: { label: "Phone Number", value: phoneValue, status: phoneStatus, note: phoneNote },
    location: { label: "Location", value: locationValue, status: locationStatus, note: locationNote },
    linkedin: { label: "LinkedIn Profile", value: linkedinValue, status: linkedinStatus, note: linkedinNote },
    github: { label: "GitHub / Portfolio", value: githubValue, status: githubStatus, note: githubNote },
    sectionStatus,
    cleanlinessPercent,
  };
}

/**
 * Extracts work experience entries, job titles, companies, dates, and bullet points.
 */
function extractExperiences(text: string, engine: AtsEngineType): ParsedExperience[] {
  const experiences: ParsedExperience[] = [];
  const lines = text.split("\n");

  let expStartIndex = -1;
  let expEndIndex = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toUpperCase();
    if (
      expStartIndex === -1 &&
      (line === "EXPERIENCE" ||
        line === "EXPERIENCE:" ||
        line === "WORK EXPERIENCE" ||
        line === "WORK EXPERIENCE:" ||
        line === "EMPLOYMENT HISTORY" ||
        line === "PROFESSIONAL EXPERIENCE")
    ) {
      expStartIndex = i + 1;
    } else if (
      expStartIndex !== -1 &&
      (line === "EDUCATION" ||
        line === "EDUCATION:" ||
        line === "SKILLS" ||
        line === "SKILLS:" ||
        line === "PROJECTS" ||
        line === "CERTIFICATIONS")
    ) {
      expEndIndex = i;
      break;
    }
  }

  const expLines = expStartIndex !== -1 ? lines.slice(expStartIndex, expEndIndex) : lines;
  const roleLineRegex = /^(.*?)(?:\||–|-|at)(.*?)(?:\||–|-|\()((?:19|20)\d{2}.*?)(?:\)|$)/i;

  let currentRole: {
    company: string;
    title: string;
    dateSpan: string;
    bullets: string[];
  } | null = null;

  for (let i = 0; i < expLines.length; i++) {
    const line = expLines[i].trim();
    if (!line) continue;

    const dateMatch = line.match(
      /((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*[-–—to]+\s*(?:Present|Current|Ongoing|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}))/i
    );

    const isHeaderCandidate = dateMatch || (line.includes("|") && line.split("|").length >= 2);

    if (isHeaderCandidate && !line.startsWith("-") && !line.startsWith("•") && !line.startsWith("*") && !line.startsWith("❖")) {
      if (currentRole) {
        experiences.push(finalizeRole(currentRole, engine, experiences.length));
      }

      const parts = line.split("|").map((p) => p.trim());
      let title = "Software Engineer";
      let company = "Company";
      let dateSpan = dateMatch ? dateMatch[0] : "Present";

      if (parts.length >= 3) {
        title = parts[0];
        company = parts[1];
        dateSpan = parts[2];
      } else if (parts.length === 2) {
        if (dateMatch) {
          title = parts[0];
          company = parts[1].replace(dateMatch[0], "").replace(/[-–—]/, "").trim();
          dateSpan = dateMatch[0];
        } else {
          title = parts[0];
          company = parts[1];
        }
      } else {
        const match = line.match(roleLineRegex);
        if (match) {
          title = match[1].trim();
          company = match[2].trim();
          dateSpan = match[3].trim();
        } else {
          title = line.replace(dateSpan, "").trim();
        }
      }

      currentRole = {
        company: company || "Undetected Company",
        title: title || "Undetected Title",
        dateSpan: dateSpan || "Date Unparsed",
        bullets: [],
      };
    } else if (currentRole) {
      if (
        line.startsWith("-") ||
        line.startsWith("•") ||
        line.startsWith("*") ||
        line.startsWith("❖") ||
        line.startsWith("–") ||
        line.startsWith("—")
      ) {
        currentRole.bullets.push(line.replace(/^[-•*❖–—]\s*/, "").trim());
      } else if (currentRole.bullets.length > 0) {
        currentRole.bullets[currentRole.bullets.length - 1] += " " + line;
      }
    }
  }

  if (currentRole) {
    experiences.push(finalizeRole(currentRole, engine, experiences.length));
  }

  if (experiences.length === 0 && text.trim()) {
    experiences.push({
      id: "exp-fallback",
      company: "Parsed Unstructured Block",
      title: "Experience Segment",
      dateSpan: "Timeline Unresolved",
      bullets: ["ATS could not delineate individual company records from input text."],
      status: "warning",
      engineNote: "Role delimiters missing or non-standard. Plaintext parser could not isolate start/end milestones.",
    });
  }

  return experiences;
}

function finalizeRole(
  role: { company: string; title: string; dateSpan: string; bullets: string[] },
  engine: AtsEngineType,
  index: number
): ParsedExperience {
  let status: "clean" | "warning" | "failed" = "clean";
  let engineNote = "Cleanly tokenized into company, title, date range, and bullet points.";

  const hasMonthInDate = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/)/i.test(role.dateSpan);

  if (engine === "workday") {
    if (!hasMonthInDate && /\d{4}\s*[-–—to]+\s*(?:\d{4}|Present)/i.test(role.dateSpan)) {
      status = "warning";
      engineNote = "Workday Warning: Year-only date format detected. Workday Sovren parser prefers MM/YYYY to prevent miscalculating tenure duration.";
    } else if (role.bullets.length === 0) {
      status = "warning";
      engineNote = "Workday Warning: No discrete bullet items extracted under this role block.";
    }
  } else if (engine === "greenhouse") {
    if (role.bullets.length === 0) {
      status = "warning";
      engineNote = "Greenhouse Warning: Role parsed with 0 bullet points; duties might be flattened.";
    }
  } else if (engine === "lever") {
    if (role.company === "Undetected Company" || role.title === "Undetected Title") {
      status = "failed";
      engineNote = "Lever Error: Plaintext tokenizer failed to segment company from title.";
    }
  }

  return {
    id: `exp-${index}`,
    company: role.company,
    title: role.title,
    dateSpan: role.dateSpan,
    bullets: role.bullets,
    status,
    engineNote,
  };
}

/**
 * Extracts education records (degree, institution, graduation year).
 */
function extractEducation(text: string, engine: AtsEngineType): ParsedEducation[] {
  const educationList: ParsedEducation[] = [];
  const lines = text.split("\n");

  let eduStartIndex = -1;
  let eduEndIndex = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toUpperCase();
    if (eduStartIndex === -1 && (line === "EDUCATION" || line === "EDUCATION:" || line === "ACADEMIC BACKGROUND")) {
      eduStartIndex = i + 1;
    } else if (eduStartIndex !== -1 && (line === "SKILLS" || line === "SKILLS:" || line === "PROJECTS" || line === "EXPERIENCE")) {
      eduEndIndex = i;
      break;
    }
  }

  const searchLines = eduStartIndex !== -1 ? lines.slice(eduStartIndex, eduEndIndex) : lines;

  for (let i = 0; i < searchLines.length; i++) {
    const line = searchLines[i].trim();
    if (!line) continue;

    const degreeMatch = line.match(/(?:B\.S\.|B\.A\.|M\.S\.|M\.A\.|Ph\.D\.|Bachelor(?:'s)?|Master(?:'s)?|Doctorate|BSc|MSc|MBA|Associate)(?:\s+in\s+[^|,]+)?/i);
    const institutionMatch = line.match(/(?:University|College|Institute|Polytechnic|School|Academy|Stanford|Harvard|MIT|Berkeley|Caltech|CMU)[^|,]+/i);
    const yearMatch = line.match(/(?:19|20)\d{2}/);

    if (degreeMatch || institutionMatch) {
      const degree = degreeMatch ? degreeMatch[0].trim() : "Degree Inferred";
      const institution = institutionMatch ? institutionMatch[0].trim() : "Educational Institution";
      const graduationYear = yearMatch ? yearMatch[0] : "Year Unstated";

      let status: "clean" | "warning" | "failed" = "clean";
      let engineNote = "Cleanly mapped to standard academic credentials.";

      if (!degreeMatch) {
        status = "warning";
        engineNote = "Institution detected, but exact degree qualification was not parsed.";
      } else if (!institutionMatch) {
        status = "warning";
        engineNote = "Degree parsed, but university or institution name was not recognized in taxonomy.";
      }

      if (engine === "workday" && !yearMatch) {
        status = "warning";
        engineNote = "Workday Warning: Graduation year missing; education requirement filters may fail.";
      }

      educationList.push({
        id: `edu-${educationList.length}`,
        degree,
        institution,
        graduationYear,
        status,
        engineNote,
      });
    }
  }

  if (educationList.length === 0) {
    educationList.push({
      id: "edu-missing",
      degree: "Not Detected",
      institution: "No Institution Detected",
      graduationYear: "N/A",
      status: "failed",
      engineNote: "No formal Education section detected in input resume text. Automated filters for degrees (B.S./M.S.) will flag an exclusion.",
    });
  }

  return educationList;
}

/**
 * Extracts and normalizes technical skills against the skills lexicon.
 */
function extractSkillsBag(text: string): string[] {
  const normalizedSet = new Set<string>();
  const lower = text.toLowerCase();

  for (const [term, canonical] of Object.entries(SKILLS_LEXICON)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[\\s,;.:/|()#])${escaped}(?:$|[\\s,;.:/|()#])`, "i");
    if (regex.test(lower)) {
      normalizedSet.add(canonical);
    }
  }

  const skillsHeaderMatch = text.match(/SKILLS:?[\s\S]*?(?:EDUCATION|EXPERIENCE|PROJECTS|$)/i);
  if (skillsHeaderMatch) {
    const skillsSection = skillsHeaderMatch[0];
    const words = skillsSection
      .split(/[\n,;:]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 1 && w.length < 30);

    for (const word of words) {
      const cleanWord = word.replace(/^(Languages|Frameworks & Libraries|Databases & Cache|DevOps & Cloud|Testing & Tools|Core Systems|Data & Messaging|Analytics & Experimentation|Collaboration & Tools)\s*/i, "").trim();
      if (cleanWord && !cleanWord.includes("\n") && cleanWord.length > 1) {
        const match = SKILLS_LEXICON[cleanWord.toLowerCase()];
        if (match) {
          normalizedSet.add(match);
        } else if (/^[A-Z][a-zA-Z0-9.+/ -]{1,25}$/.test(cleanWord)) {
          normalizedSet.add(cleanWord);
        }
      }
    }
  }

  return Array.from(normalizedSet);
}

/**
 * Identifies ATS parsing hazards based on formatting, typography, and structure.
 */
function detectHazards(text: string, engine: AtsEngineType): HazardFlag[] {
  const hazards: HazardFlag[] = [];

  // Hazard 1: Multi-column table risk
  const hasTabs = /\t/.test(text);
  const hasMultiSpacing = /[^\s]{2,}\s{4,}[^\s]{2,}/.test(text);
  const multiColumnDetected = hasTabs || hasMultiSpacing;
  hazards.push({
    id: "multi-column-table-risk",
    title: "Multi-column table risk",
    severity: multiColumnDetected ? "high" : "low",
    description: multiColumnDetected
      ? `${ATS_ENGINES[engine].label} reads across table geometries line-by-line. Multi-column resumes scramble job titles on the left with company names on the right.`
      : "No multi-column tabular structures detected. Text is linear and single-column.",
    affectedEngine: "Workday, Lever, Greenhouse",
    detected: multiColumnDetected,
    recommendation: "Use a clean, single-column document layout without tables, text frames, or columns.",
  });

  // Hazard 2: Header/footer text loss risk
  const firstLines = text.split("\n").slice(0, 3).join(" ");
  const headerRisk = firstLines.length < 30 || !/@/.test(firstLines);
  hazards.push({
    id: "header-footer-loss-risk",
    title: "Header/footer text loss risk",
    severity: headerRisk ? "medium" : "low",
    description: headerRisk
      ? "Contact details appear outside the primary body stream or are sparse. ATS parsers routinely discard PDF/DOCX header/footer bounding boxes to suppress page numbers."
      : "Contact details are placed cleanly in the document body flow.",
    affectedEngine: "Workday / Sovren, Taleo",
    detected: headerRisk,
    recommendation: "Ensure full contact details (Name, Email, Location, Phone, Links) reside directly in the document body, never inside Word/PDF headers.",
  });

  // Hazard 3: Non-standard date formats
  const yearOnlyDates = /\b(19|20)\d{2}\s*[-–—to]+\s*(?:(19|20)\d{2}|Present|Current)\b/i.test(text);
  const monthDates = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/)(?:[a-z]*\.?\s*(?:19|20)\d{2})/i.test(text);
  const nonStandardDates = yearOnlyDates && !monthDates;
  hazards.push({
    id: "non-standard-date-formats",
    title: "Non-standard date formats",
    severity: nonStandardDates ? "medium" : "low",
    description: nonStandardDates
      ? "Date spans use years without months (e.g. '2022 - Present'). Workday and Sovren algorithms may truncate your tenure calculation or fail recency weighting."
      : "Dates include month designations or follow recognized ISO/ATS formats.",
    affectedEngine: "Workday (Sovren), Greenhouse",
    detected: nonStandardDates,
    recommendation: "Format all role dates with explicit Month and Year: 'Jan 2022 – Present' or '03/2020 – 11/2022'.",
  });

  // Hazard 4: Special character bullet degradation
  const specialBulletsRegex = /[❖✓★➤●▪►◆✔▶]/;
  const hasSpecialBullets = specialBulletsRegex.test(text);
  hazards.push({
    id: "special-character-bullet-degradation",
    title: "Special character bullet degradation",
    severity: hasSpecialBullets ? "medium" : "low",
    description: hasSpecialBullets
      ? "Decorative unicode glyphs (❖, ✓, ★, ➤, etc.) detected. During ASCII plaintext stripping, Lever and Greenhouse often convert these to '?' or garbled mojibake ('â€¢')."
      : "Clean standard bullet characters or hyphens detected.",
    affectedEngine: "Lever, Greenhouse",
    detected: hasSpecialBullets,
    recommendation: "Replace decorative glyphs with standard ASCII hyphens (-) or circular bullets (•).",
  });

  // Hazard 5: Pipe separator ambiguity
  const pipeCount = (text.match(/\|/g) || []).length;
  const excessivePipes = pipeCount > 8;
  hazards.push({
    id: "pipe-separator-ambiguity",
    title: "Pipe separator ambiguity",
    severity: excessivePipes ? "medium" : "low",
    description: excessivePipes
      ? "High frequency of vertical pipe characters (|). While modern parsers tolerate pipes, Lever plaintext streams occasionally misattribute piped attributes."
      : "Minimal or safe pipe separator usage.",
    affectedEngine: "Lever",
    detected: excessivePipes,
    recommendation: "Use commas or separate lines for Title, Company, and Dates when applying through Lever or Workday.",
  });

  return hazards;
}

/**
 * Simulates raw text buffer preview as perceived by the specific ATS.
 */
function generateRawPreview(text: string, engine: AtsEngineType): string {
  if (engine === "lever") {
    return text
      .replace(/[❖✓★➤●▪►◆✔▶]/g, "?")
      .replace(/[\t ]+/g, " ")
      .trim();
  }
  if (engine === "workday") {
    return `<!-- WORKDAY/SOVREN RESUME XML STREAM (SIMULATED) -->\n` +
      `<CandidateProfile source="SOVREN_EXTRACTOR_V10.4">\n` +
      text
        .split("\n")
        .map((line) => {
          if (/^(EXPERIENCE|EDUCATION|SKILLS|SUMMARY)/i.test(line)) {
            return `  <SectionHeader name="${line.trim()}" />`;
          }
          return `  <TextNode>${line}</TextNode>`;
        })
        .slice(0, 35)
        .join("\n") +
      `\n  <!-- ... remaining nodes serialized ... -->\n</CandidateProfile>`;
  }
  return `[GREENHOUSE LINEAR INGESTION STREAM]\n` +
    text
      .split("\n")
      .map((l) => (l.trim() ? `[LINE] ${l.trim()}` : ""))
      .filter(Boolean)
      .slice(0, 30)
      .join("\n");
}

/**
 * Main ATS parser simulation entry point.
 */
export function simulateAtsParsing(rawResumeText: string, engine: AtsEngineType): AtsSimulationResult {
  const text = rawResumeText || "";
  const config = ATS_ENGINES[engine];

  const identity = extractIdentity(text, engine);
  const experiences = extractExperiences(text, engine);
  const education = extractEducation(text, engine);
  const skillsBag = extractSkillsBag(text);
  const hazards = detectHazards(text, engine);
  const rawTextPreview = generateRawPreview(text, engine);

  let fidelity = 100;

  if (identity.sectionStatus === "failed") fidelity -= 25;
  else if (identity.sectionStatus === "warning") fidelity -= 10;

  const expWarnings = experiences.filter((e) => e.status === "warning").length;
  const expFailures = experiences.filter((e) => e.status === "failed").length;
  fidelity -= expWarnings * 5 + expFailures * 15;

  const eduFailed = education.some((e) => e.status === "failed");
  if (eduFailed) fidelity -= 15;

  const highHazards = hazards.filter((h) => h.detected && h.severity === "high").length;
  const medHazards = hazards.filter((h) => h.detected && h.severity === "medium").length;
  fidelity -= highHazards * 15 + medHazards * 5;

  if (engine === "workday") {
    if (hazards.find((h) => h.id === "non-standard-date-formats")?.detected) {
      fidelity -= 5;
    }
  } else if (engine === "lever") {
    if (hazards.find((h) => h.id === "multi-column-table-risk")?.detected) {
      fidelity -= 10;
    }
  }

  fidelity = Math.max(20, Math.min(100, fidelity));

  let overallStatus: "clean" | "warning" | "failed" = "clean";
  if (fidelity < 60) overallStatus = "failed";
  else if (fidelity < 80) overallStatus = "warning";

  const engineNotes: string[] = [];
  if (engine === "workday") {
    engineNotes.push("Simulating Sovren/Textkernel XML schema mapping used by Workday.");
    engineNotes.push("Chronological milestones, job titles, and standardized sections tested.");
  } else if (engine === "greenhouse") {
    engineNotes.push("Simulating Greenhouse linear stream ingestion and field tokenizer.");
    engineNotes.push("Contact header extraction and bullet glyph stability tested.");
  } else {
    engineNotes.push("Simulating Lever plaintext stripper and regex normalizer.");
    engineNotes.push("Formatting collapse and column-interleaving risks tested.");
  }

  return {
    engine,
    config,
    fidelityScore: fidelity,
    overallStatus,
    identity,
    experiences,
    education,
    skillsBag,
    hazards,
    rawTextPreview,
    engineNotes,
  };
}
