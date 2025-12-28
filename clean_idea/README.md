# 🚀 ft_transcendence - Collaborative Workspace with 2D Metaverse

## 🎯 The Simple Idea

A **real-time collaborative workspace** where company teams manage their work inside a **2D virtual office**. Think of it as **Jira meets The Sims** - but for professional teams.

## ✨ What Makes It Different?

### The Core Concept

Instead of boring lists and tables, your team works in a **visual 2D world**:

```
Traditional Workspace (Boring):
━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Task List
  - Build API
  - Fix bug #123
  - Write docs

Just text, no interaction 😴

Your Workspace (Fun & Visual):
━━━━━━━━━━━━━━━━━━━━━━━━━
        🏢 Virtual Office

    👤      👤       👤
   Alice   Bob    Carol

Alice walks to Bob's desk
"Hey Bob, need help with that API?"
Voice chat gets louder as she gets closer!

Bob is at the whiteboard 📊
Carol is in the meeting room 🚪
```

## 🎮 The Three Main Features

### 1. **2D Virtual Office** (The Cool Part!)

**What it is:** A game-like office where people move avatars and interact

**Why it's better:**

- 🚶 Walk around the office (feels like being there)
- 🗣️ Proximity voice chat (closer = louder, like real life)
- 👀 See who's at their desk, in meetings, or away
- 🤝 Natural collaboration (walk up to someone's desk)
- 🎨 Customize your office layout

**Example:**

```
Your Office Layout:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────────────────────────┐
│         VIRTUAL OFFICE              │
│                                     │
│  🪑 Alice    🪑 Bob    🪑 Carol    │  ← Developer desks
│                                     │
│  📊 Whiteboard      🖥️ Screen      │  ← Collaboration area
│                                     │
│  🚪 Meeting Room    ☕ Break Room  │  ← Special rooms
│                                     │
│  🌳 Garden (chill zone)            │  ← Relax area
└─────────────────────────────────────┘
```

### 2. **Smart Task Management** (The Practical Part!)

**What it is:** Normal project management but visual and real-time

**Features:**

- ✅ Create tasks, assign to people
- 📊 Kanban board (To Do → In Progress → Done)
- 🏃 Sprint planning
- 💬 Real-time chat and updates
- 📈 Team progress tracking

**But here's the twist:**

- See task status IN the 2D office (icons above desks)
- Walk to teammate's desk to discuss tasks
- Whiteboard for brainstorming
- Meeting rooms for sprint planning

### 3. **AI Workspace Generator** (The Magic Part!)

**What it is:** AI creates your office layout automatically

**How it works:**

```
Step 1: You tell AI about your team
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"I have 3 frontend devs, 2 backend devs,
 1 designer, and 1 manager"

Step 2: AI generates office layout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Groups frontend devs together
✅ Puts backend devs nearby
✅ Designer gets creative space
✅ Manager near the team
✅ Adds meeting room
✅ Adds whiteboard for collaboration

Step 3: Done!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your perfect office is ready in 30 seconds!
```

## 🛠️ Technology Stack (Simple Version)

### Frontend

- **Next.js 16** - Modern React framework
- **Phaser.js** - 2D game engine (for the office)
- **TypeScript** - Type safety
- **TailwindCSS** - Styling

### Backend

- **NestJS** - Node.js framework
- **PostgreSQL** - Database
- **Socket.io** - Real-time updates
- **Redis** - Fast caching

### AI

- **OpenAI GPT-4** - Generate office layouts
- **Python FastAPI** - AI service

### Infrastructure

- **Docker** - Easy deployment
- **Nginx** - Web server

## 📁 Project Structure (Simplified)

```
ft_trans/
├── frontend/               # Next.js app
│   ├── game/              # 2D office (Phaser.js)
│   ├── components/        # UI components
│   └── features/          # Task management, chat
│
├── backend/               # NestJS API
│   ├── tasks/            # Task management
│   ├── teams/            # Team management
│   └── websocket/        # Real-time updates
│
├── ai-service/           # AI workspace generator
│   └── generator.py      # GPT-4 integration
│
└── docker/               # Deployment files
```

## 🎯 Core Features (What You'll Build)

### Phase 1: Basic Workspace

- ✅ User login/registration
- ✅ Create teams
- ✅ Basic task management (create, assign, complete)
- ✅ Simple 2D office (walk around)
- ✅ Real-time chat

### Phase 2: Advanced Features

- ✅ Proximity voice chat
- ✅ Kanban boards
- ✅ Sprint planning
- ✅ AI office generator
- ✅ Better 2D graphics

### Phase 3: Polish

- ✅ Performance optimization
- ✅ Mobile-friendly
- ✅ Testing
- ✅ Documentation

## 🚀 Why This Is Perfect for 42

### Shows Advanced Skills

- ✅ Full-stack development (Next.js + NestJS)
- ✅ Real-time systems (WebSocket)
- ✅ Game development (Phaser.js)
- ✅ AI integration (GPT-4)
- ✅ Database design (PostgreSQL)
- ✅ DevOps (Docker)

### Unique & Impressive

- 🎮 2D metaverse (not just another CRUD app)
- 🤖 AI-powered (cutting edge)
- 🚀 Real-time collaboration (advanced)
- 🎨 Visual and fun (memorable in demos)

### Practical & Useful

- 💼 Solves real problems (remote work collaboration)
- 🏢 Companies could actually use it
- 📈 Portfolio piece that stands out

## 🎮 How It Works (User Journey)

### 1. **Manager Creates Team**

```
1. Sign up / Login
2. Create team: "Development Team"
3. Invite members: alice@company.com, bob@company.com
4. AI generates office layout
5. Done!
```

### 2. **Team Members Join**

```
1. Receive invitation email
2. Click link, create account
3. Enter the virtual office
4. See avatar, can walk around
5. Start working!
```

### 3. **Daily Work**

```
Morning:
- Alice walks to her desk 🪑
- Sees tasks on Kanban board
- Picks up task: "Build login API"
- Status shows above her avatar: "Working on login API"

During Day:
- Bob walks to Alice: "Need help?"
- Voice chat activates (proximity-based)
- They discuss at whiteboard
- Update task status together

End of Day:
- Alice marks task "Done"
- Task moves on Kanban board
- Team sees progress
- Walk to break room 😊
```

## 💡 The "Aha!" Moment

**Problem with traditional tools:**

- Remote work feels isolated
- Just staring at lists all day
- No sense of "being together"
- Hard to casually ask questions

**Your solution:**

- Feel like you're in an office together
- See who's working on what
- Natural interactions (walk up and talk)
- Fun + productive = better team culture

## 🎨 Visual Examples

### Traditional Tool (Boring):

```
JIRA / Asana / Monday.com
━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────────┐
│ Tasks                  │
│ □ Build API           │
│ □ Fix bug             │
│ □ Write docs          │
└────────────────────────┘

Just a list. No context. No interaction.
```

### Your Tool (Exciting):

```
ft_transcendence
━━━━━━━━━━━━━━━━━━━━━━
    🏢 VIRTUAL OFFICE

👤 Alice          📊 Kanban Board
   "Building         ┌─────────┐
    login API"       │ To Do   │
                     │  3 tasks│
                     └─────────┘
👤 Bob
   "In meeting"      ┌─────────┐
                     │Progress │
🚪 Meeting Room      │  2 tasks│
   👤 Carol          └─────────┘
   👤 Dave
   "Sprint planning" ┌─────────┐
                     │  Done   │
                     │  5 tasks│
                     └─────────┘

Visual, interactive, fun!
```

## 🎯 Success Criteria

### For 42 Evaluation

- ✅ Works smoothly (no crashes)
- ✅ Real-time updates (WebSocket)
- ✅ 2D office is playable
- ✅ Task management functional
- ✅ Clean code
- ✅ Good documentation

### Bonus Points

- 🌟 AI office generator working
- 🌟 Voice chat implemented
- 🌟 Beautiful graphics
- 🌟 Mobile responsive
- 🌟 Deployed online (demo link)

## 📝 Quick Start

```bash
# Clone and install
git clone [your-repo]
cd ft_trans
npm install

# Start database
docker-compose up -d postgres redis

# Start backend
cd backend
npm run dev

# Start frontend
cd frontend
npm run dev

# Visit http://localhost:3000
# Create account, make a team, explore!
```

## 🎓 Learning Resources

- **Next.js**: nextjs.org/docs
- **Phaser.js**: phaser.io/tutorials
- **NestJS**: docs.nestjs.com
- **Socket.io**: socket.io/docs

## 🏆 Final Thoughts

This project combines:

- 🎮 **Fun** (game-like interface)
- 💼 **Practical** (real work management)
- 🚀 **Innovative** (AI + metaverse)
- 🎯 **Achievable** (5 months, realistic scope)

**Perfect for 42 School final project!**

Good luck! 🍀
