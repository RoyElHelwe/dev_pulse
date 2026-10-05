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
    <ul className="divide-y divide-zinc-100 rounded-2xl bg-white text-sm ring-1 ring-zinc-200/80">
      <Row label="API (HTTPS via nginx)" status={api} />
      <Row label="Database" status={db} />
      <Row label="WebSocket (Socket.IO)" status={ws} />
    </ul>
  );
}

const COLORS: Record<Status, string> = {
  checking: 'bg-zinc-300',
  ok: 'bg-emerald-500',
  error: 'bg-rose-500',
};

function Row({ label, status }: { label: string; status: Status }) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5">
      <span className="text-zinc-600">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        <span className={`size-2 rounded-full ${COLORS[status]}`} />
        {status}
      </span>
    </li>
  );
}
