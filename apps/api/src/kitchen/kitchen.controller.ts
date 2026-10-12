/** HTTP surface of the kitchen café and PulseCoin: menu, buying, wallet, daily coins, grants, ledger, proofs. */

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CoinsService } from './coins.service';
import { BuyDto, GrantDto } from './kitchen.dto';
import { KitchenService } from './kitchen.service';

/** The café of the caller's office. */
@Controller('kitchen')
export class KitchenController {
  constructor(
    private readonly kitchen: KitchenService,
    private readonly coins: CoinsService,
  ) {}

  /** Menu with on-chain prices, the caller's wallet, and whether they may give coins. */
  @Get()
  view(@CurrentUser() user: AuthUser) {
    return this.kitchen.view(user.id);
  }

  @Post('buy')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  buy(@CurrentUser() user: AuthUser, @Body() dto: BuyDto) {
    return this.kitchen.buy(user.id, dto.item);
  }

  @Post('daily')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  daily(@CurrentUser() user: AuthUser) {
    return this.coins.claimDaily(user.id);
  }

  @Post('grants')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  grant(@CurrentUser() user: AuthUser, @Body() dto: GrantDto) {
    return this.coins.grant(user.id, dto.userId, dto.amount, dto.note ?? '');
  }

  /** The caller's own transactions. */
  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.coins.history(user.id);
  }

  /** The office's transactions and the chain's state. */
  @Get('ledger')
  ledger(@CurrentUser() user: AuthUser) {
    return this.coins.ledger(user.id);
  }

  /** On-chain receipt and decoded events of one of the office's transactions. */
  @Get('tx/:hash')
  proof(@CurrentUser() user: AuthUser, @Param('hash') hash: string) {
    return this.coins.proof(user.id, hash);
  }
}
