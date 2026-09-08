export interface SamplePreset {
  label: string;
  company: string;
  role: string;
  resume: string;
  jd: string;
}

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    label: "Staff Frontend Engineer",
    company: "Stripe",
    role: "Staff Frontend Engineer",
    resume: `SENIOR FRONTEND ENGINEER
San Francisco, CA | alex.dev@example.com | github.com/alexdev

EXPERIENCE:
Staff Software Engineer @ FinTech Scaleup (2022 - Present)
- Architected design system and micro-frontends serving 4.2M daily active users using React 19, TypeScript, and Vite.
- Improved Core Web Vitals (LCP reduced by 42%, INP under 50ms) via code-splitting and asset optimization.
- Led migration of 40+ legacy components to strict TypeScript with zero regressions.
- Designed real-time WebSocket dashboard for live transactional telemetry.

Senior Frontend Developer @ Cloud Platform (2019 - 2022)
- Built interactive analytics dashboards using Next.js, Tailwind CSS, and TanStack Query.
- Implemented comprehensive E2E test suites with Playwright and Vitest (94% coverage).

SKILLS:
Languages & Frameworks: React, TypeScript, JavaScript, Next.js, Node.js, HTML5, CSS3, Tailwind CSS
Architecture: Micro-frontends, State Machines, REST, GraphQL, WebSockets, Performance Optimization
Testing & Tooling: Playwright, Vitest, Jest, Webpack, Vite, Git, CI/CD Pipelines`,
    jd: `Role: Staff Frontend Engineer
Company: Stripe
Location: Remote (US)

Requirements:
- 6+ years building scalable web applications with React, TypeScript, and modern CSS.
- Deep expertise in Core Web Vitals optimization, asset streaming, and frontend telemetry.
- Experience with Playwright or Cypress E2E automation testing.
- Track record of leading technical architecture across multiple frontend teams.
- Knowledge of GraphQL, WebSockets, and state synchronization in distributed environments.`,
  },
  {
    label: "Distributed Systems Lead",
    company: "Cloudflare",
    role: "Staff Systems Infrastructure Engineer",
    resume: `SENIOR BACKEND & INFRASTRUCTURE ENGINEER
Seattle, WA | jordan.sys@example.com | github.com/jordansys

EXPERIENCE:
Lead Distributed Systems Engineer @ Global Cloud (2021 - Present)
- Designed high-throughput event ingestion engine in Go and Rust processing 180k events/sec.
- Implemented multi-region Redis caching and Kafka partition rebalancing, cutting p99 latency to 18ms.
- Built resilient failover and zero-downtime database migration tooling with PostgreSQL.

Systems Engineer @ SaaS Infrastructure (2018 - 2021)
- Developed gRPC microservices and Docker/Kubernetes deployment pipelines on AWS EC2.
- Integrated OpenTelemetry distributed tracing and Prometheus alerting across 60+ microservices.

SKILLS:
Backend & Systems: Go, Rust, Python, PostgreSQL, Redis, Kafka, gRPC, Distributed Systems
Cloud & DevOps: Docker, Kubernetes, AWS, Terraform, CI/CD, OpenTelemetry, Prometheus`,
    jd: `Role: Staff Systems Infrastructure Engineer
Company: Cloudflare
Location: Remote (US)

Requirements:
- Strong experience in Go, Rust, or C++ building low-latency distributed systems.
- Deep understanding of Redis, Kafka, partition hashing, and distributed consensus.
- Proven ability to optimize p99 latency and manage multi-region high-availability workloads.
- Hands-on experience with Docker, Kubernetes, and telemetry instrumentation.`,
  },
  {
    label: "Product Engineer",
    company: "Linear",
    role: "Product Engineer (Core Experience)",
    resume: `SENIOR PRODUCT ENGINEER
New York, NY | sam.builds@example.com | linear.app/sam

EXPERIENCE:
Product Engineer @ High-Growth Tooling (2022 - Present)
- Engineered keyboard-first synchronization and issue tracking workflows in React, TypeScript, and Tailwind CSS.
- Implemented optimistic UI updates and local-first SQLite client state with real-time WebSocket sync.
- Reduced time-to-interactive to 80ms through zero-runtime component styles and virtualization.

Full-Stack Engineer @ Collaborative Apps (2019 - 2022)
- Built GraphQL APIs in Node.js and PostgreSQL with transactional integrity and audit logging.
- Spearheaded dark mode and motion design systems using Framer Motion and Radix UI primitives.

SKILLS:
Frontend: React, TypeScript, Next.js, Tailwind CSS, Radix UI, Framer Motion, State Synchronization
Backend: Node.js, GraphQL, PostgreSQL, Redis, WebSockets, REST APIs, Microservices
Product: Micro-interactions, Accessibility (a11y), User Feedback Loops, Rapid Prototyping`,
    jd: `Role: Product Engineer (Core Experience)
Company: Linear
Location: Remote (Global)

Requirements:
- 4+ years shipping high-craft web applications with React, TypeScript, and modern styling.
- Passion for speed, keyboard navigation, fluid micro-animations, and world-class product taste.
- Hands-on familiarity with GraphQL, client-side caching, and optimistic state synchronization.
- Ability to take ambiguous problem spaces from concept to production-grade polish.`,
  },
];
