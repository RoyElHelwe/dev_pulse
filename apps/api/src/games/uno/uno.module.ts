import { Module, type OnModuleInit } from '@nestjs/common';
import type { GameContext, GameInstance } from '../game.types';
import { GamesCoreModule } from '../games-core.module';
import { GamesRegistry } from '../games.registry';
import { createUnoGame } from './uno.game';

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
