# Architecture Decision Records (ADRs)

## ADR-001: Monorepo Tool Selection

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need to manage multiple applications and services in a single repository with efficient builds and caching.

### Decision

Use **Turborepo** over Nx or plain pnpm workspaces.

### Rationale

- **Superior Caching**: Remote caching support for CI/CD
- **Incremental Builds**: Only rebuild what changed
- **Task Orchestration**: Parallel builds with dependency tracking
- **Performance**: Significantly faster than alternatives
- **Developer Experience**: Simple configuration, great documentation
- **Built on pnpm**: Still uses pnpm workspaces underneath

### Consequences

- **Positive**: Faster builds, better CI/CD performance, excellent DX
- **Negative**: Additional dependency, learning curve for team

---

## ADR-002: Message Bus Selection

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need inter-service communication for microservices architecture with event-driven patterns.

### Decision

Use **NATS** over Redis Pub/Sub or RabbitMQ.

### Rationale

- **Lightweight**: Minimal overhead, fast performance
- **Cloud-Native**: Designed for microservices from the ground up
- **Request-Reply**: Supports both pub/sub and request-reply patterns
- **Persistence**: NATS JetStream for event sourcing
- **Simple Setup**: Easy Docker container, minimal configuration
- **Performance**: Millions of messages per second capability

**Alternatives Considered**:

- **Redis Pub/Sub**: No message persistence, fire-and-forget only
- **RabbitMQ**: Heavier, more complex setup, overkill for our needs

### Consequences

- **Positive**: Fast, reliable, easy to scale
- **Negative**: Less familiar than Redis/RabbitMQ, smaller ecosystem

---

## ADR-003: State Management (Frontend)

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need client-side state management for Next.js application.

### Decision

Use **Zustand** over Redux or Context API.

### Rationale

- **Simple API**: Less boilerplate than Redux
- **Performance**: No unnecessary re-renders
- **TypeScript**: Excellent TypeScript support
- **DevTools**: Compatible with Redux DevTools
- **Bundle Size**: ~1KB, minimal overhead
- **Flexibility**: Works with React Server Components

**Alternatives Considered**:

- **Redux**: Too much boilerplate, overkill for our needs
- **Context API**: Performance issues with frequent updates
- **Jotai/Recoil**: More complex, atomic state not needed

### Consequences

- **Positive**: Fast development, great performance, small bundle
- **Negative**: Less ecosystem support than Redux

---

## ADR-004: Authentication Library

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need comprehensive authentication system with 2FA, OTP, OAuth, sessions, and device management.

### Decision

Use **Better Auth** over NextAuth or Lucia.

### Rationale

- **All Features Built-in**: 2FA, OTP, magic links, OAuth, sessions, device tracking
- **Modern**: Built for Next.js 14+, supports App Router
- **Flexible**: Database-agnostic, works with Prisma
- **Type-Safe**: Full TypeScript support
- **Customizable**: Easy to extend and customize
- **Active Development**: Regular updates, good documentation

**Alternatives Considered**:

- **NextAuth**: Missing some features (device management, OTP), complex to extend
- **Lucia**: More low-level, requires more custom code
- **Custom**: Too time-consuming, reinventing the wheel

### Consequences

- **Positive**: Faster development, all features included, secure by default
- **Negative**: Newer library, smaller community

---

## ADR-005: Database Strategy

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need database architecture for microservices.

### Decision

Use **single PostgreSQL database with schema separation** over database-per-service.

### Rationale

- **Simpler for MVP**: Easier migrations, backups, management
- **ACID Transactions**: Cross-service data integrity
- **Efficient Joins**: Query across entities without network calls
- **Cost-Effective**: One database instance
- **Future-Proof**: Can split into separate DBs if needed

**Alternatives Considered**:

- **Database per Service**: More complex, harder to manage, overkill for MVP

### Consequences

- **Positive**: Simpler development, easier testing, lower costs
- **Negative**: Tighter coupling between services (acceptable for MVP)

---

## ADR-006: 2D Game Engine

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need 2D game engine for virtual office feature.

### Decision

Use **Phaser.js 3** over PixiJS or Three.js.

### Rationale

- **2D-Focused**: Built specifically for 2D games
- **Easy to Learn**: Great documentation, many examples
- **Feature-Rich**: Physics, animations, input handling built-in
- **Active Community**: Large community, lots of plugins
- **Performance**: Optimized for 2D rendering
- **WebGL + Canvas**: Automatic fallback

**Alternatives Considered**:

- **PixiJS**: Lower-level, more work to build game features
- **Three.js**: Overkill for 2D, 3D-focused
- **Custom Canvas**: Too much work, reinventing the wheel

### Consequences

- **Positive**: Faster development, rich features, good performance
- **Negative**: Larger bundle size than PixiJS

---

## ADR-007: Real-time Communication

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need real-time bidirectional communication for chat, 2D office, and live updates.

### Decision

Use **Socket.io** over raw WebSockets or Server-Sent Events.

### Rationale

- **Automatic Fallbacks**: Falls back to polling if WebSocket unavailable
- **Rooms**: Built-in room/namespace support
- **Easy API**: Simple client and server API
- **Reconnection**: Automatic reconnection handling
- **Binary Support**: Can send binary data efficiently
- **Mature**: Battle-tested, widely used

**Alternatives Considered**:

- **Raw WebSockets**: No fallback, manual reconnection logic
- **Server-Sent Events**: One-way only, not suitable for our needs

### Consequences

- **Positive**: Reliable, easy to use, handles edge cases
- **Negative**: Slightly larger than raw WebSockets

---

## ADR-008: Styling Solution

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need CSS solution for modern, responsive UI.

### Decision

Use **Tailwind CSS + shadcn/ui** over CSS Modules or component libraries.

### Rationale

- **Utility-First**: Fast development, no naming conflicts
- **Customizable**: Easy to customize design system
- **Performance**: Purges unused CSS, small bundle
- **shadcn/ui**: Copy-paste components, full control
- **TypeScript**: Type-safe with cn() utility
- **Modern**: Industry standard, great DX

**Alternatives Considered**:

- **CSS Modules**: More verbose, slower development
- **MUI/Chakra**: Less customizable, larger bundles
- **Styled Components**: Runtime overhead, complexity

### Consequences

- **Positive**: Fast development, small bundle, full control
- **Negative**: HTML can look cluttered with many classes

---

## ADR-009: Validation Library

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need input validation for frontend and backend with type safety.

### Decision

Use **Zod** over Yup or Joi.

### Rationale

- **Type Inference**: Automatic TypeScript types from schemas
- **Composable**: Easy to compose and reuse schemas
- **Runtime + Static**: Both runtime validation and static types
- **Small**: Smaller bundle than alternatives
- **Modern**: Built for TypeScript from the ground up
- **Ecosystem**: Works great with React Hook Form, tRPC

**Alternatives Considered**:

- **Yup**: No type inference, less TypeScript-friendly
- **Joi**: Node.js only, larger bundle

### Consequences

- **Positive**: Type-safe, great DX, single source of truth
- **Negative**: Learning curve for complex schemas

---

## ADR-010: Package Manager

**Date**: 2025-12-28  
**Status**: Accepted

### Context

Need package manager for monorepo.

### Decision

Use **pnpm** over npm or yarn.

### Rationale

- **Disk Efficiency**: Symlinks to global store, saves space
- **Fast**: Faster than npm and yarn
- **Strict**: Prevents phantom dependencies
- **Monorepo**: Excellent workspace support
- **Compatible**: Drop-in replacement for npm

**Alternatives Considered**:

- **npm**: Slower, less efficient
- **yarn**: Good, but pnpm is faster and more efficient

### Consequences

- **Positive**: Faster installs, less disk space, better monorepo support
- **Negative**: Less familiar than npm

---

## Summary

These decisions prioritize:

1. **Developer Experience**: Tools that are easy to use and well-documented
2. **Performance**: Fast builds, small bundles, efficient runtime
3. **Type Safety**: TypeScript-first approach
4. **Modern Stack**: Latest best practices and technologies
5. **Flexibility**: Can adapt and scale as needed
