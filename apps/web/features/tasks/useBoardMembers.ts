'use client';

/**
 * Hook fetching and caching the workspace member roster for the board.
 * Provides member profiles for assignee selectors and avatar chips.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { BoardMember } from './types';

interface MemberApiResponse {
  userId: string;
  displayName: string;
  email?: string;
  character: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

/** Fetches and returns the list of workspace members when enabled. */
export function useBoardMembers(enabled: boolean): BoardMember[] {
  const [members, setMembers] = useState<BoardMember[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    api<MemberApiResponse[]>('/workspace/members')
      .then((data) => {
        if (cancelled) return;
        setMembers(
          data.map((m) => ({
            userId: m.userId,
            displayName: m.displayName,
            email: m.email,
            character: m.character,
            role: m.role,
          })),
        );
      })
      .catch(() => {
        // Keeps previous list while loading or on error
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return members;
}
