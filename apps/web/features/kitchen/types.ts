// API shapes of the kitchen café (GET /api/kitchen, /kitchen/ledger...) and display helpers for PulseCoin.

import { CupSoda, type LucideIcon, GlassWater, UtensilsCrossed } from 'lucide-react';

export type ItemKey = 'water' | 'pepsi' | 'dinner';
export type CoinTxKind = 'WELCOME' | 'DAILY' | 'TASK' | 'GAME' | 'GRANT' | 'PURCHASE';

export interface MenuEntry {
  key: ItemKey;
  name: string;
  description: string;
  /** Whole PulseCoins, read from the KitchenShop contract. */
  price: number;
  available: boolean;
}

export interface WalletView {
  address: string;
  balance: number;
  /** ISO time of the next daily claim, or null when it can be claimed now. */
  nextDailyAt: string | null;
  dailyAmount: number;
}

/** GET /kitchen */
export interface KitchenView {
  menu: MenuEntry[];
  wallet: WalletView;
  canGrant: boolean;
}

/** One transaction of a history or of the office ledger (also the `coins:tx` / `coins:received` events). */
export interface CoinTx {
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

/** POST /kitchen/buy */
export interface Receipt {
  item: { key: ItemKey; name: string; price: number };
  purchaseId: number | null;
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  balance: number;
}

/** GET /kitchen/ledger */
export interface Ledger {
  transactions: CoinTx[];
  chain: {
    chainId: number;
    block: number;
    coin: string;
    shop: string;
    relayer: string;
    till: number;
    supply: number;
    purchases: number;
  };
}

/** GET /kitchen/tx/:hash */
export interface TxProof {
  hash: string;
  status: 'success' | 'failed';
  blockNumber: number;
  blockHash: string;
  timestamp: string | null;
  confirmations: number;
  from: string;
  to: string | null;
  gasUsed: string;
  events: { contract: string; event: string; args: Record<string, string> }[];
}

export const ITEM_ICONS: Record<ItemKey, { Icon: LucideIcon; tint: string }> = {
  water: { Icon: GlassWater, tint: 'bg-sky-100 text-sky-700' },
  pepsi: { Icon: CupSoda, tint: 'bg-blue-100 text-blue-800' },
  dinner: { Icon: UtensilsCrossed, tint: 'bg-amber-100 text-amber-800' },
};

const ITEM_NAMES: Record<string, string> = { water: 'Water', pepsi: 'Pepsi', dinner: 'Dinner' };

/** "0x1234…cdef" */
export const shortHex = (hex: string, keep = 4) =>
  hex.length > 2 * keep + 4 ? `${hex.slice(0, keep + 2)}…${hex.slice(-keep)}` : hex;

/** What a transaction was, in words ("bought Pepsi", "closed DP-12"...). */
export function describeTx(tx: CoinTx): string {
  switch (tx.kind) {
    case 'PURCHASE':
      return `bought ${ITEM_NAMES[tx.item ?? ''] ?? 'something'}`;
    case 'WELCOME':
      return 'got the welcome grant';
    case 'DAILY':
      return 'claimed the daily coins';
    case 'GRANT':
      return `got coins from ${tx.byName ?? 'an admin'}${tx.note ? `: “${tx.note}”` : ''}`;
    default:
      // TASK / GAME: the note says what for ("for closing DP-12", "for winning a game of Uno").
      return `earned coins ${tx.note ?? ''}`.trim();
  }
}

/** "+3" / "−2" */
export const signed = (amount: number) => (amount > 0 ? `+${amount}` : `−${Math.abs(amount)}`);

/** "5 h 12 min" until `iso` (or "now"). */
export function timeUntil(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.ceil((Date.parse(iso) - now) / 60_000));
  if (minutes === 0) return 'now';
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} h ${minutes % 60} min` : `${minutes} min`;
}
