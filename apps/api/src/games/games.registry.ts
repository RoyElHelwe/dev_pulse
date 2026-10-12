/**
 * In-memory registry storing GameDefinition descriptors for all supported minigames.
 * Allows independent game submodules (Uno, Foosball, Lego) to register factories dynamically.
 */

import { Injectable } from '@nestjs/common';
import type { GameDefinition, GameKind } from './game.types';

/**
 * Registry holding GameDefinition factories indexed by GameKind.
 * WHY: Decouples the generic games framework and gateway from game-specific engine factories;
 * modules register during onModuleInit without modifying core routing.
 */
@Injectable()
export class GamesRegistry {
  private readonly definitions = new Map<GameKind, GameDefinition>();

  /**
   * Registers a game definition descriptor with the registry.
   */
  register(def: GameDefinition): void {
    this.definitions.set(def.kind, def);
  }

  /**
   * Retrieves a registered game definition by its GameKind, or undefined if not found.
   */
  get(kind: GameKind): GameDefinition | undefined {
    return this.definitions.get(kind);
  }

  /**
   * Checks whether a game definition is registered for the given GameKind.
   */
  has(kind: GameKind): boolean {
    return this.definitions.has(kind);
  }

  /**
   * Returns an array of all currently registered game definitions.
   */
  all(): GameDefinition[] {
    return Array.from(this.definitions.values());
  }
}
