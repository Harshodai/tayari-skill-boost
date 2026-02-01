from fastapi import FastAPI
from app.plugins import register_plugins

app = FastAPI()

# Health Check
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "python-ai-engine"}

# Load Plugins
register_plugins(app)
