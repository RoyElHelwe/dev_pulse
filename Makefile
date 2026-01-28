# =============================================================================
# Makefile for Docker-based development
# No local Node.js required - everything runs in containers
# =============================================================================

.PHONY: help setup install build dev down logs clean prisma-generate prisma-migrate prisma-push prisma-studio test lint

# Default target
help:
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║           ft_transcendence - Docker Development                  ║"
	@echo "╠══════════════════════════════════════════════════════════════════╣"
	@echo "║ Setup Commands:                                                  ║"
	@echo "║   make setup          - First time setup (install + generate)   ║"
	@echo "║   make install        - Install all dependencies                ║"
	@echo "║                                                                  ║"
	@echo "║ Development Commands:                                           ║"
	@echo "║   make dev            - Start all services in dev mode          ║"
	@echo "║   make down           - Stop all services                       ║"
	@echo "║   make logs           - View logs (all services)                ║"
	@echo "║   make logs-api       - View API Gateway logs                   ║"
	@echo "║   make logs-auth      - View Auth Service logs                  ║"
	@echo "║   make logs-workspace - View Workspace Service logs             ║"
	@echo "║   make logs-web       - View Web logs                           ║"
	@echo "║                                                                  ║"
	@echo "║ Database Commands:                                              ║"
	@echo "║   make prisma-generate - Generate Prisma client                 ║"
	@echo "║   make prisma-migrate  - Run database migrations                ║"
	@echo "║   make prisma-push     - Push schema to database                ║"
	@echo "║   make prisma-studio   - Open Prisma Studio                     ║"
	@echo "║   make db-reset        - Reset database                         ║"
	@echo "║                                                                  ║"
	@echo "║ Build Commands:                                                 ║"
	@echo "║   make build          - Build all Docker images                 ║"
	@echo "║   make build-prod     - Build production images                 ║"
	@echo "║                                                                  ║"
	@echo "║ Testing Commands:                                               ║"
	@echo "║   make test           - Run all tests                           ║"
	@echo "║   make lint           - Run linting                             ║"
	@echo "║                                                                  ║"
	@echo "║ Cleanup Commands:                                               ║"
	@echo "║   make clean          - Remove containers and volumes           ║"
	@echo "║   make clean-all      - Remove everything including images      ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"

# =============================================================================
# SETUP
# =============================================================================

# First time setup
setup: install ssl-certs prisma-generate
	@echo "✅ Setup complete! Run 'make dev' to start development"

# Generate SSL certificates for HTTPS
ssl-certs:
	@echo "🔐 Generating SSL certificates..."
	@chmod +x scripts/generate-ssl-cert.sh
	@./scripts/generate-ssl-cert.sh
	@echo "✅ SSL certificates generated"

# Install dependencies using Docker
install:
	@echo "📦 Installing dependencies..."
	docker run --rm -v $(PWD):/app -w /app node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm install"
	@echo "✅ Dependencies installed"

# =============================================================================
# DEVELOPMENT
# =============================================================================

# Start all services
dev: prisma-generate
	@echo "🚀 Starting development environment..."
	docker compose up -d postgres redis nats mailpit
	@echo "⏳ Waiting for database to be ready..."
	@sleep 5
	@$(MAKE) prisma-push
	docker compose up -d --build
	
# Start services in background
dev-bg:
	docker compose up -d --build
	@echo "✅ Services started in background. Use 'make logs' to view logs"

# Stop all services
down:
	docker compose down
	@echo "✅ Services stopped"

# View logs
logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api-gateway

logs-auth:
	docker compose logs -f auth-service

logs-workspace:
	docker compose logs -f workspace-service

logs-web:
	docker compose logs -f web

# =============================================================================
# DATABASE / PRISMA
# =============================================================================

# Generate Prisma client locally
prisma-generate:
	@echo "🔧 Generating Prisma client locally..."
	docker run --rm -v $(PWD):/app -w /app node:22-alpine sh -c "\
		apk add --no-cache openssl && \
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm prisma generate --schema=prisma/schema.prisma"
	@echo "✅ Prisma client generated locally"

# Run migrations
prisma-migrate:
	@echo "🔄 Running database migrations..."
	docker run --rm -v $(PWD):/app -w /app --network ft_trans_network \
		-e DATABASE_URL=postgresql://dev:dev@postgres:5432/ft_trans \
		node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		cd packages/database && \
		pnpm prisma migrate dev --schema=../../prisma/schema.prisma"
	@echo "✅ Migrations complete"

# Push schema to database (no migrations)
prisma-push:
	@echo "📤 Pushing schema to database..."
	docker run --rm -v $(PWD):/app -w /app --network dev_pulse_ft_trans_network \
		-e DATABASE_URL=postgresql://dev:dev@postgres:5432/ft_trans \
		node:22-alpine sh -c "\
		apk add --no-cache openssl && \
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		cd packages/database && \
		pnpm prisma db push --schema=../../prisma/schema.prisma --accept-data-loss"
	@echo "✅ Schema pushed"

# Open Prisma Studio
prisma-studio:
	@echo "🎨 Opening Prisma Studio on http://localhost:5555..."
	docker run --rm -it -v $(PWD):/app -w /app --network dev_pulse_ft_trans_network \
		-e DATABASE_URL=postgresql://dev:dev@postgres:5432/ft_trans \
		-p 5555:5555 \
		node:22-alpine sh -c "\
		apk add --no-cache openssl && \
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		cd packages/database && \
		pnpm prisma studio --schema=../../prisma/schema.prisma --port 5555 --browser none"

# Reset database
db-reset:
	@echo "⚠️  Resetting database (all data will be lost)..."
	docker compose down -v postgres
	docker compose up -d postgres
	@sleep 5
	@$(MAKE) prisma-push
	@echo "✅ Database reset complete"

# =============================================================================
# BUILD
# =============================================================================

# Build all images
build:
	@echo "🏗️  Building Docker images..."
	docker compose build
	@echo "✅ Build complete"

# Build production images
build-prod:
	@echo "🏗️  Building production images..."
	DOCKER_BUILDKIT=1 docker compose -f docker-compose.yml -f docker-compose.prod.yml build
	@echo "✅ Production build complete"

# =============================================================================
# TESTING
# =============================================================================

# Run tests
test:
	@echo "🧪 Running tests..."
	docker run --rm -v $(PWD):/app -w /app node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm install --frozen-lockfile && \
		pnpm test"
	@echo "✅ Tests complete"

# Run specific package tests
test-database:
	docker run --rm -v $(PWD):/app -w /app node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm install --frozen-lockfile && \
		pnpm --filter @ft-trans/database test"

test-backend-common:
	docker run --rm -v $(PWD):/app -w /app node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm install --frozen-lockfile && \
		pnpm --filter @ft-trans/backend-common test"

# Run linting
lint:
	@echo "🔍 Running linter..."
	docker run --rm -v $(PWD):/app -w /app node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm install --frozen-lockfile && \
		pnpm lint"
	@echo "✅ Linting complete"

# Type check
type-check:
	@echo "📝 Running type check..."
	docker run --rm -v $(PWD):/app -w /app node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm type-check"
	@echo "✅ Type check complete"

# =============================================================================
# CLEANUP
# =============================================================================

# Clean containers and volumes
clean:
	@echo "🧹 Cleaning up..."
	docker compose down -v --remove-orphans
	@echo "✅ Cleanup complete"

# Clean everything including images and node_modules
clean-all: clean
	@echo "🧹 Deep cleaning..."
	docker compose down --rmi all
	docker run --rm -v $(PWD):/app -w /app alpine sh -c "\
		rm -rf node_modules */node_modules */*/node_modules"
	@echo "✅ Deep cleanup complete"

# =============================================================================
# UTILITIES
# =============================================================================

# Shell into a running container
shell-api:
	docker compose exec api-gateway sh

shell-auth:
	docker compose exec auth-service sh

shell-workspace:
	docker compose exec workspace-service sh

shell-web:
	docker compose exec web sh

shell-db:
	docker compose exec postgres psql -U dev -d ft_trans

# Run arbitrary pnpm commands
pnpm:
	@docker run --rm -it -v $(PWD):/app -w /app node:22-alpine sh -c "\
		corepack enable && \
		corepack prepare pnpm@9.14.4 --activate && \
		pnpm $(filter-out $@,$(MAKECMDGOALS))"

# Prevent make from interpreting arguments as targets
%:
	@:
