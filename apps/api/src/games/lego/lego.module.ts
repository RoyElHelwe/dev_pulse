import { Module, type OnModuleInit } from '@nestjs/common';
import { OfficeModule } from '../../office/office.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import type { GameContext } from '../game.types';
import { GamesCoreModule } from '../games-core.module';
import { GamesRegistry } from '../games.registry';
import { LegoController } from './lego.controller';
import { LegoGameInstance, LegoService } from './lego.service';

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
