'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Task, TaskStatus, TASK_COLUMNS } from '@/lib/types/task';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  userRole?: string;
  draggingTaskId?: string | null;
  canDropHere?: boolean;
}

export const TaskColumn = React.memo(function TaskColumn({
  status,
  tasks,
  onTaskClick,
  onAddTask,
  userRole = 'MEMBER',
  draggingTaskId,
  canDropHere = true,
}: TaskColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
    data: { status },
    disabled: !canDropHere,
  });

  const column = TASK_COLUMNS.find((c) => c.id === status)!;
  
  // Memoize sorted tasks to prevent recalculation on every render
  const sortedTasks = React.useMemo(() => 
    [...tasks].sort((a, b) => a.position - b.position),
    [tasks]
  );

  // Check if user can add tasks to this column
  const canAddTask = userRole !== 'MEMBER';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-gray-50/80 dark:bg-gray-900/50 rounded-2xl w-[300px] min-w-[300px] max-h-full',
        'border border-gray-100 dark:border-gray-800',
        isOver && canDropHere && 'ring-2 ring-blue-400 ring-opacity-50 bg-blue-50/50 dark:bg-blue-900/20',
        draggingTaskId && !canDropHere && 'opacity-40 cursor-not-allowed',
        'transition-all duration-200',
        'relative'
      )}
    >
      {/* No-drop indicator */}
      {draggingTaskId && !canDropHere && (
        <div className="absolute inset-0 z-10 bg-red-500/5 rounded-2xl border-2 border-red-500/30 flex items-center justify-center pointer-events-none">
          <div className="bg-red-500/90 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span>No Permission</span>
          </div>
        </div>
      )}
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className={cn('w-3 h-3 rounded-full', column.color)} />
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
            {column.title}
          </h3>
          {status === 'DONE' && (
            <div className="flex items-center gap-1 text-emerald-500" title="Blockchain Protected">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
              </svg>
            </div>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {canAddTask && onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-gray-800"
            onClick={() => onAddTask(status)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tasks */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-2 p-1">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              isDragging={task.id === draggingTaskId}
              userRole={userRole}
            />
          ))}

          {/* Empty State */}
          {tasks.length === 0 && (
            <div className={cn(
              'flex flex-col items-center justify-center py-8 px-4 rounded-xl border-2 border-dashed',
              isOver ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
            )}>
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center mb-3',
                column.color + '/20'
              )}>
                <div className={cn('w-6 h-6 rounded-full', column.color)} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {isOver ? 'Drop here!' : `No tasks in ${column.title.toLowerCase()}`}
              </p>
              {canAddTask && onAddTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => onAddTask(status)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Task
                </Button>
              )}
            </div>
          )}

          {/* Drop placeholder */}
          {isOver && tasks.length > 0 && (
            <div className="h-24 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 flex items-center justify-center">
              <span className="text-sm text-blue-500">Drop here</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
