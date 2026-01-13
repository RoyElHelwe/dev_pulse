'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar,
  PlayCircle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Target,
  Loader2,
} from 'lucide-react';
import { Sprint } from '@/lib/types/task';
import { cn } from '@/lib/utils';

interface SprintManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprints: Sprint[];
  activeSprint: Sprint | null;
  onStartSprint: (sprintId: string) => Promise<void>;
  onCompleteSprint: (sprintId: string) => Promise<void>;
  loading: boolean;
}

export function SprintManageDialog({
  open,
  onOpenChange,
  sprints,
  activeSprint,
  onStartSprint,
  onCompleteSprint,
  loading,
}: SprintManageDialogProps) {
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const handleStartSprint = async (sprintId: string) => {
    setActionLoading(sprintId);
    try {
      await onStartSprint(sprintId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteSprint = async (sprintId: string) => {
    setActionLoading(sprintId);
    try {
      await onCompleteSprint(sprintId);
    } finally {
      setActionLoading(null);
    }
  };

  // Dispatch events to disable/enable keyboard
  React.useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('dialog-opened'));
    } else {
      window.dispatchEvent(new CustomEvent('dialog-closed'));
    }
  }, [open]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLANNED':
        return <Badge variant="outline">Planned</Badge>;
      case 'ACTIVE':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'COMPLETED':
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Manage Sprints
          </DialogTitle>
          <DialogDescription>
            Start planned sprints or complete active ones. Only one sprint can be active at a time.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : sprints.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No sprints yet. Create your first sprint to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sprints.map((sprint) => (
                <div
                  key={sprint.id}
                  className={cn(
                    'border rounded-lg p-4 transition-all',
                    sprint.status === 'ACTIVE'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {sprint.name}
                        </h4>
                        {getStatusBadge(sprint.status)}
                      </div>
                      {sprint.goal && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                          <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {sprint.goal}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {sprint.status === 'PLANNED' && !activeSprint && (
                      <Button
                        size="sm"
                        onClick={() => handleStartSprint(sprint.id)}
                        disabled={actionLoading === sprint.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === sprint.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Start
                          </>
                        )}
                      </Button>
                    )}

                    {sprint.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        onClick={() => handleCompleteSprint(sprint.id)}
                        disabled={actionLoading === sprint.id}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {actionLoading === sprint.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Complete
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Duration</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Target className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Tasks</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {sprint.totalTasks || 0} total
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Progress</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {sprint.progress || 0}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {sprint.totalTasks > 0 && (
                    <div className="mt-3">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                          style={{ width: `${sprint.progress || 0}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {sprint.completedTasks || 0} / {sprint.totalTasks || 0} tasks completed
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
