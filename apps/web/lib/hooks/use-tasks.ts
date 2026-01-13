'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Task,
  KanbanBoard,
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  TaskStatus,
} from '@/lib/types/task';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UseTasksOptions {
  sprintId?: string;
  autoFetch?: boolean;
}

export function useTasks(options: UseTasksOptions = {}) {
  const { sprintId, autoFetch = true } = options;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all tasks
  const fetchTasks = useCallback(async (query?: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      const res = await fetch(`${API_URL}/tasks?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch kanban board
  const fetchBoard = useCallback(async (sprintIdOverride?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sprintIdOverride || sprintId) {
        params.set('sprintId', sprintIdOverride || sprintId!);
      }
      const res = await fetch(`${API_URL}/tasks/board?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch board');
      const data = await res.json();
      setBoard(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sprintId]);

  // Fetch my tasks
  const fetchMyTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tasks/my`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch my tasks');
      const data = await res.json();
      setTasks(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create task
  const createTask = useCallback(async (dto: CreateTaskDto) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create task');
      }
      const newTask = await res.json();
      setTasks(prev => [...prev, newTask]);
      // Update board if loaded
      if (board) {
        setBoard(prev => prev ? {
          ...prev,
          TODO: [...prev.TODO, newTask],
        } : null);
      }
      return newTask;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [board]);

  // Update task
  const updateTask = useCallback(async (taskId: string, dto: UpdateTaskDto) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update task');
      }
      const updatedTask = await res.json();
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Update task status (drag-drop)
  const updateTaskStatus = useCallback(async (
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) => {
    setError(null);
    
    // Optimistic update for board
    if (board) {
      const allTasks = [...board.TODO, ...board.IN_PROGRESS, ...board.REVIEW, ...board.DONE];
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        const oldStatus = task.status;
        const newBoard = { ...board };
        
        // Remove from old column
        newBoard[oldStatus] = newBoard[oldStatus].filter(t => t.id !== taskId);
        
        // Add to new column
        const updatedTask = { ...task, status: dto.status };
        newBoard[dto.status] = [...newBoard[dto.status], updatedTask];
        
        setBoard(newBoard);
      }
    }

    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update task status');
      }
      const updatedTask = await res.json();
      
      // If blockchain verification is needed
      if (updatedTask.readyForBlockchain) {
        console.log('Task ready for blockchain recording:', updatedTask.proofHash);
      }
      
      return updatedTask;
    } catch (err: any) {
      setError(err.message);
      // Revert optimistic update
      fetchBoard();
      throw err;
    }
  }, [board, fetchBoard]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete task');
      }
      setTasks(prev => prev.filter(t => t.id !== taskId));
      // Update board
      if (board) {
        setBoard(prev => {
          if (!prev) return null;
          return {
            TODO: prev.TODO.filter(t => t.id !== taskId),
            IN_PROGRESS: prev.IN_PROGRESS.filter(t => t.id !== taskId),
            REVIEW: prev.REVIEW.filter(t => t.id !== taskId),
            DONE: prev.DONE.filter(t => t.id !== taskId),
          };
        });
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [board]);

  // Assign task
  const assignTask = useCallback(async (taskId: string, assigneeId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assigneeId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to assign task');
      }
      const updatedTask = await res.json();
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Get single task
  const getTask = useCallback(async (taskId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch task');
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Auto fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchBoard();
    }
  }, [autoFetch, fetchBoard]);

  return {
    tasks,
    board,
    loading,
    error,
    fetchTasks,
    fetchBoard,
    fetchMyTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    assignTask,
    getTask,
    setBoard,
  };
}
