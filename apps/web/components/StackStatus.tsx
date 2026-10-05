'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

type Status = 'checking' | 'ok' | 'error';

// Checks every layer of the stack: browser -> nginx (HTTPS) -> api -> postgres,
// plus the websocket path used by the game and voice features.
export function StackStatus() {
  const [api, setApi] = useState<Status>('checking');
  const [db, setDb] = useState<Status>('checking');
  const [ws, setWs] = useState<Status>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        const body = await res.json();
        setApi('ok');
        setDb(body.db === 'up' ? 'ok' : 'error');
      })
      .catch(() => {
        setApi('error');
        setDb('error');
      });

    const socket = io({ transports: ['websocket'] });
    socket.on('connect', async () => {
      const reply = await socket.timeout(3000).emitWithAck('ping').catch(() => null);
      setWs(reply === 'pong' ? 'ok' : 'error');
    });
    socket.on('connect_error', () => setWs('error'));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
      <Row label="API (HTTPS via nginx)" status={api} />
      <Row label="Database" status={db} />
      <Row label="WebSocket (Socket.IO)" status={ws} />
    </ul>
  );
}

const COLORS: Record<Status, string> = {
  checking: 'text-slate-400',
  ok: 'text-emerald-400',
  error: 'text-rose-400',
};

function Row({ label, status }: { label: string; status: Status }) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <span>{label}</span>
      <span className={COLORS[status]}>{status}</span>
    </li>
  );
}
