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
import { artifact } from './contracts';

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
    let deployment = await this.prisma.chainDeployment.findUnique({ where: { chainId } });
    // A deployment whose code is gone (the local chain was reset) is deployed again.
    if (deployment && (await provider.getCode(deployment.coinAddress)) === '0x') {
      this.logger.warn(
        `Contracts on chain ${chainId} are gone (chain reset?): deploying them again`,
      );
      deployment = null;
    }
    if (!deployment) {
      const coin = await new ContractFactory(coinArt.abi, coinArt.bytecode, relayer).deploy(
        wallet.address,
      );
      await coin.waitForDeployment();
      // The till is the relayer's own address: coins spent in the kitchen go back to the office's account.
      const shop = await new ContractFactory(shopArt.abi, shopArt.bytecode, relayer).deploy(
        await coin.getAddress(),
        wallet.address,
        wallet.address,
      );
      await shop.waitForDeployment();
      deployment = await this.prisma.chainDeployment.upsert({
        where: { chainId },
        create: {
          chainId,
          coinAddress: await coin.getAddress(),
          shopAddress: await shop.getAddress(),
        },
        update: {
          coinAddress: await coin.getAddress(),
          shopAddress: await shop.getAddress(),
          deployedAt: new Date(),
        },
      });
    }
    const coin = new Contract(deployment.coinAddress, coinArt.abi, relayer);
    const shop = new Contract(deployment.shopAddress, shopArt.abi, relayer);

    // The menu in the code is the source of truth: list new items and fix changed prices on-chain.
    for (const item of MENU) {
      const [name, price, active] = (await shop.items(item.id)) as [string, bigint, boolean];
      if (name !== item.name || price !== toUnits(item.price) || !active) {
        await (await shop.setItem(item.id, item.name, toUnits(item.price), true)).wait();
      }
    }
    return { chainId, provider, relayer, relayerAddress: wallet.address, coin, shop };
  }
}
