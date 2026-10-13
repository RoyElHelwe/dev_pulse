/**
 * PulseCoin for members: wallets (with their welcome grant), rewards for closed tasks and won games,
 * the daily allowance, owner/admin grants, history, the office ledger and on-chain proofs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { CoinTxKind, Role } from '@prisma/client';
import { Interface, type InterfaceAbi, type TransactionReceipt } from 'ethers';
import { artifact } from '../chain/contracts';
import { ChainService } from '../chain/chain.service';
import { WalletsService } from '../chain/wallets.service';
import { FormError } from '../common/form-error';
import { OfficeGateway } from '../office/office.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../workspace/membership.service';
import {
  cappedReward,
  fromUnits,
  MAX_GRANT,
  REWARD,
  startOfUtcDay,
  toUnits,
} from './kitchen.rules';

const HISTORY_SIZE = 50;
const LEDGER_SIZE = 50;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** One line of a history or of the office ledger. */
export interface CoinTxView {
  id: string;
  kind: CoinTxKind;
  amount: number;
  item: string | null;
  userId: string;
  userName: string;
  byName: string | null;
  note: string | null;
  txHash: string;
  blockNumber: number;
  createdAt: string;
}

/** What the server records for a transaction it sent. */
interface Record {
  workspaceId: string;
  userId: string;
  kind: CoinTxKind;
  amount: number;
  receipt: TransactionReceipt;
  rewardKey?: string;
  item?: string;
  byUserId?: string;
  note?: string;
}

/** Wallets, rewards, grants and the ledger, all backed by PulseCoin on-chain. */
@Injectable()
export class CoinsService {
  private readonly logger = new Logger(CoinsService.name);
  /** Rewards, claims and purchases run one at a time ("already paid?" then "pay" must not interleave). */
  private serial: Promise<unknown> = Promise.resolve();
  private decoder: Interface | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly wallets: WalletsService,
    private readonly office: OfficeGateway,
    private readonly membership: MembershipService,
  ) {}

  /** Runs `job` after every coin operation already started (see `serial`). */
  exclusive<T>(job: () => Promise<T>): Promise<T> {
    const run = this.serial.then(job);
    this.serial = run.catch(() => undefined);
    return run;
  }

  /** The member's wallet address; a new wallet comes with the welcome grant. */
  async ensureWallet(workspaceId: string, userId: string): Promise<string> {
    const { address, created } = await this.wallets.getOrCreate(userId);
    if (created)
      await this.mint(
        workspaceId,
        userId,
        CoinTxKind.WELCOME,
        REWARD.WELCOME,
        'welcome',
        `welcome:${userId}`,
      );
    return address;
  }

  /** Whole coins in a wallet, read from the chain. */
  async balanceOf(address: string): Promise<number> {
    return fromUnits((await this.chain.get().coin.balanceOf(address)) as bigint);
  }

  /** The caller's wallet: address, balance, and when the daily allowance can be claimed (null: now). */
  async wallet(userId: string) {
    const me = await this.membership.require(userId);
    const address = await this.exclusive(() => this.ensureWallet(me.workspaceId, userId));
    const { coin } = this.chain.get();
    const next = Number((await coin.nextDailyClaim(address)) as bigint) * 1000;
    return {
      address,
      balance: await this.balanceOf(address),
      nextDailyAt: next > Date.now() ? new Date(next).toISOString() : null,
      dailyAmount: REWARD.DAILY,
      /** Seconds between two claims, as the contract has it (CHAIN_DAILY_PERIOD_SECONDS). */
      dailyPeriodSeconds: Number((await coin.dailyPeriod()) as bigint),
    };
  }

  /** Pays the daily allowance (once per period, enforced by the PulseCoin contract). */
  async claimDaily(userId: string) {
    const me = await this.membership.require(userId);
    return this.exclusive(async () => {
      const address = await this.ensureWallet(me.workspaceId, userId);
      const { coin } = this.chain.get();
      const next = Number((await coin.nextDailyClaim(address)) as bigint) * 1000;
      if (next > Date.now())
        throw new FormError(
          'DAILY_CLAIMED',
          `You already claimed your daily coins. Come back in ${waitText(next - Date.now())}.`,
          undefined,
          { nextDailyAt: new Date(next).toISOString() },
        );
      const receipt = await this.chain.send((c) => c.coin.claimDaily(address));
      const tx = await this.record({
        workspaceId: me.workspaceId,
        userId,
        kind: CoinTxKind.DAILY,
        amount: REWARD.DAILY,
        receipt,
      });
      return { tx, balance: await this.balanceOf(address) };
    });
  }

  /** An owner or admin gives coins to a member of their office. */
  async grant(byUserId: string, toUserId: string, amount: number, note: string) {
    const me = await this.membership.require(byUserId, [Role.OWNER, Role.ADMIN]);
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GRANT)
      throw new FormError('BAD_AMOUNT', `Give between 1 and ${MAX_GRANT} coins.`, 'amount');
    if (toUserId === byUserId)
      throw new FormError('SELF_GRANT', 'You can’t give coins to yourself.', 'userId');
    const target = await this.prisma.workspaceMember.findUnique({ where: { userId: toUserId } });
    if (!target || target.workspaceId !== me.workspaceId)
      throw new FormError('BAD_MEMBER', 'That person is not in this office.', 'userId');
    const tx = await this.exclusive(() =>
      this.mint(me.workspaceId, toUserId, CoinTxKind.GRANT, amount, 'grant', undefined, {
        byUserId,
        note: note.trim() || undefined,
      }),
    );
    return { tx };
  }

  /** Coins for closing a task (once per task, within the daily earning cap). */
  rewardTask(workspaceId: string, taskId: string, userId: string, label: string): void {
    void this.exclusive(() =>
      this.capped(
        workspaceId,
        userId,
        CoinTxKind.TASK,
        REWARD.TASK,
        'task',
        `task:${taskId}`,
        `for closing ${label}`,
      ),
    ).catch((e: Error) => this.logger.warn(`Task reward for ${userId} failed: ${e.message}`));
  }

  /** Coins for each winner of a game (once per result, within the daily earning cap). */
  rewardGame(workspaceId: string, resultId: string, winners: string[], game: string): void {
    for (const userId of winners) {
      void this.exclusive(() =>
        this.capped(
          workspaceId,
          userId,
          CoinTxKind.GAME,
          REWARD.GAME,
          'game',
          `game:${resultId}:${userId}`,
          `for winning ${game}`,
        ),
      ).catch((e: Error) => this.logger.warn(`Game reward for ${userId} failed: ${e.message}`));
    }
  }

  /** The caller's own transactions, newest first. */
  async history(userId: string): Promise<CoinTxView[]> {
    const rows = await this.prisma.coinTx.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_SIZE,
      include: { user: { select: { displayName: true } } },
    });
    return this.views(rows);
  }

  /** The office's latest transactions and the chain they live on. */
  async ledger(userId: string) {
    const me = await this.membership.require(userId);
    const rows = await this.prisma.coinTx.findMany({
      where: { workspaceId: me.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: LEDGER_SIZE,
      include: { user: { select: { displayName: true } } },
    });
    const { chainId, provider, coin, shop, relayerAddress } = this.chain.get();
    return {
      transactions: await this.views(rows),
      chain: {
        chainId,
        block: await provider.getBlockNumber(),
        coin: await coin.getAddress(),
        shop: await shop.getAddress(),
        relayer: relayerAddress,
        till: fromUnits((await coin.balanceOf(await shop.till())) as bigint),
        supply: fromUnits((await coin.totalSupply()) as bigint),
        purchases: Number((await shop.purchaseCount()) as bigint),
      },
    };
  }

  /**
   * Proof that a transaction of the office's ledger is on-chain: its receipt and decoded events,
   * read from the chain itself (only hashes recorded for the caller's office are looked up).
   */
  async proof(userId: string, hash: string) {
    const me = await this.membership.require(userId);
    if (!TX_HASH.test(hash)) throw new FormError('NOT_FOUND', 'Transaction not found.');
    const row = await this.prisma.coinTx.findUnique({ where: { txHash: hash } });
    if (!row || row.workspaceId !== me.workspaceId)
      throw new FormError('NOT_FOUND', 'Transaction not found.');
    const { provider } = this.chain.get();
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt)
      throw new FormError(
        'NOT_ON_CHAIN',
        'This transaction is not on the current chain (was the chain reset?).',
      );
    const block = await provider.getBlock(receipt.blockNumber);
    const events = receipt.logs.flatMap((log) => {
      const parsed = this.events().parseLog(log);
      if (!parsed) return [];
      const args = Object.fromEntries(
        parsed.fragment.inputs.map((input, i) => [input.name, String(parsed.args[i])]),
      );
      return [{ contract: log.address, event: parsed.name, args }];
    });
    return {
      hash,
      status: receipt.status === 1 ? 'success' : 'failed',
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      timestamp: block ? new Date(block.timestamp * 1000).toISOString() : null,
      confirmations: await receipt.confirmations(),
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      events,
    };
  }

  /** Decodes the events of both contracts (built on first use from the compiled ABIs). */
  private events(): Interface {
    this.decoder ??= new Interface([
      ...(artifact('PulseCoin').abi as unknown[]),
      ...(artifact('KitchenShop').abi as unknown[]),
    ] as InterfaceAbi);
    return this.decoder;
  }

  /** Stores a transaction the app sent, then tells the person and the office's ledger. */
  async record(r: Record): Promise<CoinTxView> {
    const row = await this.prisma.coinTx.create({
      data: {
        workspaceId: r.workspaceId,
        userId: r.userId,
        kind: r.kind,
        amount: r.amount,
        item: r.item,
        byUserId: r.byUserId,
        note: r.note,
        rewardKey: r.rewardKey,
        txHash: r.receipt.hash,
        blockNumber: r.receipt.blockNumber,
        chainId: this.chain.get().chainId,
      },
      include: { user: { select: { displayName: true } } },
    });
    const [view] = await this.views([row]);
    this.office.broadcast(r.workspaceId, 'coins:tx', view);
    if (r.amount > 0) this.office.sendTo(r.userId, 'coins:received', view);
    return view;
  }

  /** Mints `amount` to the member (once per `rewardKey`); null when it was already paid. */
  private async mint(
    workspaceId: string,
    userId: string,
    kind: CoinTxKind,
    amount: number,
    reason: string,
    rewardKey?: string,
    extra: { byUserId?: string; note?: string } = {},
  ) {
    if (rewardKey && (await this.prisma.coinTx.findUnique({ where: { rewardKey } }))) return null;
    // A member's first reward creates their wallet (with its welcome grant first).
    const address =
      kind === CoinTxKind.WELCOME
        ? (await this.wallets.getOrCreate(userId)).address
        : await this.ensureWallet(workspaceId, userId);
    const receipt = await this.chain.send((c) => c.coin.reward(address, toUnits(amount), reason));
    return this.record({ workspaceId, userId, kind, amount, receipt, rewardKey, ...extra });
  }

  /** A task / game reward, reduced to what the daily earning cap still allows. */
  private async capped(
    workspaceId: string,
    userId: string,
    kind: CoinTxKind,
    amount: number,
    reason: string,
    rewardKey: string,
    note: string,
  ) {
    if (!this.chain.ready) return null;
    const earned = await this.prisma.coinTx.aggregate({
      where: {
        userId,
        kind: { in: [CoinTxKind.TASK, CoinTxKind.GAME] },
        createdAt: { gte: startOfUtcDay(new Date()) },
      },
      _sum: { amount: true },
    });
    const pay = cappedReward(amount, earned._sum.amount ?? 0);
    if (pay === 0) return null;
    return this.mint(workspaceId, userId, kind, pay, reason, rewardKey, { note });
  }

  private async views(
    rows: {
      id: string;
      kind: CoinTxKind;
      amount: number;
      item: string | null;
      userId: string;
      byUserId: string | null;
      note: string | null;
      txHash: string;
      blockNumber: number;
      createdAt: Date;
      user: { displayName: string };
    }[],
  ): Promise<CoinTxView[]> {
    const byIds = [...new Set(rows.map((r) => r.byUserId).filter((id): id is string => !!id))];
    const names = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: byIds } },
          select: { id: true, displayName: true },
        })
      ).map((u) => [u.id, u.displayName]),
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      amount: r.amount,
      item: r.item,
      userId: r.userId,
      userName: r.user.displayName,
      byName: r.byUserId ? (names.get(r.byUserId) ?? null) : null,
      note: r.note,
      txHash: r.txHash,
      blockNumber: r.blockNumber,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

/** "3 h 5 min", "42 s": how long until the next daily claim. */
function waitText(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.ceil(s / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
