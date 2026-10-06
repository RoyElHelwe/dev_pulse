import type { FurnitureKind as OfficeFurnitureKind } from '../office/layout/types';

export type FurnitureKind = OfficeFurnitureKind | 'foosball' | 'cardTable' | 'legoBoard';

export type GameKind = 'foosball' | 'uno' | 'lego';

export interface GamePlayerRef {
  userId: string;
  name: string;
  character: string;
}

export interface GameContext {
  readonly workspaceId: string;
  readonly objectId: string;
  readonly kind: GameKind;
  participants(): GamePlayerRef[]; // everyone joined (players + spectators)
  emitState(): void; // sends instance.view(userId) as game:state to every participant (own view each)
  emitEvent(event: string, data?: unknown, only?: string[]): void; // game:event, optionally to some userIds
  record(r: { winners: string[]; losers: string[] }): Promise<void>; // GameResult row + game:ended is up to the game
  close(): void; // end the session now (everyone gets game:ended {reason:'closed'}), instance disposed
}

export interface GameInstance {
  onJoin(p: GamePlayerRef, intent: unknown): void; // intent = free-form `join` payload (e.g. {side:'red'} or {watch:true}); game decides player vs spectator; call ctx.emitState()
  onLeave(userId: string, reason: 'left' | 'far' | 'disconnected'): void; // framework calls this; game decides forfeit/grace
  onAction(userId: string, action: unknown): void; // already rate-limited; game validates EVERYTHING and may throw GameError
  view(userId: string): unknown; // JSON state for this viewer (hide private info here)
  dispose(): void; // clear timers; called when the last participant is gone or close()
}

export interface GameDefinition {
  kind: GameKind;
  furnitureKind: FurnitureKind;
  create(ctx: GameContext): GameInstance;
}

export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}
