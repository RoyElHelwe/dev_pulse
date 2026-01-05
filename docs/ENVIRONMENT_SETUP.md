# Environment Variables Setup

This document explains how to configure environment variables for local development.

## Quick Start

1. Copy the template file:
   ```bash
   cp .env.template .env
   ```

2. The default values in `.env.template` are already configured for local development with Docker Compose.

3. Start the services:
   ```bash
   docker-compose up -d
   ```

## Environment Variables Reference

### Node Environment
- `NODE_ENV`: Application environment (`development`, `production`, `test`)

### Database
- `DATABASE_URL`: PostgreSQL connection string
  - **Local**: `postgresql://dev:dev@localhost:5432/ft_trans?schema=public`
  - **Docker**: Automatically uses postgres service name

### Redis
- `REDIS_URL`: Redis connection string
  - **Local**: `redis://localhost:6379`

### NATS Message Bus
- `NATS_URL`: NATS server connection
  - **Local**: `nats://localhost:4222`

### API Gateway
- `API_GATEWAY_PORT`: Port for API Gateway (default: `4000`)
- `AUTH_SERVICE_URL`: Auth service URL
  - **Local**: `http://localhost:3001`
  - **Docker**: `http://auth-service:3001`

### Auth Service
- `PORT`: Auth service port (default: `3001`)
  - **Note**: Commented out in template because docker-compose sets it
- `COOKIE_DOMAIN`: Domain for session cookies
  - **Local**: `localhost`
  - **Production**: Your domain
- `FRONTEND_URL`: Frontend application URL (default: `http://localhost:3000`)

### Workspace Service
- `PORT`: Workspace service port (default: `3002`)
  - **Note**: Commented out in template because docker-compose sets it
- `APP_URL`: Application URL for invitation links (default: `http://localhost:3000`)
- `RESEND_API_KEY`: Resend API key for sending emails
  - Development uses test key: `re_6mEgpVsA_MWPE891Syc988VkcU5TJNEQ4`
- `EMAIL_FROM`: Email sender address (default: `FT Transcendence <onboarding@resend.dev>`)

### Web Frontend
- `NEXT_PUBLIC_API_URL`: API Gateway URL (default: `http://localhost:4000`)
- `NEXT_PUBLIC_WS_URL`: WebSocket URL (default: `ws://localhost:4000`)

### Security & CORS
- `CORS_ORIGINS`: Comma-separated list of allowed origins
  - Default: `http://localhost:3000,http://localhost:4000`

### OAuth Providers (Optional)
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

## Docker Compose vs Local Development

The project is designed to run with Docker Compose, where services communicate using Docker network names:

```yaml
# docker-compose.yml handles service discovery
DATABASE_URL=postgresql://dev:dev@postgres:5432/ft_trans
NATS_URL=nats://nats:4222
REDIS_URL=redis://redis:6379
AUTH_SERVICE_URL=http://auth-service:3001
```

For local development without Docker, use `localhost`:

```bash
DATABASE_URL=postgresql://dev:dev@localhost:5432/ft_trans
NATS_URL=nats://localhost:4222
REDIS_URL=redis://localhost:6379
AUTH_SERVICE_URL=http://localhost:3001
```

## Important Notes

⚠️ **Never commit the `.env` file to version control!** It's already in `.gitignore`.

⚠️ **All environment variables are now required.** The code no longer has fallback values, so ensure all necessary variables are set in your `.env` file.

## Testing Email Functionality

For local development, the project uses a test Resend API key. Emails will be captured but not actually sent. For production, you'll need to:

1. Sign up for a Resend account
2. Get your API key
3. Update `RESEND_API_KEY` in your production environment

## Troubleshooting

### Services can't connect to each other
- Check that Docker Compose is using the correct network
- Verify service names in `docker-compose.yml` match environment variables

### Authentication cookies not working
- Ensure `COOKIE_DOMAIN` matches your domain
- Check that `CORS_ORIGINS` includes your frontend URL
- Verify `FRONTEND_URL` in auth service matches your app URL

### Database connection fails
- Ensure PostgreSQL is running
- Check the database URL format and credentials
- Verify the schema name in the connection string

### NATS connection errors
- Confirm NATS server is running
- Check the NATS URL is correct for your environment
