# 🔧 Required Code Changes for Cloud Run Deployment

> **This document lists all code changes required to align your codebase with the deployment handbook**

---

## Table of Contents

1.  [Project Status Overview](#project-status-overview)
2.  [Critical Changes (Must Fix)](#critical-changes-must-fix)
3.  [High Priority Changes](#high-priority-changes)
4.  [Recommended Enhancements](#recommended-enhancements)
5.  [New Files to Create](#new-files-to-create)

---

## Project Status Overview

### 🚨 Critical Issues Found

Based on analysis of your current codebase vs. the deployment handbook requirements:

Issue

Current State

Required State

Impact

**NATS Config File**

❌ No `config/` directory exists

✅ `config/nats.conf` with WebSocket + token auth

**BLOCKER**: NATS won't accept Cloud Run connections

**NATS Token Auth**

❌ Services connect without token

✅ Add `token: process.env.NATS_TOKEN` to all services

**BLOCKER**: Unauthorized access to message broker

**Redis Adapter**

❌ Not implemented in api-gateway

✅ Socket.io Redis adapter needed

**BLOCKER**: WebSockets fail with multiple instances

**Health Endpoints**

❌ No `/health` endpoints exist

✅ Required for all 3 services

**BLOCKER**: Cloud Run readiness checks fail

**Port Configuration**

❌ Uses `API_GATEWAY_PORT`, `AUTH_PORT`, `WORKSPACE_PORT`

✅ Must use `process.env.PORT`

**BLOCKER**: Cloud Run injects PORT, not custom vars

**Next.js Standalone**

❌ Missing in config

✅ `output: 'standalone'` required

**BLOCKER**: Docker build fails

**Graceful Shutdown**

❌ No SIGTERM handlers

✅ Required for all services

**HIGH**: Data loss on shutdown

### 📊 Implementation Status

```
Critical Changes:     0/4 implemented (0%)
High Priority:        0/3 implemented (0%)
New Files Required:   0/5 created (0%)
Production Ready:     NO ❌
```

**Estimated Work**: ~3 hours to implement all changes

---

## Critical Changes (Must Fix)

### ⚠️ 1. Port Environment Variable Configuration

**Status**: ❌ **MISSING** - Services use hardcoded ports

**Problem**: Cloud Run injects `$PORT` environment variable. Services must respect it or they won't start.

**Files to Update**:

#### `apps/api-gateway/src/main.ts`

**Current Code**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  });
  // ... helmet, cookie-parser, validation, swagger setup ...
  
  const port = Number(process.env.API_GATEWAY_PORT) || 4000; // ❌ Uses API_GATEWAY_PORT, not PORT
  await app.listen(port);
}
```

**Required Change**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  });
  // ... existing configuration ...
  
  const port = process.env.PORT || 4000; // ✅ Cloud Run injects PORT
  await app.listen(port);
  console.log(`API Gateway listening on port ${port}`);
}
```

---

#### `services/auth-service/src/main.ts`

**Current Code**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ... CORS, cookie-parser, validation, swagger setup ...
  
  // Connect to NATS microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL!], // ❌ Missing token authentication
    },
  });

  await app.startAllMicroservices();
  await app.listen(Number(process.env.AUTH_PORT) || 3001); // ❌ Uses AUTH_PORT, not PORT
}
```

**Required Change**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ... existing configuration ...
  
  // Connect to NATS microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL!],
      token: process.env.NATS_TOKEN, // ✅ Add authentication token
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 3001; // ✅ Cloud Run injects PORT
  await app.listen(port);
  console.log(`Auth Service listening on port ${port}`);
}
```

---

#### `services/workspace-service/src/main.ts`

**Current Code**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ... validation setup ...
  
  // Connect to NATS as microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL!], // ❌ Missing token authentication
    },
  });

  await app.startAllMicroservices();
  await app.listen(Number(process.env.WORKSPACE_PORT) || 3002); // ❌ Uses WORKSPACE_PORT, not PORT
}
```

**Required Change**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ... existing configuration ...
  
  // Connect to NATS as microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL!],
      token: process.env.NATS_TOKEN, // ✅ Add authentication token
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 3002; // ✅ Cloud Run injects PORT
  await app.listen(port);
  console.log(`Workspace Service listening on port ${port}`);
}
```

---

### ⚠️ 2. Next.js Standalone Output

**Status**: ❌ **MISSING** - Required for production Docker builds

**Problem**: Without standalone output, the production Dockerfile cannot find `.next/standalone` directory, causing build failures.

**File to Update**: `apps/web/next.config.ts`

**Current Code**:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
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

**Required Change**:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // ✅ CRITICAL: Required for Docker production builds
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

### ⚠️ 3. Graceful Shutdown Implementation

**Status**: ❌ **MISSING** - Services don't handle SIGTERM

**Problem**: Cloud Run sends SIGTERM before stopping containers. Without handlers, connections are forcibly closed, causing data loss and poor UX.

**Files to Update**: All three NestJS services

#### `apps/api-gateway/src/main.ts`

**Add Before `bootstrap()` Call**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  });
  
  // ... existing configuration
  
  // ✅ Enable graceful shutdown
  app.enableShutdownHooks();
  
  // ✅ Handle SIGTERM (Cloud Run shutdown signal)
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

---

#### `services/auth-service/src/main.ts`

**Add the Same Pattern**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ... existing configuration
  
  // ✅ Enable graceful shutdown
  app.enableShutdownHooks();
  
  // ✅ Handle SIGTERM
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Auth Service listening on port ${port}`);
}

bootstrap();
```

---

#### `services/workspace-service/src/main.ts`

**Add the Same Pattern**:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ... existing configuration
  
  // ✅ Enable graceful shutdown
  app.enableShutdownHooks();
  
  // ✅ Handle SIGTERM
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  
  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Workspace Service listening on port ${port}`);
}

bootstrap();
```

---

### ⚠️ 4. WebSocket Redis Adapter with Graceful Shutdown

**Status**: ❌ **NOT IMPLEMENTED** - Critical for multi-instance WebSocket support

**Current State**:

-   WebSocket gateway likely exists at `apps/api-gateway/src/websocket/websocket.gateway.ts`
-   Uses default Socket.io in-memory adapter
-   No Redis integration
-   No graceful shutdown implementation

**Problem**:

1.  **Multi-Instance Failure**: Without Redis adapter, WebSocket connections are stored in memory of a single instance. When Cloud Run scales to multiple instances:
    
    -   Users connect to different instances randomly
    -   Messages don't propagate between instances
    -   Users can't see each other's real-time updates
    -   **Result**: Virtual office features completely broken
2.  **Memory Leaks**: Redis connections not properly closed on shutdown
    
    -   Causes connection pool exhaustion
    -   Cloud Run restart delays
    -   Potential data loss

**Impact**: 🔴 **DEPLOYMENT BLOCKER** - Your entire real-time collaboration feature will fail in production.

**File to Update**: `apps/api-gateway/src/websocket/websocket.gateway.ts`

**Current Code** (from `apps/api-gateway/src/websocket/websocket.gateway.ts`):

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
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  // In-memory user tracking (only works with single instance)
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private socketToUser: Map<string, string> = new Map();
  private userWorkspaces: Map<string, string> = new Map();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    // ❌ No Redis adapter - user state lost when scaling
    // ❌ No graceful shutdown - connections dropped abruptly
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // ... cleanup logic using in-memory maps
  }
}
```

**Required Change**:

**Step 1**: Install dependencies

```bash
cd apps/api-gateway
pnpm add @socket.io/redis-adapter redis
```

**Step 2**: Update the gateway

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
import { Logger, OnModuleDestroy } from '@nestjs/common'; // ✅ Add OnModuleDestroy
import { createAdapter } from '@socket.io/redis-adapter'; // ✅ Add Redis adapter
import { createClient, RedisClientType } from 'redis'; // ✅ Add Redis client

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [],
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy // ✅ Add OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  private pubClient: RedisClientType; // ✅ Store Redis clients
  private subClient: RedisClientType;

  // ✅ Initialize Redis adapter
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

  // ✅ Graceful shutdown for Redis connections
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

### 🟡 5. Health Check Endpoints

**Status**: ❌ **NOT IMPLEMENTED** - Critical for Cloud Run

**Current State**:

-   No `/health` endpoints exist in any service
-   No `/health/ready` endpoints exist
-   Controllers likely don't have health check methods

**Problem**: Cloud Run uses health checks to determine:

1.  **Startup Probe**: Is the container ready to receive traffic?
2.  **Liveness Probe**: Should the container be restarted?
3.  **Readiness Probe**: Should traffic be routed to this instance?

**Without health checks**:

-   ❌ Cloud Run may route traffic before service is ready
-   ❌ Unhealthy instances keep receiving requests (bad UX)
-   ❌ Failed deployments may not be detected
-   ❌ Auto-scaling decisions are less reliable

**Impact**: 🟡 **HIGH** - Deployments may succeed but be unreliable. Users experience random errors.

**Files to Update**: All three NestJS services

#### `apps/api-gateway/src/app.controller.ts`

**Current State**: Likely has basic controller or doesn't exist

**Add These Endpoints**:

```typescript
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
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
      // ✅ Verify database connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'ready',
        database: 'connected',
        service: 'api-gateway',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // ✅ Fail readiness if database is down
      throw new ServiceUnavailableException('Database not ready');
    }
  }
}
```

**Repeat for Other Services**:

-   `services/auth-service/src/app.controller.ts` (change service name to `'auth-service'`)
-   `services/workspace-service/src/app.controller.ts` (change service name to `'workspace-service'`)

**Cloud Run Configuration** (will use these endpoints):

```bash
# In deployment commands
--startup-probe-http-path=/health/ready \
--liveness-probe-http-path=/health \
--readiness-probe-http-path=/health/ready
```

---

### 🟡 6. CORS Enhancement

**Status**: ⚠️ **PARTIAL** - Basic CORS exists but needs enhancement

**Problem**: Current CORS uses simple origin array. Production needs proper validation.

**File to Update**: `apps/api-gateway/src/main.ts`

**Current Code**:

```typescript
const app = await NestFactory.create(AppModule, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
});
```

**Required Change**:

```typescript
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').filter(Boolean) || [];

const app = await NestFactory.create(AppModule, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
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

### 🟡 7. Rate Limiting

**Status**: ❌ **MISSING** - No rate limiting configured

**Problem**: API is vulnerable to abuse without rate limiting.

**File to Update**: `apps/api-gateway/src/app.module.ts`

**Step 1**: Install dependency

```bash
cd apps/api-gateway
pnpm add @nestjs/throttler
```

**Step 2**: Update module

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // ✅ Add
import { APP_GUARD } from '@nestjs/core'; // ✅ Add

@Module({
  imports: [
    // ✅ Add rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 10,   // 10 requests
      },
      {
        name: 'long',
        ttl: 60000,  // 1 minute
        limit: 100,  // 100 requests
      },
    ]),
    // ... other imports
  ],
  providers: [
    // ✅ Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ... other providers
  ],
})
export class AppModule {}
```

---

## Recommended Enhancements

### 💡 8. Structured Logging (Optional)

**Status**: 📝 **RECOMMENDED** - Improves Cloud Logging experience

**Install Dependencies**:

```bash
pnpm add winston nest-winston
```

**Update All Services** (`main.ts`):

```typescript
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json() // ✅ JSON format for Cloud Logging
          ),
        }),
      ],
    }),
  });
  
  // ... rest of configuration
}
```

---

## New Files to Create

### 📄 9. NATS Configuration File

**Status**: ❌ **NOT CREATED** - Blocking NATS deployment

**Current State**:

-   No `config/` directory exists in project root
-   `docker-compose.yml` likely uses default NATS command: `nats:latest` with no custom config
-   Development setup works because NATS doesn't need WebSocket support locally
-   **Production will fail** because Cloud Run exposes services via HTTPS only

**Problem**: Cloud Run routes all traffic through HTTPS. Your NestJS services need to connect to NATS via WebSocket Secure (wss://) instead of native NATS protocol (nats://). Without WebSocket support in NATS config:

-   ❌ Services can't connect to NATS from Cloud Run
-   ❌ Microservice communication completely fails
-   ❌ Auth and workspace services are unreachable
-   ❌ **Result**: Application is non-functional

**Impact**: 🔴 **DEPLOYMENT BLOCKER** - NATS container won't accept connections from Cloud Run services.

**Required Action**:

**Step 1**: Create directory structure

```bash
mkdir config
```

**Step 2**: Create `config/nats.conf`

```conf
# Cloud Run compatible NATS configuration

# Port 4222 for internal connections
port: 4222

# HTTP monitoring endpoint (useful for debugging)
http_port: 8222

# ✅ CRITICAL: WebSocket support for Cloud Run
# Cloud Run terminates TLS, so NATS doesn't need to handle it
websocket {
  port: 4222
  no_tls: true  # Cloud Run handles TLS termination
}

# JetStream for message persistence and reliability
jetstream {
  store_dir: /data
  max_memory_store: 256MB
  max_file_store: 1GB
}

# ✅ CRITICAL: Authentication to prevent unauthorized access
authorization {
  token: $NATS_TOKEN  # Environment variable injected from Secret Manager
}
```

**Step 3**: Verify NATS Dockerfile references this file

Check `docker/Dockerfile.nats`:

```dockerfile
FROM nats:latest

COPY config/nats.conf /etc/nats/nats.conf

EXPOSE 4222

CMD ["--config", "/etc/nats/nats.conf"]
```

**Step 4**: Update service connection code

All NestJS services connecting to NATS should use:

```typescript
// In main.ts or app.module.ts
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.NATS,
  options: {
    servers: [process.env.NATS_URL], // wss://ft-trans-nats-xxx.run.app:443
    token: process.env.NATS_TOKEN,
  },
});
```

---

### 📄 10. Migration Script

**Status**: ❌ **MISSING** - Required for database migrations

**Create**: `scripts/migrate-all.sh`

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

**Make Executable**:

```bash
chmod +x scripts/migrate-all.sh
```

---

### 📄 11. Production Dockerfiles

**Status**: ❌ **MISSING** - Development Dockerfiles exist, production ones needed

**Files to Create**:

-   `docker/Dockerfile.web.prod`
-   `docker/Dockerfile.gateway.prod`
-   `docker/Dockerfile.auth.prod`
-   `docker/Dockerfile.workspace.prod`
-   `docker/Dockerfile.nats`
-   `docker/Dockerfile.migrate`

**Reference**: See deployment handbook Section 1.6 for complete Dockerfile contents.

---

### 📄 12. Artifact Registry Cleanup Policy

**Status**: ❌ **MISSING** - Will accumulate costs over time

**Create**: `lifecycle-policy.json`

```json
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
```

**Apply**:

```bash
gcloud artifacts repositories set-cleanup-policies ft-trans \
  --location=us-central1 \
  --policy=lifecycle-policy.json
```

---

### 📄 13. CI/CD Pipeline Configuration

**Status**: ❌ **MISSING** - Required for automated deployments

**Create**: `cloudbuild.yaml`

**Reference**: See deployment handbook Section "CI/CD Pipeline" for complete configuration.

---

## Summary Checklist

### Must Fix Before Deployment (Critical)

-    **Port Configuration**: Update all 3 NestJS `main.ts` files to use `process.env.PORT`
-    **Next.js Standalone**: Add `output: 'standalone'` to `next.config.ts`
-    **Graceful Shutdown**: Add SIGTERM handlers to all 3 NestJS services
-    **Redis Adapter**: Update WebSocket gateway with Redis adapter and graceful shutdown

### High Priority (Should Fix)

-    **Health Checks**: Add health endpoints to all 3 NestJS services
-    **CORS Enhancement**: Improve CORS validation in API Gateway
-    **Rate Limiting**: Add throttler to API Gateway
-    **NATS Config**: Create `config/nats.conf` with WebSocket + token auth
-    **Migration Script**: Create `scripts/migrate-all.sh`

### New Files Needed

-    **Production Dockerfiles**: 5 new Dockerfiles in `docker/` directory
-    **CI/CD Config**: Create `cloudbuild.yaml`
-    **Cleanup Policy**: Create `lifecycle-policy.json`

### Recommended Enhancements

-    **Structured Logging**: Add winston to all services
-    **Error Reporting**: Add @google-cloud/error-reporting
-    **Custom Metrics**: Add monitoring for WebSocket connections

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
| Graceful shutdown (3 files) | 20 min | Critical |
| Redis adapter | 30 min | Critical |
| Health checks (3 files) | 30 min | High |
| CORS enhancement | 10 min | High |
| Rate limiting | 15 min | High |
| NATS config + token auth | 10 min | High |
| Migration script | 10 min | High |
| Production Dockerfiles | 45 min | High |
| CI/CD config | 20 min | High |
| **Total** | **~3 hours** | |

---

> **Version**: 1.1  
> **Last Updated**: January 2026  
> **Related Document**: DEPLOYMENT_HANDBOOK.md v4