# Tayari Skill Boost

Tayari Skill Boost is an AI-powered job preparation platform designed to help job seekers optimize their resumes, prepare for interviews, and plan their career roadmaps.

## 🚀 Key Features

- **Resume Optimizer**: AI-driven analysis of resumes against job descriptions to maximize match scores.
- **Interview Prep**: Mock interviews with AI agents .
- **Job Matcher**: Personalized job recommendations .
- **Career Roadmap**: Tailored career path planning and skill gap analysis (Newly Added).
- **Blog & Resources**: Career advice and industry insights.

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Runtime**: [Bun](https://bun.sh/)
- **Infrastructure**: Docker, Docker Compose
- **Backend Services**:
  - **Go API Gateway** (`backend/go`): Handles authentication, routing, and proxies AI requests.
  - **Python AI Engine** (`backend/python`): FastAPI service providing ATS scoring, resume tailoring, cover‑letter generation, and the Hermes job‑scraping pipeline.
  - **PostgreSQL**: Persistent data store for users, jobs, and automation runs.
  - **Redis & Celery**: Task queue for background jobs such as autopilot runs and Hermes scraping.
- **Integration**: Services communicate over HTTP. Frontend calls Go API (`/api/v1/...`), which forwards AI‑intensive requests to the Python service.
- **Optional**: **Ollama** for local LLM inference when `LLM_BASE_URL` points to a local endpoint.


- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Runtime**: [Bun](https://bun.sh/)
- **Infrastructure**: Docker, Docker Compose
- **Backend/Service**: Supabase (Integration)

## ⚙️ Configuration & Feature Flags

The application uses a centralized configuration system for feature management.

- **Config File**: [`src/config/features.ts`](src/config/features.ts)
- **Feature Flags**: Control the visibility and availability of features (e.g., `resumeOptimizer`, `careerRoadmap`).
- **Control**: You can enable/disable features or mark them as "Coming Soon" directly in this file.

## 🐳 Docker Deployment

The application is fully containerized using Docker.

### Prerequisites
- Docker & Docker Compose

### Running with Docker
To build and start the application:

```bash
docker-compose up --build -d
```

The application will be available at **http://localhost:4173**.

**Note on Environment Variables**:
The `.env` file is included in the Docker build context to ensure variables (like Supabase keys) are baked into the static build. This prevents runtime crashes on the client side.

## 💻 Local Development

If you prefer running locally without Docker:

```bash
# Install dependencies
bun install

# Run development server
bun run dev
```

## 🧪 Testing

The project includes unit and integration tests.

### Running Tests Locally
```bash
bun run test
```

### Tests in Docker
Tests are automatically run during the Docker build process.
- **Mocking**: We use `src/test/setup.ts` to mock environment variables (like `VITE_SUPABASE_URL`) during the build to ensure tests pass even without a `.env` file in the CI/CD pipeline (though for local Docker builds, we now include the .env).

## 🧩 Recent Implementations

- **Navigation Scroll Fix**: Implemented `ScrollToTopHandler` to ensure pages start at the top on navigation.
- **Production Visibility**: Offering cards (Resume, Interview, Job Search) now visible in production based on feature flags.
- **Data Persistence**: AutomationContext now persists runs via `localStorage`; added tests.
- **Dynamic Landing Stats**: SocialProofSection fetches real analytics from backend.
- **Documentation**: Added detailed feature flag comments and expanded architecture section.

## ⏭️ Next Steps (Audit Recommendations)

- **Robust Backend Persistence**: Migrate `_autopilot_store` to full DB persistence beyond in‑memory cache.
- **Agentic Automation**: Integrate `browser-use` library for true job‑application automation.
- **Resume Knowledge Graph**: Hook `open-resume` parser to build structured resume graph.
- **Career Intelligence Engine**: Implement skill‑gap analysis, salary benchmarking, trending‑skills radar.
- **Gamification & Habit Loops**: Use `useGamification` hook to track daily streaks, add XP system.
- **Browser Extension**: Complete functional extension for in‑page job saving and AI actions.
- **Managed Cloud Tier**: Provide SaaS deployment option.
- **Comprehensive Test Coverage**: Expand tests for UI components, automation engine, and new features to maintain 80%+ coverage.


- **Navigation Scroll Fix**: Implemented `ScrollToTopHandler` to ensure pages start at the top on navigation.
- **Production Visibility**: Offering cards (Resume, Interview, Job Search) are now visible in production based on feature flags.
