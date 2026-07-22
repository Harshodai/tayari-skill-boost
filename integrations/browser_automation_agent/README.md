# Browser Automation Agent

> An AI agent that takes a natural language instruction and autonomously navigates the web to complete it using `browser-use` and Playwright.

## Overview

Browser Automation Agent turns plain-English instructions into real browser actions. Describe a task such as _"Find the latest news about AI agents"_ and the agent plans a sequence of steps, drives a real Chromium browser to carry them out, and returns a structured summary of what it found.

Supports multi-provider LLM configuration:
- Orq.ai router (`ORQ_API_KEY`, `ORQ_MODEL`)
- OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`)
- OpenAI (`OPENAI_API_KEY`, `LLM_MODEL`)
- Anthropic (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`)
- Hermes Agent / Ollama / OpenAI-Compatible (`HERMES_AGENT_URL` / `LLM_BASE_URL`)

## Quickstart

```bash
pip install -r requirements.txt
python -m playwright install chromium
python app.py
```
