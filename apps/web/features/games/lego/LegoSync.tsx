'use client';

import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { legoArt, type LegoBrick } from '@/game/render/legoArt';
import { api } from '@/lib/api';

interface LegoSyncProps {
  socket: Socket | null | undefined;
}

interface LegoBoardsResponse {
  boards: Array<{ id: string; bricks: LegoBrick[] }>;
}

export function LegoSync({ socket }: LegoSyncProps) {
  useEffect(() => {
    let active = true;

    const fetchBoards = async () => {
      try {
        const res = await api<LegoBoardsResponse>('/workspace/lego');
        if (active && res?.boards && Array.isArray(res.boards)) {
          for (const board of res.boards) {
            legoArt.set(board.id, board.bricks);
          }
          legoArt.markLoaded();
        }
      } catch {
        // Silently ignore loading/network errors
      }
    };

    void fetchBoards();

    if (!socket) {
      return () => {
        active = false;
      };
    }

    const onConnect = () => {
      void fetchBoards();
    };

    const onArt = (payload: { id: string; bricks: LegoBrick[] }) => {
      if (payload?.id && Array.isArray(payload.bricks)) {
        legoArt.set(payload.id, payload.bricks);
      }
    };

    socket.on('connect', onConnect);
    socket.on('lego:art', onArt);

    return () => {
      active = false;
      socket.off('connect', onConnect);
      socket.off('lego:art', onArt);
    };
  }, [socket]);

  return null;
}
