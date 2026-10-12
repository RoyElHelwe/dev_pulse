/**
 * Kitchen café module: buy water, Pepsi or dinner with PulseCoin, earn coins, see the office ledger.
 * Exports CoinsService for the reward hooks (tasks closed, games won).
 */

import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module';
import { OfficeModule } from '../office/office.module';
import { CoinsService } from './coins.service';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';

/** Wires the café's HTTP endpoints to the chain, wallets and office presence. */
@Module({
  imports: [ChainModule, OfficeModule],
  controllers: [KitchenController],
  providers: [CoinsService, KitchenService],
  exports: [CoinsService],
})
export class KitchenModule {}
