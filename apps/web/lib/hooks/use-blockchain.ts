'use client';

import { useState, useCallback } from 'react';
import { BlockchainRecord, BlockchainStats } from '@/lib/types/task';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useBlockchain() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BlockchainStats | null>(null);

  const recordTaskCompletion = useCallback(async (taskId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/blockchain/record/${taskId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to record on blockchain');
      }
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBlockchainRecord = useCallback(async (taskId: string): Promise<BlockchainRecord | null> => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/blockchain/record/${taskId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch blockchain record');
      }
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const getUserBlockchainRecords = useCallback(async (userId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/blockchain/user/${userId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch user records');
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  const getBlockchainStats = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/blockchain/stats`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const verifyOnBlockchain = useCallback(async (taskId: string, txHash: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/blockchain/verify/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ txHash }),
      });
      if (!res.ok) throw new Error('Failed to verify on blockchain');
      return await res.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    loading,
    error,
    stats,
    recordTaskCompletion,
    getBlockchainRecord,
    getUserBlockchainRecords,
    getBlockchainStats,
    verifyOnBlockchain,
  };
}
