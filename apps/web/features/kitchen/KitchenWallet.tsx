'use client';

// Wallet tab of the kitchen café: address and balance, the daily allowance, ways to earn, history,
// and (owners / admins) giving coins to a member.

import { CalendarCheck, Gift } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { cn } from '@/lib/cn';
import { Hash } from './Hash';
import { type CoinTx, describeTx, signed, timeUntil, type WalletView } from './types';

/** Coins for each way of earning (same values as the API's kitchen.rules.ts). */
const EARN = [
  ['Welcome grant', '20, once'],
  ['Daily allowance', '5, every 24 h'],
  ['Closing a task', '3'],
  ['Winning a game', '2'],
  ['From an owner or admin', 'up to 50'],
] as const;
const DAILY_EARN_CAP = 30;
const MAX_GRANT = 50;

interface Member {
  userId: string;
  displayName: string;
}

interface KitchenWalletProps {
  wallet: WalletView;
  history: CoinTx[];
  canGrant: boolean;
  members: Member[];
  myId: string;
  claiming: boolean;
  onClaim(): void;
  onGrant(userId: string, amount: number, note: string): Promise<boolean>;
  onProof(hash: string): void;
}

/** The member's wallet and, for admins, the grant form. */
export function KitchenWallet({
  wallet,
  history,
  canGrant,
  members,
  myId,
  claiming,
  onClaim,
  onGrant,
  onProof,
}: KitchenWalletProps) {
  const others = members.filter((m) => m.userId !== myId);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('5');
  const [note, setNote] = useState('');
  const [giving, setGiving] = useState(false);

  const give = async (e: FormEvent) => {
    e.preventDefault();
    setGiving(true);
    const ok = await onGrant(to || others[0]?.userId || '', Number(amount), note);
    setGiving(false);
    if (ok) setNote('');
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="mr-auto">
          <p className="text-xs text-zinc-500">Your wallet</p>
          <p className="text-3xl font-semibold tabular-nums">
            {wallet.balance} <span className="text-base font-medium text-zinc-500">PULSE</span>
          </p>
          <Hash value={wallet.address} />
        </div>
        <div className="flex flex-col items-start gap-1">
          <Button
            variant="secondary"
            onClick={onClaim}
            loading={claiming}
            disabled={!!wallet.nextDailyAt}
          >
            <CalendarCheck className="size-4" />{' '}
            {wallet.nextDailyAt ? 'Daily coins claimed' : `Claim ${wallet.dailyAmount} daily coins`}
          </Button>
          {wallet.nextDailyAt && (
            <span className="text-xs text-zinc-500">
              Next claim in {timeUntil(wallet.nextDailyAt)}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200/80">
        <h3 className="text-sm font-semibold">Ways to earn PulseCoin</h3>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {EARN.map(([what, coins]) => (
            <li key={what} className="flex justify-between gap-3">
              <span className="text-zinc-600">{what}</span>
              <span className="font-medium tabular-nums">{coins}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Tasks and games pay up to {DAILY_EARN_CAP} coins a day.
        </p>
      </section>

      {canGrant && others.length > 0 && (
        <form
          onSubmit={give}
          className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200"
          aria-label="Give coins"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="size-4 text-emerald-600" /> Give coins
          </h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
            <Select
              label="To"
              value={to || others[0]?.userId}
              onChange={(e) => setTo(e.target.value)}
            >
              {others.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </Select>
            <TextField
              label="Coins"
              type="number"
              min={1}
              max={MAX_GRANT}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <TextField
            label="Note (optional)"
            maxLength={80}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Thanks for the demo!"
          />
          <Button type="submit" variant="secondary" loading={giving} className="self-start">
            Give {Number(amount) || 0} PULSE
          </Button>
        </form>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Your history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
            {history.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span
                  className={cn(
                    'w-12 shrink-0 text-right font-semibold tabular-nums',
                    tx.amount > 0 ? 'text-emerald-700' : 'text-zinc-700',
                  )}
                >
                  {signed(tx.amount)}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-700">
                  {describeTx(tx).replace(/^./, (c) => c.toUpperCase())}
                </span>
                <span className="hidden text-xs text-zinc-400 tabular-nums sm:inline">
                  #{tx.blockNumber}
                </span>
                <Hash value={tx.txHash} onOpen={() => onProof(tx.txHash)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
