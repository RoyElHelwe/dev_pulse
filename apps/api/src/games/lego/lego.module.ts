import { Module, type OnModuleInit } from '@nestjs/common';
import type { GameContext, GameInstance, GamePlayerRef } from '../game.types';
import { GamesCoreModule } from '../games-core.module';
import { GamesRegistry } from '../games.registry';

@Module({
  imports: [GamesCoreModule],
})
export class LegoModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistry) {}

  onModuleInit() {
    this.registry.register({
      kind: 'lego',
      furnitureKind: 'legoBoard',
      create(ctx: GameContext): GameInstance {
        const players: GamePlayerRef[] = [];
        return {
          onJoin(p: GamePlayerRef, _intent: unknown) {
            if (!players.some((existing) => existing.userId === p.userId)) {
              players.push(p);
            }
            ctx.emitState();
          },
          onLeave(userId: string, _reason: 'left' | 'far' | 'disconnected') {
            const idx = players.findIndex((p) => p.userId === userId);
            if (idx !== -1) {
              players.splice(idx, 1);
            }
            ctx.emitState();
          },
          onAction(_userId: string, _action: unknown) {},
          view(_userId: string) {
            return {
              stub: true,
              game: 'lego',
              players: players.map((p) => p.name),
            };
          },
          dispose() {},
        };
      },
    });
  }
}
