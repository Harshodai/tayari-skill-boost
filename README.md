# Tayari Skill Boost

Tayari Skill Boost is an AI-powered job preparation platform designed to help job seekers optimize their resumes, prepare for interviews, and plan their career roadmaps.

## 🚀 Key Features

- **Resume Optimizer**: AI-driven analysis of resumes against job descriptions to maximize match scores.
- **Interview Prep**: Mock interviews with AI agents (Coming Soon).
- **Job Matcher**: Personalized job recommendations (Coming Soon).
- **Career Roadmap**: Tailored career path planning and skill gap analysis (Newly Added).
- **Blog & Resources**: Career advice and industry insights.

## 🛠 Tech Stack

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

- **Career Roadmap Page**: A new "Coming Soon" style page for career planning.
- **Navigation Scroll Fix**: Implemented `ScrollToTopHandler` to ensure pages start at the top on navigation.
- **Production Visibility**: Offering cards (Resume, Interview, Job Search) are now visible in production based on feature flags.
