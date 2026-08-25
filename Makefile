# ==============================================================================
# Tayari Skill Boost - Development & Operations Automation Makefile
# ==============================================================================

.PHONY: help up down build rebuild restart logs ps clean \
        build-frontend build-backend build-python \
        dev-frontend dev-backend dev-python \
        test test-frontend test-backend test-python test-e2e \
        compile build-local lint audit baseline todo-status staging-integration staging-integration-plan staging-integration-contract

# Default target when calling `make` without arguments
.DEFAULT_GOAL := help

# Colors for terminal output formatting
CYAN    := \033[36m
GREEN   := \033[32m
YELLOW  := \033[33m
BLUE    := \033[34m
RESET   := \033[0m

# Prefer the repository-managed Python runtime when present. The codebase uses
# Python 3.10+ type syntax, so falling back to an older system interpreter can
# make the audit fail during test collection before any test runs.
PYTHON  ?= $(if $(wildcard backend/python/.venv/bin/python),backend/python/.venv/bin/python,python3)

## -----------------------------------------------------------------------------
## 💡 Help & Info
## -----------------------------------------------------------------------------

help: ## Display this auto-generated help menu
	@echo ""
	@echo "$(CYAN)Tayari Skill Boost Automation Tooling$(RESET)"
	@echo "$(YELLOW)Usage: make [target]$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

## -----------------------------------------------------------------------------
## 🐳 Docker Orchestration
## -----------------------------------------------------------------------------

up: ## Start all Docker containers in background
	@echo "$(BLUE)Starting Tayari microservices...$(RESET)"
	docker compose up -d
	@echo "$(GREEN)All microservices started successfully!$(RESET)"

down: ## Stop and remove all running Docker containers
	@echo "$(YELLOW)Stopping all microservices...$(RESET)"
	docker compose down
	@echo "$(GREEN)Containers stopped.$(RESET)"

build: ## Build all Docker container images
	@echo "$(BLUE)Building Docker container images...$(RESET)"
	docker compose build

rebuild: ## Rebuild all images and restart containers in background
	@echo "$(BLUE)Rebuilding and restarting all microservices...$(RESET)"
	docker compose build && docker compose up -d
	@echo "$(GREEN)Rebuild and deployment complete!$(RESET)"

restart: ## Restart all running containers
	@echo "$(YELLOW)Restarting containers...$(RESET)"
	docker compose restart

logs: ## Tail live logs for all microservices (Ctrl+C to exit)
	docker compose logs -f

ps: ## View status of all Docker containers
	docker compose ps

clean: ## Stop containers, remove volumes, networks, and orphan containers
	@echo "$(YELLOW)Cleaning up Docker resources...$(RESET)"
	docker compose down -v --remove-orphans
	@echo "$(GREEN)Clean completed.$(RESET)"

## -----------------------------------------------------------------------------
## 📦 Microservice Builds (Selective Container Rebuilds)
## -----------------------------------------------------------------------------

build-frontend: ## Rebuild and restart only the frontend container
	@echo "$(BLUE)Rebuilding Frontend container...$(RESET)"
	docker compose build frontend && docker compose up -d --no-deps frontend
	@echo "$(GREEN)Frontend container updated.$(RESET)"

build-backend: ## Rebuild and restart only the Go backend container
	@echo "$(BLUE)Rebuilding Go Backend container...$(RESET)"
	docker compose build go-backend && docker compose up -d --no-deps go-backend
	@echo "$(GREEN)Go Backend container updated.$(RESET)"

build-python: ## Rebuild and restart only the Python AI container
	@echo "$(BLUE)Rebuilding Python AI container...$(RESET)"
	docker compose build python-ai && docker compose up -d --no-deps python-ai
	@echo "$(GREEN)Python AI container updated.$(RESET)"

## -----------------------------------------------------------------------------
## 💻 Local Development (Bare-Metal / No Docker)
## -----------------------------------------------------------------------------

dev-frontend: ## Run Vite dev server for frontend
	npm run dev

dev-backend: ## Run Go API server locally
	cd backend/go && go run ./cmd/server

dev-python: ## Run Python FastAPI engine locally
	cd backend/python && uvicorn app.main:app --reload --port 8000

## -----------------------------------------------------------------------------
## 🧪 Testing & Validation
## -----------------------------------------------------------------------------

test: test-backend test-frontend ## Run all unit & integration tests

test-frontend: ## Run frontend test suite
	npm test

test-backend: ## Run Go backend unit tests
	@echo "$(BLUE)Running Go backend tests...$(RESET)"
	cd backend/go && go test -v ./...

test-python: ## Run Python AI tests in container
	@echo "$(BLUE)Running Python tests inside container...$(RESET)"
	docker compose exec python-ai pytest

test-e2e: ## Run Playwright end-to-end tests
	@echo "$(BLUE)Running E2E tests...$(RESET)"
	npx playwright test

## -----------------------------------------------------------------------------
## 🔨 Compilation & Quality Checks
## -----------------------------------------------------------------------------

compile: ## Verify compilation of both Go backend and React frontend
	@echo "$(BLUE)Checking Go backend compilation...$(RESET)"
	cd backend/go && go build -v ./...
	@echo "$(BLUE)Checking React frontend compilation...$(RESET)"
	npm run build
	@echo "$(GREEN)Compilation check passed!$(RESET)"

build-local: compile ## Alias for compile

lint: ## Run linter checks for frontend and Go code
	@echo "$(BLUE)Linting frontend...$(RESET)"
	pnpm run lint
	@echo "$(BLUE)Linting Go code...$(RESET)"
	cd backend/go && go vet ./...

audit: ## Run complete security scan, typecheck, unit, integration, and build verification
	@echo "$(BLUE)Running production security scan...$(RESET)"
	SECURITY_BASELINE_ENFORCE=true node scripts/security_scan.mjs
	@echo "$(BLUE)Running frontend lint (fail-closed)...$(RESET)"
	pnpm run lint
	@echo "$(BLUE)Running frontend Vitest suite...$(RESET)"
	pnpm run test
	@echo "$(BLUE)Running Go backend test suite...$(RESET)"
	cd backend/go && go test ./... && go vet ./...
	@echo "$(BLUE)Running Python AI test suite...$(RESET)"
	PYTHONPATH=backend/python $(PYTHON) -m pytest -q backend/python/app/tests backend/python/tests
	@echo "$(BLUE)Running frontend production build...$(RESET)"
	pnpm run build
	@echo "$(BLUE)Running production promotion contract...$(RESET)"
	pnpm run promotion:gate
	@echo "$(BLUE)Running staging gate safety contract...$(RESET)"
	bash scripts/staging_integration_gate_contract_test.sh
	@echo "$(GREEN)All audit checks and test suites passed successfully!$(RESET)"

baseline: ## Capture static readiness and environment-gate evidence without mutation
	bash scripts/repository_baseline.sh

todo-status: ## Report all unchecked remediation TODOs without contacting services
	python3 scripts/verify_todos_status.py

staging-integration: ## Run the live non-production DB/Auth/Redis integration gate
	./scripts/staging_integration_gate.sh

staging-integration-plan: ## Print staging prerequisites without contacting services
	./scripts/staging_integration_gate.sh --plan

staging-integration-contract: ## Verify staging gate safety and configuration contracts
	bash scripts/staging_integration_gate_contract_test.sh
