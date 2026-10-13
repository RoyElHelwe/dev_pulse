'use client';

// Contracts tab of the kitchen café: how the two smart contracts work, their live on-chain state,
// commands to check them straight on the chain (without the app), and their Solidity source.

import { Check, Copy, FileCode2, ShieldCheck } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Hash } from './Hash';
import { type ContractsView, formatPeriod } from './types';

interface KitchenContractsProps {
  contracts: ContractsView | null;
  /** The viewer's wallet, used in the example commands. */
  wallet: string;
}

/** The purchase, step by step. */
const STEPS = [
  [
    'You press Buy',
    'The server checks that you stand at the kitchen and that your balance covers the price read from KitchenShop.',
  ],
  [
    'Your wallet signs a permit',
    'An EIP-2612 signature allowing KitchenShop to take exactly the item’s price, once (it carries your wallet’s nonce).',
  ],
  [
    'The relayer sends KitchenShop.buy',
    'The server’s account submits the transaction and pays the gas: your wallet needs no ether.',
  ],
  [
    'The contract checks and pays the till',
    'buy() applies your permit, moves the coins from your wallet to the till, numbers the purchase. A forged, replayed or too small permit makes it revert.',
  ],
  [
    'A Purchased event is recorded',
    'The receipt you get (block, hash) is the proof; the Ledger reads it back from the chain.',
  ],
] as const;

/** How each contract can be called, and by whom. */
const COIN_FUNCTIONS = [
  [
    'reward(to, amount, reason)',
    'MINTER_ROLE (the server)',
    'Creates coins as a reward: welcome, task, game, grant. Emits Rewarded.',
  ],
  [
    'claimDaily(to)',
    'MINTER_ROLE',
    `Pays the daily allowance. Reverts with DailyAlreadyClaimed before dailyPeriod has passed: the rule lives on-chain.`,
  ],
  [
    'setDailyPeriod(seconds)',
    'DEFAULT_ADMIN_ROLE',
    'Changes the time between two daily claims (synced from CHAIN_DAILY_PERIOD_SECONDS). Emits DailyPeriodChanged.',
  ],
  [
    'permit(owner, spender, value, deadline, v, r, s)',
    'Anyone holding the owner’s signature',
    'EIP-2612: approves a spender with a signature instead of a transaction.',
  ],
  [
    'balanceOf, transfer, totalSupply…',
    'ERC-20 standard',
    'The usual token functions (OpenZeppelin implementation).',
  ],
] as const;

const SHOP_FUNCTIONS = [
  [
    'buy(buyer, itemId, deadline, v, r, s)',
    'Anyone (the relayer)',
    'Takes exactly the item’s price from the buyer with their permit, pays the till, emits Purchased. Reverts with NotOnTheMenu for inactive items.',
  ],
  [
    'setItem(itemId, name, price, active)',
    'Owner (the server)',
    'Lists an item or changes its price. Emits ItemListed.',
  ],
  [
    'items(itemId), purchaseCount(), till()',
    'Anyone (read)',
    'The menu, the number of purchases and the till’s address.',
  ],
] as const;

/** How the café's smart contracts work, with live state, verification commands and source. */
export function KitchenContracts({ contracts, wallet }: KitchenContractsProps) {
  if (!contracts)
    return (
      <p className="py-10 text-center text-sm text-zinc-500">
        Reading the contracts from the chain…
      </p>
    );
  const { coin, shop } = contracts;
  const commands = [
    [
      'Your balance (in wei: 18 decimals)',
      `cast call ${coin.address} "balanceOf(address)(uint256)" ${wallet}`,
    ],
    ['Coins in circulation', `cast call ${coin.address} "totalSupply()(uint256)"`],
    ['Daily period (seconds)', `cast call ${coin.address} "dailyPeriod()(uint256)"`],
    [
      'When you can claim again (unix time)',
      `cast call ${coin.address} "nextDailyClaim(address)(uint256)" ${wallet}`,
    ],
    [
      'Pepsi on the menu: name, price, active',
      `cast call ${shop.address} "items(uint256)(string,uint256,bool)" 2`,
    ],
    ['Purchases so far', `cast call ${shop.address} "purchaseCount()(uint256)"`],
    ['Any transaction of the Ledger', 'cast receipt <transaction hash>'],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-zinc-600">
        Two Solidity contracts run the café on the office blockchain (chain {contracts.chainId},
        block {contracts.block}). The app never changes a balance itself: every coin that moves is a
        transaction these contracts accept or refuse.
      </p>

      <section>
        <h3 className="mb-2 text-sm font-semibold">How a purchase works</h3>
        <ol className="flex flex-col gap-2">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span>
                <b className="font-semibold">{title}.</b>{' '}
                <span className="text-zinc-600">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <ContractCard
        name="PulseCoin (PULSE)"
        file="PulseCoin.sol"
        address={coin.address}
        summary="ERC-20 token with EIP-2612 permits and role-based minting (OpenZeppelin 5)."
        facts={[
          ['Name / symbol', `${coin.state.name} / ${coin.state.symbol}`],
          ['Decimals', String(coin.state.decimals)],
          ['Coins in circulation', `${coin.state.totalSupply} PULSE`],
          [
            'Daily allowance',
            `${coin.state.dailyAllowance} PULSE every ${formatPeriod(coin.state.dailyPeriodSeconds)}`,
          ],
          ['Server may mint', coin.state.relayerIsMinter ? 'yes (MINTER_ROLE)' : 'no'],
        ]}
        functions={COIN_FUNCTIONS}
        events="Transfer, Approval, Rewarded, DailyClaimed, DailyPeriodChanged"
        source={coin.source}
      />

      <ContractCard
        name="KitchenShop"
        file="KitchenShop.sol"
        address={shop.address}
        summary="The menu and the till: prices on-chain, purchases paid by the buyer's permit."
        facts={[
          ['Menu (on-chain)', shop.state.items.map((i) => `${i.name} ${i.price}`).join(' · ')],
          ['Purchases', String(shop.state.purchaseCount)],
          ['Owner', <Hash key="o" value={shop.state.owner} />],
          ['Till', <Hash key="t" value={shop.state.till} />],
          ['Accepts', <Hash key="c" value={shop.state.coin} />],
        ]}
        functions={SHOP_FUNCTIONS}
        events="Purchased, ItemListed, OwnershipTransferred"
        source={shop.source}
      />

      <section className="rounded-xl bg-zinc-900 p-4 text-zinc-100">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-emerald-400" /> Check it yourself, without the app
        </h3>
        <p className="mt-1 text-xs text-zinc-400">
          On the machine running Dev Pulse, ask the chain directly with Foundry&apos;s{' '}
          <code>cast</code>, inside the chain container:{' '}
          <code className="text-zinc-200">docker compose exec chain &lt;command&gt;</code>
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {commands.map(([what, command]) => (
            <li key={what}>
              <p className="text-xs text-zinc-400">{what}</p>
              <Command text={command} />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-zinc-500">
        Compiled with solc {contracts.compiler.split('+')[0]}; the server’s account (relayer) is{' '}
        <Hash value={contracts.relayer} />.
      </p>
    </div>
  );
}

interface ContractCardProps {
  name: string;
  file: string;
  address: string;
  summary: string;
  facts: (readonly [string, ReactNode])[];
  functions: readonly (readonly [string, string, string])[];
  events: string;
  source: string;
}

function ContractCard({
  name,
  file,
  address,
  summary,
  facts,
  functions,
  events,
  source,
}: ContractCardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <header>
        <h3 className="flex items-center gap-2 font-semibold">
          <FileCode2 className="size-4 text-emerald-600" /> {name}
        </h3>
        <p className="text-sm text-zinc-600">{summary}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Address <Hash value={address} />
        </p>
      </header>
      <p className="-mb-1 text-xs font-medium text-emerald-700">Read live from the chain</p>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="truncate font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Function</th>
              <th className="py-1 pr-3 font-medium">Who can call it</th>
              <th className="py-1 font-medium">What it does</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {functions.map(([fn, who, what]) => (
              <tr key={fn} className="align-top">
                <td className="py-1.5 pr-3 font-mono text-zinc-800">{fn}</td>
                <td className="py-1.5 pr-3 text-zinc-600">{who}</td>
                <td className="py-1.5 text-zinc-600">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Events: <span className="font-mono text-zinc-700">{events}</span>
      </p>
      <details className="rounded-lg bg-zinc-50 ring-1 ring-zinc-200/80">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Source: {file}</summary>
        <pre className="max-h-96 overflow-auto border-t border-zinc-200/80 p-3 text-[11px] leading-relaxed text-zinc-800">
          <code>{source}</code>
        </pre>
      </details>
    </section>
  );
}

/** A shell command with a copy button. */
function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard?.writeText(`docker compose exec chain ${text}`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  return (
    <div className="flex items-start gap-2 rounded-lg bg-black/40 px-2.5 py-1.5">
      <code className="min-w-0 flex-1 font-mono text-[11px] break-all text-emerald-200">
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy command"
        title={copied ? 'Copied' : 'Copy the full command'}
        className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-white"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
