/**
 * NestJS module registering the multiplayer Uno card game with the office games registry.
 * Binds card table furniture objects in the office layout to real-time turn-based card matches.
 */

import { Module, type OnModuleInit } from '@nestjs/common';
import type { GameContext, GameInstance } from '../game.types';
import { GamesCoreModule } from '../games-core.module';
import { GamesRegistry } from '../games.registry';
import { createUnoGame } from './uno.game';

/** Registers the Uno card game definition and session factory with the central games registry. */
@Module({
  imports: [GamesCoreModule],
})
export class UnoModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistry) {}

  onModuleInit() {
    this.registry.register({
      kind: 'uno',
      furnitureKind: 'cardTable',
      create(ctx: GameContext): GameInstance {
        return createUnoGame(ctx);
      },
    });
  }
}
