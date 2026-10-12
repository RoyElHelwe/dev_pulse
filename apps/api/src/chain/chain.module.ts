/**
 * Blockchain module: the chain connection with its contracts (PulseCoin, KitchenShop) and members' wallets.
 */

import { Module } from '@nestjs/common';
import { ChainService } from './chain.service';
import { WalletsService } from './wallets.service';

/** Provides the office blockchain to the kitchen and the reward hooks. */
@Module({
  providers: [ChainService, WalletsService],
  exports: [ChainService, WalletsService],
})
export class ChainModule {}
