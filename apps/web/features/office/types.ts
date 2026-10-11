/**
 * Shared type contracts for features mounted in the office canvas.
 * Defines the common dependencies passed down to voice, chat, meetings, and games.
 */

import type { Socket } from 'socket.io-client';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import type { Presence } from './connection';

/** Props contract passed to every live feature mounted inside the office. */
export interface OfficeFeatureProps {
  /** The live /office socket; null until the office is loaded. */
  socket: Socket | null;
  /** The game; null while it loads. */
  controller: OfficeController | null;
  workspace: MyWorkspace;
  /** Everyone else in the office right now. */
  people: Presence[];
  myId: string;
  /** Short message at the bottom of the screen. */
  onToast(message: string): void;
  /** An organiser is editing the office: features stay mounted (calls, chat) but hide their UI. */
  editing: boolean;
}
