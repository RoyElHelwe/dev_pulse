'use client';

/**
 * Modal dialog shell for creating or editing tasks.
 * Serves as the primary entry point mounted by TaskBoard.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscape } from '@/lib/escape';
import { CreateTaskDialog } from './CreateTaskDialog';
import { EditTaskDialog } from './EditTaskDialog';
import { useTasks } from './taskStore';
import type { TaskDialogMode } from './taskDialogUtils';
import type { BoardMember } from './types';

export interface TaskDialogProps {
  mode: TaskDialogMode;
  members: BoardMember[];
  myId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onClose(): void;
}

/** Renders the task dialog modal portal with focus trap and escape key handling. */
export function TaskDialog({ mode, members, myId, role, onClose }: TaskDialogProps) {
  useEscape(true, onClose);

  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const { tasks } = useTasks();
  const task = mode.kind === 'edit' ? tasks.find((t) => t.id === mode.taskId) : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode.kind === 'edit' && !task) {
      onClose();
    }
  }, [mode.kind, task, onClose]);

  useEffect(() => {
    if (!mounted) return;
    if (mode.kind === 'edit') {
      panelRef.current?.focus();
    }
  }, [mounted, mode.kind]);

  if (!mounted) return null;
  if (mode.kind === 'edit' && !task) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-captures-keys=""
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {mode.kind === 'create' ? (
          <CreateTaskDialog
            mode={mode}
            members={members}
            onClose={onClose}
            titleId={titleId}
          />
        ) : (
          task && (
            <EditTaskDialog
              task={task}
              members={members}
              myId={myId}
              role={role}
              onClose={onClose}
              titleId={titleId}
            />
          )
        )}
      </div>
    </div>,
    document.body,
  );
}
