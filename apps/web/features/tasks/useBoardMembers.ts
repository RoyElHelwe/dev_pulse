'use client';

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
