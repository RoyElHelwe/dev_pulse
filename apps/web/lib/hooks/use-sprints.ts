'use client';

import { useState, useCallback } from 'react';
import { Sprint, CreateSprintDto, UpdateSprintDto } from '@/lib/types/task';
import { getApiUrl } from '@/lib/api-config';

const API_URL = getApiUrl();

export function useSprints() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSprints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sprints`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch sprints');
      const data = await res.json();
      setSprints(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActiveSprint = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sprints/active`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 404) {
          setActiveSprint(null);
          return null;
        }
        throw new Error('Failed to fetch active sprint');
      }
      const data = await res.json();
      setActiveSprint(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSprint = useCallback(async (dto: CreateSprintDto) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create sprint');
      }
      const newSprint = await res.json();
      setSprints(prev => [...prev, newSprint]);
      return newSprint;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateSprint = useCallback(async (sprintId: string, dto: UpdateSprintDto) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update sprint');
      }
      const updatedSprint = await res.json();
      setSprints(prev => prev.map(s => s.id === sprintId ? updatedSprint : s));
      return updatedSprint;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const startSprint = useCallback(async (sprintId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sprints/${sprintId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to start sprint');
      }
      const updatedSprint = await res.json();
      setSprints(prev => prev.map(s => s.id === sprintId ? updatedSprint : s));
      setActiveSprint(updatedSprint);
      return updatedSprint;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const completeSprint = useCallback(async (sprintId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sprints/${sprintId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to complete sprint');
      }
      const updatedSprint = await res.json();
      setSprints(prev => prev.map(s => s.id === sprintId ? updatedSprint : s));
      setActiveSprint(null);
      return updatedSprint;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    sprints,
    activeSprint,
    loading,
    error,
    fetchSprints,
    fetchActiveSprint,
    createSprint,
    updateSprint,
    startSprint,
    completeSprint,
  };
}
