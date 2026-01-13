# 🎯 Task Management with Blockchain - Complete Implementation Plan

## 📋 Executive Summary

This document outlines the complete implementation plan for adding **Task Management with Blockchain** to the Dev Pulse virtual office. The feature will be seamlessly integrated into the `/office` page, providing a creative and immersive way to manage tasks while leveraging blockchain for permanent task completion records.

---

## 🎨 Creative UI/UX Concept: "The Office Task Board"

### The Vision
Instead of a separate task management page, tasks live **inside the 2D virtual office**. Think of it as having physical task boards, sticky notes, and task indicators integrated into the game world.

### Key UI Elements

```
┌─────────────────────────────────────────────────────────────────────┐
│                     🏢 VIRTUAL OFFICE                                │
│                                                                      │
│  ┌─────────────────┐                     ┌─────────────────┐       │
│  │ 📋 TASK BOARD   │                     │   🖥️ MY DESK    │       │
│  │ ═══════════════ │                     │   ┌──────────┐  │       │
│  │ 🟡 Task #1      │   👤 You            │   │ 📌 3 Tasks│  │       │
│  │ 🟢 Task #2      │   ─────────>        │   │ Working  │  │       │
│  │ 🔴 Task #3      │   Walking to board  │   └──────────┘  │       │
│  └─────────────────┘                     └─────────────────┘       │
│                                                                      │
│  When you approach the Task Board:                                  │
│  ┌────────────────────────────────────────────────┐                 │
│  │              📋 TASK BOARD (Modal)             │                 │
│  │  ┌────────┬────────┬────────┬────────┐        │                 │
│  │  │📥 TODO │🔄 DOING│👁️ REVIEW│✅ DONE │        │                 │
│  │  ├────────┼────────┼────────┼────────┤        │                 │
│  │  │ Task 1 │ Task 4 │ Task 7 │ Task 9 │        │                 │
│  │  │ Task 2 │ Task 5 │        │ Task 10│        │                 │
│  │  │ Task 3 │ Task 6 │        │ 🔗✓    │        │                 │
│  │  └────────┴────────┴────────┴────────┘        │                 │
│  └────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

### Microservices Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ /office page                                                  │  │
│  │  ├── VirtualOffice (Phaser.js)                               │  │
│  │  │    ├── TaskBoard Object (Interactive)                     │  │
│  │  │    ├── DeskTaskIndicator (Per Player)                     │  │
│  │  │    └── TaskBubbles (Floating above working players)       │  │
│  │  ├── TaskBoardModal (Kanban Board UI)                        │  │
│  │  ├── QuickTaskPanel (Sidebar for quick actions)              │  │
│  │  └── BlockchainVerifiedBadge                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (NestJS)                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ TaskGatewayModule                                             │  │
│  │  ├── TaskGatewayController (REST API)                        │  │
│  │  ├── TaskWebsocketGateway (Real-time updates)                │  │
│  │  └── BlockchainGateway (Blockchain integration)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│   TASK SERVICE       │ │ WORKSPACE SERVICE    │ │ BLOCKCHAIN SERVICE   │
│   (New Microservice) │ │ (Existing)           │ │ (New Microservice)   │
│  ├── TaskModule      │ │  ├── Office          │ │  ├── Contract        │
│  ├── SprintModule    │ │  └── Workspace       │ │  ├── Web3            │
│  └── CommentModule   │ │                      │ │  └── Verification    │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
                    │                                        │
                    └──────────────┬─────────────────────────┘
                                   ▼
                    ┌──────────────────────────────────────┐
                    │          PostgreSQL + Redis          │
                    │   (Tasks, Sprints, Blockchain Hash)  │
                    └──────────────────────────────────────┘
```

---

## 👥 Role-Based Access Control (RBAC)

### Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| **OWNER** | 5 | Workspace owner, full control |
| **ADMIN** | 4 | Can manage all tasks, sprints, members |
| **MANAGER** | 3 | Can create/assign tasks, manage sprints |
| **MEMBER** | 2 | Can work on assigned tasks |
| **VIEWER** | 1 | Read-only access |

### Permission Matrix

| Action | OWNER | ADMIN | MANAGER | MEMBER | VIEWER |
|--------|-------|-------|---------|--------|--------|
| **Create Task** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Assign Task** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Edit Any Task** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Task** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View All Tasks** | ✅ | ✅ | ✅ | ✅* | ✅* |
| **View Assigned Tasks** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Update Own Task Status** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Drag to IN_PROGRESS** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Drag to REVIEW** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Drag to DONE** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Create Sprint** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage Sprint** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Add Comments** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Blockchain Records** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Verify on Blockchain** | ✅ | ✅ | ✅ | ✅ | ❌ |

*Members can view all tasks but detailed filtering by default shows assigned only

---

## 📊 Task Status Flow (State Machine)

```
                    ┌─────────────────────────────────────────────┐
                    │              TASK LIFECYCLE                 │
                    └─────────────────────────────────────────────┘

     ┌─────────┐        ┌─────────────┐        ┌─────────┐        ┌────────┐
     │  TODO   │───────▶│ IN_PROGRESS │───────▶│ REVIEW  │───────▶│  DONE  │
     └─────────┘        └─────────────┘        └─────────┘        └────────┘
          │                   │                     │                  │
          │                   │                     │                  │
          └───────────────────┴─────────────────────┘                  │
                              │                                        │
                              ▼                                        ▼
                    [Can move backward]              [Blockchain Record Created]
                    [Only MANAGER+]                  [Immutable Proof]

     ALLOWED TRANSITIONS:
     ─────────────────────────────────────────────────────────────────────
     
     MEMBER Role:
     • TODO → IN_PROGRESS     (Start working)
     • IN_PROGRESS → REVIEW   (Submit for review)
     
     MANAGER+ Role:
     • Any status → Any status (Full control)
     • REVIEW → DONE          (Approve & Complete)
     
     Special Rules:
     • When task moves to DONE → Trigger blockchain record
     • Assignee change resets status to TODO (optional setting)
     • Deadline passed → Visual indicator (🔴)
```

---

## 🎮 Interactive Office Elements

### 1. Task Board Object (In-Game)

**Location:** Central area of the office, always visible
**Interaction:** Walk near + Press `E` or Click

```typescript
// TaskBoard.ts (Phaser Game Object)
interface TaskBoardConfig {
  position: { x: number; y: number };
  size: { width: number; height: number };
  interactionRadius: number; // 100px default
}

// Visual States:
// - Idle: Glowing task board with task count
// - Hover: "Press E to open Task Board"
// - Active: Full Kanban modal opens
```

### 2. Desk Task Indicators

**Each player's desk shows:**
- Current task they're working on
- Status indicator (color coded)
- Deadline warning if applicable

```
    ┌─────────────────┐
    │   🖥️ ALICE     │
    │   ━━━━━━━━━━━   │
    │   🔵 API Task   │  ← Current task
    │   ⏰ 2h left    │  ← Deadline
    └─────────────────┘
```

### 3. Floating Task Bubbles

When a player is working on a task, a small bubble floats above their avatar:

```
        💭 "Building API"
           │
        👤 Alice
```

### 4. Quick Task Panel (Sidebar)

A collapsible panel on the right side of the office page:

```
┌──────────────────────────┐
│ 📋 MY TASKS          [−] │
├──────────────────────────┤
│ 🔵 IN PROGRESS (2)       │
│  ├─ Build API endpoint   │
│  └─ Fix login bug        │
│                          │
│ 🟡 TODO (3)              │
│  ├─ Write tests          │
│  ├─ Update docs          │
│  └─ Review PR #42        │
│                          │
│ [+ Quick Add Task]       │
└──────────────────────────┘
```

---

## 🔗 Blockchain Integration

### Smart Contract: TaskRecord.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TaskRecord {
    struct TaskCompletion {
        bytes32 taskId;          // Hash of task ID
        bytes32 workspaceId;     // Hash of workspace ID
        address worker;          // Wallet address of completer
        uint256 timestamp;       // Block timestamp
        bytes32 proofHash;       // Hash of task details
        string ipfsMetadata;     // IPFS link to full details (optional)
    }
    
    mapping(bytes32 => TaskCompletion) public completions;
    mapping(address => bytes32[]) public workerTasks;
    
    event TaskCompleted(
        bytes32 indexed taskId,
        address indexed worker,
        uint256 timestamp,
        bytes32 proofHash
    );
    
    function recordTaskCompletion(
        bytes32 _taskId,
        bytes32 _workspaceId,
        address _worker,
        bytes32 _proofHash,
        string memory _ipfsMetadata
    ) external {
        require(completions[_taskId].timestamp == 0, "Task already recorded");
        
        TaskCompletion memory completion = TaskCompletion({
            taskId: _taskId,
            workspaceId: _workspaceId,
            worker: _worker,
            timestamp: block.timestamp,
            proofHash: _proofHash,
            ipfsMetadata: _ipfsMetadata
        });
        
        completions[_taskId] = completion;
        workerTasks[_worker].push(_taskId);
        
        emit TaskCompleted(_taskId, _worker, block.timestamp, _proofHash);
    }
    
    function getWorkerCompletions(address _worker) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return workerTasks[_worker];
    }
    
    function verifyCompletion(bytes32 _taskId, address _worker) 
        external 
        view 
        returns (bool, uint256) 
    {
        TaskCompletion memory completion = completions[_taskId];
        return (completion.worker == _worker, completion.timestamp);
    }
}
```

### Blockchain Service Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN RECORDING FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

1. Task Marked as DONE
        │
        ▼
2. Generate Proof Hash
   - taskId + title + assignee + completedAt + workspaceId
   - SHA256 → bytes32
        │
        ▼
3. Queue Blockchain Transaction
   - Store in Redis queue
   - Process async to not block UI
        │
        ▼
4. Submit to Smart Contract
   - Call recordTaskCompletion()
   - Wait for confirmation
        │
        ▼
5. Store Transaction Hash
   - Update Task in DB with txHash
   - Mark as blockchain_verified: true
        │
        ▼
6. Notify Frontend
   - WebSocket: task:blockchain_verified
   - Show "🔗 Verified" badge
```

---

## 📁 Database Schema Updates

### New/Updated Prisma Models

```prisma
// =============================================================================
// ENHANCED TASK MANAGEMENT MODELS
// =============================================================================

model Task {
  id          String    @id @default(cuid())
  title       String
  description String?   @db.Text
  status      TaskStatus @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  workspaceId String
  assigneeId  String?
  creatorId   String
  sprintId    String?
  tags        String[]
  deadline    DateTime?
  
  // Task position in kanban column (for drag-drop ordering)
  position    Int       @default(0)
  
  // Time tracking
  estimatedHours Float?
  actualHours    Float?
  startedAt      DateTime?
  completedAt    DateTime?
  
  // Blockchain verification
  blockchainVerified Boolean   @default(false)
  blockchainTxHash   String?
  blockchainRecordedAt DateTime?
  proofHash          String?
  
  // Metadata
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  workspace Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  assignee  User?         @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creator   User          @relation("TaskCreator", fields: [creatorId], references: [id])
  sprint    Sprint?       @relation(fields: [sprintId], references: [id])
  comments  TaskComment[]
  activities TaskActivity[]
  
  @@index([workspaceId, status])
  @@index([assigneeId])
  @@index([sprintId])
  @@map("tasks")
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  REVIEW
  DONE
  ARCHIVED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model TaskActivity {
  id        String   @id @default(cuid())
  taskId    String
  userId    String
  action    TaskAction
  oldValue  String?
  newValue  String?
  metadata  Json?
  createdAt DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  
  @@index([taskId])
  @@map("task_activities")
}

enum TaskAction {
  CREATED
  STATUS_CHANGED
  ASSIGNED
  UNASSIGNED
  PRIORITY_CHANGED
  DEADLINE_SET
  DEADLINE_CHANGED
  COMMENT_ADDED
  BLOCKCHAIN_VERIFIED
  SPRINT_ADDED
  SPRINT_REMOVED
}

model Sprint {
  id          String   @id @default(cuid())
  name        String
  goal        String?  @db.Text
  workspaceId String
  startDate   DateTime
  endDate     DateTime
  status      SprintStatus @default(PLANNED)
  
  // Sprint metrics (calculated)
  totalTasks      Int @default(0)
  completedTasks  Int @default(0)
  totalPoints     Int @default(0)
  completedPoints Int @default(0)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks     Task[]

  @@index([workspaceId, status])
  @@map("sprints")
}

enum SprintStatus {
  PLANNED
  ACTIVE
  COMPLETED
  CANCELLED
}

// User wallet address for blockchain integration
model UserWallet {
  id        String   @id @default(cuid())
  userId    String   @unique
  address   String   @unique  // Ethereum address
  verified  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("user_wallets")
}

// Blockchain transaction records
model BlockchainRecord {
  id            String   @id @default(cuid())
  taskId        String   @unique
  txHash        String   @unique
  blockNumber   Int
  proofHash     String
  workerAddress String
  network       String   // sepolia, polygon, etc.
  status        String   @default("PENDING") // PENDING, CONFIRMED, FAILED
  gasUsed       String?
  createdAt     DateTime @default(now())
  confirmedAt   DateTime?
  
  @@index([workerAddress])
  @@map("blockchain_records")
}
```

---

## 🎛️ API Endpoints

### Task Management Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/tasks` | Get all tasks (filtered by role) | All |
| `GET` | `/tasks/:id` | Get task details | All |
| `POST` | `/tasks` | Create new task | MANAGER+ |
| `PATCH` | `/tasks/:id` | Update task | MANAGER+ (full) / MEMBER (status only) |
| `DELETE` | `/tasks/:id` | Delete task | ADMIN+ |
| `PATCH` | `/tasks/:id/status` | Update task status (drag-drop) | See flow rules |
| `POST` | `/tasks/:id/assign` | Assign task to user | MANAGER+ |
| `POST` | `/tasks/:id/comment` | Add comment | MEMBER+ |
| `GET` | `/tasks/my` | Get my assigned tasks | All |
| `GET` | `/tasks/board` | Get kanban board data | All |

### Sprint Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/sprints` | Get all sprints | All |
| `POST` | `/sprints` | Create sprint | MANAGER+ |
| `PATCH` | `/sprints/:id` | Update sprint | MANAGER+ |
| `POST` | `/sprints/:id/start` | Start sprint | MANAGER+ |
| `POST` | `/sprints/:id/complete` | Complete sprint | MANAGER+ |

### Blockchain Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/blockchain/records/:taskId` | Get blockchain record | All |
| `GET` | `/blockchain/user/:userId` | Get user's verified tasks | All |
| `POST` | `/blockchain/verify/:taskId` | Manually verify on chain | MANAGER+ |
| `GET` | `/blockchain/stats` | Get blockchain stats | All |

---

## 🔄 Real-time WebSocket Events

### Task Events

```typescript
// Server → Client
'task:created'        // New task created
'task:updated'        // Task updated (any field)
'task:deleted'        // Task deleted
'task:status_changed' // Status changed (triggers board update)
'task:assigned'       // Task assigned to user
'task:comment_added'  // New comment on task
'task:blockchain_verified' // Blockchain record confirmed

// Client → Server
'task:subscribe'      // Subscribe to workspace tasks
'task:unsubscribe'    // Unsubscribe from tasks
'task:move'           // Drag-drop status change
```

### Event Payload Examples

```typescript
// task:status_changed
{
  taskId: "clx...",
  previousStatus: "IN_PROGRESS",
  newStatus: "REVIEW",
  userId: "clx...",
  userName: "Alice",
  timestamp: 1704840000000
}

// task:blockchain_verified
{
  taskId: "clx...",
  txHash: "0x...",
  blockNumber: 12345678,
  worker: "Alice",
  verifiedAt: 1704840000000
}
```

---

## 🖥️ Frontend Components Structure

```
apps/web/
├── app/(dashboard)/office/
│   └── page.tsx                    # Enhanced with task integration
│
├── components/
│   ├── game/
│   │   ├── VirtualOffice.tsx       # Enhanced
│   │   ├── TaskBoard.tsx           # NEW: In-game task board object
│   │   ├── DeskTaskIndicator.tsx   # NEW: Task indicator above desk
│   │   └── TaskBubble.tsx          # NEW: Floating task bubble
│   │
│   ├── tasks/
│   │   ├── TaskBoardModal.tsx      # NEW: Full kanban board modal
│   │   ├── TaskCard.tsx            # NEW: Draggable task card
│   │   ├── TaskColumn.tsx          # NEW: Kanban column
│   │   ├── TaskDetailModal.tsx     # NEW: Task detail view
│   │   ├── TaskCreateForm.tsx      # NEW: Task creation form
│   │   ├── TaskQuickPanel.tsx      # NEW: Sidebar quick panel
│   │   ├── TaskComments.tsx        # NEW: Comments section
│   │   ├── BlockchainBadge.tsx     # NEW: Verified badge
│   │   └── SprintSelector.tsx      # NEW: Sprint dropdown
│   │
│   └── ui/
│       ├── drag-drop/              # NEW: DnD components
│       │   ├── DragProvider.tsx
│       │   ├── Draggable.tsx
│       │   └── Droppable.tsx
│       └── ...existing ui components
│
├── lib/
│   ├── hooks/
│   │   ├── use-tasks.ts            # NEW: Task state management
│   │   ├── use-task-board.ts       # NEW: Kanban board logic
│   │   ├── use-task-socket.ts      # NEW: Task WebSocket
│   │   └── use-blockchain.ts       # NEW: Blockchain status
│   │
│   └── game/
│       ├── objects/
│       │   ├── TaskBoardObject.ts  # NEW: Phaser task board
│       │   └── ...existing
│       └── scenes/
│           └── OfficeScene.ts      # Enhanced with task objects
```

---

## 🔧 Backend Services Structure

### New: Task Service

```
services/task-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── task/
│   │   ├── task.module.ts
│   │   ├── task.controller.ts
│   │   ├── task.service.ts
│   │   ├── task.gateway.ts          # WebSocket
│   │   └── dto/
│   │       ├── create-task.dto.ts
│   │       ├── update-task.dto.ts
│   │       └── task-status.dto.ts
│   ├── sprint/
│   │   ├── sprint.module.ts
│   │   ├── sprint.controller.ts
│   │   └── sprint.service.ts
│   └── comment/
│       ├── comment.module.ts
│       ├── comment.controller.ts
│       └── comment.service.ts
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### New: Blockchain Service

```
services/blockchain-service/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── contract/
│   │   ├── contract.module.ts
│   │   ├── contract.service.ts
│   │   └── TaskRecord.json         # ABI
│   ├── queue/
│   │   ├── queue.module.ts
│   │   └── blockchain.processor.ts
│   └── verification/
│       ├── verification.module.ts
│       └── verification.service.ts
├── contracts/
│   └── TaskRecord.sol
├── scripts/
│   └── deploy.ts
├── hardhat.config.ts
├── package.json
└── tsconfig.json
```

---

## 🎯 Implementation Phases

### Phase 1: Core Task Management (Week 1-2)

**Backend:**
- [ ] Create task-service microservice
- [ ] Implement Task CRUD operations
- [ ] Implement Sprint CRUD operations
- [ ] Add NATS message patterns
- [ ] Create TaskGatewayModule in api-gateway
- [ ] Add role-based permission guards
- [ ] Update Prisma schema

**Frontend:**
- [ ] Create TaskBoardModal component
- [ ] Implement drag-and-drop with @dnd-kit
- [ ] Create TaskCard component
- [ ] Create TaskDetailModal
- [ ] Create TaskCreateForm
- [ ] Add task hooks (use-tasks, use-task-board)

### Phase 2: Office Integration (Week 2-3)

**Game Integration:**
- [ ] Create TaskBoardObject in Phaser
- [ ] Add DeskTaskIndicator
- [ ] Implement TaskBubble floating above players
- [ ] Add interaction zones for task board
- [ ] Update OfficeScene with task elements

**UI Enhancements:**
- [ ] Create TaskQuickPanel (sidebar)
- [ ] Add keyboard shortcuts (E to interact)
- [ ] Implement task notifications
- [ ] Add visual status indicators in office

### Phase 3: Real-time & Collaboration (Week 3)

**WebSocket:**
- [ ] Implement task WebSocket gateway
- [ ] Add real-time task updates
- [ ] Sync drag-drop across clients
- [ ] Add presence indicators (who's viewing what)

**Collaboration:**
- [ ] Implement task comments
- [ ] Add @mentions in comments
- [ ] Create activity feed
- [ ] Add task notifications

### Phase 4: Blockchain Integration (Week 4)

**Smart Contract:**
- [ ] Write TaskRecord.sol
- [ ] Test on local Hardhat network
- [ ] Deploy to Sepolia testnet
- [ ] Generate ABI and types

**Blockchain Service:**
- [ ] Create blockchain-service microservice
- [ ] Implement queue processor
- [ ] Add verification endpoints
- [ ] Create BlockchainBadge component

### Phase 5: Polish & Testing (Week 5)

- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Documentation
- [ ] Docker configuration updates

---

## 🐳 Docker Updates

### docker-compose.yml additions

```yaml
# Task Service (Microservice)
task-service:
  build:
    context: .
    dockerfile: docker/Dockerfile
    target: task-service-dev
  container_name: ft_trans_task_service
  restart: unless-stopped
  ports:
    - '3003:3003'
  volumes:
    - ./services/task-service/src:/app/services/task-service/src
    - ./packages/database/src:/app/packages/database/src
    - ./packages/backend-common/src:/app/packages/backend-common/src
    - ./packages/shared-types/src:/app/packages/shared-types/src
    - ./prisma:/app/prisma
  environment:
    - NODE_ENV=${NODE_ENV:-development}
    - DATABASE_URL=${DATABASE_URL_DOCKER:-postgresql://dev:dev@postgres:5432/ft_trans}
    - NATS_URL=${NATS_URL_DOCKER:-nats://nats:4222}
    - REDIS_URL=${REDIS_URL_DOCKER:-redis://redis:6379}
    - PORT=3003
  depends_on:
    postgres:
      condition: service_healthy
    nats:
      condition: service_started
    redis:
      condition: service_healthy
  networks:
    - ft_trans_network

# Blockchain Service (Microservice)
blockchain-service:
  build:
    context: .
    dockerfile: docker/Dockerfile
    target: blockchain-service-dev
  container_name: ft_trans_blockchain_service
  restart: unless-stopped
  ports:
    - '3004:3004'
  volumes:
    - ./services/blockchain-service/src:/app/services/blockchain-service/src
    - ./packages/database/src:/app/packages/database/src
    - ./packages/backend-common/src:/app/packages/backend-common/src
  environment:
    - NODE_ENV=${NODE_ENV:-development}
    - DATABASE_URL=${DATABASE_URL_DOCKER:-postgresql://dev:dev@postgres:5432/ft_trans}
    - NATS_URL=${NATS_URL_DOCKER:-nats://nats:4222}
    - REDIS_URL=${REDIS_URL_DOCKER:-redis://redis:6379}
    - PORT=3004
    - BLOCKCHAIN_RPC_URL=${BLOCKCHAIN_RPC_URL:-https://sepolia.infura.io/v3/YOUR_KEY}
    - BLOCKCHAIN_PRIVATE_KEY=${BLOCKCHAIN_PRIVATE_KEY:-}
    - CONTRACT_ADDRESS=${CONTRACT_ADDRESS:-}
  depends_on:
    postgres:
      condition: service_healthy
    nats:
      condition: service_started
    redis:
      condition: service_healthy
  networks:
    - ft_trans_network
```

---

## 🔐 Security Considerations

### 1. Role Validation
- All task operations validate user role against workspace membership
- Status transitions are validated server-side
- Blockchain records cannot be modified once created

### 2. Rate Limiting
- Task creation: 20 per minute
- Status updates: 60 per minute
- Comments: 30 per minute
- Blockchain verification: 10 per minute

### 3. Input Validation
- All task inputs sanitized
- Maximum lengths enforced
- XSS prevention in comments

### 4. Blockchain Security
- Private key stored in secure environment variable
- Transaction signing done server-side only
- Queue prevents duplicate submissions

---

## 📊 Metrics & Analytics

### Task Metrics (Dashboard)
- Tasks completed this sprint
- Average completion time
- Tasks by status distribution
- Team velocity over time

### Blockchain Metrics
- Total tasks verified on chain
- Verification success rate
- Gas costs (estimated)
- Network status

---

## 🎨 UI/UX Highlights

### 1. Smooth Drag-and-Drop
- Uses @dnd-kit for accessible, smooth dragging
- Visual feedback during drag
- Snap-to-column effect
- Optimistic updates

### 2. In-Office Integration
- Task board glows when tasks are overdue
- Players see task icons above their heads
- Walking near task board shows preview
- Sound effects for task completion

### 3. Blockchain Verification
- Animated "Recording..." indicator
- Success celebration effect
- Etherscan link for verification
- Badge persists on completed tasks

### 4. Mobile Support
- Touch-friendly drag-and-drop
- Responsive task board
- Quick actions via floating button
- Gesture support

---

## 📝 Example User Flows

### Flow 1: Manager Creates and Assigns Task

```
1. Manager clicks Task Board in office (or presses E)
2. Kanban modal opens
3. Clicks "+ New Task" in TODO column
4. Fills form: title, description, priority, deadline
5. Assigns to team member (Alice)
6. Task appears in TODO column
7. Alice sees notification and task indicator on her desk
8. Real-time update to all workspace members
```

### Flow 2: Member Works on Task

```
1. Alice sees task assigned to her
2. Opens quick panel → sees "Build API" task
3. Drags task from TODO → IN_PROGRESS
4. Her avatar now shows 💭 "Building API"
5. Other members see her working on it
6. When done, drags IN_PROGRESS → REVIEW
7. Manager gets notification for review
```

### Flow 3: Task Completion with Blockchain

```
1. Manager reviews task in REVIEW column
2. Checks comments, code links
3. Drags REVIEW → DONE
4. System shows "Recording on blockchain..."
5. After ~15 seconds: "✅ Verified on Blockchain"
6. Task shows 🔗 badge
7. Click badge → Opens Etherscan transaction
8. Permanent proof of Alice's work!
```

---

## 🚀 Getting Started Commands

```bash
# Start all services
docker compose up -d --build

# Check logs
docker compose logs -f task-service
docker compose logs -f blockchain-service

# Run Prisma migration (if schema changed)
docker compose exec task-service pnpm prisma:push

# Deploy smart contract (one-time)
cd services/blockchain-service
npx hardhat run scripts/deploy.ts --network sepolia
```

---

## 📚 Resources

- [dnd-kit Documentation](https://dndkit.com/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Etherscan Sepolia](https://sepolia.etherscan.io/)
- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)

---

## ✅ Success Criteria

1. **Functional Requirements**
   - [ ] Tasks can be created, updated, deleted by authorized users
   - [ ] Drag-and-drop works with role restrictions
   - [ ] Members can only update their assigned tasks
   - [ ] Real-time sync across all connected clients
   - [ ] Blockchain records created for completed tasks
   - [ ] Task indicators visible in virtual office

2. **Non-Functional Requirements**
   - [ ] < 100ms latency for drag-drop updates
   - [ ] < 30s for blockchain confirmation
   - [ ] Mobile-responsive task board
   - [ ] Works offline (queues sync)
   - [ ] Accessible (keyboard navigation)

3. **Integration Requirements**
   - [ ] Seamless integration with existing office
   - [ ] No breaking changes to current features
   - [ ] Docker-only deployment
   - [ ] All services communicate via NATS

---

*This plan provides a comprehensive roadmap for implementing Task Management with Blockchain in the Dev Pulse virtual office platform.*
