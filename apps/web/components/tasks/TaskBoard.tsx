'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Task, TaskStatus, KanbanBoard, TASK_COLUMNS, CreateTaskDto, CreateSprintDto } from '@/lib/types/task';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskCreateForm } from './TaskCreateForm';
import { SprintCreateForm } from './SprintCreateForm';
import { SprintManageDialog } from './SprintManageDialog';
import { useTasks } from '@/lib/hooks/use-tasks';
import { useSprints } from '@/lib/hooks/use-sprints';
import { useBlockchain } from '@/lib/hooks/use-blockchain';
import { useTaskSocket } from '@/lib/hooks/use-task-socket';
import { BlockchainVerifiedAnimation } from './BlockchainBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Plus,
  LayoutGrid,
  RefreshCw,
  Filter,
  Loader2,
  X,
  ChevronRight,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface TaskBoardProps {
  workspaceId?: string;
  userId?: string;
  userRole?: string;
  onClose?: () => void;
  workspaceMembers?: { id: string; name: string; email: string }[];
  className?: string;
  compact?: boolean;
}

export function TaskBoard({
  workspaceId,
  userId,
  userRole = 'MEMBER',
  onClose,
  workspaceMembers = [],
  className,
  compact = false,
}: TaskBoardProps) {
  const {
    board,
    loading,
    error,
    fetchBoard,
    createTask,
    updateTaskStatus,
    deleteTask,
  } = useTasks({ autoFetch: true });
  
  const { sprints, activeSprint, fetchSprints, fetchActiveSprint, createSprint, startSprint, completeSprint, loading: sprintsLoading } = useSprints();
  const { recordTaskCompletion } = useBlockchain();

  // WebSocket for real-time updates
  useTaskSocket({
    workspaceId: workspaceId || '',
    userId: userId || '',
    enabled: !!(workspaceId && userId),
    events: {
      onTaskCreated: (data) => {
        console.log('[TaskBoard] Task created via WebSocket:', data);
        fetchBoard(); // Refresh board
      },
      onTaskUpdated: (data) => {
        console.log('[TaskBoard] Task updated via WebSocket:', data);
        fetchBoard(); // Refresh board
      },
      onTaskStatusChanged: (data) => {
        console.log('[TaskBoard] Task status changed via WebSocket:', data);
        fetchBoard(); // Refresh board
      },
      onTaskAssigned: (data) => {
        console.log('[TaskBoard] Task assigned via WebSocket:', data);
        fetchBoard(); // Refresh board
      },
      onTaskDeleted: (data) => {
        console.log('[TaskBoard] Task deleted via WebSocket:', data);
        fetchBoard(); // Refresh board
      },
      onTaskBlockchainVerified: (data) => {
        console.log('[TaskBoard] Task blockchain verified via WebSocket:', data);
        fetchBoard(); // Refresh board
        setShowBlockchainAnimation(true);
      },
    },
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sprintCreateOpen, setSprintCreateOpen] = useState(false);
  const [sprintManageOpen, setSprintManageOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('all');
  const [showBlockchainAnimation, setShowBlockchainAnimation] = useState(false);

  // DnD Sensors - Optimized for smoother drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Slightly higher to prevent accidental drags
        delay: 0,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch data on mount
  useEffect(() => {
    fetchSprints();
    fetchActiveSprint();
  }, [fetchSprints, fetchActiveSprint]);

  // Permission check for status transitions
  const canTransitionTo = useCallback((fromStatus: TaskStatus, toStatus: TaskStatus): boolean => {
    // Allow all transitions for high-level roles
    console.log(userRole)
    if (userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MANAGER') {
      return true;
    }
    
    // Members can only move within these states (not to DONE)
    if (userRole === 'MEMBER') {
      return ['TODO', 'IN_PROGRESS', 'REVIEW'].includes(toStatus);
    }
    
    // Viewers can't move anything
    return false;
  }, [userRole]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task as Task;
    
    // Prevent dragging blockchain-verified tasks
    if (task.blockchainVerified) {
      event.active.rect.current.initial = null; // Cancel drag
      return;
    }
    
    setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = active.data.current?.task as Task;

    if (task.status === newStatus) return;
    
    // Prevent moving blockchain-verified tasks
    if (task.blockchainVerified) {
      console.warn('Cannot move blockchain-verified task');
      return;
    }

    // Check permission
    if (!canTransitionTo(task.status, newStatus)) {
      console.warn('Permission denied for this status transition');
      return;
    }

    try {
      const result = await updateTaskStatus(taskId, { status: newStatus });
      
      // If moved to DONE and ready for blockchain
      if (newStatus === 'DONE' && result.readyForBlockchain) {
        try {
          const blockchainResult = await recordTaskCompletion(taskId);
          setShowBlockchainAnimation(true);
          
          // Refresh the board to get the updated task with blockchainVerified flag
          // Wait a moment for the backend to update
          setTimeout(async () => {
            await fetchBoard();
          }, 500);
        } catch (err) {
          console.error('Blockchain recording failed:', err);
        }
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  // Task handlers
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailModalOpen(true);
  };

  const handleAddTask = (status: TaskStatus) => {
    setCreateModalOpen(true);
  };

  const handleCreateTask = async (dto: CreateTaskDto) => {
    await createTask(dto);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    setDetailModalOpen(false);
    setSelectedTask(null);
  };

  const handleCreateSprint = async (dto: CreateSprintDto) => {
    await createSprint(dto);
    await fetchSprints();
  };

  const handleStartSprint = async (sprintId: string) => {
    await startSprint(sprintId);
    await fetchSprints();
    await fetchActiveSprint();
  };

  const handleCompleteSprint = async (sprintId: string) => {
    await completeSprint(sprintId);
    await fetchSprints();
    await fetchActiveSprint();
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    await updateTaskStatus(taskId, { status });
    // Refresh the selected task data
    const allTasks = board ? [...board.TODO, ...board.IN_PROGRESS, ...board.REVIEW, ...board.DONE] : [];
    const updatedTask = allTasks.find(t => t.id === taskId);
    if (updatedTask) {
      setSelectedTask({ ...updatedTask, status });
    }
  };

  // Filter board by sprint - memoized for performance
  const filteredBoard: KanbanBoard | null = React.useMemo(() => {
    if (!board) return null;
    
    if (selectedSprintId === 'all') return board;
    
    return {
      TODO: board.TODO.filter(t => t.sprintId === selectedSprintId),
      IN_PROGRESS: board.IN_PROGRESS.filter(t => t.sprintId === selectedSprintId),
      REVIEW: board.REVIEW.filter(t => t.sprintId === selectedSprintId),
      DONE: board.DONE.filter(t => t.sprintId === selectedSprintId),
    };
  }, [board, selectedSprintId]);

  // Stats - memoized for performance
  const { totalTasks, completedTasks, progress } = React.useMemo(() => {
    if (!filteredBoard) {
      return { totalTasks: 0, completedTasks: 0, progress: 0 };
    }
    
    const total = filteredBoard.TODO.length + filteredBoard.IN_PROGRESS.length + 
                  filteredBoard.REVIEW.length + filteredBoard.DONE.length;
    const completed = filteredBoard.DONE.length;
    const prog = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { totalTasks: total, completedTasks: completed, progress: prog };
  }, [filteredBoard]);

  return (
    <>
      <div className={cn(
        'flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800',
        compact ? 'rounded-xl border shadow-xl' : '',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <LayoutGrid className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Task Board
                </h2>
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{totalTasks} tasks</span>
                  <span>•</span>
                  <span className="text-green-600">{progress}% complete</span>
                </p>
              </div>
            </div>

            {/* Sprint Filter */}
            <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
              <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800">
                <Filter className="w-4 h-4 mr-2 text-gray-400" />
                <SelectValue placeholder="All Sprints" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sprints</SelectItem>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>
                    {sprint.name}
                    {sprint.status === 'ACTIVE' && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Active
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBoard()}
              disabled={loading}
            >
              <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
              Refresh
            </Button>
            
            {(userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MANAGER') && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSprintManageOpen(true)}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Manage Sprints
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSprintCreateOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Sprint
                </Button>
              </>
            )}
            
            {userRole !== 'MEMBER' && (
              <Button size="sm" onClick={() => setCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New Task
              </Button>
            )}
            
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-2 bg-white/30 dark:bg-gray-800/30">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Board Content */}
        <div className="flex-1 overflow-x-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          {loading && !filteredBoard ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredBoard ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 h-full">
                {TASK_COLUMNS.map((column) => (
                  <TaskColumn
                    key={column.id}
                    status={column.id}
                    tasks={filteredBoard[column.id]}
                    onTaskClick={handleTaskClick}
                    onAddTask={handleAddTask}
                    userRole={userRole}
                    draggingTaskId={activeTask?.id}
                    canDropHere={activeTask ? canTransitionTo(activeTask.status, column.id) : true}
                  />
                ))}
              </div>
            </DndContext>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Sparkles className="w-12 h-12 mb-4 text-blue-400" />
              <p>No tasks yet. Create your first task!</p>
            </div>
          )}
        </div>

        {/* Role Permission Hint */}
        {userRole === 'MEMBER' && (
          <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-t text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
            <span>💡</span>
            <span>
              As a member, you can drag tasks between To Do, In Progress, and Review.
              Only managers can mark tasks as Done.
            </span>
          </div>
        )}
      </div>

      {/* Drag Overlay Portal - render at body level */}
      {typeof window !== 'undefined' && activeTask && createPortal(
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          zIndex: 9999999, 
          pointerEvents: 'none' 
        }}>
          <DragOverlay dropAnimation={null}>
            <TaskCard
              task={activeTask}
              isDragging
              userRole={userRole}
              className="rotate-3 shadow-2xl scale-105"
            />
          </DragOverlay>
        </div>,
        document.body
      )}

      {/* Modals */}
      <TaskDetailModal
        task={selectedTask}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onDelete={handleDeleteTask}
        onStatusChange={handleStatusChange}
        userRole={userRole}
      />

      <TaskCreateForm
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={handleCreateTask}
        workspaceMembers={workspaceMembers}
        sprints={sprints}
      />

      <SprintCreateForm
        open={sprintCreateOpen}
        onOpenChange={setSprintCreateOpen}
        onSubmit={handleCreateSprint}
      />

      <SprintManageDialog
        open={sprintManageOpen}
        onOpenChange={setSprintManageOpen}
        sprints={sprints}
        activeSprint={activeSprint}
        onStartSprint={handleStartSprint}
        onCompleteSprint={handleCompleteSprint}
        loading={sprintsLoading}
      />

      {/* Blockchain Animation */}
      {showBlockchainAnimation && (
        <BlockchainVerifiedAnimation
          onComplete={() => setShowBlockchainAnimation(false)}
        />
      )}
    </>
  );
}
