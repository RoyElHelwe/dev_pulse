'use client';

/**
 * Single status column rendering task cards, drop indicators, and column creation actions.
 * Used by TaskBoard to display each workflow status lane.
 */

import { Fragment, memo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { TaskCard } from './TaskCard';
import type { BoardMember, TaskStatus, TaskView } from './types';
import { STATUS_LABEL } from './types';

function InsertionLine() {
  return <div className="h-0.5 w-full shrink-0 rounded-full bg-emerald-500 transition-all" />;
}

export interface TaskColumnProps {
  status: TaskStatus;
  cards: TaskView[];
  totalCount: number;
  filtered: boolean;
  onlyMine: boolean;
  myId: string;
  memberMap: Map<string, BoardMember>;
  dragId: string | null;
  /** Where the drop line goes in this column while hovered, or null. */
  dropIndex: number | null;
  onOpenTask(id: string): void;
  onCreate(mode: { kind: 'create'; status?: TaskStatus; assigneeId?: string | null }): void;
  onDragStart(id: string): void;
  onDragEnd(): void;
  onDragOver(e: React.DragEvent<HTMLElement>, status: TaskStatus): void;
  onDragLeave(e: React.DragEvent<HTMLElement>, status: TaskStatus): void;
  onDrop(e: React.DragEvent<HTMLElement>, status: TaskStatus): void;
}

/** Renders a status lane with its card list, count badges, and drop target indicators. */
export const TaskColumn = memo(function TaskColumn({
  status,
  cards,
  totalCount,
  filtered,
  onlyMine,
  myId,
  memberMap,
  dragId,
  dropIndex,
  onOpenTask,
  onCreate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: TaskColumnProps) {
  const isHovered = dropIndex !== null;
  const visibleCards = cards.filter((c) => c.id !== dragId);

  return (
    <div
      className={cn(
        'flex flex-col min-w-64 shrink-0 @3xl:shrink @3xl:min-w-0 flex-1 rounded-xl bg-zinc-100/80 border border-zinc-200/50 min-h-0 transition-shadow',
        isHovered && 'ring-2 ring-emerald-400/60',
      )}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={(e) => onDragLeave(e, status)}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {STATUS_LABEL[status]}
        </span>
        <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-xs font-medium text-zinc-600">
          {filtered ? `${cards.length} of ${totalCount}` : totalCount}
        </span>
      </div>

      <div data-column-scroll="" className="flex-1 overflow-y-auto px-2 py-1 min-h-0 space-y-2">
        {cards.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center p-4 gap-2 text-xs font-medium text-zinc-400">
            {isHovered && <InsertionLine />}
            <span>{dragId ? 'Drop here' : 'No issues'}</span>
          </div>
        ) : (
          <>
            {cards.map((task) => {
              const isDragged = task.id === dragId;
              const visibleIdx = visibleCards.indexOf(task);
              const showLineBefore = isHovered && !isDragged && dropIndex === visibleIdx;

              return (
                <Fragment key={task.id}>
                  {showLineBefore && <InsertionLine />}
                  <TaskCard
                    task={task}
                    assignee={task.assigneeId ? memberMap.get(task.assigneeId) : undefined}
                    onOpen={() => onOpenTask(task.id)}
                    dragging={isDragged}
                    draggable
                    data-task-id={task.id}
                    onDragStart={(e: React.DragEvent) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', task.id);
                      onDragStart(task.id);
                    }}
                    onDragEnd={onDragEnd}
                  />
                </Fragment>
              );
            })}
            {isHovered && dropIndex === visibleCards.length && <InsertionLine />}
          </>
        )}
      </div>

      <div className="p-2 pt-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-zinc-500 hover:text-zinc-900"
          onClick={() =>
            onCreate({
              kind: 'create',
              status,
              assigneeId: onlyMine ? myId : undefined,
            })
          }
        >
          <Plus className="size-3.5" />
          <span>Create</span>
        </Button>
      </div>
    </div>
  );
});
