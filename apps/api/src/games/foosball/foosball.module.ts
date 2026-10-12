/**
 * NestJS module registering the interactive foosball mini-game with the office games registry.
 * Binds foosball furniture objects in the office layout to real-time physics simulation sessions.
 */

import { Module, type OnModuleInit } from '@nestjs/common';
import type { GameContext } from '../game.types';
import { GamesCoreModule } from '../games-core.module';
import { GamesRegistry } from '../games.registry';
import { createFoosballGame } from './foosball.game';

/** Registers the foosball game definition and session factory with the central games registry. */
@Module({
  imports: [GamesCoreModule],
})
export class FoosballModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistry) {}

  onModuleInit() {
    this.registry.register({
      kind: 'foosball',
      furnitureKind: 'foosball',
      create(ctx: GameContext) {
        return createFoosballGame(ctx);
      },
    });
  }
}
