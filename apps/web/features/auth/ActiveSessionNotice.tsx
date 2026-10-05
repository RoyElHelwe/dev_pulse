'use client';

import { MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { timeAgo } from '@/lib/user-agent';
import type { ActiveDevice } from './types';

/**
 * "Your account is already open on another device". The button emails a link
 * that closes every session; only works right after a correct sign-in here.
 */
export function ActiveSessionNotice({ device }: { device?: ActiveDevice }) {
  const [state, setState] = useState<{ step: 'idle' | 'sending' | 'sent' | 'error'; text?: string }>({ step: 'idle' });

  async function requestLink() {
    setState({ step: 'sending' });
    try {
      const { sentTo } = await api<{ sentTo: string }>('/auth/sessions/close-request', { method: 'POST' });
      setState({ step: 'sent', text: sentTo });
    } catch (error) {
      setState({ step: 'error', text: error instanceof ApiError ? error.message : 'Could not reach the server.' });
    }
  }

  return (
    <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200/80">
      <div className="flex gap-3">
        <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold">Your account is already open on another device</p>
          <p className="mt-1 text-amber-900/80">
            {device ? (
              <>
                {device.name}, active {timeAgo(device.lastActiveAt)}.{' '}
              </>
            ) : null}
            You can only be signed in on one device at a time.
          </p>

          {state.step === 'sent' ? (
            <p className="mt-3 rounded-xl bg-white/70 px-3 py-2.5 text-amber-950 ring-1 ring-amber-200">
              We sent a link to <b>{state.text}</b>. Open it to close all your sessions, then sign in here again.
            </p>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                loading={state.step === 'sending'}
                onClick={requestLink}
                className="mt-3 ring-amber-300"
              >
                Close the other session
              </Button>
              {state.step === 'error' && <p className="mt-2 text-rose-700">{state.text}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
