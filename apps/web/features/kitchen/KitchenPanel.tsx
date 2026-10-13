'use client';

// The kitchen café: opened with E at the kitchen's fridge or counter. Buy water, Pepsi or dinner with
// PulseCoin, manage the wallet, browse the office ledger. Also toasts coins earned anywhere in the office.

import { Coffee, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { officeEvents } from '@/features/office/events';
import type { OfficeFeatureProps } from '@/features/office/types';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useEscape } from '@/lib/escape';
import { KitchenContracts } from './KitchenContracts';
import { KitchenLedger } from './KitchenLedger';
import { KitchenMenu } from './KitchenMenu';
import { KitchenWallet } from './KitchenWallet';
import {
  type CoinTx,
  describeTx,
  type KitchenView,
  type Ledger,
  type MenuEntry,
  type Receipt,
  type ContractsView,
  type TxProof,
} from './types';

type Tab = 'menu' | 'wallet' | 'ledger' | 'contracts';
const TABS: { id: Tab; label: string }[] = [
  { id: 'menu', label: 'Menu' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'contracts', label: 'Contracts' },
];

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/** Kitchen café dialog and PulseCoin notifications. */
export function KitchenPanel({ socket, myId, onToast, editing }: OfficeFeatureProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('menu');
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [view, setView] = useState<KitchenView | null>(null);
  const [history, setHistory] = useState<CoinTx[]>([]);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [contracts, setContracts] = useState<ContractsView | null>(null);
  const [members, setMembers] = useState<{ userId: string; displayName: string }[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [proof, setProof] = useState<TxProof | null>(null);
  const [proofError, setProofError] = useState('');
  const [buying, setBuying] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const load = useCallback(async () => {
    try {
      const [v, h, l] = await Promise.all([
        api<KitchenView>('/kitchen'),
        api<CoinTx[]>('/kitchen/history'),
        api<Ledger>('/kitchen/ledger'),
      ]);
      setView(v);
      setHistory(h);
      setLedger(l);
      // The contracts' live state too, once the tab has been opened.
      if (tabRef.current === 'contracts')
        api<ContractsView>('/kitchen/contracts').then(setContracts, () => undefined);
      setError('');
      if (v.canGrant)
        api<{ userId: string; displayName: string }[]>('/workspace/members').then(
          setMembers,
          () => undefined,
        );
    } catch (err) {
      setError(errorText(err, 'The kitchen is not reachable right now.'));
    }
  }, []);

  // E at the fridge or the counter.
  useEffect(
    () =>
      officeEvents.on('object:interact', (e) => {
        if (e.type !== 'kitchen') return;
        setOpen(true);
        setTab('menu');
        setReceipt(null);
        setProof(null);
        setProofError('');
      }),
    [],
  );

  useEffect(() => {
    if (!open) return;
    void load();
    panelRef.current?.focus();
  }, [open, load]);

  // Coins moved somewhere in the office: refresh what is on screen; tell people when they earned some.
  useEffect(() => {
    if (!socket) return;
    const onTx = () => openRef.current && void load();
    const onReceived = (tx: CoinTx) => {
      if (tx.kind === 'WELCOME' || tx.kind === 'DAILY') return; // shown in the panel that asked for them
      onToast(`+${tx.amount} PulseCoin: you ${describeTx(tx)}.`);
    };
    socket.on('coins:tx', onTx);
    socket.on('coins:received', onReceived);
    return () => {
      socket.off('coins:tx', onTx);
      socket.off('coins:received', onReceived);
    };
  }, [socket, load, onToast]);

  const close = () => setOpen(false);
  useEscape(open && !editing, close);

  const buy = async (item: MenuEntry) => {
    setBuying(item.key);
    setError('');
    try {
      const r = await api<Receipt>('/kitchen/buy', { body: { item: item.key } });
      setReceipt(r);
      void load();
    } catch (err) {
      setError(errorText(err, 'The purchase did not go through. Please try again.'));
    } finally {
      setBuying(null);
    }
  };

  const claim = async () => {
    setClaiming(true);
    setError('');
    try {
      await api('/kitchen/daily', { method: 'POST' });
      onToast('+5 PulseCoin: daily coins claimed.');
      void load();
    } catch (err) {
      setError(errorText(err, 'Could not claim the daily coins.'));
      void load();
    } finally {
      setClaiming(false);
    }
  };

  const grant = async (userId: string, amount: number, note: string) => {
    setError('');
    try {
      await api('/kitchen/grants', { body: { userId, amount, note } });
      const name = members.find((m) => m.userId === userId)?.displayName ?? 'them';
      onToast(`You gave ${amount} PulseCoin to ${name}.`);
      void load();
      return true;
    } catch (err) {
      setError(errorText(err, 'Could not give the coins.'));
      return false;
    }
  };

  const showProof = async (hash: string) => {
    setTab('ledger');
    setProof(null);
    setProofError('');
    try {
      setProof(await api<TxProof>(`/kitchen/tx/${hash}`));
    } catch (err) {
      setProofError(errorText(err, 'Could not read this transaction from the chain.'));
    }
  };

  if (!open || editing) return null;
  return (
    <Panel
      ref={panelRef}
      role="dialog"
      aria-label="Kitchen café"
      tabIndex={-1}
      // Keys pressed in the café (Tab, Space on buttons...) never walk the avatar away from the counter.
      data-captures-keys=""
      className="absolute inset-x-2 top-[4.5rem] bottom-4 z-30 flex flex-col overflow-hidden outline-none sm:inset-x-auto sm:left-1/2 sm:w-[min(42rem,calc(100vw-2rem))] sm:-translate-x-1/2"
    >
      <header className="flex items-center gap-2 border-b border-zinc-200/70 py-2 pr-2 pl-4">
        <Coffee className="size-5 text-amber-700" />
        <h2 className="mr-auto font-semibold">Kitchen café</h2>
        {view && (
          <span
            className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800 tabular-nums ring-1 ring-emerald-200"
            aria-label="Your balance"
          >
            {view.wallet.balance} PULSE
          </span>
        )}
        <IconButton aria-label="Close" onClick={close}>
          <X className="size-4" />
        </IconButton>
      </header>

      <div
        role="tablist"
        aria-label="Kitchen café"
        className="flex gap-1 border-b border-zinc-200/70 px-3 py-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setProof(null);
              setProofError('');
              if (t.id === 'contracts') {
                api<ContractsView>('/kitchen/contracts').then(setContracts, (err: unknown) =>
                  setError(errorText(err, 'Could not read the contracts from the chain.')),
                );
              }
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition',
              tab === t.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-900/5',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        {error && (
          <Alert tone="error" className="mb-4">
            {error}
          </Alert>
        )}
        {!view ? (
          !error && <p className="py-10 text-center text-sm text-zinc-500">Opening the café…</p>
        ) : tab === 'menu' ? (
          <KitchenMenu
            menu={view.menu}
            balance={view.wallet.balance}
            buying={buying}
            receipt={receipt}
            onBuy={buy}
            onProof={showProof}
          />
        ) : tab === 'wallet' ? (
          <KitchenWallet
            wallet={view.wallet}
            history={history}
            canGrant={view.canGrant}
            members={members}
            myId={myId}
            claiming={claiming}
            onClaim={claim}
            onGrant={grant}
            onProof={showProof}
          />
        ) : tab === 'contracts' ? (
          <KitchenContracts contracts={contracts} wallet={view.wallet.address} />
        ) : (
          <KitchenLedger
            ledger={ledger}
            proof={proof}
            proofError={proofError}
            onProof={showProof}
            onCloseProof={() => {
              setProof(null);
              setProofError('');
            }}
          />
        )}
      </div>
    </Panel>
  );
}
