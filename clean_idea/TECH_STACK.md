# 🛠️ Technology Stack (Simple & Clear)

## Frontend

### Main Framework

- **Next.js 15** - React framework with server components
  - Why: Fast, modern, great for real-time apps
  - Learning curve: Medium (1-2 weeks if you know React)

### 2D Game Engine

- **Phaser.js 3** - HTML5 game framework
  - Why: Easy to learn, perfect for 2D office
  - Learning curve: Easy (1 week)
  - Alternative: PixiJS, Three.js (but Phaser is simpler)

### Language

- **TypeScript** - JavaScript with types
  - Why: Catch errors early, better code
  - Learning curve: Easy if you know JavaScript

### Styling

- **TailwindCSS 4** - Utility-first CSS
  - Why: Fast development, looks good
  - Learning curve: Very easy

### Real-Time

- **Socket.io Client** - WebSocket communication
  - Why: Industry standard for real-time
  - Learning curve: Easy

### State Management

- **Zustand** - Simple state management
  - Why: Simpler than Redux
  - Learning curve: Very easy (1 day)

---

## Backend

### Main Framework

- **NestJS 10** - Node.js framework
  - Why: Well-structured, TypeScript native
  - Learning curve: Medium (1-2 weeks)
  - Alternative: Express.js (simpler but less structure)

### Database

- **PostgreSQL 16** - Relational database
  - Why: Reliable, perfect for structured data
  - Learning curve: Medium
  - Stores: Users, teams, tasks, comments

### ORM

- **Prisma 6** - Database toolkit
  - Why: Easy to use, TypeScript support
  - Learning curve: Easy (2-3 days)
  - Alternative: TypeORM

### Cache

- **Redis 7** - In-memory cache
  - Why: Fast, great for real-time features
  - Learning curve: Easy
  - Use for: WebSocket sessions, online users

### Real-Time

- **Socket.io Server** - WebSocket server
  - Why: Pairs with Socket.io client
  - Learning curve: Easy

---

## AI Service (Optional)

### AI API

- **OpenAI GPT-4** - AI for office generation
  - Why: Smart, easy to use
  - Cost: ~$0.01 per request (cheap!)
  - Alternative: Skip if no budget

### AI Backend

- **Python FastAPI** - Micro web framework
  - Why: Perfect for AI services, fast
  - Learning curve: Easy if you know Python
  - Alternative: Add to main NestJS backend

---

## Infrastructure

### Containerization

- **Docker** - Package everything
  - Why: Easy deployment, consistent environment
  - Learning curve: Easy (1-2 days)

### Web Server

- **Nginx** - Reverse proxy
  - Why: Fast, reliable
  - Learning curve: Easy (basic config only)

### Development

- **Node.js 22** - JavaScript runtime
- **pnpm** - Fast package manager
  - Alternative: npm, yarn

---

## Database Schema (Simplified)

### Core Tables

**users**

```
- id
- email
- password
- name
- avatar
- created_at
```

**teams**

```
- id
- name
- owner_id
- office_layout (JSON - coordinates)
- created_at
```

**team_members**

```
- id
- team_id
- user_id
- role (admin/manager/member)
```

**tasks**

```
- id
- title
- description
- assignee_id
- team_id
- status (todo/progress/done)
- priority
- deadline
- created_at
```

**comments**

```
- id
- task_id
- user_id
- text
- created_at
```

**messages** (Redis for real-time, optional Postgres for history)

```
- id
- team_id
- user_id
- text
- timestamp
```

---

## Project File Structure

```
ft_trans/
│
├── frontend/                    # Next.js app
│   ├── app/                    # Next.js 15 App Router
│   │   ├── (auth)/            # Login, register pages
│   │   ├── (app)/             # Main app (after login)
│   │   │   ├── office/        # 2D office view
│   │   │   ├── tasks/         # Task management
│   │   │   └── team/          # Team settings
│   │   └── layout.tsx
│   │
│   ├── components/             # Reusable components
│   │   ├── ui/                # Buttons, inputs, cards
│   │   ├── task/              # Task cards, kanban
│   │   └── chat/              # Chat components
│   │
│   ├── game/                   # Phaser.js 2D office
│   │   ├── scenes/            # Game scenes
│   │   ├── objects/           # Player, furniture
│   │   └── config.ts          # Game configuration
│   │
│   ├── lib/                    # Utilities
│   │   ├── socket.ts          # Socket.io setup
│   │   └── api.ts             # API calls
│   │
│   └── package.json
│
├── backend/                     # NestJS API
│   ├── src/
│   │   ├── auth/              # Login, register
│   │   ├── users/             # User management
│   │   ├── teams/             # Team management
│   │   ├── tasks/             # Task CRUD
│   │   ├── websocket/         # Socket.io gateway
│   │   └── main.ts            # Entry point
│   │
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   │
│   └── package.json
│
├── ai-service/                  # Optional AI service
│   ├── main.py                # FastAPI app
│   ├── generator.py           # Office layout AI
│   └── requirements.txt
│
├── docker/                      # Docker files
│   ├── docker-compose.yml     # All services
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── nginx.conf
│
└── README.md
```

---

## Development Setup (Step by Step)

### 1. Prerequisites

```bash
# Install Node.js 20
# Download from nodejs.org

# Install pnpm
npm install -g pnpm

# Install Docker
# Download from docker.com
```

### 2. Clone & Install

```bash
git clone [your-repo]
cd ft_trans

# Install frontend
cd frontend
pnpm install

# Install backend
cd ../backend
pnpm install
```

### 3. Database Setup

```bash
# Start PostgreSQL & Redis with Docker
docker-compose up -d postgres redis

# Run migrations
cd backend
pnpm prisma migrate dev
```

### 4. Start Development

```bash
# Terminal 1: Backend
cd backend
pnpm run dev
# Runs on http://localhost:4000

# Terminal 2: Frontend
cd frontend
pnpm run dev
# Runs on http://localhost:3000
```

### 5. Open Browser

```
Visit: http://localhost:3000
Create account, start building!
```

---

## External Services Needed

### Required

- ✅ **Nothing!** Everything runs locally

### Optional (If you want AI features)

- 🤖 **OpenAI API Key** - Get free trial at openai.com
  - Free tier: $5 credit
  - Should last entire development

### For Production Deployment

- 🌐 **VPS/Cloud Server** - ~$5-10/month
  - DigitalOcean, AWS, Railway, Vercel
- 🌍 **Domain Name** - ~$10/year (optional)

---

## Estimated Costs

### Development (Building the project)

- 💰 **Total: $0**
  - All tools are free
  - OpenAI trial credit: free

### Production (After 42, if you want to deploy)

- 💰 **Total: $5-15/month**
  - Server: $5-10/month
  - Database: Free tier (Supabase/Railway)
  - Domain: ~$10/year
  - OpenAI: ~$2/month (if used)

---

## Learning Timeline

### If you're comfortable with JavaScript/TypeScript:

- Week 1: Next.js basics → 2D office prototype
- Week 2: NestJS backend → Basic API
- Week 3: Database + Prisma → Data persistence
- Week 4: Socket.io → Real-time features
- Week 5: Polish + features
- Week 6: Testing + deployment prep

### Total: 6-8 weeks realistic timeline

---

## Alternatives & Simplifications

### If Phaser.js seems complex:

- Use simple HTML Canvas
- Or use a library like Konva.js
- Or even just divs with CSS positions (very simple!)

### If NestJS seems heavy:

- Use Express.js (simpler but less structure)
- Or just Next.js API routes (everything in one project)

### If PostgreSQL seems complex:

- Use SQLite (file-based, simpler)
- Or use Supabase (hosted Postgres with GUI)

### If Redis seems unnecessary:

- Skip it for MVP, add later
- Use in-memory storage for prototype

---

## Recommended Path

### MVP (Minimum Viable Product) - 4 weeks

1. **Week 1**: Login, teams, basic UI
2. **Week 2**: Simple 2D office (Phaser)
3. **Week 3**: Task CRUD + Kanban board
4. **Week 4**: Real-time updates (Socket.io)

### Polish - 2 weeks

5. **Week 5**: Voice chat, AI generator
6. **Week 6**: Testing, bugs, documentation

**Total: 6 weeks = Perfect for 42 project!**

---

## Key Principle

**Start simple, add complexity gradually!**

Don't try to build everything at once. Get basic features working first, then enhance.

Good luck! 🚀
