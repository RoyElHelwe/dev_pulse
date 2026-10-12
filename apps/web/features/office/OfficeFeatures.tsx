/**
 * Mounted in-office real-time features container.
 * Houses voice proximity controls, chat, meeting scheduler, meeting room tools, the kitchen café, mini-games, and Lego sync.
 */

'use client';

import { useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { GameHost } from '@/features/games/GameHost';
import { LegoSync } from '@/features/games/lego/LegoSync';
import { KitchenPanel } from '@/features/kitchen/KitchenPanel';
import { MeetingRoomTools } from '@/features/meeting-room/MeetingRoomTools';
import { MeetingsPanel } from '@/features/meetings/MeetingsPanel';
import { VoiceControls } from '@/features/voice/VoiceControls';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import type { Presence } from './connection';
import type { OfficeFeatureProps } from './types';

interface OfficeFeaturesProps {
  user: { id: string; displayName: string };
  myId: string;
  workspace: MyWorkspace;
  people: Presence[];
  socket: Socket | null;
  controller: OfficeController | null;
  editing: boolean;
  onToast: (message: string) => void;
  onGameOpenChange: (open: boolean) => void;
}

/** Renders voice, chat, meeting room, mini-game, and Lego canvas feature panels. */
export function OfficeFeatures({
  user,
  myId,
  workspace,
  people,
  socket,
  controller,
  editing,
  onToast,
  onGameOpenChange,
}: OfficeFeaturesProps) {
  const features = useMemo<OfficeFeatureProps>(
    () => ({
      socket,
      controller,
      workspace,
      people,
      myId,
      onToast,
      editing,
    }),
    [socket, controller, workspace, people, myId, onToast, editing],
  );

  return (
    <>
      <VoiceControls {...features} />
      <ChatPanel {...features} />
      <MeetingsPanel {...features} />
      <MeetingRoomTools {...features} />
      <KitchenPanel {...features} />
      <GameHost
        socket={socket}
        me={{ id: user.id, name: user.displayName, character: workspace.character }}
        onOpenChange={onGameOpenChange}
      />
      <LegoSync socket={socket} />
    </>
  );
}
