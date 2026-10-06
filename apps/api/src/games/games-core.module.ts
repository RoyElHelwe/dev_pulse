import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GameResultsService } from './game-results.service';
import { GamesRegistry } from './games.registry';

@Module({
  imports: [PrismaModule],
  providers: [GamesRegistry, GameResultsService],
  exports: [GamesRegistry, GameResultsService],
})
export class GamesCoreModule {}
