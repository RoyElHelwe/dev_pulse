/**
 * The kitchen café: menu with on-chain prices, and buying with PulseCoin.
 * A purchase is a KitchenShop transaction paid by the buyer's permit; the item then shows in their hand.
 */

import { Injectable } from '@nestjs/common';
import { CoinTxKind, Role } from '@prisma/client';
import { ChainService } from '../chain/chain.service';
import { build } from '../chain/contracts';
import { WalletsService } from '../chain/wallets.service';
import { FormError } from '../common/form-error';
import { OfficeGateway } from '../office/office.gateway';
import { MembershipService } from '../workspace/membership.service';
import { CoinsService } from './coins.service';
import {
  fromUnits,
  HOLD_MS,
  KITCHEN_FURNITURE,
  KITCHEN_REACH_TILES,
  MENU,
  menuItem,
} from './kitchen.rules';

/** Menu, purchases and the café's view for a member. */
@Injectable()
export class KitchenService {
  constructor(
    private readonly chain: ChainService,
    private readonly wallets: WalletsService,
    private readonly coins: CoinsService,
    private readonly office: OfficeGateway,
    private readonly membership: MembershipService,
  ) {}

  /** Everything the café panel shows: menu (prices read on-chain), the caller's wallet, their rights. */
  async view(userId: string) {
    const me = await this.membership.require(userId);
    const { shop } = this.chain.get();
    const menu = await Promise.all(
      MENU.map(async (m) => {
        const [, price, active] = (await shop.items(m.id)) as [string, bigint, boolean];
        return {
          key: m.key,
          name: m.name,
          description: m.description,
          price: fromUnits(price),
          available: active,
        };
      }),
    );
    return {
      menu,
      wallet: await this.coins.wallet(userId),
      canGrant: me.role === Role.OWNER || me.role === Role.ADMIN,
    };
  }

  /**
   * The two contracts as they are on-chain right now: address, live state read from the chain,
   * and their Solidity source (for the café's Contracts tab).
   */
  async contracts(userId: string) {
    await this.membership.require(userId);
    const { chainId, provider, coin, shop, relayerAddress } = this.chain.get();
    const { sources, compiler } = build();
    const items = await Promise.all(
      MENU.map(async (m) => {
        const [name, price, active] = (await shop.items(m.id)) as [string, bigint, boolean];
        return { id: m.id, name, price: fromUnits(price), active };
      }),
    );
    return {
      chainId,
      block: await provider.getBlockNumber(),
      compiler,
      relayer: relayerAddress,
      coin: {
        address: await coin.getAddress(),
        source: sources['PulseCoin.sol'],
        state: {
          name: (await coin.name()) as string,
          symbol: (await coin.symbol()) as string,
          decimals: Number((await coin.decimals()) as bigint),
          totalSupply: fromUnits((await coin.totalSupply()) as bigint),
          dailyAllowance: fromUnits((await coin.DAILY_ALLOWANCE()) as bigint),
          dailyPeriodSeconds: Number((await coin.dailyPeriod()) as bigint),
          relayerIsMinter: (await coin.hasRole(
            await coin.MINTER_ROLE(),
            relayerAddress,
          )) as boolean,
        },
      },
      shop: {
        address: await shop.getAddress(),
        source: sources['KitchenShop.sol'],
        state: {
          owner: (await shop.owner()) as string,
          till: (await shop.till()) as string,
          coin: (await shop.coin()) as string,
          purchaseCount: Number((await shop.purchaseCount()) as bigint),
          items,
        },
      },
    };
  }

  /** Buys one item for the caller, who must stand at the kitchen. Returns the receipt. */
  async buy(userId: string, key: string) {
    const me = await this.membership.require(userId);
    const item = menuItem(key);
    if (!item) throw new FormError('NOT_ON_MENU', 'That is not on the menu.');
    // Server-side, from its own copy of positions: buying happens at the kitchen, not from anywhere.
    if (!this.office.isNear(me.workspaceId, userId, KITCHEN_FURNITURE, KITCHEN_REACH_TILES)) {
      throw new FormError(
        'NOT_IN_KITCHEN',
        'Walk to the kitchen (the fridge or the counter) to buy something.',
      );
    }
    return this.coins.exclusive(async () => {
      const address = await this.coins.ensureWallet(me.workspaceId, userId);
      const { coin, shop } = this.chain.get();
      const [, price, active] = (await shop.items(item.id)) as [string, bigint, boolean];
      if (!active) throw new FormError('NOT_ON_MENU', `${item.name} is not available right now.`);
      const balance = (await coin.balanceOf(address)) as bigint;
      if (balance < price) {
        throw new FormError(
          'NOT_ENOUGH_COINS',
          `${item.name} costs ${fromUnits(price)} PULSE and you have ${fromUnits(balance)}. Claim your daily coins, close a task or win a game.`,
        );
      }
      // The buyer's key approves exactly this price for the shop; the relayer submits it and pays the gas.
      const permit = await this.wallets.signPermit(userId, await shop.getAddress(), price);
      const receipt = await this.chain.send((c) =>
        c.shop.buy(address, item.id, permit.deadline, permit.v, permit.r, permit.s),
      );
      const purchased = receipt.logs
        .map((log) => shop.interface.parseLog(log))
        .find((e) => e?.name === 'Purchased');
      const tx = await this.coins.record({
        workspaceId: me.workspaceId,
        userId,
        kind: CoinTxKind.PURCHASE,
        amount: -fromUnits(price),
        receipt,
        item: item.key,
      });
      this.office.setHolding(me.workspaceId, userId, item.key, HOLD_MS);
      return {
        item: { key: item.key, name: item.name, price: fromUnits(price) },
        purchaseId: purchased ? Number(purchased.args.purchaseId as bigint) : null,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        balance: await this.coins.balanceOf(address),
        tx,
      };
    });
  }
}
