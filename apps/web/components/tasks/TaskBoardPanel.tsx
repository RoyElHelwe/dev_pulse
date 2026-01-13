'use client';

import React, { useState } from 'react';
import { TaskBoard } from '@/components/tasks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, ClipboardList } from 'lucide-react';

interface TaskBoardPanelProps {
  workspaceId: string;
  userId: string;
  userRole?: string;
  isOpen: boolean;
  onClose: () => void;
  workspaceMembers?: { id: string; name: string; email: string }[];
}

export function TaskBoardPanel({
  workspaceId,
  userId,
  userRole = 'MEMBER',
  isOpen,
  onClose,
  workspaceMembers = [],
}: TaskBoardPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed z-[200] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col',
        isExpanded
          ? 'top-20 left-4 right-4 bottom-4 rounded-2xl'
          : 'right-4 bottom-4 w-[1200px] max-w-[calc(100vw-32px)] h-[600px] max-h-[calc(100vh-100px)] rounded-2xl'
      )}
    >
      {/* Panel Header - Always visible */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Office Task Board</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:bg-white/20"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Task Board Content - Scrollable */}
      <div className="flex-1 overflow-hidden rounded-b-2xl">
        <TaskBoard
          workspaceId={workspaceId}
          userId={userId}
          userRole={userRole}
          workspaceMembers={workspaceMembers}
          className="h-full"
        />
      </div>
    </div>
  );
}

// Floating Task Board Button to toggle panel
export function TaskBoardButton({
  onClick,
  taskCount = 0,
  hasActiveTask = false,
}: {
  onClick: () => void;
  taskCount?: number;
  hasActiveTask?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative group w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all',
        'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700',
        'hover:scale-110 hover:shadow-xl active:scale-95',
        hasActiveTask && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-900 animate-pulse'
      )}
      title="Open Task Board"
    >
      <ClipboardList className="w-6 h-6 text-white" />
      
      {/* Task count badge */}
      {taskCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow">
          {taskCount > 9 ? '9+' : taskCount}
        </span>
      )}

      {/* Active task indicator */}
      {hasActiveTask && (
        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-[8px]">
          ⚡
        </span>
      )}

      {/* Tooltip */}
      <span className="absolute right-full mr-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        Task Board {taskCount > 0 && `(${taskCount})`}
      </span>
    </button>
  );
}
