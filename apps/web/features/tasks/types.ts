// Mirrors apps/api/src/tasks (see docs/HANDOFF.md section 5).

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LOWEST';
export type TaskType = 'TASK' | 'BUG' | 'STORY';

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const PRIORITIES: TaskPriority[] = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW', 'LOWEST'];
export const TYPES: TaskType[] = ['TASK', 'BUG', 'STORY'];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  HIGHEST: 'Highest',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  LOWEST: 'Lowest',
};
export const TYPE_LABEL: Record<TaskType, string> = { TASK: 'Task', BUG: 'Bug', STORY: 'Story' };

export interface TaskView {
  id: string;
  key: string;
  number: number;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  reporterId: string;
  /** ISO date or null. */
  dueDate: string | null;
  /** Order inside a column (ascending). */
  rank: number;
  createdAt: string;
  updatedAt: string;
}

/** A workspace member as the board needs it (from GET /workspace/members). */
export interface BoardMember {
  userId: string;
  displayName: string;
  email?: string;
  character: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface NewTask {
  title: string;
  type?: TaskType;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export type TaskPatch = Partial<Omit<NewTask, 'title'>> & { title?: string; rank?: number };

/** Board filters (the quick filters above the columns). */
export interface BoardFilter {
  /** Multi-select of assignee ids; 'none' means unassigned. Empty = everyone. */
  assignees: string[];
  onlyMine: boolean;
  query: string;
}
