/**
 * Per-session Lego game instance wiring player lifecycle, permissions, and incoming actions.
 * Dispatches player actions to granular handlers and broadcasts state updates to session participants.
 */

import { Logger } from '@nestjs/common';
import type { Budget } from '../../office/office.rules';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type GameContext,
  GameError,
  type GameInstance,
  type GamePlayerRef,
} from '../game.types';
import {
  BOARD_H,
  BOARD_W,
  type Brick,
  canClearBoard,
  createActionBudget,
  validatePlace,
} from './lego.rules';
import type { LegoService } from './lego.service';

/**
 * Lego minigame session controller.
 * Implements the GameInstance contract: tracks joined players, enforces clearance roles,
 * rates limits action calls, and coordinates with LegoService for persistent storage.
 */
export class LegoGameInstance implements GameInstance {
  private readonly logger = new Logger(LegoGameInstance.name);
  private readonly players = new Map<string, GamePlayerRef>();
  private readonly roles = new Map<string, string>();
  private readonly budgets = new Map<string, Budget>();
  private disposed = false;

  constructor(
    private readonly ctx: GameContext,
    private readonly legoService: LegoService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Called when a player joins the Lego board session.
   * Ensures the board data is loaded from the database and fetches the player's workspace role.
   */
  onJoin(p: GamePlayerRef, _intent: unknown): void {
    if (this.disposed) return;
    this.players.set(p.userId, p);

    void this.legoService
      .ensureLoaded(this.ctx.workspaceId, this.ctx.objectId)
      .then(() => {
        if (!this.disposed) {
          this.ctx.emitState();
        }
      })
      .catch((err) => {
        this.logger.error('Failed to ensure board loaded on join', err);
      });

    void this.prisma.workspaceMember
      .findUnique({
        where: { userId: p.userId },
        select: { role: true },
      })
      .then((member) => {
        if (member && !this.disposed) {
          this.roles.set(p.userId, member.role);
          this.ctx.emitState();
        }
      })
      .catch((err) => {
        this.logger.error('Failed to get member role on join', err);
      });
  }

  /**
   * Called when a player leaves the session (manually, walked far away, or disconnected).
   */
  onLeave(userId: string, _reason: 'left' | 'far' | 'disconnected'): void {
    this.players.delete(userId);
    this.roles.delete(userId);
    this.budgets.delete(userId);
    if (!this.disposed) {
      this.ctx.emitState();
    }
  }

  /**
   * Routes incoming game actions to specific handlers after applying the per-user rate limit.
   */
  onAction(userId: string, action: unknown): void {
    if (this.disposed) return;

    let budget = this.budgets.get(userId);
    if (!budget) {
      budget = createActionBudget();
      this.budgets.set(userId, budget);
    }
    if (!budget.allow()) {
      throw new GameError('RATE_LIMIT', 'Too many actions');
    }

    if (!action || typeof action !== 'object' || !('type' in action)) {
      throw new GameError('BAD_REQUEST', 'Action must have a type');
    }

    const { type } = action as { type: unknown };
    switch (type) {
      case 'place':
        return this.handlePlace(action as Record<string, unknown>);
      case 'remove':
        return this.handleRemove(action as Record<string, unknown>);
      case 'clear':
        return this.handleClear(userId);
      default:
        throw new GameError('BAD_REQUEST', `Unknown action type: ${String(type)}`);
    }
  }

  /** Handles placement of a new brick onto the board. */
  private handlePlace(payload: Record<string, unknown>): void {
    const { x, y, w, h, c } = payload;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof w !== 'number' ||
      typeof h !== 'number' ||
      typeof c !== 'number'
    ) {
      throw new GameError('BAD_REQUEST', 'Missing or invalid place parameters');
    }

    const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
    if (!board) {
      throw new GameError('LOADING', 'Board is not loaded yet');
    }

    const brick: Brick = [x, y, w, h, c];
    const validationError = validatePlace(board.bricks, brick);
    if (validationError) {
      throw new GameError('INVALID_BRICK', validationError);
    }

    this.legoService.place(this.ctx.workspaceId, this.ctx.objectId, brick);
    this.ctx.emitState();
  }

  /** Handles removal of an existing brick covering the specified coordinates. */
  private handleRemove(payload: Record<string, unknown>): void {
    const { x, y } = payload;
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new GameError('BAD_REQUEST', 'Missing or invalid remove parameters');
    }

    const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
    if (!board) {
      throw new GameError('LOADING', 'Board is not loaded yet');
    }

    this.legoService.remove(this.ctx.workspaceId, this.ctx.objectId, x, y);
    this.ctx.emitState();
  }

  /** Handles board clearing, requiring OWNER or ADMIN permissions. */
  private handleClear(userId: string): void {
    const role = this.roles.get(userId);
    if (!canClearBoard(role)) {
      throw new GameError('FORBIDDEN', 'Only OWNER or ADMIN may clear the board');
    }

    const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
    if (!board) {
      throw new GameError('LOADING', 'Board is not loaded yet');
    }

    this.legoService.clear(this.ctx.workspaceId, this.ctx.objectId);
    this.ctx.emitState();
  }

  /**
   * Generates a player-specific view of the Lego board state.
   */
  view(userId: string) {
    const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
    const role = this.roles.get(userId);
    const canClear = canClearBoard(role);

    return {
      ready: !!board,
      w: BOARD_W,
      h: BOARD_H,
      bricks: board ? board.bricks : [],
      canClear,
      players: Array.from(this.players.values()).map((p) => p.name),
      version: board ? board.version : 0,
    };
  }

  /**
   * Disposes of the game instance, releasing players, roles, and budget references.
   */
  dispose(): void {
    this.disposed = true;
    this.players.clear();
    this.roles.clear();
    this.budgets.clear();
  }
}
