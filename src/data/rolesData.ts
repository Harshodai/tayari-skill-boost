export interface SalaryRange {
  min: number;
  max: number;
  median: number;
  currency: string;
  formatted: string;
}

export interface AtsBenchmarks {
  targetScore: number;
  keywordDensity: string;
  bulletMetricRatio: string;
  recommendedSections: string[];
  maxPageLength: number;
}

export interface SkillItem {
  name: string;
  category: "Core Technical" | "Architecture & Systems" | "Tools & Cloud" | "Practices & Delivery";
  frequency: string;
  importance: "Mandatory" | "Highly Preferred" | "Differentiating";
  description: string;
}

export interface RejectionTrap {
  trap: string;
  whyItFails: string;
  howToFix: string;
}

export interface ParBullet {
  title: string;
  problem: string;
  action: string;
  result: string;
  before: string;
  after: string;
}

export interface RoleFaq {
  question: string;
  answer: string;
}

export interface RoleData {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  salaryRange: SalaryRange;
  atsBenchmarks: AtsBenchmarks;
  topSkills: SkillItem[];
  commonRejectionTraps: RejectionTrap[];
  sampleParBullets: ParBullet[];
  sampleResumeTemplate: string;
  faqs: RoleFaq[];
}

export const ROLES_DATA: Record<string, RoleData> = {
  "software-engineer": {
    title: "Software Engineer",
    slug: "software-engineer",
    subtitle: "Full Stack & Backend Distributed Systems Engineering",
    description: "Evaluates distributed architecture, microservices throughput, concurrency control, relational data indexing, and end-to-end API lifecycle management.",
    salaryRange: {
      min: 125000,
      max: 210000,
      median: 165000,
      currency: "USD",
      formatted: "$125,000 - $210,000",
    },
    atsBenchmarks: {
      targetScore: 85,
      keywordDensity: "14% - 18%",
      bulletMetricRatio: "80%+",
      recommendedSections: ["Summary", "Technical Skills", "Work Experience", "Projects", "Education"],
      maxPageLength: 2,
    },
    topSkills: [
      {
        name: "Distributed Systems & Microservices",
        category: "Architecture & Systems",
        frequency: "94% of JDs",
        importance: "Mandatory",
        description: "Experience designing event-driven services, gRPC/REST contracts, and asynchronous message brokers (Kafka, RabbitMQ).",
      },
      {
        name: "TypeScript / Node.js or Go",
        category: "Core Technical",
        frequency: "91% of JDs",
        importance: "Mandatory",
        description: "Static type safety, concurrency patterns (goroutines/async-await), and production API development.",
      },
      {
        name: "PostgreSQL & Database Indexing",
        category: "Core Technical",
        frequency: "88% of JDs",
        importance: "Mandatory",
        description: "Schema design, query execution plan analysis (EXPLAIN ANALYZE), connection pooling, and ACID isolation guarantees.",
      },
      {
        name: "Redis & In-Memory Caching",
        category: "Architecture & Systems",
        frequency: "82% of JDs",
        importance: "Highly Preferred",
        description: "Cache-aside strategies, distributed locking, rate-limiting algorithms, and latency reduction.",
      },
      {
        name: "Cloud Platforms (AWS / GCP)",
        category: "Tools & Cloud",
        frequency: "89% of JDs",
        importance: "Mandatory",
        description: "AWS services (ECS, EKS, Lambda, S3, RDS, CloudWatch) or Google Cloud infrastructure primitives.",
      },
      {
        name: "Docker & Kubernetes Orchestration",
        category: "Tools & Cloud",
        frequency: "80% of JDs",
        importance: "Highly Preferred",
        description: "Containerization, Helm charts, pod autoscaling (HPA), and zero-downtime rolling deployments.",
      },
      {
        name: "CI/CD & Infrastructure as Code",
        category: "Practices & Delivery",
        frequency: "78% of JDs",
        importance: "Highly Preferred",
        description: "Automated test-and-deploy pipelines (GitHub Actions, GitLab CI) and declarative infra (Terraform).",
      },
      {
        name: "Automated Testing (Vitest, Jest, Playwright)",
        category: "Practices & Delivery",
        frequency: "85% of JDs",
        importance: "Mandatory",
        description: "Unit, integration, and E2E regression suites with code coverage benchmarks above 80%.",
      },
      {
        name: "REST / GraphQL / gRPC API Design",
        category: "Core Technical",
        frequency: "86% of JDs",
        importance: "Mandatory",
        description: "Idempotent endpoints, OpenAPI specs, schema stitching, error contracts, and backward compatibility.",
      },
      {
        name: "Telemetry & Performance Profiling",
        category: "Practices & Delivery",
        frequency: "72% of JDs",
        importance: "Differentiating",
        description: "Distributed tracing (OpenTelemetry, Jaeger), p99 latency profiling, and Prometheus/Grafana alerts.",
      },
    ],
    commonRejectionTraps: [
      {
        trap: "Vague responsibilities without quantifiable business impact",
        whyItFails: "ATS parsers and senior engineering screeners score action verbs accompanied by numbers (%, $, latency ms) 3x higher than passive task lists.",
        howToFix: "Use the PAR formula: describe the problem, the specific engineering action taken, and the quantified result (e.g., 'slashed p99 latency by 35%').",
      },
      {
        trap: "Listing obsolete tech or laundry-list keyword dumps",
        whyItFails: "Modern ATS algorithms cross-reference skills against bullet context. Listing 40 disconnected technologies triggers low-relevance penalties.",
        howToFix: "Categorize skills cleanly and ensure every key skill is contextualized in at least one substantive achievement bullet.",
      },
      {
        trap: "Tables, two-column layouts, or header graphics",
        whyItFails: "Complex column tables scramble text streams in Workday and Taleo parsers, turning work experience into unparseable text fragments.",
        howToFix: "Use clean, single-column semantic markdown or standard Typst/PDF layout without embedded layout tables.",
      },
    ],
    sampleParBullets: [
      {
        title: "Microservices Scalability & p99 Latency",
        problem: "Monolithic payments gateway experienced frequent latency spikes (p99 > 1,200ms) and database lock contention during flash sales.",
        action: "Decomposed the bottleneck service into an asynchronous Go microservice backed by Redis distributed caching and connection-pooled PostgreSQL.",
        result: "Reduced p99 response times by 68% (from 1,200ms to 380ms) and maintained 99.99% uptime across 12M monthly transactions.",
        before: "Worked on payments system backend and helped optimize database queries for better performance.",
        after: "Architected asynchronous Go payments microservice with Redis caching, reducing p99 latency by 68% (1.2s to 380ms) across 12M monthly transactions.",
      },
      {
        title: "Test Automation & Release Velocity",
        problem: "Manual regression testing delayed sprint releases by 4 days every cycle and missed critical edge-case bugs.",
        action: "Engineered automated test pipeline using Vitest and Playwright integrated into GitHub Actions with parallel test runners.",
        result: "Elevated test coverage from 45% to 88% and compressed release deployment cycles from 4 days to 45 minutes.",
        before: "Responsible for writing unit tests and helping QA test release builds before deployment.",
        after: "Engineered automated CI pipeline using Vitest and Playwright, boosting test coverage to 88% and shrinking deployment cycles from 4 days to 45 minutes.",
      },
      {
        title: "Cloud Migration & Infrastructure Cost",
        problem: "Overprovisioned legacy EC2 instances resulted in runaway AWS cloud expenditures without autoscaling safeguards.",
        action: "Containerized 14 services onto AWS EKS with Terraform-managed horizontal pod autoscalers and spot instance node groups.",
        result: "Reduced monthly AWS cloud compute bill by 42% ($38,000/mo savings) while auto-handling 3x peak traffic bursts.",
        before: "Assisted in migrating applications to Docker containers on AWS Kubernetes.",
        after: "Containerized 14 services onto AWS EKS with spot instance autoscaling, cutting cloud expenditures by 42% ($38,000/mo) while sustaining 3x peak surges.",
      },
    ],
    sampleResumeTemplate: `ALEX RIVERA
San Francisco, CA • (555) 234-5678 • alex.rivera@example.com • github.com/alexrivera • linkedin.com/in/alexrivera

PROFESSIONAL SUMMARY
Senior Software Engineer with 6+ years of expertise architecting high-throughput distributed microservices, low-latency relational schemas, and resilient CI/CD pipelines. Track record of scaling systems to 15M+ MAUs, slashing p99 latency by over 60%, and mentoring teams in production best practices.

TECHNICAL SKILLS
• Languages: Go, TypeScript, Python, SQL, JavaScript
• Backend & Distributed: Microservices, gRPC, REST APIs, Redis, Kafka, PostgreSQL, GraphQL
• Cloud & DevOps: AWS (ECS, EKS, RDS, S3), Docker, Kubernetes, Terraform, GitHub Actions
• Quality & Observability: Vitest, Playwright, OpenTelemetry, Prometheus, Grafana

PROFESSIONAL EXPERIENCE
Senior Software Engineer | Apex Cloud Systems | 2022 - Present
• Designed and deployed high-throughput event processing engine in Go and Kafka, handling 45,000 events/sec with sub-50ms latency.
• Optimized PostgreSQL query execution plans and partitioned multi-terabyte tables, reducing database CPU utilization by 44%.
• Built distributed Redis caching layer with adaptive TTLs, decreasing origin server load by 55% during high-traffic product launches.
• Spearheaded migration from legacy VMs to Kubernetes (EKS), reducing infrastructure costs by 35% ($45k/year).

Software Engineer | Nexus Interactive | 2019 - 2022
• Developed REST and GraphQL API services in TypeScript/Node.js serving 3M active web and mobile clients.
• Established automated end-to-end testing suite using Playwright and Vitest, catching 95% of regressions pre-production.
• Containerized core application workflows using Docker and streamlined release pipeline to under 15 minutes.

EDUCATION
Bachelor of Science in Computer Science | University of California, Berkeley`,
    faqs: [
      {
        question: "What ATS score is required to pass initial screening for Software Engineers?",
        answer: "Top tech companies filter resumes through ATS scoring systems like Workday, Lever, and Greenhouse. A score of 82% to 85%+ is generally required to guarantee human recruiter review.",
      },
      {
        question: "Should a Software Engineer resume be one page or two pages?",
        answer: "If you have under 5 years of experience, keep it strictly to 1 page. With 5+ years of relevant experience across multiple senior roles and production deployments, 2 pages is standard and expected.",
      },
      {
        question: "How should technical skills be formatted for optimal ATS parsing?",
        answer: "Group skills into clean categories (Languages, Frameworks, Cloud & DevOps, Databases) with standard comma-separated lists. Avoid progress bars, stars, or arbitrary percentage ratings as they confuse parsers.",
      },
    ],
  },

  "product-manager": {
    title: "Product Manager",
    slug: "product-manager",
    subtitle: "Product Strategy, Growth Experimentation & User Lifecycle",
    description: "Assesses PRD specifications, customer discovery, quantitative A/B testing, cohort retention metrics, and cross-functional engineering alignment.",
    salaryRange: {
      min: 130000,
      max: 220000,
      median: 170000,
      currency: "USD",
      formatted: "$130,000 - $220,000",
    },
    atsBenchmarks: {
      targetScore: 86,
      keywordDensity: "12% - 16%",
      bulletMetricRatio: "85%+",
      recommendedSections: ["Summary", "Core Competencies", "Professional Experience", "Education & Certifications"],
      maxPageLength: 2,
    },
    topSkills: [
      {
        name: "Product Strategy & Roadmapping",
        category: "Practices & Delivery",
        frequency: "95% of JDs",
        importance: "Mandatory",
        description: "Vision definition, multi-quarter roadmap prioritization (RICE/MoSCoW), and executive alignment.",
      },
      {
        name: "Data Analytics & SQL",
        category: "Core Technical",
        frequency: "90% of JDs",
        importance: "Mandatory",
        description: "Writing complex SQL queries, building dashboards in Tableau/Looker, and tracking funnel conversions.",
      },
      {
        name: "A/B Testing & Experimentation",
        category: "Core Technical",
        frequency: "88% of JDs",
        importance: "Mandatory",
        description: "Hypothesis generation, sample size calculation, statistical significance, and cohort analysis.",
      },
      {
        name: "User Discovery & Qualitative Research",
        category: "Practices & Delivery",
        frequency: "84% of JDs",
        importance: "Mandatory",
        description: "Conducting user interviews, synthesizing usability tests, and translating pain points into PRD epics.",
      },
      {
        name: "PRD & Technical Specification Writing",
        category: "Practices & Delivery",
        frequency: "92% of JDs",
        importance: "Mandatory",
        description: "Detailed acceptance criteria, system boundary diagrams, API mockups, and edge-case definitions.",
      },
      {
        name: "Cross-Functional Agile Leadership",
        category: "Practices & Delivery",
        frequency: "89% of JDs",
        importance: "Mandatory",
        description: "Sprint grooming, backlog prioritization, OKR definition, and bridging engineering, design, and sales.",
      },
      {
        name: "Growth & Retention Metrics (CAC, LTV, Churn)",
        category: "Architecture & Systems",
        frequency: "81% of JDs",
        importance: "Highly Preferred",
        description: "Funnel drop-off diagnosis, activation onboarding optimizations, and net revenue retention (NRR).",
      },
      {
        name: "Product Analytics Platforms (Amplitude, Mixpanel)",
        category: "Tools & Cloud",
        frequency: "82% of JDs",
        importance: "Highly Preferred",
        description: "Behavioral event instrumentation, retention curves, and path analysis across user cohorts.",
      },
      {
        name: "Go-to-Market (GTM) Strategy",
        category: "Practices & Delivery",
        frequency: "77% of JDs",
        importance: "Highly Preferred",
        description: "Coordinating launches with PMM, sales enablement collateral, pricing tiers, and beta rollouts.",
      },
      {
        name: "AI & Automation Product Integration",
        category: "Architecture & Systems",
        frequency: "74% of JDs",
        importance: "Differentiating",
        description: "Evaluating LLM latency/cost trade-offs, agentic UX, prompt engineering, and human-in-the-loop workflows.",
      },
    ],
    commonRejectionTraps: [
      {
        trap: "Describing feature launches instead of measurable business outcomes",
        whyItFails: "Hiring managers look for commercial accountability (revenue, retention, conversion), not merely ticket output or sprint delivery.",
        howToFix: "Frame achievements around business lift: 'Drove +24% onboarding completion and $1.4M ARR expansion' instead of 'Managed sprint backlog for new UI'.",
      },
      {
        trap: "Omitting data literacy and experimentation proof",
        whyItFails: "Product resumes that lack SQL, quantitative metrics, or A/B testing evidence are flagged as low-rigor by ATS filters.",
        howToFix: "Explicitly reference analytical tools (SQL, Amplitude) and include test outcomes with sample size or significance confidence.",
      },
      {
        trap: "Lack of clear product ownership scope",
        whyItFails: "Unclear ownership leaves recruiters wondering if you led the product or merely attended meetings as a project coordinator.",
        howToFix: "State product domain, team composition, and direct P&L or metric responsibility in the opening line of each role.",
      },
    ],
    sampleParBullets: [
      {
        title: "Self-Serve Onboarding Activation",
        problem: "B2B SaaS platform suffered 58% user drop-off during the initial 3-step workspace setup process.",
        action: "Led cross-functional team of 4 engineers and 1 designer to replace static wizard with an interactive sandbox template flow guided by Amplitude event tracking.",
        result: "Boosted trial-to-paid activation by 31%, reducing time-to-first-value from 18 minutes to 4.2 minutes and generating $680K in incremental ARR.",
        before: "Led the redesign of the onboarding flow to improve user activation and trial conversion.",
        after: "Spearheaded onboarding overhaul with interactive sandbox templates, lifting trial-to-paid conversion by 31% and adding $680K incremental ARR.",
      },
      {
        title: "A/B Testing & Pricing Tier Optimization",
        problem: "Existing single-tier checkout caused high enterprise churn and failed to monetize mid-market usage spikes.",
        action: "Formulated hypothesis and executed 4-variant pricing A/B test across 85,000 monthly active users based on SQL usage cluster analysis.",
        result: "Identified optimal usage-based tier that elevated Average Revenue Per User (ARPU) by 26% while decreasing customer churn by 4.2%.",
        before: "Conducted pricing experiments and analyzed user data using SQL to increase revenue.",
        after: "Executed multi-variant pricing A/B test across 85k MAUs, increasing ARPU by 26% and reducing churn by 4.2% via usage-based tiering.",
      },
    ],
    sampleResumeTemplate: `JORDAN REESE
New York, NY • (555) 876-5432 • jordan.reese@example.com • linkedin.com/in/jordanreese

SUMMARY
Senior Product Manager with 5+ years of experience leading cross-functional engineering and design squads in B2B SaaS. Proven track record of scaling product lines from $2M to $14M ARR through rigorous customer discovery, data-backed A/B experimentation, and user lifecycle optimization.

CORE COMPETENCIES
• Strategy: Roadmap Prioritization (RICE), Go-To-Market (GTM), Customer Discovery, OKRs
• Analytics & Data: SQL, Amplitude, Mixpanel, Looker, Hypothesis Testing, Cohort Retention
• Execution: PRDs, User Story Mapping, Agile/Scrum, Figma, Jira, System Architecture Specs

EXPERIENCE
Senior Product Manager | Veloce Software | 2022 - Present
• Owned end-to-end product roadmap for self-serve growth platform, directing a squad of 8 engineers and 2 product designers.
• Redesigned team collaboration workspace, driving a 28% increase in 30-day retention and reducing churn by 3.8%.
• Championed AI-assisted workflow initiative, automating 40% of manual data entry tasks and driving 18,000 new team signups in Q3.

Product Manager | Catalyst Analytics | 2019 - 2022
• Directed core reporting suite used by 120,000 daily active business users.
• Launched automated alert feature, resulting in a 44% surge in weekly active engagement and $1.2M pipeline influence.
• Synthesized feedback from 60+ customer discovery interviews to construct 4-quarter strategic product vision.

EDUCATION
Bachelor of Science in Industrial Engineering & Economics | Northwestern University`,
    faqs: [
      {
        question: "How should a Product Manager demonstrate technical credibility on a resume?",
        answer: "Highlight familiarity with system constraints, API contracts, data pipelines, SQL, and analytical instrumentation in your PRD definitions and bullet points.",
      },
      {
        question: "What metrics carry the highest weight on a PM resume?",
        answer: "Metrics tied to revenue (ARR/MRR growth), retention (30-day cohort retention, churn reduction), and efficiency (activation rate, time-to-value) stand out most.",
      },
    ],
  },

  "data-scientist": {
    title: "Data Scientist",
    slug: "data-scientist",
    subtitle: "Machine Learning, Statistical Modeling & AI Inference",
    description: "Evaluates machine learning pipelines, predictive modeling, statistical hypothesis validation, feature engineering, and production model serving.",
    salaryRange: {
      min: 135000,
      max: 225000,
      median: 175000,
      currency: "USD",
      formatted: "$135,000 - $225,000",
    },
    atsBenchmarks: {
      targetScore: 84,
      keywordDensity: "15% - 19%",
      bulletMetricRatio: "85%+",
      recommendedSections: ["Summary", "Technical Skills", "Work Experience", "Publications & Projects", "Education"],
      maxPageLength: 2,
    },
    topSkills: [
      {
        name: "Python (NumPy, Pandas, Scikit-Learn)",
        category: "Core Technical",
        frequency: "97% of JDs",
        importance: "Mandatory",
        description: "Vectorized computation, data wrangling, model training, and algorithmic optimization.",
      },
      {
        name: "Deep Learning (PyTorch / TensorFlow)",
        category: "Core Technical",
        frequency: "86% of JDs",
        importance: "Mandatory",
        description: "Neural network architectures (Transformers, CNNs), backpropagation tuning, and GPU inference.",
      },
      {
        name: "Statistical Inference & Hypothesis Testing",
        category: "Practices & Delivery",
        frequency: "91% of JDs",
        importance: "Mandatory",
        description: "Bayesian and Frequentist statistics, p-value calculations, bootstrapping, and regression modeling.",
      },
      {
        name: "Advanced SQL & Feature Store Pipelines",
        category: "Core Technical",
        frequency: "92% of JDs",
        importance: "Mandatory",
        description: "Window functions, distributed query engines (Snowflake, BigQuery, Spark SQL), and Feast feature stores.",
      },
      {
        name: "MLOps & Model Serving (MLflow, Triton, FastAPI)",
        category: "Tools & Cloud",
        frequency: "80% of JDs",
        importance: "Highly Preferred",
        description: "Model registry versioning, real-time REST inference endpoints, and drift monitoring.",
      },
      {
        name: "LLM Fine-Tuning & RAG Architecture",
        category: "Architecture & Systems",
        frequency: "79% of JDs",
        importance: "Highly Preferred",
        description: "Vector embeddings, LangChain/LlamaIndex, PEFT/LoRA fine-tuning, and semantic retrieval evaluation.",
      },
      {
        name: "Distributed Computing (Apache Spark / Ray)",
        category: "Tools & Cloud",
        frequency: "76% of JDs",
        importance: "Highly Preferred",
        description: "Processing multi-terabyte datasets across distributed worker clusters.",
      },
      {
        name: "Data Visualization (Seaborn, Plotly, Streamlit)",
        category: "Practices & Delivery",
        frequency: "75% of JDs",
        importance: "Highly Preferred",
        description: "Translating statistical distributions into executive visual dashboards and interactive apps.",
      },
      {
        name: "A/B Experimentation Design & Causal Inference",
        category: "Practices & Delivery",
        frequency: "83% of JDs",
        importance: "Mandatory",
        description: "Quasi-experimentation, synthetic controls, and multi-armed bandit algorithms.",
      },
      {
        name: "Cloud ML Infrastructure (AWS SageMaker / GCP Vertex)",
        category: "Tools & Cloud",
        frequency: "81% of JDs",
        importance: "Highly Preferred",
        description: "Distributed GPU training pipelines, spot instance orchestrators, and serverless endpoints.",
      },
    ],
    commonRejectionTraps: [
      {
        trap: "Citing academic model accuracy without real-world business impact",
        whyItFails: "Saying 'Achieved 94% ROC-AUC on Kaggle dataset' tells hiring managers nothing about how you solved operational business problems or reduced cost.",
        howToFix: "Tie model improvements to commercial KPIs: 'Lifted fraud detection precision by 18%, saving $2.1M in fraudulent claim chargebacks.'",
      },
      {
        trap: "Treating Data Science as purely Jupyter notebooks without deployment proof",
        whyItFails: "Production hiring managers reject candidates whose models never leave local .ipynb files.",
        howToFix: "Highlight production deployment: FastAPI microservices, Docker containers, low-latency endpoints, and CI/CD pipelines.",
      },
    ],
    sampleParBullets: [
      {
        title: "Fraud Detection Deep Learning Model",
        problem: "Rule-based fraud detection engine flagged 12% false positives, alienating premium customers and consuming 40 hours/week of manual review.",
        action: "Engineered an XGBoost and PyTorch hybrid classification pipeline with real-time feature extraction in Snowflake and FastAPI.",
        result: "Reduced false positive rate by 42% while improving fraud capture recall to 96.4%, saving $3.2M in annual prevented chargebacks.",
        before: "Built machine learning models using Python and PyTorch to detect fraudulent transactions.",
        after: "Built hybrid XGBoost/PyTorch fraud detection engine, cutting false positives by 42% and preventing $3.2M in annual chargebacks with 96.4% recall.",
      },
      {
        title: "Customer Churn Predictive Pipeline",
        problem: "High-value enterprise accounts churned unpredictably due to delayed customer success intervention.",
        action: "Designed a survival analysis churn prediction model using PySpark and MLflow running daily inference over 20M user events.",
        result: "Delivered 60-day early warning alerts that enabled account teams to salvage 34 at-risk accounts, preserving $1.8M in ARR.",
        before: "Developed churn prediction models in Python and analyzed customer usage trends.",
        after: "Implemented PySpark survival analysis churn model with daily MLflow inference, identifying 34 at-risk accounts and preserving $1.8M in ARR.",
      },
    ],
    sampleResumeTemplate: `PRIYA SHARMA
Austin, TX • (555) 345-6789 • priya.sharma@example.com • github.com/priyasharma • linkedin.com/in/priyasharma

SUMMARY
Senior Data Scientist with 6+ years of experience designing and deploying production machine learning models, statistical inference pipelines, and LLM architectures. Expert in transforming raw multi-terabyte datasets into high-impact predictive systems generating $5M+ in verified business value.

TECHNICAL SKILLS
• Languages & Libraries: Python, R, SQL, PyTorch, Scikit-Learn, Pandas, NumPy, Spark
• ML & AI: Transformers, XGBoost, A/B Testing, Time Series, Survival Analysis, RAG, PEFT
• MLOps & Cloud: MLflow, Docker, FastAPI, Snowflake, AWS SageMaker, Kubernetes, Triton
• Observability & BI: Streamlit, Plotly, Looker, Evidently AI (Drift Monitoring)

EXPERIENCE
Lead Data Scientist | Horizon Financial | 2022 - Present
• Spearheaded real-time credit default risk model in PyTorch, reducing defaults by 19% across $400M in loan originations.
• Automated feature store pipeline using Snowflake and Feast, cutting feature engineering latency from 3 days to under 10 minutes.
• Mentored team of 4 junior data scientists and established standardized MLOps testing and validation framework.

Data Scientist | Helix Health Analytics | 2019 - 2022
• Built patient readmission risk model using XGBoost, cutting 30-day preventable readmissions by 14% across 8 hospital networks.
• Designed randomized A/B experimentation engine determining clinical workflow efficiency with 99% statistical confidence.

EDUCATION
Master of Science in Statistics & Machine Learning | Carnegie Mellon University`,
    faqs: [
      {
        question: "Should Data Scientists list academic publications on their resume?",
        answer: "Yes, include a concise 'Publications & Patents' section, especially if relevant to NLP, Computer Vision, or ML systems. However, keep the primary focus on production impact.",
      },
      {
        question: "What is the difference between Data Science and Data Engineering resumes?",
        answer: "Data Scientists emphasize statistical modeling, algorithmic experimentation, and predictive accuracy; Data Engineers emphasize data ingestion throughput, pipeline reliability, and distributed storage architecture.",
      },
    ],
  },

  "devops-engineer": {
    title: "DevOps Engineer",
    slug: "devops-engineer",
    subtitle: "Cloud Infrastructure, Kubernetes, CI/CD & Reliability",
    description: "Evaluates Infrastructure as Code (Terraform), Kubernetes cluster management, automated deployment pipelines, security hardening, and site reliability.",
    salaryRange: {
      min: 135000,
      max: 215000,
      median: 172000,
      currency: "USD",
      formatted: "$135,000 - $215,000",
    },
    atsBenchmarks: {
      targetScore: 86,
      keywordDensity: "16% - 20%",
      bulletMetricRatio: "85%+",
      recommendedSections: ["Summary", "Technical Stack", "Professional Experience", "Certifications", "Education"],
      maxPageLength: 2,
    },
    topSkills: [
      {
        name: "Kubernetes & Container Orchestration",
        category: "Tools & Cloud",
        frequency: "96% of JDs",
        importance: "Mandatory",
        description: "Cluster provisioning (EKS/GKE), Helm templating, CNI networking, ingress controllers, and pod security standards.",
      },
      {
        name: "Infrastructure as Code (Terraform / OpenTofu)",
        category: "Tools & Cloud",
        frequency: "94% of JDs",
        importance: "Mandatory",
        description: "Modular state management, multi-environment provisioning, drift detection, and automated validation.",
      },
      {
        name: "CI/CD Pipeline Automation (GitHub Actions, GitLab)",
        category: "Practices & Delivery",
        frequency: "93% of JDs",
        importance: "Mandatory",
        description: "Multi-stage pipeline triggers, Docker image layer caching, semantic versioning, and canary rollouts.",
      },
      {
        name: "AWS / GCP Multi-Account Cloud Architecture",
        category: "Architecture & Systems",
        frequency: "91% of JDs",
        importance: "Mandatory",
        description: "IAM least-privilege policies, VPC peering, transit gateways, KMS encryption, and cost governance.",
      },
      {
        name: "Observability & Alerting (Prometheus, Grafana, Datadog)",
        category: "Practices & Delivery",
        frequency: "88% of JDs",
        importance: "Mandatory",
        description: "Service Level Objectives (SLOs), error budget alerting, metric aggregation, and synthetic monitors.",
      },
      {
        name: "Linux Systems Administration & Shell Scripting",
        category: "Core Technical",
        frequency: "89% of JDs",
        importance: "Mandatory",
        description: "Kernel tuning, systemd, bash/zsh automation, networking diagnostics (tcpdump, iptables), and storage.",
      },
      {
        name: "GitOps Workflows (ArgoCD / Flux)",
        category: "Practices & Delivery",
        frequency: "79% of JDs",
        importance: "Highly Preferred",
        description: "Declarative continuous delivery, automated reconciliation, and pull-request driven cluster sync.",
      },
      {
        name: "DevSecOps & Vulnerability Scanning (Trivy, Snyk)",
        category: "Practices & Delivery",
        frequency: "82% of JDs",
        importance: "Highly Preferred",
        description: "Automated container CVE scanning, SAST pipeline gates, and secret detection tools.",
      },
      {
        name: "Python or Go for Tooling Automation",
        category: "Core Technical",
        frequency: "80% of JDs",
        importance: "Highly Preferred",
        description: "Developing custom CLI utilities, Kubernetes operators, and API glue scripts.",
      },
      {
        name: "Zero-Downtime Deployment Strategies",
        category: "Architecture & Systems",
        frequency: "84% of JDs",
        importance: "Mandatory",
        description: "Blue/green switches, progressive canary releases via Istio/Envoy, and automated health rollback.",
      },
    ],
    commonRejectionTraps: [
      {
        trap: "Listing tools without proving reliability and uptime improvements",
        whyItFails: "Recruiters see hundreds of resumes listing 'Docker, Kubernetes, AWS'. Without metrics on uptime, deployment frequency, and MTTR, the resume blends into the discard pile.",
        howToFix: "Highlight DORA metrics: Mean Time to Recovery (MTTR), deployment frequency, change failure rate, and lead time for changes.",
      },
      {
        trap: "Missing cloud security and compliance mentions",
        whyItFails: "Enterprise ATS filters screen heavily for SOC2, IAM least-privilege, and encryption standards in cloud engineering roles.",
        howToFix: "Incorporate security standards: IAM auditing, KMS envelope encryption, TLS mTLS, and automated container scanning.",
      },
    ],
    sampleParBullets: [
      {
        title: "GitOps Kubernetes Migration & Deployment Frequency",
        problem: "Engineering team suffered 45-minute manual deployments with a 14% failure rate requiring frequent midnight rollbacks.",
        action: "Implemented ArgoCD GitOps pipeline with automated canary testing in Istio service mesh and automated rollback triggers.",
        result: "Increased deployment frequency from 2x/week to 18x/day while cutting deployment failure rate from 14% to 0.4% and MTTR to under 3 minutes.",
        before: "Maintained Kubernetes deployments and helped developers deploy applications to staging and production.",
        after: "Architected ArgoCD GitOps pipeline with Istio canary rollouts, increasing deploy frequency 9x to 18x/day and cutting failure rate to 0.4%.",
      },
      {
        title: "Infrastructure as Code & Cloud Cost Optimization",
        problem: "Unmanaged legacy AWS infrastructure resulted in frequent configuration drift and $65,000/mo in idle compute costs.",
        action: "Codified 100% of cloud resources into modular Terraform with automated infracost CI checks and Karpenter autoscaling.",
        result: "Reduced monthly AWS cloud bill by 38% ($24,700/mo savings) and achieved complete multi-region disaster recovery replication in 22 minutes.",
        before: "Used Terraform to manage AWS resources and helped reduce cloud spending.",
        after: "Codified all AWS infrastructure into modular Terraform with Karpenter autoscaling, cutting monthly cloud spend by 38% ($24.7k/mo).",
      },
    ],
    sampleResumeTemplate: `MARCUS VANCE
Seattle, WA • (555) 456-7890 • marcus.vance@example.com • github.com/marcusvance • linkedin.com/in/marcusvance

SUMMARY
Lead DevOps & SRE Engineer with 7+ years of experience engineering secure cloud platforms, Kubernetes clusters, and automated GitOps CI/CD pipelines. Proven track record of upholding 99.99% system availability and cutting cloud infrastructure overhead by 35%+.

TECHNICAL SKILLS
• Cloud & Orchestration: AWS (EKS, VPC, IAM, RDS), Google Cloud, Kubernetes, Helm, Docker
• Infrastructure as Code: Terraform, Terragrunt, OpenTofu, CloudFormation, Ansible
• CI/CD & GitOps: GitHub Actions, GitLab CI, ArgoCD, Flux, Jenkins
• Observability & SRE: Prometheus, Grafana, Datadog, OpenTelemetry, PagerDuty, Chaos Mesh
• Security & Governance: Vault, Trivy, Snyk, IAM Least-Privilege, SOC2 Type II compliance

EXPERIENCE
Senior DevOps Engineer | Strata Cloud Platforms | 2022 - Present
• Designed and managed 12 multi-tenant Kubernetes (EKS) clusters supporting 60+ microservices and 99.99% uptime SLA.
• Migrated 350+ manual cloud assets to Terraform, instituting drift detection and CI pull-request validation gates.
• Reduced mean time to recovery (MTTR) by 72% (from 42 min to 11 min) by implementing automated Prometheus alerts and runbooks.

DevOps Engineer | CloudPulse Systems | 2019 - 2022
• Automated microservice build and test pipeline using GitHub Actions, slashing average build time from 28 minutes to 4.5 minutes.
• Integrated Trivy container scanning and secret leak detection into CI, catching 100% of critical CVEs prior to production registry push.

CERTIFICATIONS
• AWS Certified Solutions Architect – Professional
• Certified Kubernetes Administrator (CKA)

EDUCATION
Bachelor of Science in Information Systems | University of Washington`,
    faqs: [
      {
        question: "Are certifications like CKA or AWS Pro valuable on a DevOps resume?",
        answer: "Yes, CKA (Certified Kubernetes Administrator) and AWS Solutions Architect Professional are among the few industry certifications that meaningfully boost ATS keyword match rates.",
      },
      {
        question: "How should DORA metrics be integrated into resume bullets?",
        answer: "Explicitly state numbers for deployment frequency (e.g. '15 deploys/day'), lead time for changes, change failure rate, and mean time to recovery (MTTR).",
      },
    ],
  },

  "frontend-engineer": {
    title: "Frontend Engineer",
    slug: "frontend-engineer",
    subtitle: "Modern React, TypeScript, Core Web Vitals & Design Systems",
    description: "Evaluates client-side state architecture, render optimization, Core Web Vitals (LCP, INP, CLS), accessibility (WCAG AA), and component design systems.",
    salaryRange: {
      min: 120000,
      max: 195000,
      median: 158000,
      currency: "USD",
      formatted: "$120,000 - $195,000",
    },
    atsBenchmarks: {
      targetScore: 85,
      keywordDensity: "14% - 18%",
      bulletMetricRatio: "80%+",
      recommendedSections: ["Summary", "Technical Skills", "Work Experience", "Projects", "Education"],
      maxPageLength: 2,
    },
    topSkills: [
      {
        name: "React 19 & Next.js App Router",
        category: "Core Technical",
        frequency: "95% of JDs",
        importance: "Mandatory",
        description: "Server components, streaming SSR, hook lifecycles, and modern reconciliation.",
      },
      {
        name: "TypeScript (Strict Mode)",
        category: "Core Technical",
        frequency: "94% of JDs",
        importance: "Mandatory",
        description: "Discriminated unions, generics, type narrowing, and strict compile-time safety.",
      },
      {
        name: "Core Web Vitals & Web Performance",
        category: "Architecture & Systems",
        frequency: "87% of JDs",
        importance: "Mandatory",
        description: "LCP optimization, Interaction to Next Paint (INP), CLS prevention, code-splitting, and asset preloading.",
      },
      {
        name: "State Management & Data Layer (TanStack Query, Zustand)",
        category: "Core Technical",
        frequency: "89% of JDs",
        importance: "Mandatory",
        description: "Cache invalidation, optimistic updates, server-state synchronization, and deduplication.",
      },
      {
        name: "CSS Architecture (Tailwind CSS, CSS Modules)",
        category: "Core Technical",
        frequency: "86% of JDs",
        importance: "Mandatory",
        description: "Responsive layouts, container queries, modern CSS variables, and design tokens.",
      },
      {
        name: "Web Accessibility (WCAG 2.1 AA & WAI-ARIA)",
        category: "Practices & Delivery",
        frequency: "82% of JDs",
        importance: "Mandatory",
        description: "Keyboard focus management, screen reader compatibility, ARIA live regions, and color contrast.",
      },
      {
        name: "Component Design Systems (Radix UI, shadcn/ui)",
        category: "Architecture & Systems",
        frequency: "84% of JDs",
        importance: "Highly Preferred",
        description: "Reusable primitives, compound components, theme providers, and Storybook documentation.",
      },
      {
        name: "Frontend Testing (Playwright & Vitest)",
        category: "Practices & Delivery",
        frequency: "85% of JDs",
        importance: "Mandatory",
        description: "End-to-end browser automation, visual regression tests, and fast unit component tests.",
      },
      {
        name: "Build Tooling (Vite, Rollup, Turbopack)",
        category: "Tools & Cloud",
        frequency: "81% of JDs",
        importance: "Highly Preferred",
        description: "Bundle size budgeting, tree shaking, code chunking, and hot module replacement.",
      },
      {
        name: "Browser APIs & Realtime (WebSockets, Web Workers)",
        category: "Core Technical",
        frequency: "73% of JDs",
        importance: "Differentiating",
        description: "Off-thread compute with Web Workers, real-time message feeds, and offline caching.",
      },
    ],
    commonRejectionTraps: [
      {
        trap: "Only listing cosmetic UI styling without web performance metrics",
        whyItFails: "Recruiters and frontend directors discard resumes that look like junior CSS markup. Modern senior frontend roles demand performance engineering (CWV, bundle size, INP).",
        howToFix: "Include metrics for page load speed, LCP drop, bundle size reduction (KB/MB), and checkout or conversion rate lifts.",
      },
      {
        trap: "Ignoring web accessibility (a11y) standards",
        whyItFails: "Automated screening tools look for WCAG and ARIA keywords, which are mandatory compliance requirements for modern tech platforms.",
        howToFix: "Highlight keyboard navigation, screen reader testing, and automated a11y testing with Axe-core in your test suite.",
      },
    ],
    sampleParBullets: [
      {
        title: "Core Web Vitals & Checkout Conversion Lift",
        problem: "E-commerce checkout page suffered a 4.8s Largest Contentful Paint (LCP) and severe layout shifts (CLS > 0.35), causing 24% cart abandonment on mobile.",
        action: "Audited bundle with Vite analyzer, implemented dynamic code-splitting for heavy modal assets, and transitioned image loading to priority next-gen formats.",
        result: "Reduced mobile LCP from 4.8s to 1.4s (70% speedup), achieved 99+ Lighthouse performance score, and lifted checkout conversion by 14.2% ($1.1M ARR).",
        before: "Worked on frontend performance optimization and improved mobile website loading speeds.",
        after: "Optimized mobile checkout Core Web Vitals, dropping LCP from 4.8s to 1.4s (70% faster) and driving a 14.2% lift in completed checkouts ($1.1M ARR).",
      },
      {
        title: "Design System Migration & Engineering Velocity",
        problem: "Inconsistent UI patterns across 4 separate engineering squads led to duplicate components, frequent visual bugs, and slow feature delivery.",
        action: "Architected accessible, token-driven component library with React 19, TypeScript, and Radix UI primitives with 100% Storybook test coverage.",
        result: "Accelerated frontend feature delivery time by 40% and eliminated recurring UI regression tickets across all 4 product squads.",
        before: "Built reusable React UI components and maintained team component library.",
        after: "Engineered tokenized React 19/Radix UI design system adopted by 4 squads, speeding feature delivery by 40% and eliminating visual regression bugs.",
      },
    ],
    sampleResumeTemplate: `ELENA ROSTOVA
Chicago, IL • (555) 567-8901 • elena.rostova@example.com • github.com/elenarostova • linkedin.com/in/elenarostova

SUMMARY
Senior Frontend Engineer with 6+ years of experience building high-performance web applications using React, TypeScript, and modern data-fetching architectures. Proven expertise in Core Web Vitals optimization, accessible design systems (WCAG 2.1 AA), and robust end-to-end testing with Playwright.

TECHNICAL SKILLS
• Core: React 19, TypeScript, JavaScript (ESNext), Next.js, HTML5, CSS3/PostCSS
• State & Data: TanStack Query, Zustand, React Hook Form, Zod, REST & GraphQL
• Styling & Design: Tailwind CSS, Radix UI, shadcn/ui, Storybook, Figma-to-Code
• Performance & Testing: Core Web Vitals (LCP/INP), Playwright, Vitest, Testing Library, Vite

EXPERIENCE
Senior Frontend Engineer | Lumina Digital | 2022 - Present
• Spearheaded frontend architecture rewrite for customer portal serving 2.5M monthly users, cutting initial JS bundle payload by 46%.
• Improved Core Web Vitals across 80+ routes, driving mobile LCP under 1.6s and boosting organic search rankings.
• Implemented end-to-end testing suite in Playwright running in parallel CI, catching 40+ pre-release bugs and maintaining 92% coverage.

Frontend Software Engineer | Kinetic Commerce | 2019 - 2022
• Built dynamic product catalog using React, TypeScript, and TanStack Query with optimistic client caching.
• Led WCAG 2.1 AA accessibility audit, remediating keyboard navigation and screen reader issues to achieve 100% compliance.

EDUCATION
Bachelor of Science in Software Engineering | University of Illinois Urbana-Champaign`,
    faqs: [
      {
        question: "What frontend skills are most scrutinized by technical ATS screeners?",
        answer: "TypeScript (in strict mode), state management (TanStack Query/Zustand), automated testing (Playwright/Vitest), and Core Web Vitals (LCP/INP).",
      },
      {
        question: "Should I include links to live deployed projects or GitHub repos?",
        answer: "Yes, include clickable links to your GitHub profile and production applications in your contact header. Modern ATS parsers preserve and extract clean URLs.",
      },
    ],
  },

  "cloud-architect": {
    title: "Cloud Architect",
    slug: "cloud-architect",
    subtitle: "Enterprise Multi-Cloud, Zero-Trust Security & Distributed Systems",
    description: "Evaluates multi-cloud infrastructure governance, high-availability disaster recovery, zero-trust security postures, cost finops, and distributed scalability.",
    salaryRange: {
      min: 155000,
      max: 260000,
      median: 205000,
      currency: "USD",
      formatted: "$155,000 - $260,000",
    },
    atsBenchmarks: {
      targetScore: 87,
      keywordDensity: "15% - 19%",
      bulletMetricRatio: "85%+",
      recommendedSections: ["Executive Summary", "Architecture Competencies", "Work Experience", "Certifications", "Education"],
      maxPageLength: 2,
    },
    topSkills: [
      {
        name: "Enterprise Multi-Cloud (AWS, Azure, GCP)",
        category: "Architecture & Systems",
        frequency: "95% of JDs",
        importance: "Mandatory",
        description: "Multi-region architecture, hybrid cloud connectivity, direct connect, and cross-cloud disaster recovery.",
      },
      {
        name: "Zero-Trust Security & Identity (IAM, OIDC, KMS)",
        category: "Practices & Delivery",
        frequency: "92% of JDs",
        importance: "Mandatory",
        description: "Role-based access control, cryptographic key management, mutual TLS, and least-privilege policies.",
      },
      {
        name: "Cloud FinOps & Cost Optimization",
        category: "Practices & Delivery",
        frequency: "88% of JDs",
        importance: "Mandatory",
        description: "Savings Plans, Spot orchestration, resource tagging frameworks, and cloud spend forecasting.",
      },
      {
        name: "Disaster Recovery & High Availability (RTO/RPO)",
        category: "Architecture & Systems",
        frequency: "90% of JDs",
        importance: "Mandatory",
        description: "Multi-region active-active architectures, automated failovers, and backup verification drills.",
      },
      {
        name: "Infrastructure as Code at Scale (Terraform, Terragrunt)",
        category: "Tools & Cloud",
        frequency: "91% of JDs",
        importance: "Mandatory",
        description: "Enterprise landing zones, policy-as-code (OPA/Sentinel), and modular workspace hierarchies.",
      },
      {
        name: "Container & Serverless Platforms (EKS, ECS, Lambda)",
        category: "Tools & Cloud",
        frequency: "86% of JDs",
        importance: "Mandatory",
        description: "Event-driven serverless architectures, microservice mesh, and autoscaling compute fabrics.",
      },
      {
        name: "Regulatory Compliance (SOC2, HIPAA, ISO 27001)",
        category: "Practices & Delivery",
        frequency: "84% of JDs",
        importance: "Highly Preferred",
        description: "Audit trail logging, immutable backup vaults, data residency, and compliance automation.",
      },
      {
        name: "Enterprise Networking & Transit Routing",
        category: "Architecture & Systems",
        frequency: "85% of JDs",
        importance: "Mandatory",
        description: "BGP routing, AWS Transit Gateway, Cloudflare edge security, and WAF protection.",
      },
      {
        name: "Data Lakehouse & Streaming Infrastructure",
        category: "Architecture & Systems",
        frequency: "76% of JDs",
        importance: "Highly Preferred",
        description: "Designing multi-tier storage architectures (S3, Snowflake, Kafka) with lifecycle tiering policies.",
      },
      {
        name: "Technical Leadership & Executive RFC Roadmapping",
        category: "Practices & Delivery",
        frequency: "89% of JDs",
        importance: "Mandatory",
        description: "Authoring architectural decision records (ADRs), conducting vendor reviews, and guiding director-level strategy.",
      },
    ],
    commonRejectionTraps: [
      {
        trap: "Looking like a hands-on sysadmin rather than a strategic system architect",
        whyItFails: "Cloud Architect roles require high-level governance, cost management, and executive RFC ownership, not merely rebooting EC2 instances or setting up basic dashboards.",
        howToFix: "Frame achievements around organizational scale: number of engineering squads supported, annual cloud budget managed ($X Millions), and multi-region resilience.",
      },
      {
        trap: "Neglecting FinOps numbers and cost governance",
        whyItFails: "Companies hiring Cloud Architects prioritize financial efficiency alongside technical scalability.",
        howToFix: "State exact dollar figures or percentage savings achieved through architectural governance and compute consolidation.",
      },
    ],
    sampleParBullets: [
      {
        title: "Multi-Region Disaster Recovery & RTO Reduction",
        problem: "Single-region enterprise infrastructure carried unacceptable business risk of extended outage (estimated $400K/hour in revenue loss).",
        action: "Designed active-active multi-region AWS architecture across us-east-1 and us-west-2 with Route 53 latency routing and Aurora Global Database.",
        result: "Reduced Recovery Time Objective (RTO) from 4 hours to under 90 seconds and Recovery Point Objective (RPO) to zero data loss, achieving 99.999% availability.",
        before: "Designed cloud architecture and set up backup disaster recovery systems on AWS.",
        after: "Architected active-active multi-region AWS topology with Aurora Global DB, slashing RTO from 4 hours to under 90 seconds and guaranteeing zero data loss.",
      },
      {
        title: "Enterprise FinOps Governance & Cloud Consolidation",
        problem: "Uncoordinated cloud provisioning across 18 teams resulted in $8.5M annual AWS cloud spend with 32% unutilized capacity.",
        action: "Instituted enterprise FinOps framework: automated idle resource pruning, Spot instance adoption, and multi-year Compute Savings Plans.",
        result: "Cut annual cloud expenditure by $2.4M (28% reduction) within 6 months while supporting 45% workload growth.",
        before: "Helped optimize AWS cloud costs and implemented tagging for different engineering teams.",
        after: "Instituted enterprise FinOps governance across 18 squads, slashing annual cloud expenditure by $2.4M (28%) while supporting 45% workload growth.",
      },
    ],
    sampleResumeTemplate: `DAVID STERLING
Dallas, TX • (555) 678-9012 • david.sterling@example.com • linkedin.com/in/davidsterling

SUMMARY
Principal Cloud Architect with 10+ years of experience directing enterprise cloud transformation, multi-region high availability, and zero-trust security architecture. Managed $15M+ annual cloud budgets and engineered fault-tolerant distributed platforms sustaining 99.999% uptime for Fortune 500 enterprises.

CORE ARCHITECTURE COMPETENCIES
• Cloud Infrastructure: AWS (All Core Services), Microsoft Azure, Google Cloud Platform (GCP)
• Enterprise Architecture: Active-Active Multi-Region, Zero-Trust Security, Disaster Recovery, FinOps
• Automation & Governance: Terraform Enterprise, Policy-as-Code (OPA), Landing Zones, Transit Gateways
• Compliance & Standards: SOC 2 Type II, HIPAA, PCI-DSS, ISO 27001, AWS Well-Architected Framework

EXPERIENCE
Principal Cloud Architect | Apex Global Financial | 2021 - Present
• Led cloud strategy and modernization for 40+ enterprise banking applications across AWS and Azure hybrid environments.
• Engineered zero-trust network topology with mutual TLS and strict IAM boundaries, passing annual SOC2 and PCI-DSS audits with zero findings.
• Implemented automated FinOps governance, shrinking enterprise cloud expenditure by $3.1M annually without impacting performance SLAs.

Senior Cloud Solutions Architect | Vanguard Cloud Partners | 2017 - 2021
• Architected containerized platform on AWS EKS serving 25M daily transactions with sub-80ms p99 latency.
• Created enterprise Terraform landing zone utilized by 200+ developers, standardizing VPC networking, KMS keys, and audit logging.

CERTIFICATIONS
• AWS Certified Solutions Architect – Professional
• AWS Certified Security – Specialty
• Google Cloud Professional Cloud Architect

EDUCATION
Master of Science in Computer Engineering | Texas A&M University`,
    faqs: [
      {
        question: "What is the expected experience level for a Cloud Architect resume?",
        answer: "Cloud Architect roles typically expect 8+ years of total tech experience with at least 3 to 5 years specifically owning cloud strategy, architecture RFCs, and infrastructure budgets.",
      },
      {
        question: "How critical are cloud certifications for Cloud Architect roles?",
        answer: "Extremely critical. Professional-level certifications (e.g. AWS Solutions Architect Professional or Google Professional Cloud Architect) are among the highest-weighted keyword criteria in enterprise ATS systems.",
      },
    ],
  },
};

export const getAllRoles = (): RoleData[] => Object.values(ROLES_DATA);
export const getAllRoleSlugs = (): string[] => Object.keys(ROLES_DATA);
export const getRoleBySlug = (slug: string): RoleData | undefined => ROLES_DATA[slug];
