'use client';

import React, { useState } from 'react';
import { Task, TaskComment as TaskCommentType, PRIORITY_CONFIG, TaskStatus } from '@/lib/types/task';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Calendar,
  User,
  MessageSquare,
  Tag,
  Flag,
  Edit2,
  Trash2,
  Send,
  ExternalLink,
  Shield,
  CheckCircle2,
  Timer,
  Activity,
  X,
} from 'lucide-react';
import { BlockchainBadge } from './BlockchainBadge';

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  userRole?: string;
  comments?: TaskCommentType[];
  onAddComment?: (taskId: string, content: string) => Promise<void>;
}

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStatusChange,
  userRole = 'MEMBER',
  comments = [],
  onAddComment,
}: TaskDetailModalProps) {
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Notify parent about dialog state to disable game keyboard
  React.useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('dialog-opened'));
    } else {
      window.dispatchEvent(new CustomEvent('dialog-closed'));
    }
  }, [open]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  if (!task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'DONE';
  const canEdit = userRole !== 'MEMBER' || task.status !== 'DONE';
  const canDelete = userRole === 'OWNER' || userRole === 'ADMIN';

  const handleAddComment = async () => {
    if (!newComment.trim() || !onAddComment) return;
    setSubmittingComment(true);
    try {
      await onAddComment(task.id, newComment);
      setNewComment('');
    } finally {
      setSubmittingComment(false);
    }
  };

  const statusOptions: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
  const canChangeToStatus = (status: TaskStatus): boolean => {
    if (userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MANAGER') {
      return true;
    }
    // Members can only move to TODO, IN_PROGRESS, REVIEW
    return status !== 'DONE';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header with Blockchain Badge */}
        <div className="relative bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 border-b">
          {task.blockchainVerified && (
            <div className="absolute top-4 right-4">
              <BlockchainBadge
                verified={true}
                txHash={task.blockchainTxHash}
                size="lg"
              />
            </div>
          )}
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn('text-xs', priorityConfig.color)}>
                {priorityConfig.icon} {priorityConfig.label} Priority
              </Badge>
              {task.sprint && (
                <Badge variant="outline" className="text-xs">
                  {task.sprint.name}
                </Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white pr-10">
              {task.title}
            </DialogTitle>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Description */}
            {task.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Description
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            {/* Status Selector */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Status
              </h4>
              <div className="flex gap-2 flex-wrap">
                {statusOptions.map((status) => (
                  <Button
                    key={status}
                    variant={task.status === status ? 'default' : 'outline'}
                    size="sm"
                    disabled={!canChangeToStatus(status)}
                    onClick={() => onStatusChange?.(task.id, status)}
                    className={cn(
                      task.status === status && 'ring-2 ring-offset-2',
                      status === 'TODO' && 'hover:bg-gray-500 hover:text-white',
                      status === 'IN_PROGRESS' && 'hover:bg-blue-500 hover:text-white',
                      status === 'REVIEW' && 'hover:bg-yellow-500 hover:text-white',
                      status === 'DONE' && 'hover:bg-green-500 hover:text-white',
                    )}
                  >
                    {status.replace('_', ' ')}
                  </Button>
                ))}
              </div>
              {userRole === 'MEMBER' && (
                <p className="text-xs text-gray-400 mt-2">
                  Note: As a member, you cannot mark tasks as Done. Contact a manager.
                </p>
              )}
            </div>

            {/* Meta Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Assignee</p>
                  {task.assignee ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-[8px]">
                          {task.assignee.name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{task.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Unassigned</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Created by</p>
                  <span className="text-sm font-medium">{task.creator?.name || 'Unknown'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Calendar className={cn("w-4 h-4", isOverdue ? "text-red-500" : "text-gray-400")} />
                <div>
                  <p className="text-xs text-gray-400">Deadline</p>
                  <span className={cn("text-sm font-medium", isOverdue && "text-red-500")}>
                    {task.deadline
                      ? new Date(task.deadline).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'No deadline'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Time Estimate</p>
                  <span className="text-sm font-medium">
                    {task.estimatedHours ? `${task.estimatedHours}h` : 'Not set'}
                    {task.actualHours && ` / ${task.actualHours}h actual`}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {task.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Blockchain Info */}
            {task.blockchainVerified && (
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-medium text-emerald-700 dark:text-emerald-400">
                    Blockchain Verified
                  </h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction Hash:</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${task.blockchainTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1 font-mono text-xs"
                    >
                      {task.blockchainTxHash?.slice(0, 10)}...{task.blockchainTxHash?.slice(-8)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recorded At:</span>
                    <span>
                      {task.blockchainRecordedAt &&
                        new Date(task.blockchainRecordedAt).toLocaleString()}
                    </span>
                  </div>
                  {task.proofHash && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Proof Hash:</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {task.proofHash}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Comments Section */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments ({comments.length})
              </h4>

              <div className="space-y-3 mb-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={comment.user.image || ''} />
                      <AvatarFallback className="text-xs">
                        {comment.user.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{comment.user.name}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>

              {/* Add Comment */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <Button
                  size="icon"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 dark:bg-gray-800">
          <div className="text-xs text-gray-400">
            Created {new Date(task.createdAt).toLocaleDateString()}
            {task.updatedAt !== task.createdAt && (
              <> · Updated {new Date(task.updatedAt).toLocaleDateString()}</>
            )}
          </div>
          <div className="flex gap-2">
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete?.(task.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
            {canEdit && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onEdit?.(task)}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
