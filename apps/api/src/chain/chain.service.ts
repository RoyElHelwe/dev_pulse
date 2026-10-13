/**
 * Connection to the office blockchain: deploys PulseCoin and KitchenShop once, keeps the on-chain menu
 * in sync, and sends every transaction of the app's relayer account through one queue (no nonce races).
 */

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Contract,
  ContractFactory,
  FetchRequest,
  JsonRpcProvider,
  NonceManager,
  type TransactionReceipt,
  type TransactionResponse,
  Wallet,
} from 'ethers';
import { deriveKey } from '../auth/crypto/secrets';
import { AppConfig } from '../config/app-config';
import { MENU, toUnits } from '../kitchen/kitchen.rules';
import { PrismaService } from '../prisma/prisma.service';
import { artifact, build } from './contracts';

/** Anvil's chain id: a local development chain, where the relayer can fund itself. */
const LOCAL_CHAIN_ID = 31337;
/** Plenty of local test ether for the relayer's gas (1,000,000 ETH). */
const LOCAL_RELAYER_FUNDS = 10n ** 24n;
const RETRY_DELAY_MS = 3_000;
const RPC_TIMEOUT_MS = 10_000;

/** The deployed contracts, once connected. */
interface Connected {
  chainId: number;
  provider: JsonRpcProvider;
  relayer: NonceManager;
  relayerAddress: string;
  coin: Contract;
  shop: Contract;
}

/** Owns the blockchain connection, the contract handles and the relayer's transaction queue. */
@Injectable()
export class ChainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChainService.name);
  private connected: Connected | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    // In the background: the API serves everything else while the chain container starts.
    void this.connect();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.connected?.provider.destroy();
  }

  /** The contracts, or a 503 while the chain is not reachable yet. */
  get(): Connected {
    if (!this.connected)
      throw new ServiceUnavailableException({
        code: 'CHAIN_UNAVAILABLE',
        message: 'The office blockchain is starting. Try again in a moment.',
      });
    return this.connected;
  }

  get ready(): boolean {
    return this.connected !== null;
  }

  /**
   * Sends a relayer transaction and waits for its block. Transactions go one at a time, so the
   * relayer's nonces never collide when many people buy or earn at once.
   */
  send(make: (c: Connected) => Promise<TransactionResponse>): Promise<TransactionReceipt> {
    const c = this.get();
    const run = this.queue.then(async () => {
      const tx = await make(c);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error(`Transaction ${tx.hash} failed`);
      return receipt;
    });
    // A failed transaction must not block the ones after it.
    this.queue = run.catch(() => undefined);
    return run.catch((error: unknown) => {
      // The local nonce may be ahead after a failure: ask the chain again next time.
      c.relayer.reset();
      throw error;
    });
  }

  private async connect(): Promise<void> {
    try {
      this.connected = await this.setUp();
      const c = this.connected;
      this.logger.log(
        `Connected to chain ${c.chainId}: PulseCoin ${await c.coin.getAddress()}, KitchenShop ${await c.shop.getAddress()}`,
      );
    } catch (error) {
      if (this.stopped) return;
      this.logger.warn(
        `Blockchain not ready (${(error as Error).message}); retrying in ${RETRY_DELAY_MS / 1000}s`,
      );
      this.retryTimer = setTimeout(() => void this.connect(), RETRY_DELAY_MS);
    }
  }

  private async setUp(): Promise<Connected> {
    const request = new FetchRequest(this.config.chain.rpcUrl);
    request.timeout = RPC_TIMEOUT_MS;
    // cacheTimeout -1: ethers otherwise reuses identical calls for 250 ms, so a second "claim daily" right
    // after the first got the first one's gas estimate (success) instead of the chain's revert.
    const provider = new JsonRpcProvider(request, undefined, {
      staticNetwork: true,
      pollingInterval: 500,
      cacheTimeout: -1,
    });
    const chainId = Number((await provider.getNetwork()).chainId);
    const key =
      this.config.chain.relayerKey ??
      `0x${deriveKey(this.config.jwtSecret, 'chain-relayer').toString('hex')}`;
    const wallet = new Wallet(key, provider);
    // The local chain starts empty: give the relayer gas money. On a public testnet, fund it with a faucet.
    if (chainId === LOCAL_CHAIN_ID)
      await provider.send('anvil_setBalance', [
        wallet.address,
        `0x${LOCAL_RELAYER_FUNDS.toString(16)}`,
      ]);
    const relayer = new NonceManager(wallet);

    const coinArt = artifact('PulseCoin');
    const shopArt = artifact('KitchenShop');
    const { codeHash } = build();
    const { dailyPeriodSeconds } = this.config.chain;
    let deployment = await this.prisma.chainDeployment.findUnique({ where: { chainId } });
    // A deployment whose code is gone (the local chain was reset) is deployed again.
    const gone = !!deployment && (await provider.getCode(deployment.coinAddress)) === '0x';
    if (gone)
      this.logger.warn(
        `Contracts on chain ${chainId} are gone (chain reset?): deploying them again`,
      );
    // New contract code (e.g. a new function): deploy it, and carry members' balances over below.
    const outdated = !!deployment && !gone && deployment.codeHash !== codeHash;
    if (outdated)
      this.logger.warn(
        `Contracts changed (code ${codeHash.slice(0, 12)}): deploying the new version`,
      );

    if (!deployment || gone || outdated) {
      const previousCoin = outdated ? deployment!.coinAddress : null;
      const coin = await new ContractFactory(coinArt.abi, coinArt.bytecode, relayer).deploy(
        wallet.address,
        dailyPeriodSeconds,
      );
      await coin.waitForDeployment();
      // The till is the relayer's own address: coins spent in the kitchen go back to the office's account.
      const shop = await new ContractFactory(shopArt.abi, shopArt.bytecode, relayer).deploy(
        await coin.getAddress(),
        wallet.address,
        wallet.address,
      );
      await shop.waitForDeployment();
      if (previousCoin)
        await this.migrateBalances(provider, previousCoin, coin as unknown as Contract);
      const addresses = {
        coinAddress: await coin.getAddress(),
        shopAddress: await shop.getAddress(),
        codeHash,
      };
      deployment = await this.prisma.chainDeployment.upsert({
        where: { chainId },
        create: { chainId, ...addresses },
        update: { ...addresses, deployedAt: new Date() },
      });
    }
    const coin = new Contract(deployment.coinAddress, coinArt.abi, relayer);
    const shop = new Contract(deployment.shopAddress, shopArt.abi, relayer);

    // The configuration is the source of truth for the daily period (CHAIN_DAILY_PERIOD_SECONDS)...
    if (((await coin.dailyPeriod()) as bigint) !== BigInt(dailyPeriodSeconds)) {
      await (await coin.setDailyPeriod(dailyPeriodSeconds)).wait();
      this.logger.log(`Daily allowance period set to ${dailyPeriodSeconds} s on-chain`);
    }
    // ...and the code for the menu: list new items and fix changed prices on-chain.
    for (const item of MENU) {
      const [name, price, active] = (await shop.items(item.id)) as [string, bigint, boolean];
      if (name !== item.name || price !== toUnits(item.price) || !active) {
        await (await shop.setItem(item.id, item.name, toUnits(item.price), true)).wait();
      }
    }
    return { chainId, provider, relayer, relayerAddress: wallet.address, coin, shop };
  }

  /** Mints on the new coin what each member's wallet held on the previous version of the contract. */
  private async migrateBalances(provider: JsonRpcProvider, previous: string, next: Contract) {
    const old = new Contract(
      previous,
      ['function balanceOf(address) view returns (uint256)'],
      provider,
    );
    const wallets = await this.prisma.wallet.findMany({ select: { address: true } });
    let moved = 0;
    for (const { address } of wallets) {
      const balance = (await old.balanceOf(address)) as bigint;
      if (balance === 0n) continue;
      await (await next.reward(address, balance, 'migration')).wait();
      moved++;
    }
    this.logger.log(`Carried ${moved} wallet balance(s) over to the new PulseCoin contract`);
  }
}
