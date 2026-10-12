/**
 * Meeting room whiteboards: one Excalidraw scene per room, kept in memory and saved to PostgreSQL.
 * Edits are merged element by element (see whiteboard.rules.ts) and saved after a short pause.
 */

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type BoardElement, mergeElements, parseElements, purgeDeleted } from './whiteboard.rules';

/** Pause after the last edit before the board is written to the database. */
const SAVE_DEBOUNCE_MS = 1_000;

interface Board {
  elements: Map<string, BoardElement>;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

/** Loads, merges and persists the whiteboard of each meeting room. */
@Injectable()
export class WhiteboardService implements OnModuleDestroy {
  private readonly logger = new Logger(WhiteboardService.name);
  private readonly boards = new Map<string, Promise<Board>>();

  constructor(private readonly prisma: PrismaService) {}

  /** Every element of the room's board (deleted ones included, for clients already in sync). */
  async elements(workspaceId: string, roomId: string): Promise<BoardElement[]> {
    return [...(await this.board(workspaceId, roomId)).elements.values()];
  }

  /** Merges an edit into the board; returns the elements that changed, to pass on. */
  async apply(workspaceId: string, roomId: string, incoming: BoardElement[]): Promise<BoardElement[]> {
    const board = await this.board(workspaceId, roomId);
    const accepted = mergeElements(board.elements, incoming);
    if (accepted.length > 0) this.scheduleSave(workspaceId, roomId, board);
    return accepted;
  }

  async onModuleDestroy() {
    // Save pending edits before the process stops.
    await Promise.all(
      [...this.boards].map(async ([key, promise]) => {
        const board = await promise.catch(() => null);
        if (!board?.saveTimer) return;
        clearTimeout(board.saveTimer);
        const [workspaceId, roomId] = splitKey(key);
        await this.save(workspaceId, roomId, board);
      }),
    );
  }

  /** The cached board, loaded once (concurrent callers share the load). */
  private board(workspaceId: string, roomId: string): Promise<Board> {
    const key = `${workspaceId}:${roomId}`;
    let board = this.boards.get(key);
    if (!board) {
      board = this.load(workspaceId, roomId);
      this.boards.set(key, board);
      // A failed load is retried by the next caller instead of being cached.
      board.catch(() => this.boards.delete(key));
    }
    return board;
  }

  private async load(workspaceId: string, roomId: string): Promise<Board> {
    const row = await this.prisma.whiteboard.findUnique({ where: { workspaceId_roomId: { workspaceId, roomId } } });
    const elements = new Map<string, BoardElement>();
    // Stored boards were validated on the way in; re-check in case the format changed.
    for (const el of (row && parseElements(row.elements, Number.MAX_SAFE_INTEGER)) || []) elements.set(el.id, el);
    // Deletions only matter to clients connected at the time: start fresh without them.
    purgeDeleted(elements);
    return { elements, saveTimer: null };
  }

  private scheduleSave(workspaceId: string, roomId: string, board: Board) {
    if (board.saveTimer) clearTimeout(board.saveTimer);
    board.saveTimer = setTimeout(() => {
      board.saveTimer = null;
      void this.save(workspaceId, roomId, board);
    }, SAVE_DEBOUNCE_MS);
  }

  private async save(workspaceId: string, roomId: string, board: Board) {
    const elements = [...board.elements.values()].filter((el) => !el.isDeleted) as unknown as Prisma.InputJsonValue;
    try {
      await this.prisma.whiteboard.upsert({
        where: { workspaceId_roomId: { workspaceId, roomId } },
        create: { workspaceId, roomId, elements },
        update: { elements },
      });
    } catch (error) {
      this.logger.error(`Failed to save whiteboard ${workspaceId}:${roomId}: ${(error as Error).message}`);
    }
  }
}

/** "workspaceId:roomId" back into its parts (room ids may themselves contain ':'). */
function splitKey(key: string): [string, string] {
  const at = key.indexOf(':');
  return [key.slice(0, at), key.slice(at + 1)];
}
