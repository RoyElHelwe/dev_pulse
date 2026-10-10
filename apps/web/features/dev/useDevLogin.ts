'use client';

// Dev/test only: asks the api whether the dev sign-in is on. The api only mounts that
// endpoint when DEV_LOGIN is effective (never in production), so it answers 404 elsewhere
// and every dev feature in the web app stays off.

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
    api<DevStatus>('/auth/dev')
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus({ enabled: false, users: [] }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
