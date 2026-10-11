'use client';

// Dev/test only: checks dev sign-in status and loads test users for the switcher;
// never active in production because GET /auth/dev reports enabled as false in production
// and the API only mounts DevModule when DEV_LOGIN is configured.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface DevUser {
  id: string;
  displayName: string;
  email: string;
  officeName: string | null;
  role: string | null;
}

export interface DevStatus {
  enabled: boolean;
  users: DevUser[];
}

/** `null` while the api is being asked; afterwards whether DEV_LOGIN is on (and the existing users). */
export function useDevLogin(): DevStatus | null {
  const [status, setStatus] = useState<DevStatus | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ enabled: boolean }>('/auth/dev')
      .then(async ({ enabled }) => {
        const users = enabled ? (await api<{ users: DevUser[] }>('/auth/dev/users')).users : [];
        if (alive) setStatus({ enabled, users });
      })
      .catch(() => alive && setStatus({ enabled: false, users: [] }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
