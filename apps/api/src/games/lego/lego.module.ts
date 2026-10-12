/**
 * NestJS module for the collaborative Lego wall minigame.
 * Configures LegoService and LegoController and registers LegoGameInstance in the GamesRegistry.
 */

import { Module, type OnModuleInit } from '@nestjs/common';
import { OfficeModule } from '../../office/office.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import type { GameContext } from '../game.types';
import { GamesCoreModule } from '../games-core.module';
import { GamesRegistry } from '../games.registry';
import { LegoController } from './lego.controller';
import { LegoGameInstance } from './lego.game';
import { LegoService } from './lego.service';

/**
 * Lego minigame module.
 * Binds LegoGameInstance to 'legoBoard' furniture objects upon initialization.
 */
@Module({
  imports: [GamesCoreModule, PrismaModule, OfficeModule],
  controllers: [LegoController],
  providers: [LegoService],
  exports: [LegoService],
})
export class LegoModule implements OnModuleInit {
  constructor(
    private readonly registry: GamesRegistry,
    private readonly legoService: LegoService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Registers the Lego game definition with the global games registry.
   */
  onModuleInit() {
    this.registry.register({
      kind: 'lego',
      furnitureKind: 'legoBoard',
      create: (ctx: GameContext) => {
        return new LegoGameInstance(ctx, this.legoService, this.prisma);
      },
    });
  }
}
