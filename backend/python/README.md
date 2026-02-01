# Python AI Engine

Dedicated service for AI/ML workloads including resume parsing and career analytics.

## Structure

```
python/
└── app/
    ├── main.py       # FastAPI entry point
    └── plugins/      # Pluggable AI modules
        └── resume_optimizer/
```

## Key Features

- **Plugin Architecture**: Drop-in AI modules
- **FastAPI**: High-performance async API
- **Isolated Workloads**: Heavy ML runs here, not in Go

## Development

```bash
# Install dependencies
cd backend/python
pip install -r requirements.txt

# Run locally
uvicorn app.main:app --reload --port 8000

# Or via Docker
docker-compose up backend-ai
```

## Adding New AI Plugins

1. Create folder in `plugins/`
2. Add `main.py` with FastAPI router
3. Export router - auto-discovered on startup

## API Endpoints

- `GET /health` - Health check
- `POST /api/v1/resume_optimizer/analyze` - Analyze resume against job description
