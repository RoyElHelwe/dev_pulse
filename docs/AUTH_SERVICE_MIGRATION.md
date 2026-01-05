# Auth Service Migration

## Overview
The authentication logic has been successfully moved from the API Gateway to a dedicated microservice (`auth-service`).

## What Was Moved

### From `apps/api-gateway` to `services/auth-service`:
- **Auth Module**: Complete authentication module with controller, service, and guards
- **Auth Controller**: All auth endpoints (register, login, 2FA, sessions, etc.)
- **Auth Service**: Core business logic for authentication
- **Auth Guard**: Session validation guard
- **Prisma Schema**: User, Account, Session, and VerificationToken models
- **2FA Support**: TOTP-based two-factor authentication with QR code generation

## Architecture Changes

### Before:
```
API Gateway
├── Auth Module (local)
├── Auth Service (local)
├── Auth Guard (local)
└── Prisma (users, sessions, accounts)
```

### After:
```
API Gateway
├── Auth Proxy Service (HTTP/NATS client)
├── Auth Guard (uses proxy)
└── Auth Controller (proxy endpoints)
    ↓
Auth Service (Microservice)
├── Auth Module
├── Auth Service (business logic)
├── Auth Guard
└── Prisma (users, sessions, accounts)
```

## Communication

The API Gateway communicates with the Auth Service using:
1. **HTTP/REST**: For proxying client requests (via axios)
2. **NATS**: For inter-service communication (validate_session, get_user_by_id)

## Configuration

### Environment Variables

**Auth Service** (`port 3001`):
- `DATABASE_URL`: PostgreSQL connection string
- `NATS_URL`: NATS server URL
- `PORT`: Service port (3001)
- `COOKIE_DOMAIN`: Cookie domain for sessions

**API Gateway** (`port 4000`):
- `AUTH_SERVICE_URL`: URL to auth service (http://auth-service:3001)
- `NATS_URL`: NATS server URL

### Docker Services

Updated `docker-compose.yml` to include:
- `auth-service` on port 3001
- `workspace-service` moved to port 3002 (to avoid conflict)
- API Gateway depends on both auth-service and workspace-service

## Testing Steps

1. **Start the services**:
   ```powershell
   docker-compose up --build
   ```

2. **Verify auth-service is running**:
   - Check logs: `docker-compose logs auth-service`
   - Visit Swagger docs: http://localhost:3001/api

3. **Test authentication flow**:
   - Register: POST http://localhost:4000/auth/register
   - Login: POST http://localhost:4000/auth/login
   - Get user: GET http://localhost:4000/auth/me

4. **Run database migrations**:
   ```powershell
   docker-compose exec auth-service pnpm prisma migrate deploy
   ```

## Benefits

1. **Separation of Concerns**: Auth logic is isolated in its own service
2. **Scalability**: Auth service can be scaled independently
3. **Security**: Auth data is isolated from other services
4. **Maintainability**: Easier to maintain and update auth features
5. **Reusability**: Other services can use the auth service via NATS

## Next Steps

1. Install dependencies: `pnpm install`
2. Generate Prisma client for auth service: `cd services/auth-service && pnpm prisma generate`
3. Run migrations: `docker-compose exec auth-service pnpm prisma migrate deploy`
4. Test the authentication flow
5. (Optional) Remove old auth files from api-gateway after verification

## Notes

- Session cookies are still managed by the API Gateway (proxy pattern)
- The auth service returns Set-Cookie headers that the gateway forwards to clients
- NATS is used for session validation to avoid HTTP overhead
- The old auth service files in api-gateway can be deleted after testing
