# =============================================================================
# Multi-stage Dockerfile for ft_transcendence monorepo
# Supports: api-gateway, auth-service, workspace-service, web
# =============================================================================

# =============================================================================
# BASE STAGE - Common base for all stages
# =============================================================================
FROM node:22-alpine AS base

# Install build dependencies and pnpm
RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

WORKDIR /app

# =============================================================================
# DEPS STAGE - Install all dependencies with caching
# =============================================================================
FROM base AS deps

# Copy workspace config first for better caching
COPY pnpm-workspace.yaml package.json ./
# Copy lockfile if it exists (optional for fresh builds)
COPY pnpm-lock.yam* ./

# Copy all package.json files for workspaces
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/web/package.json ./apps/web/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/workspace-service/package.json ./services/workspace-service/
COPY packages/database/package.json ./packages/database/
COPY packages/backend-common/package.json ./packages/backend-common/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/eslint-config/package.json ./packages/config/eslint-config/
COPY packages/config/typescript-config/package.json ./packages/config/typescript-config/

# Install dependencies with cache mount for faster rebuilds
# Use --no-frozen-lockfile to allow lockfile generation on fresh builds
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install

# =============================================================================
# PRISMA STAGE - Generate Prisma client
# =============================================================================
FROM deps AS prisma

# Copy prisma schema and generate client
COPY prisma ./prisma
COPY packages/database ./packages/database

RUN cd packages/database && pnpm prisma:generate

# =============================================================================
# BUILDER STAGE - Build all packages
# =============================================================================
FROM prisma AS builder

# Copy all source code
COPY . .

# Clean incremental build caches and build shared packages
RUN find . -name 'tsconfig.tsbuildinfo' -delete
RUN pnpm --filter @ft-trans/database build
RUN pnpm --filter @ft-trans/backend-common build
RUN pnpm --filter @dev-pulse/shared-types build

# =============================================================================
# API-GATEWAY BUILD
# =============================================================================
FROM builder AS api-gateway-builder

RUN pnpm --filter api-gateway build

# =============================================================================
# AUTH-SERVICE BUILD
# =============================================================================
FROM builder AS auth-service-builder

RUN pnpm --filter @ft-trans/auth-service build

# =============================================================================
# WORKSPACE-SERVICE BUILD
# =============================================================================
FROM builder AS workspace-service-builder

RUN pnpm --filter @ft-trans/workspace-service build

# =============================================================================
# WEB BUILD
# =============================================================================
FROM builder AS web-builder

# Build Next.js app
RUN pnpm --filter web build

# =============================================================================
# API-GATEWAY PRODUCTION
# =============================================================================
FROM base AS api-gateway

ENV NODE_ENV=production

WORKDIR /app

# Copy package files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/apps/api-gateway/package.json ./apps/api-gateway/
COPY --from=deps /app/packages ./packages

# Copy Prisma generated client
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/prisma ./prisma

# Copy built application
COPY --from=api-gateway-builder /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/backend-common/dist ./packages/backend-common/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

WORKDIR /app/apps/api-gateway

EXPOSE 4000

CMD ["node", "dist/main.js"]

# =============================================================================
# AUTH-SERVICE PRODUCTION
# =============================================================================
FROM base AS auth-service

ENV NODE_ENV=production

WORKDIR /app

# Copy package files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/services/auth-service/package.json ./services/auth-service/
COPY --from=deps /app/packages ./packages

# Copy Prisma generated client
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/prisma ./prisma

# Copy built application
COPY --from=auth-service-builder /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/backend-common/dist ./packages/backend-common/dist

WORKDIR /app/services/auth-service

EXPOSE 3001

CMD ["node", "dist/main.js"]

# =============================================================================
# WORKSPACE-SERVICE PRODUCTION
# =============================================================================
FROM base AS workspace-service

ENV NODE_ENV=production

WORKDIR /app

# Copy package files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/services/workspace-service/package.json ./services/workspace-service/
COPY --from=deps /app/packages ./packages

# Copy Prisma generated client
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/prisma ./prisma

# Copy built application
COPY --from=workspace-service-builder /app/services/workspace-service/dist ./services/workspace-service/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/backend-common/dist ./packages/backend-common/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

WORKDIR /app/services/workspace-service

EXPOSE 3002

CMD ["node", "dist/main.js"]

# =============================================================================
# WEB PRODUCTION (Next.js standalone)
# =============================================================================
FROM base AS web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Copy standalone build
COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]

# =============================================================================
# DEVELOPMENT STAGES
# =============================================================================

# API-GATEWAY DEV
FROM builder AS api-gateway-dev

WORKDIR /app/apps/api-gateway

EXPOSE 4000

CMD ["pnpm", "run", "dev"]

# AUTH-SERVICE DEV
FROM builder AS auth-service-dev

WORKDIR /app/services/auth-service

EXPOSE 3001

CMD ["pnpm", "run", "dev"]

# WORKSPACE-SERVICE DEV
FROM builder AS workspace-service-dev

WORKDIR /app/services/workspace-service

EXPOSE 3002

CMD ["pnpm", "run", "dev"]

# WEB DEV
FROM deps AS web-dev

WORKDIR /app

COPY . .

RUN pnpm --filter @dev-pulse/shared-types build

WORKDIR /app/apps/web

ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["pnpm", "run", "dev"]
