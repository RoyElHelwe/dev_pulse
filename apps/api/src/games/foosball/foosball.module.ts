import { Module, type OnModuleInit } from '@nestjs/common';
import type { GameContext } from '../game.types';
import { GamesCoreModule } from '../games-core.module';
import { GamesRegistry } from '../games.registry';
import { createFoosballGame } from './foosball.game';

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
