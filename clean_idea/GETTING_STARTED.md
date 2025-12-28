# 🚀 Getting Started - Step by Step

## 📋 Prerequisites

### What You Need to Know
- ✅ JavaScript/TypeScript (intermediate level)
- ✅ React basics (components, hooks, state)
- ✅ Node.js basics (npm, basic server)
- ✅ Git (clone, commit, push)
- ⚠️ Don't need to know: Phaser.js, NestJS, Prisma (you'll learn!)

### What to Install
```bash
# 1. Node.js 20 LTS
# Download: nodejs.org
# Verify: node --version (should show v20.x.x)

# 2. pnpm (fast package manager)
npm install -g pnpm
# Verify: pnpm --version

# 3. Docker Desktop
# Download: docker.com
# Verify: docker --version

# 4. VS Code (recommended)
# Download: code.visualstudio.com

# 5. Git
# Download: git-scm.com
# Verify: git --version
```

---

## 🎯 Week-by-Week Plan

### Week 1: Setup & Basic UI

**Goal: Login page + Dashboard skeleton**

**Day 1-2: Project Setup**
```bash
# Create project structure
mkdir ft_trans
cd ft_trans

# Frontend (Next.js)
npx create-next-app@latest frontend
cd frontend
pnpm install

# Backend (NestJS)
cd ..
npx @nestjs/cli new backend
cd backend
pnpm install
```

**Day 3-4: Authentication**
- User registration
- Login/logout
- JWT tokens
- Protected routes

**Day 5-7: Basic Dashboard**
- Header with navigation
- Sidebar menu
- Empty sections (will fill later)
- Styling with TailwindCSS

**Checkpoint:** You can login and see a dashboard!

---

### Week 2: Database & Tasks

**Goal: Create, view, and manage tasks**

**Day 1-2: Database Setup**
```bash
cd backend

# Install Prisma
pnpm install prisma @prisma/client

# Initialize Prisma
npx prisma init

# Start PostgreSQL with Docker
docker-compose up -d postgres
```

**Day 3-4: Task API**
Create backend endpoints:
- POST /tasks (create task)
- GET /tasks (list tasks)
- PATCH /tasks/:id (update task)
- DELETE /tasks/:id (delete task)

**Day 5-7: Task UI**
Create frontend pages:
- Task list
- Create task form
- Task detail view
- Simple kanban board

**Checkpoint:** You can create and manage tasks!

---

### Week 3: 2D Office (The Fun Part!)

**Goal: Basic 2D office where you can walk around**

**Day 1-2: Phaser Setup**
```bash
cd frontend
pnpm install phaser

# Create game folder
mkdir -p game/scenes
```

**Day 3-4: First Scene**
Create simple office:
- Basic tilemap (floor, walls)
- Player character
- Arrow key movement
- Camera follows player

**Day 5-7: Multi-player Basics**
- Show other players' avatars
- Update positions via WebSocket
- Username labels above avatars

**Checkpoint:** You can walk around with your avatar and see others!

---

### Week 4: Real-Time Features

**Goal: Live updates, chat, and presence**

**Day 1-2: WebSocket Setup**
```bash
# Backend
cd backend
pnpm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Frontend
cd frontend
pnpm install socket.io-client
```

**Day 3-4: Real-Time Updates**
- Task updates broadcast to team
- Presence system (online/offline)
- Typing indicators

**Day 5-7: Chat**
- Team chat interface
- Send/receive messages
- Chat history
- Emoji support

**Checkpoint:** Tasks update live, you can chat!

---

### Week 5: Polish & Features

**Goal: AI office generator + improvements**

**Day 1-3: AI Office Generator (Optional)**
```bash
# Create AI service
cd ..
mkdir ai-service
cd ai-service
pip install fastapi openai
```

Generate office layout based on team size.

**Day 4-7: Improvements**
- Better graphics for 2D office
- Task filters and search
- Sprint planning view
- Avatar customization
- Voice chat (if time)

**Checkpoint:** Polished, feature-complete app!

---

### Week 6: Testing & Deployment

**Goal: Bug-free, deployed, documented**

**Day 1-3: Testing**
- Fix bugs
- Test all features
- Get friends to try it
- Performance optimization

**Day 4-5: Documentation**
- README with screenshots
- How to run locally
- Architecture explanation
- API documentation

**Day 6-7: Deployment (Optional)**
- Deploy to Railway/Vercel
- Set up domain
- Create demo video

**Checkpoint:** Ready for evaluation!

---

## 🔧 Development Workflow

### Daily Routine

**Morning:**
```bash
# Start database
docker-compose up -d

# Terminal 1: Backend
cd backend
pnpm run dev

# Terminal 2: Frontend  
cd frontend
pnpm run dev
```

**During Development:**
- Make small changes
- Test immediately
- Commit often (every feature)
- Push to GitHub daily

**Evening:**
```bash
# Stop containers
docker-compose down

# Commit changes
git add .
git commit -m "Added feature X"
git push
```

---

## 📦 Docker Setup (Simple)

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: ft_trans

  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

**Usage:**
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot connect to database"
```bash
# Check if PostgreSQL is running
docker ps

# Restart database
docker-compose restart postgres

# Check connection in Prisma schema
DATABASE_URL="postgresql://dev:dev@localhost:5432/ft_trans"
```

### Issue: "Port 3000 already in use"
```bash
# Find process using port
lsof -ti:3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or use different port
pnpm run dev -- -p 3001
```

### Issue: "Module not found"
```bash
# Clear node_modules and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Issue: "WebSocket not connecting"
```bash
# Check CORS settings in backend
# Check Socket.io URL in frontend
# Check firewall/antivirus
```

---

## 📚 Learning Resources

### Next.js
- Official tutorial: nextjs.org/learn
- Time: 2-3 hours

### Phaser.js
- Official examples: phaser.io/examples
- Tutorial: "Making your first Phaser 3 game"
- Time: 2-4 hours

### NestJS
- Official docs: docs.nestjs.com
- Tutorial: "First steps"
- Time: 2-3 hours

### Prisma
- Official quickstart: prisma.io/docs/getting-started
- Time: 1 hour

### Socket.io
- Official tutorial: socket.io/get-started/chat
- Time: 1 hour

---

## ✅ Checkpoints (Am I on Track?)

### After Week 1
- [ ] Can login/register
- [ ] See dashboard
- [ ] Code is organized
- [ ] Git repo set up

### After Week 2
- [ ] Database connected
- [ ] Can create tasks
- [ ] Tasks show in list
- [ ] Basic kanban works

### After Week 3
- [ ] 2D office loads
- [ ] Can move avatar
- [ ] See other players
- [ ] No major bugs

### After Week 4
- [ ] Real-time updates work
- [ ] Chat functional
- [ ] Presence indicators
- [ ] WebSocket stable

### After Week 5
- [ ] Polish looks good
- [ ] AI generator works (or skipped)
- [ ] Most features done
- [ ] Performance good

### After Week 6
- [ ] All bugs fixed
- [ ] Documentation complete
- [ ] Ready to demo
- [ ] Deployed (optional)

---

## 🎯 Minimum Viable Product (MVP)

### Must Have
- ✅ User authentication
- ✅ Create/manage tasks
- ✅ Basic kanban board
- ✅ 2D office with movement
- ✅ Real-time chat
- ✅ Team management

### Nice to Have
- 🎨 Beautiful graphics
- 🎤 Voice chat
- 🤖 AI office generator
- 📊 Analytics
- 🏆 Achievements

### Can Skip
- ❌ Mobile app
- ❌ Blockchain
- ❌ Advanced analytics
- ❌ Integrations

**Focus on MVP first! Add extras only if time permits.**

---

## 💪 Motivation Tips

### When Stuck
- Break problem into smaller pieces
- Google the error message
- Ask ChatGPT/Copilot for help
- Take a break, come back fresh
- Skip hard features temporarily

### When Behind Schedule
- Cut nice-to-have features
- Focus on core functionality
- Simple is better than complex
- You can always add more later

### When Overwhelmed
- Remember: You have 6 weeks!
- One feature at a time
- Small progress every day
- Your project is already impressive

---

## 🎓 42 School Tips

### For Evaluation
- **Demo first, explain later** - Show it working!
- **Know your tech** - Understand why you chose each tool
- **Explain challenges** - What was hard? How did you solve it?
- **Show code quality** - Clean, organized, commented
- **Highlight unique features** - 2D office, real-time, AI

### Defense Preparation
- Test EVERYTHING before evaluation
- Have backup plan if WiFi fails
- Prepare 5-min demo flow
- Know your architecture cold
- Practice explaining technical choices

---

## 🚀 You Got This!

**Remember:**
- Start simple, add complexity gradually
- Working > Perfect
- Progress over perfection
- Ask for help when stuck
- Enjoy the journey!

**You're building something cool! Good luck! 🍀**
