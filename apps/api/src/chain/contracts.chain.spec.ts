/**
 * Contract tests for PulseCoin and KitchenShop on a real EVM chain (Anvil). Skipped unless CHAIN_TEST_RPC_URL
 * points at a throwaway Anvil node (they move its clock), e.g.:
 *   docker run -d --name anvil-test -p 8546:8545 ghcr.io/foundry-rs/foundry:v1.5.1 "anvil --host 0.0.0.0"
 *   CHAIN_TEST_RPC_URL=http://localhost:8546 pnpm vitest run src/chain
 */
import {
  type BaseWallet,
  Contract,
  ContractFactory,
  JsonRpcProvider,
  NonceManager,
  Signature,
  Wallet,
} from 'ethers';
import { beforeAll, describe, expect, it } from 'vitest';
import { toUnits } from '../kitchen/kitchen.rules';
import { artifact } from './contracts';

const RPC = process.env.CHAIN_TEST_RPC_URL;
const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

describe.skipIf(!RPC)('PulseCoin and KitchenShop on-chain', () => {
  let provider: JsonRpcProvider;
  let admin: NonceManager;
  let adminAddress: string;
  let coin: Contract;
  let shop: Contract;
  let chainId: number;
  const till = Wallet.createRandom().address;

  /** A permit from `owner` letting the shop take `value`, signed by `signer` (normally the owner). */
  async function permit(owner: string, signer: BaseWallet, value: bigint) {
    const deadline = BigInt((await provider.getBlock('latest'))!.timestamp + 600);
    const nonce = (await coin.nonces(owner)) as bigint;
    const domain = {
      name: 'PulseCoin',
      version: '1',
      chainId,
      verifyingContract: await coin.getAddress(),
    };
    const sig = Signature.from(
      await signer.signTypedData(domain, PERMIT_TYPES, {
        owner,
        spender: await shop.getAddress(),
        value,
        nonce,
        deadline,
      }),
    );
    return [deadline, sig.v, sig.r, sig.s] as const;
  }

  const send = async (p: Promise<{ wait(): Promise<unknown> }>) => (await p).wait();

  /** Expects a transaction to be refused; the nonce manager counted it, so it asks the chain again. */
  async function refused(p: Promise<unknown>, message?: RegExp) {
    await expect(p).rejects.toThrow(message);
    admin.reset();
  }

  beforeAll(async () => {
    // No request cache: identical calls (a repeated claim) must reach the chain.
    provider = new JsonRpcProvider(RPC, undefined, { cacheTimeout: -1 });
    chainId = Number((await provider.getNetwork()).chainId);
    const wallet = Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [wallet.address, '0x56BC75E2D63100000']);
    admin = new NonceManager(wallet);
    adminAddress = wallet.address;
    const c = artifact('PulseCoin');
    const s = artifact('KitchenShop');
    coin = (await (
      await new ContractFactory(c.abi, c.bytecode, admin).deploy(adminAddress, 24 * 3600)
    ).waitForDeployment()) as unknown as Contract;
    shop = (await (
      await new ContractFactory(s.abi, s.bytecode, admin).deploy(
        await coin.getAddress(),
        till,
        adminAddress,
      )
    ).waitForDeployment()) as unknown as Contract;
    await send(shop.setItem(1, 'Water', toUnits(1), true));
    await send(shop.setItem(3, 'Dinner', toUnits(6), true));
    await send(shop.setItem(9, 'Gone', toUnits(1), false));
  });

  it('mints rewards for the minter only', async () => {
    const member = Wallet.createRandom();
    await send(coin.reward(member.address, toUnits(20), 'welcome'));
    expect(await coin.balanceOf(member.address)).toBe(toUnits(20));
    const stranger = Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [stranger.address, '0xDE0B6B3A7640000']);
    await expect(
      (coin.connect(stranger) as Contract).reward(stranger.address, toUnits(1000), 'theft'),
    ).rejects.toThrow();
  });

  it('pays the daily allowance once per 24 h', async () => {
    const member = Wallet.createRandom();
    await send(coin.claimDaily(member.address));
    expect(await coin.balanceOf(member.address)).toBe(toUnits(5));
    await refused(coin.claimDaily(member.address), /DailyAlreadyClaimed|reverted/);
    await provider.send('evm_increaseTime', [24 * 3600]);
    await provider.send('evm_mine', []);
    await send(coin.claimDaily(member.address));
    expect(await coin.balanceOf(member.address)).toBe(toUnits(10));
  });

  it('sells an item for exactly its price with the buyer’s permit, and records the purchase', async () => {
    const buyer = Wallet.createRandom();
    await send(coin.reward(buyer.address, toUnits(10), 'test'));
    const before = (await shop.purchaseCount()) as bigint;
    const receipt = (await send(
      shop.buy(buyer.address, 3, ...(await permit(buyer.address, buyer, toUnits(6)))),
    )) as { logs: never[] };
    expect(await coin.balanceOf(buyer.address)).toBe(toUnits(4));
    expect(await coin.balanceOf(till)).toBeGreaterThanOrEqual(toUnits(6));
    expect(await shop.purchaseCount()).toBe(before + 1n);
    const event = receipt.logs
      .map((l) => shop.interface.parseLog(l))
      .find((e) => e?.name === 'Purchased');
    expect(event?.args.buyer).toBe(buyer.address);
    expect(event?.args.price).toBe(toUnits(6));
  });

  it('refuses a permit signed by someone else, a replayed permit, and a permit for less than the price', async () => {
    const buyer = Wallet.createRandom();
    await send(coin.reward(buyer.address, toUnits(10), 'test'));
    const thief = Wallet.createRandom();
    await refused(shop.buy(buyer.address, 1, ...(await permit(buyer.address, thief, toUnits(1)))));

    const once = await permit(buyer.address, buyer, toUnits(1));
    await send(shop.buy(buyer.address, 1, ...once));
    await refused(shop.buy(buyer.address, 1, ...once));

    await refused(shop.buy(buyer.address, 3, ...(await permit(buyer.address, buyer, toUnits(1)))));
    expect(await coin.balanceOf(buyer.address)).toBe(toUnits(9));
  });

  it('refuses buyers without enough coins and items off the menu', async () => {
    const poor = Wallet.createRandom();
    await send(coin.reward(poor.address, toUnits(2), 'test'));
    await refused(shop.buy(poor.address, 3, ...(await permit(poor.address, poor, toUnits(6)))));
    await refused(
      shop.buy(poor.address, 9, ...(await permit(poor.address, poor, toUnits(1)))),
      /NotOnTheMenu|reverted/,
    );
    expect(await coin.balanceOf(poor.address)).toBe(toUnits(2));
  });

  it('lets the admin shorten the daily period (60 s to test), and nobody else', async () => {
    const stranger = Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [stranger.address, '0xDE0B6B3A7640000']);
    await expect((coin.connect(stranger) as Contract).setDailyPeriod(60)).rejects.toThrow();
    await refused(coin.setDailyPeriod(0), /InvalidDailyPeriod|reverted/);
    await send(coin.setDailyPeriod(60));
    expect(await coin.dailyPeriod()).toBe(60n);
    const member = Wallet.createRandom();
    await send(coin.claimDaily(member.address));
    await refused(coin.claimDaily(member.address), /DailyAlreadyClaimed|reverted/);
    await provider.send('evm_increaseTime', [61]);
    await provider.send('evm_mine', []);
    await send(coin.claimDaily(member.address));
    expect(await coin.balanceOf(member.address)).toBe(toUnits(10));
    await send(coin.setDailyPeriod(24 * 3600));
  });

  it('lets only the owner change the menu', async () => {
    const stranger = Wallet.createRandom().connect(provider);
    await provider.send('anvil_setBalance', [stranger.address, '0xDE0B6B3A7640000']);
    await expect(
      (shop.connect(stranger) as Contract).setItem(1, 'Water', 0n, true),
    ).rejects.toThrow();
  });
});
