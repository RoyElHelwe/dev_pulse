# Dev Pulse project management Makefile.
# Used for build, startup, development, log inspection, and teardown workflows.
# Wires db (PostgreSQL), api (NestJS), web (Next.js), proxy (nginx), and the email service
# (postfix + email-api) via Docker Compose.
COMPOSE     = docker compose
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml

# Read SERVER_NAME / HTTPS_PORT from .env so we can print the URL.
-include .env
URL = https://$(or $(SERVER_NAME),localhost):$(or $(HTTPS_PORT),8443)

.PHONY: all up dev down logs ps db studio clean re

## all: build and start the production-like stack in the background (default target)
all: up

## .env: create local .env from .env.example with random secrets if missing
# First run: copy the example and fill the secrets with random values.
.env:
	cp .env.example .env
	@sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$$(head -c 24 /dev/urandom | base64 | tr -d '\n/+=')|" .env
	@sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$$(head -c 48 /dev/urandom | base64 | tr -d '\n/+=')|" .env
	@sed -i.bak "s|^EMAIL_API_KEY=.*|EMAIL_API_KEY=$$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')|" .env
	@rm -f .env.bak
	@echo "Created .env with random secrets."

## up: build and start the production-like stack (single command for evaluation)
up: .env
	$(COMPOSE) up --build -d
	@printf "\n  Dev Pulse is running at $(URL)\n"
	@printf "  Email API is running at http://127.0.0.1:$(or $(EMAIL_API_PORT),8025)\n\n"

## dev: start with hot reload (code changes apply without rebuilding)
dev: .env
	@printf "\n  Dev Pulse (dev) will be at $(URL)\n\n"
	$(COMPOSE_DEV) up --build --renew-anon-volumes

## down: stop everything (data is kept)
down:
	$(COMPOSE_DEV) down

## logs: follow logs of all services (make logs s=api for one)
logs:
	$(COMPOSE_DEV) logs -f $(s)

## ps: list running containers and their status across the dev stack
ps:
	$(COMPOSE_DEV) ps

## db: push prisma/schema.prisma changes to the database (dev) and restart api
db:
	$(COMPOSE_DEV) restart api

## studio: open Prisma Studio at http://localhost:5555 (dev only)
studio:
	$(COMPOSE_DEV) exec api pnpm db:studio

## clean: stop everything AND delete the database + certificates
clean:
	$(COMPOSE_DEV) down -v --remove-orphans

## re: clean all containers and volumes, then rebuild and start the production stack
re: clean up
