/**
 * Task Management Types
 */

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  workspaceId: string;
  assigneeId?: string;
  creatorId: string;
  sprintId?: string;
  tags: string[];
  deadline?: string;
  position: number;
  estimatedHours?: number;
  actualHours?: number;
  startedAt?: string;
  completedAt?: string;
  blockchainVerified: boolean;
  blockchainTxHash?: string;
  blockchainRecordedAt?: string;
  proofHash?: string;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  sprint?: {
    id: string;
    name: string;
  };
  _count?: {
    comments: number;
  };
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  workspaceId: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  totalTasks: number;
  completedTasks: number;
  totalPoints: number;
  completedPoints: number;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
  progress?: number;
}

export interface KanbanBoard {
  TODO: Task[];
  IN_PROGRESS: Task[];
  REVIEW: Task[];
  DONE: Task[];
}

export interface BlockchainRecord {
  id: string;
  taskId: string;
  txHash: string;
  blockNumber?: number;
  proofHash: string;
  workerAddress?: string;
  network: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  gasUsed?: string;
  errorMessage?: string;
  createdAt: string;
  confirmedAt?: string;
  explorerUrl?: string;
}

export interface BlockchainStats {
  totalRecorded: number;
  pendingCount: number;
  failedCount: number;
  network: string;
  contractAddress: string;
}

// DTOs
export interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  sprintId?: string;
  tags?: string[];
  deadline?: string;
  estimatedHours?: number;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  sprintId?: string;
  tags?: string[];
  deadline?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface UpdateTaskStatusDto {
  status: TaskStatus;
  position?: number;
}

export interface CreateSprintDto {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

export interface UpdateSprintDto {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

// Column configuration for Kanban board
export const TASK_COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'TODO', title: 'To Do', color: 'bg-gray-500' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'REVIEW', title: 'Review', color: 'bg-yellow-500' },
  { id: 'DONE', title: 'Done', color: 'bg-green-500' },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; icon: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-600', icon: '⬇️' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-600', icon: '➡️' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-600', icon: '⬆️' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-600', icon: '🔥' },
};
