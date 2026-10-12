/**
 * Compiled Solidity contracts (ABI + bytecode), produced by scripts/compile-contracts.mjs into
 * contracts/build/contracts.json and read once at startup.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InterfaceAbi } from 'ethers';

/** One compiled contract. */
export interface Artifact {
  abi: InterfaceAbi;
  bytecode: string;
}

let cached: Record<string, Artifact> | null = null;

/** The compiled contract `name` (PulseCoin, KitchenShop). Throws when the contracts were not compiled. */
export function artifact(name: 'PulseCoin' | 'KitchenShop'): Artifact {
  if (!cached) {
    // The API always runs from its package root (apps/api locally, /app in Docker).
    const file = resolve(process.cwd(), 'contracts/build/contracts.json');
    try {
      cached = (JSON.parse(readFileSync(file, 'utf8')) as { contracts: Record<string, Artifact> })
        .contracts;
    } catch {
      throw new Error(`Compiled contracts not found at ${file}: run \`pnpm contracts\`.`);
    }
  }
  const found = cached[name];
  if (!found) throw new Error(`Contract ${name} missing from the compiled contracts.`);
  return found;
}
