# 🚀 ft_transcendence

> **Collaborative Workspace with 2D Metaverse** - A modern SaaS platform where teams manage work inside a virtual office

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🎯 What is ft_transcendence?

A **real-time collaborative workspace** that combines professional task management with an engaging **2D virtual office**. Think of it as **"Jira meets The Sims"** for remote teams.

### Key Features

- 🎮 **2D Virtual Office** - Walk around, interact with teammates using Phaser.js
- ✅ **Task Management** - Kanban boards, sprints, and real-time updates
- 💬 **Real-time Chat** - Team chat and direct messages
- 🔐 **Enterprise Auth** - 2FA, OTP, OAuth, session management
- 🏢 **Workspaces** - Multi-tenant with role-based access control
- 🤖 **AI Office Generator** - Auto-generate office layouts (optional)

---

## 🚀 Quick Start with Docker

### Prerequisites

- **Docker** & Docker Compose ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

### 1. Clone & Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd ft_trans

# Copy environment template
cp .env.template .env

# Edit .env and add your secrets
# Generate secrets with: openssl rand -base64 32
```

### 2. Start All Services

```bash
# Build and start all containers
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

> **Note on SSL Certificates**: The web container will automatically generate self-signed SSL certificates on first run. If you want to generate them manually before starting Docker, run:
> ```bash
> pnpm run generate:certs
> ```
> The web service will work with or without SSL certificates (fallback to HTTP if not found).

### 3. Access the Application

- **Frontend**: https://localhost:3000 (or http://localhost:3000 if no SSL certs)
- **API Gateway**: http://localhost:4000
- **API Documentation**: http://localhost:4000/api/docs
- **Mailpit UI**: http://localhost:8025
- **NATS Management**: http://localhost:8222

---

## 🏗️ Architecture

### Services

| Service         | Port | Description                    |
| --------------- | ---- | ------------------------------ |
| **web**         | 3000 | Next.js 16 frontend            |
| **api-gateway** | 4000 | NestJS API Gateway + WebSocket |
| **postgres**    | 5432 | PostgreSQL 16 database         |
| **redis**       | 6379 | Cache & sessions               |
| **nats**        | 4222 | Message bus                    |
| **mailpit**     | 8025 | Email testing                  |

### Tech Stack

**Frontend:**

- Next.js 16 (App Router)
- Phaser.js 3 (2D game engine)
- Tailwind CSS 4 + shadcn/ui
- Zustand (state management)
- Socket.io (real-time)

**Backend:**

- NestJS 10 (microservices)
- PostgreSQL 16 (database)
- Prisma 6 (ORM)
- Redis 7 (cache & sessions)
- NATS (message bus)
- Better Auth (authentication)

**Infrastructure:**

- Docker & Docker Compose
- Turborepo (monorepo)
- pnpm (package manager)

---

## 📦 Available Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Rebuild specific service
docker-compose up -d --build web

# Run database migrations
docker-compose exec api-gateway pnpm run migrate

# Seed database
docker-compose exec api-gateway pnpm run seed

# Access container shell
docker-compose exec web sh
docker-compose exec api-gateway sh
```

---

## 🔧 Development

### Hot Reload

Both `web` and `api-gateway` containers are configured with hot reload:

- Changes to code are automatically detected
- No need to rebuild containers during development

### Adding Dependencies

```bash
# Add to web app
docker-compose exec web pnpm add <package-name>

# Add to api-gateway
docker-compose exec api-gateway pnpm add <package-name>

# Rebuild after adding dependencies
docker-compose up -d --build
```

### Database Migrations

```bash
# Create migration
docker-compose exec api-gateway pnpm run migrate:create

# Run migrations
docker-compose exec api-gateway pnpm run migrate

# Reset database
docker-compose down -v
docker-compose up -d
```

---

## 📚 Documentation

- [Requirements Extract](docs/REQUIREMENTS_EXTRACT.md)
- [Architecture Plan](docs/ARCHITECTURE_PLAN.md)
- [Security Guide](docs/SECURITY.md)
- [Decision Records](docs/DECISIONS.md)

---

## 🔐 Security

This project implements security best practices:

- ✅ Password hashing (bcrypt)
- ✅ 2FA (TOTP)
- ✅ Session management
- ✅ Rate limiting
- ✅ CSRF protection
- ✅ Input validation (Zod)
- ✅ Audit logging
- ✅ Secure headers

See [SECURITY.md](docs/SECURITY.md) for details.

---

## 🐛 Troubleshooting

### Containers won't start

```bash
# Check Docker is running
docker ps

# View container logs
docker-compose logs

# Restart services
docker-compose restart
```

### Port already in use

```bash
# Stop conflicting services
docker-compose down

# Or change ports in docker-compose.yml
```

### Database connection issues

```bash
# Wait for postgres to be healthy
docker-compose ps

# Check postgres logs
docker-compose logs postgres
```

---

## 🚢 Production Deployment

For production deployment, use `docker-compose.prod.yml`:

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- **42 School** - Project framework
- **Next.js Team** - Amazing framework
- **NestJS Team** - Excellent backend framework
- **Phaser.js** - 2D game engine

---

**Built with ❤️ for 42 School**

## 🎉 Current Status

- ✅ Phase 1: Infrastructure Complete
- 🚧 Phase 2: Authentication In Progress
- ⏳ Phase 3: Core Features Pending
- ⏳ Phase 4: Production Polish Pending
