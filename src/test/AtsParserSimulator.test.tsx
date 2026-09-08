import "./setup";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { simulateAtsParsing, ATS_ENGINES } from "@/lib/ats-simulator/parser";
import { AtsParserSimulator } from "@/components/resume/AtsParserSimulator";

const SAMPLE_CLEAN_RESUME = `ALEX CHEN
San Francisco, CA | alex.chen@example.com | (415) 555-0199 | linkedin.com/in/alexchen | github.com/alexchen

SUMMARY:
Senior Full Stack Engineer with 6+ years of experience engineering high-throughput web applications.

EXPERIENCE:
Senior Full Stack Engineer | Nova Payments Inc. | Jan 2022 - Present
- Architected multi-tenant payments microservice in Go and PostgreSQL processing $120M volume.
- Re-architected frontend data layer with React 19 and TypeScript.

Software Engineer | StreamScale Cloud | Mar 2019 - Dec 2021
- Developed RESTful API endpoints and WebSocket telemetry channels using Node.js.
- Deployed Docker containers orchestrated on AWS EKS (Kubernetes).

EDUCATION:
B.S. in Computer Science | Stanford University | 2018

SKILLS:
Languages: TypeScript, JavaScript, Go, Python, SQL
Frameworks: React, Node.js, Express, Tailwind CSS
Cloud: AWS, Docker, Kubernetes, PostgreSQL, Redis`;

const SAMPLE_HAZARDOUS_RESUME = `JORDAN VANCE
jordan.vance@example.com

EXPERIENCE:
Staff Distributed Systems Engineer | Global Scale Networks | 2021 - Present
❖ Designed streaming gateway handling 280,000 requests/sec with custom zero-copy buffers.
❖ Multi-column layout test with wide space    ColumnTwoCompany    2021-Present
❖ Implemented Raft consensus across 5 regions.

SKILLS:
Go, Rust, Kafka, Redis, PostgreSQL`;

describe("ATS Parser Simulator - Engine Logic (simulateAtsParsing)", () => {
  it("cleanly extracts contact, experience, education, and skills on clean resume for Workday", () => {
    const result = simulateAtsParsing(SAMPLE_CLEAN_RESUME, "workday");

    expect(result.engine).toBe("workday");
    expect(result.identity.name.value).toContain("ALEX CHEN");
    expect(result.identity.name.status).toBe("clean");
    expect(result.identity.email.value).toBe("alex.chen@example.com");
    expect(result.identity.email.status).toBe("clean");
    expect(result.identity.phone.value).toBe("(415) 555-0199");
    expect(result.identity.phone.status).toBe("clean");
    expect(result.identity.location.value).toContain("San Francisco, CA");
    expect(result.identity.linkedin.value).toContain("linkedin.com/in/alexchen");
    expect(result.identity.github.value).toContain("github.com/alexchen");
    expect(result.identity.sectionStatus).toBe("clean");

    // Experience
    expect(result.experiences.length).toBe(2);
    expect(result.experiences[0].title).toBe("Senior Full Stack Engineer");
    expect(result.experiences[0].company).toBe("Nova Payments Inc.");
    expect(result.experiences[0].status).toBe("clean");
    expect(result.experiences[0].bullets.length).toBe(2);

    // Education
    expect(result.education.length).toBeGreaterThan(0);
    expect(result.education[0].degree).toContain("B.S. in Computer Science");
    expect(result.education[0].institution).toContain("Stanford University");
    expect(result.education[0].graduationYear).toBe("2018");
    expect(result.education[0].status).toBe("clean");

    // Skills
    expect(result.skillsBag).toContain("React");
    expect(result.skillsBag).toContain("TypeScript");
    expect(result.skillsBag).toContain("Go");
    expect(result.skillsBag).toContain("Docker");
    expect(result.skillsBag).toContain("PostgreSQL");

    // Clean score
    expect(result.fidelityScore).toBeGreaterThanOrEqual(80);
    expect(result.overallStatus).toBe("clean");
  });

  it("detects non-standard date formats and warns in Workday", () => {
    const result = simulateAtsParsing(SAMPLE_HAZARDOUS_RESUME, "workday");

    // Year-only date warning (2021 - Present without months)
    const dateHazard = result.hazards.find((h) => h.id === "non-standard-date-formats");
    expect(dateHazard).toBeDefined();
    expect(dateHazard?.detected).toBe(true);
    expect(dateHazard?.severity).toBe("medium");

    // Missing formal education section flagged
    const eduMissing = result.education.find((e) => e.status === "failed");
    expect(eduMissing).toBeDefined();
    expect(eduMissing?.degree).toBe("Not Detected");
  });

  it("detects special character bullet degradation in Greenhouse and Lever", () => {
    const greenhouseResult = simulateAtsParsing(SAMPLE_HAZARDOUS_RESUME, "greenhouse");
    const bulletHazard = greenhouseResult.hazards.find((h) => h.id === "special-character-bullet-degradation");
    expect(bulletHazard).toBeDefined();
    expect(bulletHazard?.detected).toBe(true);

    const leverResult = simulateAtsParsing(SAMPLE_HAZARDOUS_RESUME, "lever");
    expect(leverResult.rawTextPreview).toContain("?");
  });

  it("detects multi-column tabular risks in Lever plaintext parser", () => {
    const leverResult = simulateAtsParsing(SAMPLE_HAZARDOUS_RESUME, "lever");
    const columnHazard = leverResult.hazards.find((h) => h.id === "multi-column-table-risk");
    expect(columnHazard).toBeDefined();
    expect(columnHazard?.detected).toBe(true);
    expect(columnHazard?.severity).toBe("high");
  });
});

describe("AtsParserSimulator UI Component", () => {
  it("renders engine switcher and toggles between Workday, Greenhouse, and Lever", () => {
    render(
      <AtsParserSimulator
        resumeText={SAMPLE_CLEAN_RESUME}
        benchmarkRole="Senior Full Stack Engineer"
      />
    );

    // Initial Workday engine active
    expect(screen.getByText(/Enterprise Semantic Parser Simulation/i)).toBeInTheDocument();
    expect(screen.getByText(/Benchmarking: Senior Full Stack Engineer/i)).toBeInTheDocument();
    expect(screen.getAllByText("Workday Parser (Sovren/Textkernel simulation)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Greenhouse Parser")).toBeInTheDocument();
    expect(screen.getByText("Lever Plaintext Parser")).toBeInTheDocument();

    // Workday extraction status
    expect(screen.getAllByText(/Sovren \/ Textkernel XML Semantic Extraction/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Clean Extraction/i).length).toBeGreaterThanOrEqual(1);

    // Toggle to Greenhouse Parser
    const greenhouseBtn = screen.getByRole("button", { name: /Greenhouse Parser/i });
    fireEvent.click(greenhouseBtn);
    expect(screen.getAllByText(/Greenhouse Automated Document Ingestion Pipeline/i).length).toBeGreaterThanOrEqual(1);

    // Toggle to Lever Plaintext Parser
    const leverBtn = screen.getByRole("button", { name: /Lever Plaintext Parser/i });
    fireEvent.click(leverBtn);
    expect(screen.getAllByText(/Lever Raw Plaintext Normalization Engine/i).length).toBeGreaterThanOrEqual(1);
  });

  it("displays structured entities, contact cards, timeline, education, and skills bag", () => {
    render(<AtsParserSimulator resumeText={SAMPLE_CLEAN_RESUME} />);

    // Contact Header
    expect(screen.getByText(/Candidate Identity & Contact Header/i)).toBeInTheDocument();
    expect(screen.getByText(/Candidate Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByText(/alex.chen@example.com/i)).toBeInTheDocument();

    // Experience Timeline
    expect(screen.getByText(/Experience Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Nova Payments Inc./i)).toBeInTheDocument();
    expect(screen.getByText(/StreamScale Cloud/i)).toBeInTheDocument();

    // Education
    expect(screen.getByText(/Stanford University/i)).toBeInTheDocument();
    expect(screen.getByText(/Graduation: 2018/i)).toBeInTheDocument();

    // Skills Bag
    expect(screen.getByText(/Normalized Skills Bag/i)).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("allows toggling raw ATS plaintext buffer view via keyboard accessible button", () => {
    render(<AtsParserSimulator resumeText={SAMPLE_CLEAN_RESUME} />);

    const toggleBtn = screen.getByRole("button", {
      name: /Inspect raw plaintext buffer/i,
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    // Ensure no nested button exists inside the toggle button
    expect(toggleBtn.querySelectorAll("button").length).toBe(0);

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/WORKDAY\/SOVREN RESUME XML STREAM/i)).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("avoids extracting false-positive locations from emails, URLs, compound words, or ordinary text", () => {
    const resumeWithFalsePositives = `ALEX CHEN
alex@india.com | (415) 555-0199 | linkedin.com/in/alexchen | github.com/remote
Building scalable systems, especially with high reliability. I work remotely on usability.

EXPERIENCE:
Staff Engineer | Tech Corp | 2020 - Present
- Built platforms.`;

    const result = simulateAtsParsing(resumeWithFalsePositives, "workday");
    expect(result.identity.location.value).toBeNull();
    expect(result.identity.location.status).toBe("warning");

    const resumeWithRemote = `ALEX CHEN
remote | alex@example.com | (415) 555-0199`;
    const resultRemote = simulateAtsParsing(resumeWithRemote, "workday");
    expect(resultRemote.identity.location.value?.toLowerCase()).toBe("remote");
    expect(resultRemote.identity.location.status).toBe("clean");

    const resumeWithIndia = `ALEX CHEN
India | alex@example.com | (415) 555-0199`;
    const resultIndia = simulateAtsParsing(resumeWithIndia, "workday");
    expect(resultIndia.identity.location.value).toBe("India");
    expect(resultIndia.identity.location.status).toBe("clean");
  });
});
