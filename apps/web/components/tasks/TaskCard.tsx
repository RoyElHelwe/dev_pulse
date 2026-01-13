'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Task, PRIORITY_CONFIG } from '@/lib/types/task';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  MessageSquare, 
  Calendar, 
  Link2,
  CheckCircle2,
  Shield
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  userRole?: string;
  className?: string;
}

export const TaskCard = React.memo(function TaskCard({ 
  task, 
  onClick, 
  isDragging,
  userRole = 'MEMBER',
  className 
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: task.id,
    data: { task },
    disabled: task.blockchainVerified, // Disable dragging for blockchain-verified tasks
  });

  const style = React.useMemo(() => ({
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    transition: isDragging ? 'none' : 'transform 200ms ease',
  }), [transform, isDragging]);

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const isOverdue = React.useMemo(() => 
    task.deadline && new Date(task.deadline) < new Date() && task.status !== 'DONE',
    [task.deadline, task.status]
  );
  
  const isBlockchainLocked = task.blockchainVerified;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isBlockchainLocked ? {} : listeners)}
      {...attributes}
      onClick={onClick}
      className={cn(
        'group relative bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700',
        'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200',
        isBlockchainLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'shadow-xl ring-2 ring-blue-500 opacity-0',
        isOverdue && 'border-l-4 border-l-red-500',
        isBlockchainLocked && 'border-2 border-emerald-500/50 bg-emerald-50/5',
        className
      )}
    >
      {/* Blockchain Lock Indicator */}
      {isBlockchainLocked && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-lg">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>LOCKED</span>
          </div>
        </div>
      )}
      {/* Blockchain Verified Badge */}
      {task.blockchainVerified && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="relative group/badge">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="absolute top-full right-0 mt-1 w-max opacity-0 group-hover/badge:opacity-100 transition-opacity z-50">
              <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
                <div className="font-medium">Blockchain Verified</div>
                {task.blockchainTxHash && (
                  <div className="text-gray-400 text-[10px] font-mono truncate max-w-[150px]">
                    {task.blockchainTxHash}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Priority Indicator */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <Badge 
          variant="secondary" 
          className={cn('text-[10px] font-medium', priorityConfig.color)}
        >
          {priorityConfig.icon} {priorityConfig.label}
        </Badge>
        {task.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap justify-end">
            {task.tags.slice(0, 2).map((tag) => (
              <Badge 
                key={tag} 
                variant="outline" 
                className="text-[9px] px-1.5 py-0 bg-gray-50 dark:bg-gray-700"
              >
                {tag}
              </Badge>
            ))}
            {task.tags.length > 2 && (
              <Badge 
                variant="outline" 
                className="text-[9px] px-1.5 py-0 bg-gray-50 dark:bg-gray-700"
              >
                +{task.tags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Task Title */}
      <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Task Description Preview */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Task Metadata */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
        {task.estimatedHours && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{task.estimatedHours}h</span>
          </div>
        )}
        {task.deadline && (
          <div className={cn(
            "flex items-center gap-1",
            isOverdue && "text-red-500"
          )}>
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.deadline).toLocaleDateString()}</span>
          </div>
        )}
        {task._count?.comments && task._count.comments > 0 && (
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            <span>{task._count.comments}</span>
          </div>
        )}
      </div>

      {/* Footer: Assignee & Sprint */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700">
        {task.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={task.assignee.image || ''} />
              <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {task.assignee.name?.slice(0, 2).toUpperCase() || 'UN'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[100px]">
              {task.assignee.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-[10px]">?</span>
            </div>
            <span className="text-xs">Unassigned</span>
          </div>
        )}

        {task.sprint && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
            {task.sprint.name}
          </Badge>
        )}
      </div>

      {/* Status Completed Indicator */}
      {task.status === 'DONE' && (
        <div className="absolute inset-0 bg-green-500/5 rounded-xl pointer-events-none flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500/20" />
        </div>
      )}
    </div>
  );
});
