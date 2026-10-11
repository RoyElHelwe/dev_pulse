/**
 * Type definitions, status/priority constants, and filter interfaces for tasks.
 * Mirrors apps/api/src/tasks and serves as the core schema for the tasks feature.
 */

/** Workflow lane progression status from creation to completion. */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

/** Urgency ranking assigned to a task to drive triage and ordering. */
export type TaskPriority = 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LOWEST';

/** Work item categorization differentiating features, defects, and tasks. */
export type TaskType = 'TASK' | 'BUG' | 'STORY';

/** Ordered list of workflow statuses representing task board columns from left to right. */
export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

/** Ordered list of task priority levels from highest urgency to lowest. */
export const PRIORITIES: TaskPriority[] = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW', 'LOWEST'];

/** List of valid task work item categories supported by the board. */
export const TYPES: TaskType[] = ['TASK', 'BUG', 'STORY'];

/** Human-readable display names mapped from task workflow status keys. */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

/** Human-readable display names mapped from task urgency priority levels. */
export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  HIGHEST: 'Highest',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  LOWEST: 'Lowest',
};

/** Human-readable display names mapped from task work item categories. */
export const TYPE_LABEL: Record<TaskType, string> = { TASK: 'Task', BUG: 'Bug', STORY: 'Story' };

/** Task record including identity, status, ordering rank, and assignment metadata for board display. */
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

/** Creation payload containing initial attributes and optional fields for a newly posted task. */
export interface NewTask {
  title: string;
  type?: TaskType;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

/** Partial update payload specifying only the modified fields or rank position of an existing task. */
export type TaskPatch = Partial<Omit<NewTask, 'title'>> & { title?: string; rank?: number };

/** Board filters (the quick filters above the columns). */
export interface BoardFilter {
  /** Multi-select of assignee ids; 'none' means unassigned. Empty = everyone. */
  assignees: string[];
  onlyMine: boolean;
  query: string;
}
