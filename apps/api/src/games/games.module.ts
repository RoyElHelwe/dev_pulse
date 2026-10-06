import { Module } from '@nestjs/common';
import { OfficeModule } from '../office/office.module';
import { FoosballModule } from './foosball/foosball.module';
import { GamesController } from './games.controller';
import { GamesGateway } from './games.gateway';
import { GamesSessionManager } from './games.session';
import { GamesCoreModule } from './games-core.module';
import { LegoModule } from './lego/lego.module';
import { UnoModule } from './uno/uno.module';

@Module({
  imports: [GamesCoreModule, FoosballModule, UnoModule, LegoModule, OfficeModule],
  controllers: [GamesController],
  providers: [GamesGateway, GamesSessionManager],
  exports: [GamesCoreModule, GamesSessionManager],
})
export class GamesModule {}
