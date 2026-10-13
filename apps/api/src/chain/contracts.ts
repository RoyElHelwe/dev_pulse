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

/** contracts/build/contracts.json */
interface Build {
  compiler: string;
  /** Changes whenever a contract's bytecode changes (the API then redeploys). */
  codeHash: string;
  /** Solidity sources by file name, to show them in the app. */
  sources: Record<string, string>;
  contracts: Record<string, Artifact>;
}

let cached: Build | null = null;

/** The whole compiled build, read once. Throws when the contracts were not compiled. */
export function build(): Build {
  if (!cached) {
    // The API always runs from its package root (apps/api locally, /app in Docker).
    const file = resolve(process.cwd(), 'contracts/build/contracts.json');
    try {
      cached = JSON.parse(readFileSync(file, 'utf8')) as Build;
    } catch {
      throw new Error(`Compiled contracts not found at ${file}: run \`pnpm contracts\`.`);
    }
  }
  return cached;
}

/** The compiled contract `name` (PulseCoin, KitchenShop). */
export function artifact(name: 'PulseCoin' | 'KitchenShop'): Artifact {
  const found = build().contracts[name];
  if (!found) throw new Error(`Contract ${name} missing from the compiled contracts.`);
  return found;
}
