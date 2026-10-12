/**
 * Members' custodial wallets: one Ethereum key per user, created on first use and stored encrypted.
 * The key only ever signs EIP-2612 permits (spending approvals) for the kitchen; it never needs gas.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Signature, Wallet } from 'ethers';
import { decrypt, deriveKey, encrypt } from '../auth/crypto/secrets';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { ChainService } from './chain.service';

/** How long a signed permit stays valid (it is used right away by the relayer). */
const PERMIT_TTL_S = 10 * 60;

/** EIP-2612 Permit, as defined by OpenZeppelin's ERC20Permit. */
const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

/** A permit signature, split the way KitchenShop.buy takes it. */
export interface SignedPermit {
  deadline: bigint;
  v: number;
  r: string;
  s: string;
}

/** Creates, stores (encrypted) and uses members' wallet keys. */
@Injectable()
export class WalletsService {
  private readonly key: Buffer;

  constructor(
    config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
  ) {
    this.key = deriveKey(config.jwtSecret, 'wallet-key');
  }

  /** The member's wallet address, or null when they have none yet. */
  async address(userId: string): Promise<string | null> {
    return (
      (await this.prisma.wallet.findUnique({ where: { userId }, select: { address: true } }))
        ?.address ?? null
    );
  }

  /** The member's wallet, created on first use. `created` tells the caller to pay the welcome grant. */
  async getOrCreate(userId: string): Promise<{ address: string; created: boolean }> {
    const existing = await this.address(userId);
    if (existing) return { address: existing, created: false };
    const wallet = Wallet.createRandom();
    try {
      await this.prisma.wallet.create({
        data: {
          userId,
          address: wallet.address,
          encryptedKey: encrypt(wallet.privateKey, this.key),
        },
      });
      return { address: wallet.address, created: true };
    } catch (error) {
      // Two requests created it at the same time: keep the one that was stored.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return { address: (await this.address(userId))!, created: false };
      throw error;
    }
  }

  /** Signs a permit letting `spender` take exactly `value` coin units from the member's wallet. */
  async signPermit(userId: string, spender: string, value: bigint): Promise<SignedPermit> {
    const row = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const signer = new Wallet(decrypt(row.encryptedKey, this.key));
    const { coin, chainId } = this.chain.get();
    const nonce = (await coin.nonces(row.address)) as bigint;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + PERMIT_TTL_S);
    const domain = {
      name: 'PulseCoin',
      version: '1',
      chainId,
      verifyingContract: await coin.getAddress(),
    };
    const signature = Signature.from(
      await signer.signTypedData(domain, PERMIT_TYPES, {
        owner: row.address,
        spender,
        value,
        nonce,
        deadline,
      }),
    );
    return { deadline, v: signature.v, r: signature.r, s: signature.s };
  }
}
