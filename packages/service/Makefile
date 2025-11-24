# Makefile for BPT Service

.PHONY: help install build test lint format clean dev prod deploy

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)BPT Service - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

setup: install ## Run full setup
	@echo "$(BLUE)Running setup...$(NC)"
	./setup.sh

build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	./build.sh all

build-prod: ## Build production image only
	@echo "$(BLUE)Building production image...$(NC)"
	./build.sh prod

build-dev: ## Build development image only
	@echo "$(BLUE)Building development image...$(NC)"
	./build.sh dev

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	npm test

test-unit: ## Run unit tests
	@echo "$(BLUE)Running unit tests...$(NC)"
	npm run test:unit

test-integration: ## Run integration tests
	@echo "$(BLUE)Running integration tests...$(NC)"
	npm run test:integration

test-api: ## Run API tests
	@echo "$(BLUE)Running API tests...$(NC)"
	npm run test:api

test-coverage: ## Run tests with coverage
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	npm run test:coverage

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

lint-fix: ## Fix linting errors
	@echo "$(BLUE)Fixing linting errors...$(NC)"
	npm run lint:fix

format: ## Format code
	@echo "$(BLUE)Formatting code...$(NC)"
	npm run format

format-check: ## Check code formatting
	@echo "$(BLUE)Checking code formatting...$(NC)"
	npm run format:check

clean: ## Clean generated files
	@echo "$(BLUE)Cleaning...$(NC)"
	rm -rf node_modules coverage .nyc_output
	docker-compose down -v
	@echo "$(GREEN)✓ Cleaned$(NC)"

dev: ## Start development server
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

dev-docker: ## Start development server with Docker
	@echo "$(BLUE)Starting development environment with Docker...$(NC)"
	docker-compose --profile dev up

prod: ## Start production server locally
	@echo "$(BLUE)Starting production server...$(NC)"
	npm start

prod-docker: ## Start production with Docker
	@echo "$(BLUE)Starting production environment with Docker...$(NC)"
	docker-compose up -d

deploy: ## Deploy to production
	@echo "$(BLUE)Deploying to production...$(NC)"
	./deploy.sh production

deploy-dev: ## Deploy development environment
	@echo "$(BLUE)Deploying development environment...$(NC)"
	./deploy.sh development

redis: ## Start Redis only
	@echo "$(BLUE)Starting Redis...$(NC)"
	docker-compose up redis -d

logs: ## View logs
	docker-compose logs -f

stop: ## Stop all services
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose down

restart: ## Restart all services
	@echo "$(BLUE)Restarting all services...$(NC)"
	docker-compose restart

ps: ## Show running containers
	docker-compose ps

shell: ## Open shell in app container
	docker-compose exec app sh

redis-cli: ## Open Redis CLI
	docker-compose exec redis redis-cli

quality: lint format-check test-coverage ## Run all quality checks

ci: quality build ## Run CI pipeline locally

.PHONY: install setup build build-prod build-dev test test-unit test-integration test-api test-coverage
.PHONY: lint lint-fix format format-check clean dev dev-docker prod prod-docker deploy deploy-dev
.PHONY: redis logs stop restart ps shell redis-cli quality ci help
