# 🔧 Required Code Changes for Cloud Run Deployment

> **This document lists all code changes required to align your codebase with the deployment handbook**

---

## Table of Contents

1. [Project Status Overview](#project-status-overview)
2. [Architecture Clarification](#architecture-clarification)
3. [Critical Changes (Must Fix)](#critical-changes-must-fix)
4. [High Priority Changes](#high-priority-changes)
5. [New Files to Create](#new-files-to-create)

---

## Project Status Overview

### 🚨 Critical Issues Found

Based on analysis of your current codebase vs. the deployment handbook requirements:

| Issue | Current State | Required State | Impact |
|-------|--------------|----------------|--------|
| **Port Configuration** | ❌ Uses `API_GATEWAY_PORT`, `AUTH_PORT`, `WORKSPACE_PORT` | ✅ Must use `process.env.PORT` | **BLOCKER**: Cloud Run injects PORT |
| **Next.js Standalone** | ❌ Missing in config | ✅ `output: 'standalone'` required | **BLOCKER**: Docker build fails |
| **Redis Adapter** | ❌ Not implemented in api-gateway | ✅ Socket.io Redis adapter needed | **BLOCKER**: WebSockets fail with multiple instances |
| **NATS Token Auth** | ❌ Services connect without token | ✅ Add `token: process.env.NATS_TOKEN` | **BLOCKER**: Unauthorized access to message broker |
| **Health Endpoints** | ⚠️ Basic `/health` exists in api-gateway | ✅ Need `/health/ready` with DB check | **HIGH**: Incomplete readiness checks |
| **Graceful Shutdown** | ❌ No SIGTERM handlers | ✅ Required for all services | **HIGH**: Data loss on shutdown |

### 📊 Implementation Status

```
Critical Changes:     0/4 implemented (0%)
High Priority:        0/2 implemented (0%)
New Files Required:   0/3 created (0%)
Production Ready:     NO ❌
```

**Estimated Work**: ~3 hours to implement all changes

---

## Architecture Clarification

### Data Ownership (Current Implementation)

The actual data ownership in the codebase differs from what some documentation implies:

| Service | Prisma Schema | Data Models Owned |
|---------|---------------|-------------------|
| **api-gateway** | `apps/api-gateway/prisma/schema.prisma` | User, Session, Account, Workspace, WorkspaceMember, Task, Sprint, Message, AuditLog |
| **auth-service** | `services/auth-service/prisma/schema.prisma` | User, Session, Account, PasswordReset, VerificationToken |
| **workspace-service** | `services/workspace-service/prisma/schema.prisma` | Workspace, WorkspaceMember, Invitation |

### Key Insight

> **api-gateway is NOT a pure gateway**. It is the main backend service that owns most application data. This is intentional and appropriate for a small team. Do not refactor into "true microservices" unless you have 5+ developers.

### Why This Is Acceptable

1. **Reduced inter-service calls**: Task operations don't require NATS roundtrips
2. **Simpler transactions**: No distributed transactions needed
3. **Easier debugging**: Most logic in one service
4. **Lower latency**: Direct database access vs. network hops

---

## Critical Changes (Must Fix)

### ⚠️ 1. Port Environment Variable Configuration

**Status**: ❌ **MISSING** - Services use hardcoded ports

**Problem**: Cloud Run injects `$PORT` environment variable. Services must respect it or they won't start.

**Files to Update**:

#### `apps/api-gateway/src/main.ts`

**Current Code**:

```typescript
const port = Number(process.env.API_GATEWAY_PORT) || 4000;
await app.listen(port);
```

**Required Change**:

```typescript
const port = process.env.PORT || 4000;
await app.listen(port);
console.log(`API Gateway listening on port ${port}`);
```

---

#### `services/auth-service/src/main.ts`

**Current Code**:

```typescript
await app.listen(Number(process.env.AUTH_PORT) || 3001);
```

**Required Change**:

```typescript
const port = process.env.PORT || 3001;
await app.listen(port);
console.log(`Auth Service listening on port ${port}`);
```

---

#### `services/workspace-service/src/main.ts`

**Current Code**:

```typescript
await app.listen(Number(process.env.WORKSPACE_PORT) || 3002);
```

**Required Change**:

```typescript
const port = process.env.PORT || 3002;
await app.listen(port);
console.log(`Workspace Service listening on port ${port}`);
```

---

### ⚠️ 2. Next.js Standalone Output

**Status**: ❌ **MISSING** - Required for production Docker builds

**Problem**: Without standalone output, the production Dockerfile cannot find `.next/standalone` directory, causing build failures.

**File to Update**: `apps/web/next.config.ts`

**Current Code**:

```typescript
const nextConfig = {
  transpilePackages: ['@ft-trans/frontend-shared'],
  // ...
}
```

**Required Change**:

```typescript
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ft-trans/frontend-shared'],
  // ...
}
```

---

### ⚠️ 3. NATS Token Authentication

**Status**: ❌ **MISSING** - Services connect without token

**Problem**: Production NATS requires authentication. Current code has no token, allowing unauthorized access.

**Files to Update**: All NestJS services with NATS connections

#### `services/auth-service/src/main.ts`

**Current Code**:

```typescript
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.NATS,
  options: {
    servers: [process.env.NATS_URL!],
  },
});
```

**Required Change**:

```typescript
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.NATS,
  options: {
    servers: [process.env.NATS_URL!],
    token: process.env.NATS_TOKEN,
  },
});
```

---

#### `services/workspace-service/src/main.ts`

Apply the same change: add `token: process.env.NATS_TOKEN` to NATS options.

---

### ⚠️ 4. WebSocket Redis Adapter with Graceful Shutdown

**Status**: ❌ **NOT IMPLEMENTED** - Critical for multi-instance WebSocket support

**Current State**:

- WebSocket gateway uses in-memory Maps for user tracking
- No Redis integration
- No graceful shutdown implementation

**Problem**:

1. **Multi-Instance Failure**: Without Redis adapter, WebSocket connections are stored in memory of a single instance. When Cloud Run scales to multiple instances:
   - Users connect to different instances randomly
   - Messages don't propagate between instances
   - Real-time features break completely

2. **Memory Leaks**: Redis connections not properly closed on shutdown

**Impact**: 🔴 **DEPLOYMENT BLOCKER** - Real-time collaboration will fail in production.

**Step 1**: Install dependencies

```bash
cd apps/api-gateway
pnpm add @socket.io/redis-adapter redis
```

**Step 2**: Update `apps/api-gateway/src/websocket/websocket.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
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
    } else {
      this.logger.warn('REDIS_URL not set, running in single-instance mode');
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

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

## High Priority Changes

### 🟡 5. Graceful Shutdown Implementation

**Status**: ❌ **MISSING** - Services don't handle SIGTERM

**Problem**: Cloud Run sends SIGTERM before stopping containers. Without handlers, connections are forcibly closed, causing data loss.

**Files to Update**: All three NestJS services

#### Add to `apps/api-gateway/src/main.ts`

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  });
  
  // ... existing configuration
  
  app.enableShutdownHooks();
  
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`API Gateway listening on port ${port}`);
}

bootstrap();
```

Apply the same pattern to `services/auth-service/src/main.ts` and `services/workspace-service/src/main.ts`.

---

### 🟡 6. Health Check Endpoints

**Status**: ⚠️ **PARTIALLY IMPLEMENTED** - Basic health exists, needs enhancement

**Current State**:
- `api-gateway` has `/health` and `/health` endpoints (basic, no DB check)
- `auth-service` and `workspace-service` have no health endpoints

**Problem**: Cloud Run uses health checks to determine:

1. **Startup Probe**: Is the container ready to receive traffic?
2. **Liveness Probe**: Should the container be restarted?
3. **Readiness Probe**: Should traffic be routed to this instance?

**Without health checks**:
- ❌ Cloud Run may route traffic before service is ready
- ❌ Unhealthy instances keep receiving requests
- ❌ Failed deployments may not be detected

**Files to Update**: All three NestJS services

#### Update `apps/api-gateway/src/app.controller.ts`

**Current Code** (basic health exists):
```typescript
@Get('health')
getDetailedHealth(): object {
  return this.appService.getDetailedHealth();
}
```

**Required Change** (add DB connectivity check):

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@Controller()
@ApiTags('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Basic liveness check' })
  health() {
    return {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString()
    };
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness check with database connectivity' })
  async ready() {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 2000)
        )
      ]);
      
      return {
        status: 'ready',
        database: 'connected',
        service: 'api-gateway',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'degraded',
        database: 'unavailable',
        service: 'api-gateway',
        timestamp: new Date().toISOString()
      };
    }
  }
}
```

**Repeat for Other Services**:

- `services/auth-service/src/app.controller.ts` (change service name to `'auth-service'`)
- `services/workspace-service/src/app.controller.ts` (change service name to `'workspace-service'`)

---

## New Files to Create

### 📄 7. NATS Configuration File

**Status**: ❌ **NOT CREATED** - Blocking NATS deployment

**Create directory and file**:

```bash
mkdir config
```

**Create**: `config/nats.conf`

```conf
port: 4222

http_port: 8222

jetstream {
  store_dir: /data
  max_memory_store: 256MB
  max_file_store: 1GB
}

authorization {
  token: $NATS_TOKEN
}
```

> **Note**: The `/data` directory is ephemeral in Cloud Run. JetStream messages will be lost on container restart. Design your application to handle this.

---

### 📄 8. Migration Script

**Status**: ❌ **MISSING** - Required for database migrations

**Create**: `scripts/migrate-all.sh`

```bash
#!/bin/bash
set -e

echo "Running API Gateway migrations..."
cd /app/apps/api-gateway
DATABASE_URL=$DATABASE_URL_GATEWAY npx prisma migrate deploy

echo "Running Auth Service migrations..."
cd /app/services/auth-service
DATABASE_URL=$DATABASE_URL_AUTH npx prisma migrate deploy

echo "Running Workspace Service migrations..."
cd /app/services/workspace-service
DATABASE_URL=$DATABASE_URL_WORKSPACE npx prisma migrate deploy

echo "All migrations completed!"
```

**Make Executable**:

```bash
chmod +x scripts/migrate-all.sh
```

---

### 📄 9. Production Dockerfiles

**Status**: ❌ **MISSING** - Development Dockerfiles exist, production ones needed

**Files to Create**:

- `docker/Dockerfile.web.prod`
- `docker/Dockerfile.gateway.prod`
- `docker/Dockerfile.auth.prod`
- `docker/Dockerfile.workspace.prod`
- `docker/Dockerfile.nats`
- `docker/Dockerfile.migrate`

**Reference**: See deployment handbook Section 1.6 for complete Dockerfile contents.

---

## Summary Checklist

### Must Fix Before Deployment (Critical)

- [ ] **Port Configuration**: Update all 3 NestJS `main.ts` files to use `process.env.PORT`
- [ ] **Next.js Standalone**: Add `output: 'standalone'` to `next.config.ts`
- [ ] **Redis Adapter**: Update WebSocket gateway with Redis adapter and graceful shutdown
- [ ] **NATS Token Auth**: Add token to all NATS connections

### High Priority (Should Fix)

- [ ] **Graceful Shutdown**: Add SIGTERM handlers to all 3 NestJS services
- [ ] **Health Checks**: Add health endpoints to all 3 NestJS services

### New Files Needed

- [ ] **NATS Config**: Create `config/nats.conf` with token auth
- [ ] **Migration Script**: Create `scripts/migrate-all.sh`
- [ ] **Production Dockerfiles**: 6 new Dockerfiles in `docker/` directory

---

## Verification Commands

After making changes, verify with:

```bash
# 1. Check Prisma schemas are valid
cd apps/api-gateway && pnpm prisma validate
cd ../../services/auth-service && pnpm prisma validate
cd ../workspace-service && pnpm prisma validate

# 2. TypeScript compilation
pnpm run type-check

# 3. Build all services locally
pnpm run build

# 4. Test Docker builds (without pushing)
docker build -f docker/Dockerfile.web.prod -t test-web .
docker build -f docker/Dockerfile.gateway.prod -t test-gateway .
docker build -f docker/Dockerfile.auth.prod -t test-auth .
docker build -f docker/Dockerfile.workspace.prod -t test-workspace .
```

---

## Estimated Time to Complete

| Task | Time | Priority |
|------|------|----------|
| Port configuration (3 files) | 15 min | Critical |
| Next.js standalone | 2 min | Critical |
| Redis adapter + graceful shutdown | 30 min | Critical |
| NATS token auth (2 files) | 10 min | Critical |
| Graceful shutdown (3 files) | 20 min | High |
| Health checks (3 files) | 30 min | High |
| NATS config | 5 min | High |
| Migration script | 10 min | High |
| Production Dockerfiles | 45 min | High |
| **Total** | **~3 hours** | |

---

> **Version**: 2.0  
> **Last Updated**: January 2026  
> **Related Document**: DEPLOYMENT_HANDBOOK.md