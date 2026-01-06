# 🔍 Architecture Review — ft_transcendence

> **Review Date**: January 2026  
> **Reviewer**: Senior Backend Architect & Cloud Engineer  
> **Scope**: REQUIRED_CODE_CHANGES.md, DEPLOYMENT_HANDBOOK.md, REALTIME_ARCHITECTURE.md vs. actual codebase

---

## High-Level Verdict: **ACCEPTABLE** ✅

The architecture is **well-suited for a 1-3 developer team** with a limited budget. The 5-service approach is pragmatic and avoids the common trap of over-splitting into microservices. However, some documentation proposes features that are **over-engineered for current needs**.

---

## What Is Done Well ✅

- **5-service design instead of 8**: Correct decision. Adding separate `realtime-service`, `notification-service`, and `task-service` would triple operational complexity with minimal benefit at this scale.

- **API Gateway as WebSocket hub**: Centralizing all real-time events in `api-gateway` is simpler and cheaper than a distributed approach.

- **Scale-to-zero for auth/workspace services**: These services don't need to be always-on. Scaling 0-3 is appropriate.

- **NATS for inter-service communication**: Good choice over direct HTTP calls—provides decoupling without Kafka/RabbitMQ complexity.

- **Single Cloud SQL instance with 3 databases**: Cost-efficient (~$9/month). Separate instances would cost ~$27/month for no meaningful isolation benefit at this scale.

- **Cloud Run native architecture**: No GKE, no always-on VMs. Correct for budget constraints.

- **Redis Memorystore for WebSocket pub/sub**: Required for multi-instance WebSocket support. Correct decision.

- **Prisma for data access**: Appropriate for NestJS; provides type safety and migration management.

---

## What Is Unnecessarily Complex ⚠️

### 1. **NATS JetStream persistence is over-engineered**
- **Document says**: Store messages in `/data` with 1GB file storage
- **Reality**: Cloud Run has ephemeral storage. Messages are lost on restart anyway.
- **Recommendation**: Keep JetStream for at-least-once delivery semantics, but document clearly that persistent queuing is NOT available. Remove `/data` store_dir or accept it's ephemeral.

### 2. **Winston structured logging is optional, not critical**
- **Document says**: Add winston to all services
- **Reality**: Cloud Run captures stdout/stderr automatically. NestJS default logger works fine.
- **Recommendation**: Add winston later if you actually need JSON logs for searching. Not a pre-deployment requirement.

### 3. **Artifact Registry cleanup policy**
- **Document says**: Create lifecycle-policy.json
- **Reality**: With 5 services and weekly deployments, you'll have ~20 images/month. Even after a year, storage costs are negligible (<$0.50).
- **Recommendation**: Skip for now. Add when you see Artifact Registry costs on your bill.

### 4. **Custom Prometheus metrics (prom-client)**
- **Document says**: Add Counter, Histogram for WebSocket metrics
- **Reality**: Cloud Run provides request/latency metrics automatically. Cloud Monitoring is included.
- **Recommendation**: Use Cloud Monitoring. Add custom metrics only if you identify specific observability gaps.

### 5. **Collaborative whiteboard OT/CRDT**
- **Document mentions**: Operational Transformation or CRDT for conflicts
- **Reality**: With <50 users editing, last-write-wins is sufficient. OT/CRDT adds significant complexity.
- **Recommendation**: Implement simple last-write-wins first. Only add OT if users complain about conflicts.

---

## What Should Be Simplified or Removed 🔻

| Item | Current Proposal | Recommendation |
|------|------------------|----------------|
| **Game server 30 FPS tick rate** | Run in api-gateway | For a simple 2D movement sync, 10-15 FPS is sufficient. Reduces CPU cost. |
| **Whiteboard snapshot every 1 minute** | Auto-generate PNG to Cloud Storage | Remove. Let users manually export. Saves storage + compute. |
| **Voice call recording** | Optional Cloud Storage recording | Remove entirely from Phase 1-2. Add only if users request it. |
| **TURN server (Coturn on f1-micro)** | ~$5/month for NAT traversal | Use free Twilio TURN (limited quota) or Google's public STUN first. Add TURN only if >10% of calls fail. |
| **Rate limiting short tier (10 req/sec)** | ThrottlerModule with 2 tiers | Single tier (100/min) is sufficient. 10/sec is too aggressive and may hurt real-time features. |

---

## What Should Remain As-Is ✅

| Item | Why Keep It |
|------|-------------|
| **Graceful shutdown (SIGTERM handlers)** | Required for Cloud Run. Without it, WebSocket connections drop abruptly. |
| **Redis adapter for Socket.io** | Mandatory for multi-instance WebSocket. Current in-memory approach will break in production. |
| **Health endpoints (`/health`, `/health/ready`)** | Cloud Run probes require these. Critical for reliable deployments. |
| **`output: 'standalone'` in Next.js** | Required for Docker production builds. Current config is missing this—fix it. |
| **NATS token authentication** | Production security requirement. Current code has no token—fix it. |
| **Port configuration (`process.env.PORT`)** | Cloud Run injects PORT. Current code uses custom vars—fix it. |
| **Separate databases per service** | Good isolation without extra cost. Makes independent migrations safer. |
| **VPC Connector** | Required for Cloud SQL and Redis private connectivity. Fixed cost, unavoidable. |

---

## Architectural Contradictions Found ⚠️

### 1. **NATS Protocol Confusion**
- **DEPLOYMENT_HANDBOOK.md** (line 834): "NATS should be accessed **internally** via the private Cloud Run service URL, not via WebSocket"
- **REQUIRED_CODE_CHANGES.md** (line 831): "Development setup works because NATS doesn't need WebSocket support locally"
- **Contradiction**: The documents initially suggested NATS needs WebSocket for Cloud Run, then corrected it. The final guidance (internal `nats://` protocol) is correct, but the flip-flopping may confuse implementers.

### 2. **Game Loop Location**
- **REALTIME_ARCHITECTURE.md** (line 276-279): Shows "realtime-service" handling game state
- **Same document** (line 130): States "No realtime-service—api-gateway handles game loop"
- **Contradiction**: The diagrams reference a service that the text says doesn't exist. Clean up diagrams to show api-gateway as the game server.

### 3. **Task Service References**
- **REALTIME_ARCHITECTURE.md** (line 480-481): References `task-service` publishing events
- **Same document** (line 47): States only 5 services exist (no task-service)
- **Contradiction**: task-service is mentioned but doesn't exist. Tasks are handled by workspace-service.

### 4. **Cost Estimates Inconsistency**
- **DEPLOYMENT_HANDBOOK cost summary**: $95-106/month (Phase 1)
- **REALTIME_ARCHITECTURE cost summary**: $95-106/month (Phase 1)  
- **But**: VPC Connector is listed as $41/month fixed. Some estimates show different scaling costs.
- **Reality**: Estimates are close enough, but be aware actual costs will vary ±20%.

---

## Critical Findings from Code Review 🔴

| Issue | Current Code | Required Fix | Severity |
|-------|--------------|--------------|----------|
| **Port config** | `API_GATEWAY_PORT`, `AUTH_PORT`, `WORKSPACE_PORT` | Must use `process.env.PORT` | BLOCKER |
| **NATS token** | No token in connection options | Add `token: process.env.NATS_TOKEN` | BLOCKER |
| **Next.js standalone** | Missing `output: 'standalone'` | Add to next.config.ts | BLOCKER |
| **Graceful shutdown** | No SIGTERM handlers | Add `app.enableShutdownHooks()` + handler | HIGH |
| **WebSocket Redis adapter** | In-memory Maps only | Add @socket.io/redis-adapter | BLOCKER |
| **Health endpoints** | Not implemented | Add `/health` and `/health/ready` | HIGH |
| **NATS config file** | No `config/nats.conf` | Create with token auth | HIGH |

---

## Actionable Recommendations (Priority Order)

### 🔴 Priority 1: Deployment Blockers (Do First)

1. **Fix port configuration in all 3 services**
   - Change `API_GATEWAY_PORT` → `PORT` in `apps/api-gateway/src/main.ts`
   - Change `AUTH_PORT` → `PORT` in `services/auth-service/src/main.ts`
   - Change `WORKSPACE_PORT` → `PORT` in `services/workspace-service/src/main.ts`

2. **Add Next.js standalone output**
   ```typescript
   // apps/web/next.config.ts
   output: 'standalone',
   ```

3. **Implement Redis adapter for WebSocket**
   - Install: `pnpm add @socket.io/redis-adapter redis`
   - Update `websocket.gateway.ts` with Redis pub/sub

4. **Add NATS token authentication**
   - Create `config/nats.conf`
   - Add token to all service connection configs

### 🟡 Priority 2: Production Readiness (Do Second)

5. **Add health check endpoints** to all services

6. **Implement graceful shutdown** with SIGTERM handlers

7. **Create production Dockerfiles**
   - Current Dockerfiles in `docker/` are development-focused
   - Need multi-stage builds for smaller images

### 🟢 Priority 3: Nice to Have (Do Later)

8. Rate limiting (single tier, 100 req/min)

9. Enhanced CORS validation

10. CI/CD pipeline (cloudbuild.yaml)

---

## Summary

| Category | Score |
|----------|-------|
| **Small team suitability** | ⭐⭐⭐⭐⭐ (5/5) — 5-service approach is ideal |
| **Simplicity** | ⭐⭐⭐⭐ (4/5) — Some over-engineering in docs |
| **Service split logic** | ⭐⭐⭐⭐⭐ (5/5) — Responsibilities are correctly placed |
| **WebSocket approach** | ⭐⭐⭐⭐ (4/5) — Good design, needs Redis adapter |
| **Documentation consistency** | ⭐⭐⭐ (3/5) — Some contradictions between docs |
| **Production readiness** | ⭐⭐ (2/5) — Critical code changes missing |

**Bottom Line**: The architecture is **good for your constraints**. The documents identify the right problems but occasionally over-prescribe solutions. Fix the 4 deployment blockers, implement health checks and graceful shutdown, and you're production-ready. Skip the fancy observability and CRDT features until you actually need them.

---

> **Version**: 1.0  
> **Estimated time to production-ready**: 3-4 hours of focused work
