'use client';

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Task, TaskStatus } from '@/lib/types/task';
import { getWsUrl } from '@/lib/api-config';

interface TaskSocketEvents {
  onTaskCreated?: (data: { task: Task; createdBy: string; timestamp: string }) => void;
  onTaskUpdated?: (data: { task: Task; updatedBy: string; changes?: any; timestamp: string }) => void;
  onTaskStatusChanged?: (data: {
    taskId: string;
    oldStatus: TaskStatus;
    newStatus: TaskStatus;
    movedBy: string;
    movedByName?: string;
    timestamp: string;
  }) => void;
  onTaskAssigned?: (data: {
    taskId: string;
    taskTitle: string;
    assigneeId: string;
    assigneeName?: string;
    assignedBy: string;
    timestamp: string;
  }) => void;
  onTaskDeleted?: (data: { taskId: string; deletedBy: string; timestamp: string }) => void;
  onTaskBlockchainVerified?: (data: {
    taskId: string;
    taskTitle: string;
    txHash: string;
    completedBy: string;
    completedByName?: string;
    timestamp: string;
  }) => void;
  onTaskCommentAdded?: (data: {
    taskId: string;
    comment: any;
    addedBy: string;
    addedByName?: string;
    timestamp: string;
  }) => void;
  onSprintCreated?: (data: { sprint: any; createdBy: string; timestamp: string }) => void;
  onSprintStarted?: (data: {
    sprintId: string;
    sprintName: string;
    startedBy: string;
    timestamp: string;
  }) => void;
  onSprintCompleted?: (data: {
    sprintId: string;
    sprintName: string;
    stats: { totalTasks: number; completedTasks: number };
    completedBy: string;
    timestamp: string;
  }) => void;
  onNotification?: (data: {
    type: string;
    title: string;
    message: string;
    taskId?: string;
    timestamp: string;
  }) => void;
}

interface UseTaskSocketOptions {
  workspaceId: string;
  userId: string;
  enabled?: boolean;
  events?: TaskSocketEvents;
}

const WS_URL = getWsUrl();

export function useTaskSocket({
  workspaceId,
  userId,
  enabled = true,
  events = {},
}: UseTaskSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef(events);

  // Update events ref when events change
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Initialize socket connection
  useEffect(() => {
    if (!enabled || !workspaceId || !userId) return;

    const socket = io(WS_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[TaskSocket] Connected');
      // Subscribe to task events for this workspace
      socket.emit('task:subscribe', { workspaceId });
    });

    socket.on('disconnect', () => {
      console.log('[TaskSocket] Disconnected');
    });

    socket.on('task:subscribed', (data) => {
      console.log('[TaskSocket] Subscribed to tasks for workspace:', data.workspaceId);
    });

    // Task events
    socket.on('task:created', (data) => {
      console.log('[TaskSocket] Task created:', data);
      eventsRef.current.onTaskCreated?.(data);
    });

    socket.on('task:updated', (data) => {
      console.log('[TaskSocket] Task updated:', data);
      eventsRef.current.onTaskUpdated?.(data);
    });

    socket.on('task:status:changed', (data) => {
      console.log('[TaskSocket] Task status changed:', data);
      eventsRef.current.onTaskStatusChanged?.(data);
    });

    socket.on('task:assigned', (data) => {
      console.log('[TaskSocket] Task assigned:', data);
      eventsRef.current.onTaskAssigned?.(data);
    });

    socket.on('task:deleted', (data) => {
      console.log('[TaskSocket] Task deleted:', data);
      eventsRef.current.onTaskDeleted?.(data);
    });

    socket.on('task:blockchain:verified', (data) => {
      console.log('[TaskSocket] Task blockchain verified:', data);
      eventsRef.current.onTaskBlockchainVerified?.(data);
    });

    socket.on('task:comment:added', (data) => {
      console.log('[TaskSocket] Task comment added:', data);
      eventsRef.current.onTaskCommentAdded?.(data);
    });

    // Sprint events
    socket.on('sprint:created', (data) => {
      console.log('[TaskSocket] Sprint created:', data);
      eventsRef.current.onSprintCreated?.(data);
    });

    socket.on('sprint:started', (data) => {
      console.log('[TaskSocket] Sprint started:', data);
      eventsRef.current.onSprintStarted?.(data);
    });

    socket.on('sprint:completed', (data) => {
      console.log('[TaskSocket] Sprint completed:', data);
      eventsRef.current.onSprintCompleted?.(data);
    });

    // Personal notifications
    socket.on('notification', (data) => {
      console.log('[TaskSocket] Notification:', data);
      eventsRef.current.onNotification?.(data);
    });

    return () => {
      socket.emit('task:unsubscribe', { workspaceId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, workspaceId, userId]);

  // Emit task events
  const emitTaskCreated = useCallback(
    (task: Task) => {
      socketRef.current?.emit('task:created', {
        workspaceId,
        task,
        userId,
      });
    },
    [workspaceId, userId]
  );

  const emitTaskUpdated = useCallback(
    (task: Task, changes?: any) => {
      socketRef.current?.emit('task:updated', {
        workspaceId,
        task,
        userId,
        changes,
      });
    },
    [workspaceId, userId]
  );

  const emitTaskStatusChanged = useCallback(
    (taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus, userName?: string) => {
      socketRef.current?.emit('task:status:changed', {
        workspaceId,
        taskId,
        oldStatus,
        newStatus,
        userId,
        userName,
      });
    },
    [workspaceId, userId]
  );

  const emitTaskAssigned = useCallback(
    (taskId: string, taskTitle: string, assigneeId: string, assigneeName?: string) => {
      socketRef.current?.emit('task:assigned', {
        workspaceId,
        taskId,
        taskTitle,
        assigneeId,
        assigneeName,
        assignedBy: userId,
      });
    },
    [workspaceId, userId]
  );

  const emitTaskDeleted = useCallback(
    (taskId: string) => {
      socketRef.current?.emit('task:deleted', {
        workspaceId,
        taskId,
        userId,
      });
    },
    [workspaceId, userId]
  );

  const emitTaskBlockchainVerified = useCallback(
    (taskId: string, taskTitle: string, txHash: string, userName?: string) => {
      socketRef.current?.emit('task:blockchain:verified', {
        workspaceId,
        taskId,
        taskTitle,
        txHash,
        completedBy: userId,
        completedByName: userName,
      });
    },
    [workspaceId, userId]
  );

  const emitTaskCommentAdded = useCallback(
    (taskId: string, comment: any, userName?: string) => {
      socketRef.current?.emit('task:comment:added', {
        workspaceId,
        taskId,
        comment,
        userId,
        userName,
      });
    },
    [workspaceId, userId]
  );

  const emitSprintStarted = useCallback(
    (sprintId: string, sprintName: string) => {
      socketRef.current?.emit('sprint:started', {
        workspaceId,
        sprintId,
        sprintName,
        userId,
      });
    },
    [workspaceId, userId]
  );

  const emitSprintCompleted = useCallback(
    (sprintId: string, sprintName: string, stats: { totalTasks: number; completedTasks: number }) => {
      socketRef.current?.emit('sprint:completed', {
        workspaceId,
        sprintId,
        sprintName,
        stats,
        userId,
      });
    },
    [workspaceId, userId]
  );

  return {
    isConnected: socketRef.current?.connected || false,
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskStatusChanged,
    emitTaskAssigned,
    emitTaskDeleted,
    emitTaskBlockchainVerified,
    emitTaskCommentAdded,
    emitSprintStarted,
    emitSprintCompleted,
  };
}
