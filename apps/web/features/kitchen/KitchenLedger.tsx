'use client';

// Ledger tab of the kitchen café: the office blockchain at a glance, every PulseCoin transaction of the
// office, and the on-chain proof (receipt + decoded events) of any of them.

import { BadgeCheck, Blocks, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { Hash } from './Hash';
import { type CoinTx, describeTx, type Ledger, signed, type TxProof } from './types';

interface KitchenLedgerProps {
  ledger: Ledger | null;
  proof: TxProof | null;
  proofError: string;
  onProof(hash: string): void;
  onCloseProof(): void;
}

/** Chain summary and office transactions, or one transaction's proof. */
export function KitchenLedger({
  ledger,
  proof,
  proofError,
  onProof,
  onCloseProof,
}: KitchenLedgerProps) {
  if (proof || proofError) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" onClick={onCloseProof}>
          <ChevronLeft className="size-4" /> Ledger
        </Button>
        {proofError ? (
          <p className="text-sm text-rose-700">{proofError}</p>
        ) : (
          proof && <Proof proof={proof} />
        )}
      </div>
    );
  }
  if (!ledger)
    return <p className="py-10 text-center text-sm text-zinc-500">Loading the ledger…</p>;
  const { chain } = ledger;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl bg-zinc-900 p-4 text-zinc-100">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Blocks className="size-4 text-emerald-400" /> Office blockchain
          <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
            block {chain.block}
          </span>
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          <Fact
            label="Chain id"
            value={`${chain.chainId}${chain.chainId === 31337 ? ' (local)' : ''}`}
          />
          <Fact label="Coins in circulation" value={`${chain.supply} PULSE`} />
          <Fact label="Kitchen till" value={`${chain.till} PULSE`} />
          <Fact label="Purchases" value={String(chain.purchases)} />
          <Fact label="PulseCoin contract" value={<Hash value={chain.coin} />} />
          <Fact label="KitchenShop contract" value={<Hash value={chain.shop} />} />
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Office transactions</h3>
        {ledger.transactions.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
            {ledger.transactions.map((tx) => (
              <Row key={tx.id} tx={tx} onProof={onProof} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ tx, onProof }: { tx: CoinTx; onProof(hash: string): void }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <span
        className={cn(
          'w-12 shrink-0 text-right font-semibold tabular-nums',
          tx.amount > 0 ? 'text-emerald-700' : 'text-zinc-700',
        )}
      >
        {signed(tx.amount)}
      </span>
      <span className="min-w-0 flex-1 truncate">
        <b className="font-medium">{tx.userName}</b>{' '}
        <span className="text-zinc-600">{describeTx(tx)}</span>
      </span>
      <span className="hidden text-xs text-zinc-400 tabular-nums sm:inline">#{tx.blockNumber}</span>
      <Hash value={tx.txHash} onOpen={() => onProof(tx.txHash)} />
    </li>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="truncate font-medium text-zinc-100 [&_button]:text-emerald-300 [&_span]:text-zinc-100">
        {value}
      </dd>
    </div>
  );
}

/** A transaction as the chain reports it. */
function Proof({ proof }: { proof: TxProof }) {
  return (
    <section
      aria-label="On-chain proof"
      className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200"
    >
      <p
        className={cn(
          'flex items-center gap-2 font-semibold',
          proof.status === 'success' ? 'text-emerald-700' : 'text-rose-700',
        )}
      >
        <BadgeCheck className="size-5" />{' '}
        {proof.status === 'success' ? 'Confirmed on-chain' : 'Failed on-chain'}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-zinc-500">Block</dt>
          <dd className="font-medium tabular-nums">{proof.blockNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Confirmations</dt>
          <dd className="font-medium tabular-nums">{proof.confirmations}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Gas used</dt>
          <dd className="font-medium tabular-nums">{Number(proof.gasUsed).toLocaleString()}</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-zinc-500">Time</dt>
          <dd className="font-medium">
            {proof.timestamp ? new Date(proof.timestamp).toLocaleString() : '?'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Transaction</dt>
          <dd>
            <Hash value={proof.hash} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Block hash</dt>
          <dd>
            <Hash value={proof.blockHash} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">From (relayer)</dt>
          <dd>
            <Hash value={proof.from} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">To (contract)</dt>
          <dd>{proof.to ? <Hash value={proof.to} /> : '?'}</dd>
        </div>
      </dl>
      <div>
        <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Events
        </h4>
        <ul className="flex flex-col gap-2">
          {proof.events.map((e, i) => (
            <li
              key={i}
              className="rounded-lg bg-zinc-50 p-2.5 font-mono text-xs ring-1 ring-zinc-200/80"
            >
              <p className="font-semibold text-zinc-800">{e.event}</p>
              <dl className="mt-1 grid gap-0.5">
                {Object.entries(e.args).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="shrink-0 text-zinc-500">{k}</dt>
                    <dd className="truncate text-zinc-800" title={v}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
