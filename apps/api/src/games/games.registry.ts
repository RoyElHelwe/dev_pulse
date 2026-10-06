import { Injectable } from '@nestjs/common';
import type { GameDefinition, GameKind } from './game.types';

@Injectable()
export class GamesRegistry {
  private readonly definitions = new Map<GameKind, GameDefinition>();

  register(def: GameDefinition): void {
    this.definitions.set(def.kind, def);
  }

  get(kind: GameKind): GameDefinition | undefined {
    return this.definitions.get(kind);
  }

  has(kind: GameKind): boolean {
    return this.definitions.has(kind);
  }

  all(): GameDefinition[] {
    return Array.from(this.definitions.values());
  }
}
