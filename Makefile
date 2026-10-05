COMPOSE     = docker compose
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml

# Read SERVER_NAME / HTTPS_PORT from .env so we can print the URL.
-include .env
URL = https://$(or $(SERVER_NAME),localhost):$(or $(HTTPS_PORT),8443)

.PHONY: all up dev down logs ps db studio clean re

all: up

.env:
	cp .env.example .env
	@echo "Created .env from .env.example – change the secrets before deploying."

## up: build and start the production-like stack (single command for evaluation)
up: .env
	$(COMPOSE) up --build -d
	@printf "\n  Dev Pulse is running at $(URL)\n\n"

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

re: clean up
