import type { Socket } from 'socket.io-client';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import type { Presence } from './connection';

/**
 * What every feature mounted in the office gets (voice, chat, meetings).
 * They talk to the server over the office socket (namespace /office) and
 * read the game through the controller and `officeEvents`.
 */
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
}
