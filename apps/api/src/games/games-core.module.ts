/**
 * Core games module providing shared infrastructure across minigame submodules.
 * Exports GamesRegistry for dynamic registration and GameResultsService for match logging.
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GameResultsService } from './game-results.service';
import { GamesRegistry } from './games.registry';

/**
 * Shared infrastructure module providing registry and result persistence services.
 */
@Module({
  imports: [PrismaModule],
  providers: [GamesRegistry, GameResultsService],
  exports: [GamesRegistry, GameResultsService],
})
export class GamesCoreModule {}
