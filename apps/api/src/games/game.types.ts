/**
 * Core type definitions, lifecycle contracts, and error structures for office minigames.
 * Defines the contract between the games framework (sessions, gateway) and concrete game engines.
 */

import type { FurnitureKind as OfficeFurnitureKind } from '../office/layout/types';

/** Furniture types eligible for hosting interactive minigames in the office layout. */
export type FurnitureKind = OfficeFurnitureKind | 'foosball' | 'cardTable' | 'legoBoard';

/** Supported minigame kinds recognized by the server. */
export type GameKind = 'foosball' | 'uno' | 'lego';

/**
 * Player identity reference passed to minigame instances upon joining.
 */
export interface GamePlayerRef {
  /** Unique user ID from auth. */
  userId: string;
  /** Display name shown to other players in the game. */
  name: string;
  /** Sprite character avatar key (e.g. 'maya'). */
  character: string;
}

/**
 * Host framework context supplied to a GameInstance when instantiated.
 * Provides hooks for broadcasting state, triggering events, and saving results.
 */
export interface GameContext {
  /** ID of the workspace hosting the game session. */
  readonly workspaceId: string;
  /** ID of the physical furniture item hosting the game session. */
  readonly objectId: string;
  /** Minigame kind identifier. */
  readonly kind: GameKind;

  /**
   * Returns a snapshot of all currently joined participants (active players and spectators).
   */
  participants(): GamePlayerRef[];

  /**
   * Dispatches customized game:state updates to all current session participants.
   * WHY: Invokes instance.view(userId) individually for each participant so private data
   * (e.g. cards in an Uno hand) is never leaked across network boundaries.
   */
  emitState(): void;

  /**
   * Emits an arbitrary game:event payload to room members or a targeted subset of user IDs.
   */
  emitEvent(event: string, data?: unknown, only?: string[]): void;

  /**
   * Records match outcome winners and losers into persistent GameResult storage.
   * WHY: Game engines determine their own win/loss condition criteria and trigger recording at match end.
   */
  record(r: { winners: string[]; losers: string[] }): Promise<void>;

  /**
   * Terminates the game session immediately, notifying all participants and releasing resources.
   */
  close(): void;
}

/**
 * Lifecycle and interaction contract that every concrete game engine must implement.
 * Instances are created per active furniture item and disposed when all players leave.
 */
export interface GameInstance {
  /**
   * Invoked when a player attempts to join the game session.
   * Called by: GamesGateway via GameSession.join().
   * @param p Player metadata (ID, display name, avatar character).
   * @param intent Optional client payload (e.g. team preference { side: 'red' } or spectator flag { watch: true }).
   * WHY: The game engine decides whether the user fills an active slot or becomes a spectator.
   */
  onJoin(p: GamePlayerRef, intent: unknown): void;

  /**
   * Invoked when a participant leaves or is removed from the session.
   * Called by: Framework via GameSession.leave().
   * @param userId The ID of the leaving user.
   * @param reason Why the user left:
   *   - 'left': Explicit user departure (player closed modal or clicked exit).
   *   - 'far': Spatial ejection; player walked outside proximity range (> 7 tiles from furniture).
   *   - 'disconnected': Network drop; socket connection was severed.
   * WHY: Distinguishing disconnect vs far vs deliberate left allows game engines to support
   * reconnect grace periods vs immediate forfeits or AI takeovers.
   */
  onLeave(userId: string, reason: 'left' | 'far' | 'disconnected'): void;

  /**
   * Processes a client action from a participant.
   * Called by: GamesGateway via GameSession.action().
   * @param userId ID of the acting player.
   * @param action Unvalidated client action payload.
   * WHY: The game engine must validate turn order, rules, and parameters, throwing GameError on illegal moves.
   */
  onAction(userId: string, action: unknown): void;

  /**
   * Generates a viewer-specific projection of current game state.
   * Called by: GameSession.emitState() for each connected participant.
   * @param userId ID of the participant requesting/viewing state.
   * WHY: Allows masking hidden information (e.g. deck cards, opponent hands) based on viewer identity.
   */
  view(userId: string): unknown;

  /**
   * Cleans up all active intervals, physics loops, or asynchronous timers.
   * Called by: GameSession.dispose() when the session closes or the last participant departs.
   */
  dispose(): void;
}

/**
 * Registration descriptor linking a game kind to an office furniture kind and factory.
 */
export interface GameDefinition {
  /** Unique game kind identifier. */
  kind: GameKind;
  /** Furniture item kind that hosts this game. */
  furnitureKind: FurnitureKind;
  /** Factory method creating a new GameInstance given a host GameContext. */
  create(ctx: GameContext): GameInstance;
}

/**
 * Exception thrown by minigame engines to report rule violations or protocol errors back to clients.
 */
export class GameError extends Error {
  /**
   * @param code Machine-readable error code (e.g. 'RATE_LIMIT', 'INVALID_BRICK', 'NOT_NEAR').
   * @param message Human-readable error explanation.
   */
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}
