'use client';

// Menu tab of the kitchen café: items with their on-chain price, Buy, and the receipt of the last purchase.

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { Hash } from './Hash';
import { ITEM_ICONS, type MenuEntry, type Receipt } from './types';

interface KitchenMenuProps {
  menu: MenuEntry[];
  balance: number;
  buying: string | null;
  receipt: Receipt | null;
  onBuy(item: MenuEntry): void;
  onProof(hash: string): void;
}

/** The menu cards and, after a purchase, its receipt. */
export function KitchenMenu({ menu, balance, buying, receipt, onBuy, onProof }: KitchenMenuProps) {
  return (
    <div className="flex flex-col gap-4">
      {receipt && (
        <section
          aria-label="Receipt"
          className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200"
        >
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 className="size-5" /> Enjoy! Your {receipt.item.name} is paid.
          </p>
          <p className="mt-0.5 text-sm text-emerald-800/80">
            You hold it for 3 minutes, and everyone can see it.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-zinc-500">Paid</dt>
              <dd className="font-medium">{receipt.item.price} PULSE</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Balance now</dt>
              <dd className="font-medium">{receipt.balance} PULSE</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Purchase</dt>
              <dd className="font-medium">#{receipt.purchaseId ?? '?'}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Block</dt>
              <dd className="font-medium tabular-nums">{receipt.blockNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Gas used</dt>
              <dd className="font-medium tabular-nums">
                {Number(receipt.gasUsed).toLocaleString()}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-xs text-zinc-500">Transaction</dt>
              <dd>
                <Hash value={receipt.txHash} onOpen={() => onProof(receipt.txHash)} />
              </dd>
            </div>
          </dl>
        </section>
      )}

      <ul className="grid gap-3 sm:grid-cols-3">
        {menu.map((item) => {
          const { Icon, tint } = ITEM_ICONS[item.key];
          const short = item.price - balance;
          return (
            // A compact row on phones, a card from sm up.
            <li
              key={item.key}
              className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-zinc-200 sm:flex-col sm:items-stretch sm:p-4"
            >
              <span
                className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tint)}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-sm text-zinc-600">{item.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 sm:items-stretch sm:gap-3">
                <p className="text-sm font-semibold tabular-nums">{item.price} PULSE</p>
                <Button
                  size="sm"
                  onClick={() => onBuy(item)}
                  loading={buying === item.key}
                  disabled={
                    !item.available || short > 0 || (buying !== null && buying !== item.key)
                  }
                  aria-label={`Buy ${item.name} for ${item.price} PULSE`}
                >
                  {!item.available ? 'Unavailable' : short > 0 ? `Need ${short} more` : 'Buy'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500">
        Prices are set in the KitchenShop smart contract; every purchase is a transaction on the
        office blockchain.
      </p>
    </div>
  );
}
