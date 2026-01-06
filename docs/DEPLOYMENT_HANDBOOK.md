# 🌩️ ft_transcendence — Google Cloud Deployment Handbook

> **Official deployment documentation for the ft_transcendence collaborative workspace platform**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Google Cloud Services](#google-cloud-services)
4. [Prerequisites](#prerequisites)
5. [Phase 1: Critical Setup](#phase-1-critical-setup)
6. [Phase 2: High Priority Configuration](#phase-2-high-priority-configuration)
7. [Phase 3: Optimization](#phase-3-optimization)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Environment Variables Reference](#environment-variables-reference)
10. [Cost Summary](#cost-summary)
11. [Rollback Strategy](#rollback-strategy)
12. [Quick Reference](#quick-reference)

---

## Overview

**ft_transcendence** is a real-time collaborative workspace featuring a 2D virtual office. This handbook guides you through deploying the application on Google Cloud Platform, optimized for the **$300 free trial credit (3 months)**.

### Application Components

| Service | Port | Technology | Purpose |
|---------|------|-----------|---------|
| **web** | 3000 | Next.js 16 + Phaser.js | Frontend with 2D virtual office |
| **api-gateway** | 4000 | NestJS + Socket.io | REST API and WebSocket connections |
| **auth-service** | 3001 | NestJS + Better Auth | Authentication, 2FA, OAuth |
| **workspace-service** | 3002 | NestJS + Prisma | Workspace and team management |
| **nats** | 4222 | NATS JetStream | Microservice communication |

---

## Architecture

```
                                    INTERNET
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
        ┌───────────────────────┐           ┌───────────────────────────┐
        │    CLOUD RUN: WEB     │           │  CLOUD RUN: API-GATEWAY   │
        │   Port: 3000          │           │  Port: 4000               │
        │   Next.js 16          │    ◄──────│  NestJS + Socket.io       │
        │   output: standalone  │   HTTP    │  Redis Adapter            │
        │   Scale: 0-10         │           │  Scale: 1-5 (always-on)   │
        └───────────────────────┘           └─────────────┬─────────────┘
                                                          │
                                    ┌─────────NATS────────┼─────────────────┐
                                    │      (Secured)      │                 │
                                    ▼                     ▼                 ▼
            ┌───────────────────────────┐   ┌────────────────────┐   ┌─────────────────────┐
            │  CLOUD RUN: AUTH-SERVICE  │   │  CLOUD RUN: NATS   │   │  WORKSPACE-SERVICE  │
            │  Port: 3001               │   │  Port: 4222        │   │  Port: 3002         │
            │  Scale: 0-3               │   │  Scale: 1          │   │  Scale: 0-3         │
            └─────────────┬─────────────┘   └────────────────────┘   └──────────┬──────────┘
                          │                                                      │
                          └───────────────────────┬──────────────────────────────┘
                                                  │
                                    ┌─────────────▼─────────────┐
                                    │     VPC CONNECTOR         │
                                    │  (1 min / 3 max instance) │
                                    └─────────────┬─────────────┘
                                                  │
                        ┌─────────────────────────┼─────────────────────────┐
                        │                         │                         │
                        ▼                         ▼                         ▼
            ┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
            │    CLOUD SQL      │     │      REDIS        │     │  SECRET MANAGER   │
            │  PostgreSQL 16    │     │  Memorystore      │     │  All credentials  │
            │  3 Databases:     │     │  (Basic tier)     │     │  stored here      │
            │  gateway/auth/    │     │                   │     │                   │
            │  workspace        │     │                   │     │                   │
            └───────────────────┘     └───────────────────┘     └───────────────────┘
```

---

## Google Cloud Services

### Cloud Run Configuration

| Service | Min | Max | Memory | CPU Throttling | Session Affinity | Port |
|---------|-----|-----|--------|----------------|------------------|------|
| web | 0 | 10 | 512Mi | Yes | No | 3000 |
| api-gateway | 1 | 5 | 1Gi | **No** | **Yes** | 4000 |
| auth-service | 0 | 3 | 512Mi | Yes | No | 3001 |
| workspace-service | 0 | 3 | 512Mi | Yes | No | 3002 |
| nats | 1 | 1 | 256Mi | Yes | No | 4222 |

**Important**: Cloud Run uses the `$PORT` environment variable. All services must listen on this port.

---

## Prerequisites

```bash
# Install and configure gcloud CLI
gcloud version
gcloud auth login
gcloud config set project ft-transcendence-prod
```

---

## Phase 1: Critical Setup

> **Complete all steps in this phase before any deployment**

### 1.1 Project and APIs

```bash
# Create project
gcloud projects create ft-transcendence-prod --name="FT Transcendence"
gcloud config set project ft-transcendence-prod

# Link billing
gcloud billing projects link ft-transcendence-prod --billing-account=YOUR_BILLING_ACCOUNT_ID

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com
```

---

### 1.2 Database Strategy & Connection Pooling

We will use **Separate Databases** (Option B) for isolation and simplicity. Each service will connect to its own logical database within the Cloud SQL instance.

#### Step 1: specific Connection Pooling (Required for Cloud Run)

Cloud Run services can exhaust database connections quickly. Configure Prisma to handle this.

**Action**: Update `schema.prisma` in **ALL** services (`api-gateway`, `auth-service`, `workspace-service`).

Change the `datasource` block to include `relationMode = "prisma"`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

> **Note**: Remove any `previewFeatures` or `relationMode` lines. We use standard PostgreSQL configuration. Connection pooling is handled via the connection string URL parameters.

#### Step 2: Regenerate Prisma Clients

```bash
cd apps/api-gateway && pnpm prisma generate
cd ../../services/auth-service && pnpm prisma generate
cd ../workspace-service && pnpm prisma generate
```

---

### 1.3 WebSocket Redis Adapter

Install dependencies:
```bash
cd apps/api-gateway
pnpm add @socket.io/redis-adapter redis
```

**File**: `apps/api-gateway/src/websocket/websocket.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [],
    credentials: true,
  },
})
export class WebsocketGateway 
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy 
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  private pubClient: RedisClientType;
  private subClient: RedisClientType;

  async afterInit(server: Server) {
    if (process.env.REDIS_URL) {
      try {
        this.pubClient = createClient({ url: process.env.REDIS_URL });
        this.subClient = this.pubClient.duplicate();

        this.pubClient.on('error', (err) => this.logger.error('Redis Pub Error', err));
        this.subClient.on('error', (err) => this.logger.error('Redis Sub Error', err));

        await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
        server.adapter(createAdapter(this.pubClient, this.subClient));
        
        this.logger.log('WebSocket Redis adapter initialized');
      } catch (error) {
        this.logger.error('Redis adapter failed', error);
      }
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Graceful shutdown - required for Cloud Run
  async onModuleDestroy() {
    this.logger.log('Shutting down WebSocket gateway...');
    
    if (this.pubClient) {
      await this.pubClient.quit();
    }
    if (this.subClient) {
      await this.subClient.quit();
    }
    
    this.logger.log('Redis connections closed');
  }
}
```

---

### 1.4 Next.js Standalone Output

**File**: `apps/web/next.config.ts`

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ft-trans/frontend-shared'],
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  webpack: (config: any) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      phaser: 'phaser/dist/phaser.js',
    }
    return config
  },
}

export default nextConfig
```

---

### 1.5 Application Port Configuration

All NestJS services must respect the `$PORT` environment variable:

**Update**: `apps/api-gateway/src/main.ts`

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ... configuration
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`API Gateway listening on port ${port}`);
}
```

**Update**: `services/auth-service/src/main.ts`

```typescript
const port = process.env.PORT || 3001;
await app.listen(port);
```

**Update**: `services/workspace-service/src/main.ts`

```typescript
const port = process.env.PORT || 3002;
await app.listen(port);
```

---

### 1.6 Production Dockerfiles

#### Web Frontend

**File**: `docker/Dockerfile.web.prod`

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Include package.json for runtime
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

#### API Gateway

**File**: `docker/Dockerfile.gateway.prod`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api-gateway ./apps/api-gateway

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/api-gateway
RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Include package.json for runtime
COPY --from=builder /app/apps/api-gateway/package.json ./package.json
COPY --from=builder /app/apps/api-gateway/dist ./dist
COPY --from=builder /app/apps/api-gateway/prisma ./prisma
COPY --from=builder /app/apps/api-gateway/node_modules ./node_modules
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

EXPOSE 4000
CMD ["node", "dist/main.js"]
```

#### Auth Service

**File**: `docker/Dockerfile.auth.prod`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/auth-service ./services/auth-service

RUN pnpm install --frozen-lockfile

WORKDIR /app/services/auth-service
RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Include package.json for runtime
COPY --from=builder /app/services/auth-service/package.json ./package.json
COPY --from=builder /app/services/auth-service/dist ./dist
COPY --from=builder /app/services/auth-service/prisma ./prisma
COPY --from=builder /app/services/auth-service/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

#### Workspace Service

**File**: `docker/Dockerfile.workspace.prod`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY services/workspace-service ./services/workspace-service

RUN pnpm install --frozen-lockfile

WORKDIR /app/services/workspace-service
RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Include package.json for runtime
COPY --from=builder /app/services/workspace-service/package.json ./package.json
COPY --from=builder /app/services/workspace-service/dist ./dist
COPY --from=builder /app/services/workspace-service/prisma ./prisma
COPY --from=builder /app/services/workspace-service/node_modules ./node_modules

EXPOSE 3002
CMD ["node", "dist/main.js"]
```

#### NATS Service

**File**: `docker/Dockerfile.nats`

```dockerfile
FROM nats:latest

COPY config/nats.conf /etc/nats/nats.conf

EXPOSE 4222
CMD ["--config", "/etc/nats/nats.conf"]
```

---

### 1.7 Cloud SQL Setup

```bash
# Create VPC
gcloud compute networks create ft-trans-vpc --subnet-mode=auto

# Create Cloud SQL instance
gcloud sql instances create ft-trans-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --network=projects/ft-transcendence-prod/global/networks/ft-trans-vpc \
  --no-assign-ip \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00

# Create 3 Separate Databases (Option B)
gcloud sql databases create ft_trans_gateway --instance=ft-trans-db
gcloud sql databases create ft_trans_auth --instance=ft-trans-db
gcloud sql databases create ft_trans_workspace --instance=ft-trans-db

# Create User
gcloud sql users create ft_trans_user \
  --instance=ft-trans-db \
  --password=YOUR_SECURE_PASSWORD
```

Connection string format (update for EACH service):
```bash
# Gateway
DATABASE_URL="postgresql://ft_trans_user:PASSWORD@localhost/ft_trans_gateway?host=/cloudsql/ft-transcendence-prod:us-central1:ft-trans-db&connection_limit=5"

# Auth
DATABASE_URL="postgresql://ft_trans_user:PASSWORD@localhost/ft_trans_auth?host=/cloudsql/ft-transcendence-prod:us-central1:ft-trans-db&connection_limit=5"

# Workspace
DATABASE_URL="postgresql://ft_trans_user:PASSWORD@localhost/ft_trans_workspace?host=/cloudsql/ft-transcendence-prod:us-central1:ft-trans-db&connection_limit=5"
```

---

### 1.8 Memorystore Redis Setup

```bash
# Create Memorystore Redis instance (Basic tier for learning)
gcloud redis instances create ft-trans-redis \
  --size=1 \
  --region=us-central1 \
  --network=ft-trans-vpc \
  --tier=basic

# Get the Redis host IP
gcloud redis instances describe ft-trans-redis --region=us-central1 --format="value(host)"
```

**Store Redis URL in Secret Manager**:
```bash
REDIS_HOST=$(gcloud redis instances describe ft-trans-redis --region=us-central1 --format="value(host)")
echo -n "redis://${REDIS_HOST}:6379" | gcloud secrets create redis-url --data-file=-
```

> **Note**: Memorystore requires VPC Connector. All Cloud Run services using Redis must include `--vpc-connector=ft-trans-connector`.

### 1.9 Implement Graceful Shutdown

Cloud Run sends a SIGTERM signal to stop containers. Services must handle this to prevent data loss.

**Action**: Add to `main.ts` of **ALL** services:

```typescript
// Enable shutdown hooks
app.enableShutdownHooks();

// Explicit SIGTERM handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await app.close();
  process.exit(0);
});
```

---

## Phase 2: High Priority Configuration

### 2.1 VPC Connector (Cost Optimized)

```bash
gcloud compute networks vpc-access connectors create ft-trans-connector \
  --region=us-central1 \
  --network=ft-trans-vpc \
  --range=10.8.0.0/28 \
  --min-instances=1 \
  --max-instances=3
```

---

### 2.2 Database Migration Job

Create `scripts/migrate-all.sh`:

```bash
#!/bin/bash
set -e

echo "Running API Gateway migrations (DATABASE_URL_GATEWAY required)..."
cd /app/apps/api-gateway
DATABASE_URL=$DATABASE_URL_GATEWAY npx prisma migrate deploy

echo "Running Auth Service migrations (DATABASE_URL_AUTH required)..."
cd /app/services/auth-service
DATABASE_URL=$DATABASE_URL_AUTH npx prisma migrate deploy

echo "Running Workspace Service migrations (DATABASE_URL_WORKSPACE required)..."
cd /app/services/workspace-service
DATABASE_URL=$DATABASE_URL_WORKSPACE npx prisma migrate deploy

echo "All migrations completed!"
```

**File**: `docker/Dockerfile.migrate`

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
RUN apk add --no-cache postgresql-client

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api-gateway ./apps/api-gateway
COPY services/auth-service ./services/auth-service
COPY services/workspace-service ./services/workspace-service
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

RUN cd apps/api-gateway && pnpm prisma generate
RUN cd services/auth-service && pnpm prisma generate
RUN cd services/workspace-service && pnpm prisma generate

RUN chmod +x scripts/migrate-all.sh

CMD ["./scripts/migrate-all.sh"]
```

#### Create Migration Job

After building the migration image, create the Cloud Run Job:

```bash
# Build and push migration image first
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/ft-transcendence-prod/ft-trans/migrate:latest \
  -f docker/Dockerfile.migrate .

# Create the migration job (run once during initial setup)
gcloud run jobs create ft-trans-migrate \
  --image=us-central1-docker.pkg.dev/ft-transcendence-prod/ft-trans/migrate:latest \
  --region=us-central1 \
  --vpc-connector=ft-trans-connector \
  --add-cloudsql-instances=ft-transcendence-prod:us-central1:ft-trans-db \
  --service-account=ft-trans-runner@ft-transcendence-prod.iam.gserviceaccount.com \
  --set-secrets="DATABASE_URL_GATEWAY=database-url-gateway:latest,DATABASE_URL_AUTH=database-url-auth:latest,DATABASE_URL_WORKSPACE=database-url-workspace:latest"

# Execute migrations
gcloud run jobs execute ft-trans-migrate --wait --region=us-central1
```

> **Note**: This job should be created during initial setup. The CI/CD pipeline (cloudbuild.yaml) will update and re-execute it on subsequent deployments.

---

### 2.3 Cloud Run Service Account

Create a dedicated identity for your services with minimal permissions.

```bash
gcloud iam service-accounts create ft-trans-runner \
  --display-name="FT Trans Cloud Run Runner"

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:ft-trans-runner@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:ft-trans-runner@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### 2.4 NATS Authentication & WebSockets

**Important for Cloud Run**: Cloud Run exposes services via HTTPS, so NATS must support WebSocket connections for external traffic.

Create `config/nats.conf`:

```conf
# Cloud Run routes public traffic to this port
port: 4222

# Enable WebSockets for Cloud Run compatibility
websocket {
  port: 4222
  no_tls: true  # Cloud Run handles TLS termination
}

jetstream {
  store_dir: /data
  max_memory_store: 256MB
  max_file_store: 1GB
}

authorization {
  token: $NATS_TOKEN
}
```

Store token in Secret Manager:
```bash
openssl rand -base64 32 | gcloud secrets create nats-token --data-file=-
```

> **Note**: Update your NATS client code to use `wss://` protocol when connecting in Cloud Run: `wss://ft-trans-nats-xxx.run.app:443`

---

### 2.5 CORS Configuration

**File**: `apps/api-gateway/src/main.ts`

```typescript
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').filter(Boolean) || [];

const app = await NestFactory.create(AppModule, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  },
});
```

---

### 2.6 Health Check Endpoints

Add to each NestJS service:

```typescript
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { 
        status: 'ready', 
        database: 'connected', 
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      throw new ServiceUnavailableException('Database not ready');
    }
  }
}
```

---

## Phase 3: Optimization

### 3.1 Artifact Registry Cleanup

```bash
cat > lifecycle-policy.json << 'EOF'
{
  "rules": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "tagState": "untagged",
        "olderThan": "7d"
      }
    }
  ]
}
EOF

gcloud artifacts repositories set-cleanup-policies ft-trans \
  --location=us-central1 \
  --policy=lifecycle-policy.json
```

---

### 3.2 Rate Limiting

```bash
cd apps/api-gateway
pnpm add @nestjs/throttler
```

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

---

## CI/CD Pipeline

### cloudbuild.yaml

```yaml
steps:
  # Build all images
  - id: 'build-web'
    name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/web:$COMMIT_SHA',
           '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/web:latest',
           '-f', 'docker/Dockerfile.web.prod', '.']
    waitFor: ['-']

  - id: 'build-gateway'
    name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:$COMMIT_SHA',
           '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:latest',
           '-f', 'docker/Dockerfile.gateway.prod', '.']
    waitFor: ['-']

  - id: 'build-auth'
    name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/auth-service:$COMMIT_SHA',
           '-f', 'docker/Dockerfile.auth.prod', '.']
    waitFor: ['-']

  - id: 'build-workspace'
    name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/workspace-service:$COMMIT_SHA',
           '-f', 'docker/Dockerfile.workspace.prod', '.']
    waitFor: ['-']

  - id: 'build-migrate'
    name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/migrate:$COMMIT_SHA',
           '-f', 'docker/Dockerfile.migrate', '.']
    waitFor: ['-']

  - id: 'build-nats'
    name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/nats:$COMMIT_SHA',
           '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/nats:latest',
           '-f', 'docker/Dockerfile.nats', '.']
    waitFor: ['-']

  # Push all images
  - id: 'push-images'
    name: 'gcr.io/cloud-builders/docker'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/web:$COMMIT_SHA
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/web:latest
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:$COMMIT_SHA
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:latest
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/auth-service:$COMMIT_SHA
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/workspace-service:$COMMIT_SHA
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/migrate:$COMMIT_SHA
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/nats:$COMMIT_SHA
        docker push us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/nats:latest
    waitFor: ['build-web', 'build-gateway', 'build-auth', 'build-workspace', 'build-migrate', 'build-nats']

  # Run migrations
  - id: 'run-migrations'
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        gcloud run jobs update ft-trans-migrate \
          --image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/migrate:$COMMIT_SHA \
          --region=us-central1 \
          --vpc-connector=ft-trans-connector \
          --add-cloudsql-instances=ft-transcendence-prod:us-central1:ft-trans-db \
          --set-secrets="DATABASE_URL_GATEWAY=database-url-gateway:latest,DATABASE_URL_AUTH=database-url-auth:latest,DATABASE_URL_WORKSPACE=database-url-workspace:latest"
        gcloud run jobs execute ft-trans-migrate --wait --region=us-central1
    waitFor: ['push-images']

  # Deploy all services
  - id: 'deploy-nats'
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args: ['run', 'deploy', 'ft-trans-nats',
           '--image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/nats:$COMMIT_SHA',
           '--region=us-central1']
    waitFor: ['push-images']

  - id: 'deploy-web'
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args: ['run', 'deploy', 'ft-trans-web',
           '--image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/web:$COMMIT_SHA',
           '--region=us-central1']
    waitFor: ['run-migrations', 'deploy-nats']

  - id: 'deploy-gateway'
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args: ['run', 'deploy', 'ft-trans-api-gateway',
           '--image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:$COMMIT_SHA',
           '--region=us-central1']
    waitFor: ['run-migrations', 'deploy-nats']

  - id: 'deploy-auth'
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args: ['run', 'deploy', 'ft-trans-auth-service',
           '--image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/auth-service:$COMMIT_SHA',
           '--region=us-central1']
    waitFor: ['run-migrations', 'deploy-nats']

  - id: 'deploy-workspace'
    name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args: ['run', 'deploy', 'ft-trans-workspace-service',
           '--image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/workspace-service:$COMMIT_SHA',
           '--region=us-central1']
    waitFor: ['run-migrations', 'deploy-nats']

options:
  logging: CLOUD_LOGGING_ONLY
timeout: '1800s'
```

---

## Environment Variables Reference

### Secrets (Store in Secret Manager)

```bash
# Gateway Database
echo -n "postgresql://ft_trans_user:PASS@localhost/ft_trans_gateway?host=/cloudsql/ft-transcendence-prod:us-central1:ft-trans-db&connection_limit=5" | \
  gcloud secrets create database-url-gateway --data-file=-

# Auth Database
echo -n "postgresql://ft_trans_user:PASS@localhost/ft_trans_auth?host=/cloudsql/ft-transcendence-prod:us-central1:ft-trans-db&connection_limit=5" | \
  gcloud secrets create database-url-auth --data-file=-

# Workspace Database
echo -n "postgresql://ft_trans_user:PASS@localhost/ft_trans_workspace?host=/cloudsql/ft-transcendence-prod:us-central1:ft-trans-db&connection_limit=5" | \
  gcloud secrets create database-url-workspace --data-file=-

# Redis
echo -n "redis://HOST:6379" | gcloud secrets create redis-url --data-file=-

# JWT
openssl rand -base64 64 | gcloud secrets create jwt-secret --data-file=-

# NATS Token
openssl rand -base64 32 | gcloud secrets create nats-token --data-file=-

# OAuth
echo -n "github-client-secret" | gcloud secrets create github-oauth-secret --data-file=-
echo -n "google-client-secret" | gcloud secrets create google-oauth-secret --data-file=-

# Email
echo -n "resend-api-key" | gcloud secrets create resend-api-key --data-file=-
```

### Service Environment Variables

**Web Frontend**:
| Variable | Example | Required |
|----------|---------|----------|
| PORT | 3000 | Yes |
| NODE_ENV | production | Yes |
| NEXT_PUBLIC_API_URL | https://ft-trans-api-gateway-xxx.run.app | Yes |
| NEXT_PUBLIC_WS_URL | wss://ft-trans-api-gateway-xxx.run.app | Yes |

**API Gateway**:
| Variable | Example | Required |
|----------|---------|----------|
| PORT | 4000 | Yes |
| NODE_ENV | production | Yes |
| DATABASE_URL | (from secret) | Yes |
| REDIS_URL | (from secret) | Yes |
| JWT_SECRET | (from secret) | Yes |
| NATS_URL | wss://ft-trans-nats:443 | Yes |
| NATS_TOKEN | (from secret) | Yes |
| CORS_ORIGINS | https://ft-trans-web-xxx.run.app | Yes |

**Auth Service**:
| Variable | Example | Required |
|----------|---------|----------|
| PORT | 3001 | Yes |
| NODE_ENV | production | Yes |
| DATABASE_URL | (from secret) | Yes |
| NATS_URL | wss://ft-trans-nats:443 | Yes |
| NATS_TOKEN | (from secret) | Yes |
| FRONTEND_URL | https://ft-trans-web-xxx.run.app | Yes |
| GITHUB_CLIENT_ID | abc123 | Yes |
| GITHUB_CLIENT_SECRET | (from secret) | Yes |
| GOOGLE_CLIENT_ID | abc123.apps.googleusercontent.com | Yes |
| GOOGLE_CLIENT_SECRET | (from secret) | Yes |
| RESEND_API_KEY | (from secret) | Yes |

**Workspace Service**:
| Variable | Example | Required |
|----------|---------|----------|
| PORT | 3002 | Yes |
| NODE_ENV | production | Yes |
| DATABASE_URL | (from secret) | Yes |
| NATS_URL | wss://ft-trans-nats:443 | Yes |
| NATS_TOKEN | (from secret) | Yes |

---

## Cost Summary

### Revised Cost Estimate (Intermittent Usage)

Assumptions: ~5 hours/day active usage (100 hours/month), scaling to zero when idle.

| Service | 24/7 Cost | Your Usage (100 hrs) | Notes |
|---------|-----------|---------------------|-------|
| Cloud Run - web | $15 | **~$2** | Scale to 0 when idle |
| Cloud Run - api-gateway | $40 | **~$6** | min=1 only when active |
| Cloud Run - auth | $8 | **~$1** | Scale to 0 |
| Cloud Run - workspace | $8 | **~$1** | Scale to 0 |
| Cloud Run - nats | $15 | **~$2** | |
| Cloud SQL db-f1-micro | $9 | **~$9** | Billed while running* |
| VPC Connector | $40 | **~$6** | Billed per hour |
| **Memorystore Basic 1GB** | **$35** | **~$5-35** | **Option B** (Delete/Recreate) recommended |
| **Total** | $170 | **~$32-62/month** | |

### Cost Optimization Tips

1. **Cloud SQL**: Stop instance when not learning:
   ```bash
   gcloud sql instances patch ft-trans-db --activation-policy=NEVER
   ```
2. **Memorystore**: Delete instance (`gcloud redis instances delete`) when done for the day and recreate (`gcloud redis instances create`) when starting.
3. **Budget**: Set specific budget alerts for daily spending.

```bash
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="FT Trans Budget" \
  --budget-amount=300USD \
  --threshold-rules=percent=0.25 \
  --threshold-rules=percent=0.5 \
  --threshold-rules=percent=0.75 \
  --threshold-rules=percent=0.9
```

---

## Rollback Strategy

### Rollback Cloud Run Service

```bash
# List recent revisions
gcloud run revisions list --service=ft-trans-api-gateway --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic ft-trans-api-gateway \
  --to-revisions=ft-trans-api-gateway-00005-abc=100 \
  --region=us-central1
```

### Rollback Database Migrations

**⚠️ CAUTION**: Database rollbacks can cause data loss. Review carefully!

```bash
# Check migration status
cd apps/api-gateway
npx prisma migrate status

# Mark migration as rolled back (does NOT undo changes)
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# For actual rollback, create a new "down" migration
npx prisma migrate dev --name rollback_MIGRATION_NAME
```

### Emergency Rollback Procedure

1. **Stop traffic**: Route all traffic to previous revision
2. **Assess damage**: Check logs and database state
3. **Decide**: Manual fix vs full rollback
4. **Execute**: Apply fix or rollback migration
5. **Verify**: Test all endpoints before restoring traffic

---

## Quick Reference

### Complete Deployment Commands

```bash
# NATS
gcloud run deploy ft-trans-nats \
  --image=us-central1-docker.pkg.dev/ft-transcendence-prod/ft-trans/nats:latest \
  --region=us-central1 \
  --allow-unauthenticated \
  --min-instances=1 --max-instances=1 \
  --memory=256Mi --cpu=0.5 \
  --port=4222 \
  --set-secrets="NATS_TOKEN=nats-token:latest"

# Web
gcloud run deploy ft-trans-web \
  --image=us-central1-docker.pkg.dev/ft-transcendence-prod/ft-trans/web:latest \
  --region=us-central1 \
  --allow-unauthenticated \
  --vpc-connector=ft-trans-connector \
  --min-instances=0 --max-instances=10 \
  --memory=512Mi --cpu=1 --cpu-boost \
  --port=3000 \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_API_URL=https://ft-trans-api-gateway-xxx.run.app"

# API Gateway
gcloud run deploy ft-trans-api-gateway \
  --image=us-central1-docker.pkg.dev/ft-transcendence-prod/ft-trans/api-gateway:latest \
  --region=us-central1 \
  --allow-unauthenticated \
  --vpc-connector=ft-trans-connector \
  --add-cloudsql-instances=ft-transcendence-prod:us-central1:ft-trans-db \
  --min-instances=1 --max-instances=5 \
  --memory=1Gi --cpu=1 \
  --port=4000 \
  --timeout=3600 \
  --session-affinity \
  --no-cpu-throttling \
  --set-env-vars="NODE_ENV=production,CORS_ORIGINS=https://ft-trans-web-xxx.run.app,NATS_URL=wss://ft-trans-nats-xxx.run.app:443" \
  --set-secrets="DATABASE_URL=database-url-gateway:latest,REDIS_URL=redis-url:latest,JWT_SECRET=jwt-secret:latest,NATS_TOKEN=nats-token:latest"

# Auth Service
gcloud run deploy ft-trans-auth-service \
  --image=us-central1-docker.pkg.dev/ft-transcendence-prod/ft-trans/auth-service:latest \
  --region=us-central1 \
  --vpc-connector=ft-trans-connector \
  --add-cloudsql-instances=ft-transcendence-prod:us-central1:ft-trans-db \
  --min-instances=0 --max-instances=3 \
  --memory=512Mi --cpu=1 \
  --port=3001 \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=https://ft-trans-web-xxx.run.app,GITHUB_CLIENT_ID=xxx,GOOGLE_CLIENT_ID=xxx,NATS_URL=wss://ft-trans-nats-xxx.run.app:443" \
  --set-secrets="DATABASE_URL=database-url-auth:latest,GITHUB_CLIENT_SECRET=github-oauth-secret:latest,GOOGLE_CLIENT_SECRET=google-oauth-secret:latest,RESEND_API_KEY=resend-api-key:latest,NATS_TOKEN=nats-token:latest"

# Workspace Service
gcloud run deploy ft-trans-workspace-service \
  --image=us-central1-docker.pkg.dev/ft-transcendence-prod/ft-trans/workspace-service:latest \
  --region=us-central1 \
  --vpc-connector=ft-trans-connector \
  --add-cloudsql-instances=ft-transcendence-prod:us-central1:ft-trans-db \
  --min-instances=0 --max-instances=3 \
  --memory=512Mi --cpu=1 \
  --port=3002 \
  --set-env-vars="NODE_ENV=production,NATS_URL=wss://ft-trans-nats-xxx.run.app:443" \
  --set-secrets="DATABASE_URL=database-url-workspace:latest,NATS_TOKEN=nats-token:latest"
```

### Common Commands

```bash
# View logs
gcloud run services logs read ft-trans-api-gateway --region=us-central1

# Execute migration
gcloud run jobs execute ft-trans-migrate --wait --region=us-central1

# Manual build
gcloud builds submit --config=cloudbuild.yaml
```

---

## Deployment Checklist

### Phase 1: Critical
- [ ] Project created and APIs enabled
- [ ] Prisma schemas configured (standard public schema, NO @@schema annotations)
- [ ] Prisma clients regenerated
- [ ] Three databases created: ft_trans_gateway, ft_trans_auth, ft_trans_workspace
- [ ] Three database URL secrets created in Secret Manager
- [ ] Prisma migrations created
- [ ] WebSocket Redis adapter with graceful shutdown
- [ ] `output: 'standalone'` in next.config.ts
- [ ] Port configuration using `$PORT` variable
- [ ] Production Dockerfiles with package.json included
- [ ] Cloud SQL instance created
- [ ] VPC connector created (1 min instance)

### Phase 2: High Priority
- [ ] Migration Dockerfile and script created
- [ ] NATS authentication configured
- [ ] Winthin NATS config: websockets enabled
- [ ] All secrets stored in Secret Manager
- [ ] CORS configured with production origins
- [ ] Health check endpoints added

### Phase 3: Optimization
- [ ] Artifact Registry cleanup policy
- [ ] Rate limiting configured
- [ ] Budget alerts set at 25%, 50%, 75%, 90%
- [ ] Rollback procedure documented and tested

---

> **Version**: 4
> **Last Updated**: January 2026
