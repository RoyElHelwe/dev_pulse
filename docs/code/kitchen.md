# Kitchen Café & PulseCoin (`kitchen`, `chain`)

## Purpose

The office kitchen sells **water (1 PULSE), Pepsi (2) and dinner (6)** for **PulseCoin**, an ERC-20 token on a blockchain that `make` starts with the rest of the app. Walk to the kitchen's fridge or counter and press **E**: the café opens with three tabs:

- **Menu**: prices read from the `KitchenShop` contract, Buy, and a receipt (transaction hash, block, purchase number, gas, new balance). The item then shows in your avatar's hand for 3 minutes, for everyone.
- **Wallet**: your address and balance, the daily allowance, ways to earn, your history; owners and admins can give coins.
- **Ledger**: the chain (id, block height, contracts, coins in circulation, kitchen till, purchases), every PulseCoin transaction of the office, and for any of them an on-chain proof read back from the chain (receipt and decoded events).
- **Contracts**: how the two smart contracts work (a purchase step by step, each function and who may call it, events), their live on-chain state, their Solidity source, and `cast` commands to check them on the chain without the app.

### Earning coins

| Source | Coins | Rule (where it is enforced) |
| --- | --- | --- |
| Welcome grant | 20 | Once, when the wallet is created (`rewardKey` unique in the database) |
| Daily allowance | 5 | Once per `dailyPeriod` (24 h by default, see below): **`PulseCoin.claimDaily` reverts otherwise (on-chain)** |
| Closing a task | 3 | First move to Done, to the assignee (or the closer); once per task |
| Winning a game | 2 | Each winner of a baby foot / Uno match; once per result |
| Owner / admin grant | 1–50 | With an optional note; not to yourself |

Tasks and games pay at most **30 coins per person per UTC day** (`DAILY_EARN_CAP`), so creating and closing junk tasks can't farm coins.

---

## Where it lives

| Path | Job |
| --- | --- |
| `chain/Dockerfile` | The `chain` service: Anvil (Foundry 1.5.1), chain id 31337, instant mining, state dumped to the `chain_data` volume every 5 s and on stop. Internal to Docker (no host port). |
| `apps/api/contracts/PulseCoin.sol` | ERC-20 + EIP-2612 permit + AccessControl (OpenZeppelin 5). `reward` (MINTER_ROLE), `claimDaily` with the 24 h rule, `Rewarded` / `DailyClaimed` events. |
| `apps/api/contracts/KitchenShop.sol` | The menu (`items`: name, price, active; owner-only `setItem`) and `buy(buyer, itemId, deadline, v, r, s)`: applies the buyer's permit for exactly the price, moves the coins to the till, emits `Purchased(purchaseId, buyer, itemId, price)`. |
| `apps/api/scripts/compile-contracts.mjs` | solc-js 0.8.37 (optimizer, EVM `cancun`) → `contracts/build/contracts.json`; runs before `nest build` / `nest start`. |
| `apps/api/src/chain/chain.service.ts` | Connects (retrying while the chain starts), funds the relayer on the local chain, deploys the contracts once (`ChainDeployment` table; redeploys if the chain was reset), syncs the menu on-chain, and sends every relayer transaction through **one queue** (no nonce races). |
| `apps/api/src/chain/wallets.service.ts` | One wallet per member, created on first use; private key AES-256-GCM encrypted (HKDF key from `JWT_SECRET`, like 2FA secrets). Signs EIP-712 permits. |
| `apps/api/src/kitchen/kitchen.rules.ts` | Pure rules: menu, rewards, caps, hold time, kitchen reach (unit tested). |
| `apps/api/src/kitchen/coins.service.ts` | Wallet view, daily claim, grants, task / game rewards, history, ledger, on-chain proofs; records each transaction (`CoinTx`) and emits `coins:tx` / `coins:received`. |
| `apps/api/src/kitchen/kitchen.service.ts` | Menu view and `buy` (kitchen-reach check, balance check, permit, relay, record, holding). |
| `apps/api/src/kitchen/kitchen.controller.ts` | `GET /api/kitchen`, `POST /kitchen/buy`, `POST /kitchen/daily`, `POST /kitchen/grants`, `GET /kitchen/history`, `GET /kitchen/ledger`, `GET /kitchen/tx/:hash`. |
| `apps/web/features/kitchen/` | `KitchenPanel` (dialog, tabs, live refresh, earning toasts), `KitchenMenu`, `KitchenWallet`, `KitchenLedger`, `Hash`. |
| `apps/web/game/objects/Avatar.ts` | `setHolding(item, ms)`: a baked bottle / can / plate at the hand, behind the body when facing away. |

---

## How a purchase works

```
Browser            API (NestJS)                                       Chain (Anvil)
  │ POST /kitchen/buy {item:'pepsi'}
  │──────────────► at the kitchen? (OfficeGateway.isNear: ≤ 2.5 tiles from fridge/counter)
  │                one coin operation at a time (CoinsService.exclusive)
  │                price = KitchenShop.items(2).price ─────────────────────► (read)
  │                balance ≥ price? ───────────────────────────────────────► (read)
  │                buyer's key signs EIP-2612 Permit(owner, shop, price, nonce, deadline)   (off-chain)
  │                relayer sends KitchenShop.buy(buyer, 2, deadline, v, r, s) ────► permit + transferFrom
  │                                                                          buyer → till, Purchased event
  │                CoinTx row, office:holding (everyone), coins:tx (ledger)
  │◄────────────── receipt {txHash, blockNumber, purchaseId, gasUsed, balance}
```

- **Who pays the gas:** the relayer (the server's account). Members' wallets never hold gas money and nobody needs MetaMask.
- **Why a permit:** the buyer's signature authorises exactly the item's price for the shop and is usable once (its nonce), so even the relayer can't take more. Forged, replayed, or under-priced permits revert (see the contract tests).
- **Front-running safe:** `buy` wraps `permit` in `try/catch` and relies on the allowance check, as OpenZeppelin recommends.

---

## Rules & invariants

- **Balances live on-chain.** The `CoinTx` table is the history and the ledger view (with the tx hash and block of each line), never the balance.
- **Exactly once:** rewards carry a unique `rewardKey`; rewards, claims and purchases run one at a time, so "already paid?" and "pay" never interleave.
- **One relayer queue:** transactions are sent and awaited in order; after a failure the nonce manager re-reads the chain's nonce.
- **No RPC cache:** the provider runs with `cacheTimeout: -1`. ethers reuses identical calls for 250 ms by default, which made a second "claim daily" right after the first get the first one's (successful) gas estimate instead of the chain's revert.
- **Access:** members only, in their own office; grants for owners / admins; proofs only for transactions of the caller's office; purchases only at the kitchen.
- **Startup:** the API serves everything else while the chain starts; kitchen calls answer 503 `CHAIN_UNAVAILABLE` until connected.

---

## Changing the daily period (e.g. every minute, to test)

The period lives in the contract (`PulseCoin.dailyPeriod`) and only its admin (the server) can change it (`setDailyPeriod`). The server sets it from `.env` at startup:

```bash
# .env
CHAIN_DAILY_PERIOD_SECONDS=60      # every minute (testing); 86400 or empty = every 24 h
make                               # restarts the api, which sends setDailyPeriod(60) to the contract
```

Balances are kept; the change is itself an on-chain transaction (`DailyPeriodChanged` event). Accepted range: 10 s to 7 days.

## Contract upgrades

`compile-contracts.mjs` writes a hash of the contracts' bytecode. When it differs from the deployed version's (`ChainDeployment.codeHash`), the API deploys the new contracts on startup and mints every member's balance from the previous PulseCoin onto the new one (`Rewarded(…, "migration")`), so nobody loses coins.

---

## How to evaluate it (about 10 minutes)

Prepare: `make`, open `https://<SERVER_NAME>:8443`, sign up two accounts (two browsers, or one private window): **A** creates the office, **B** joins with an invitation link (Invite button). For a quick demo, set `CHAIN_DAILY_PERIOD_SECONDS=60` first.

1. **The contracts exist and are deployed by `make`**: `docker compose ps` shows the `chain` service; `docker compose logs api | grep ChainService` shows the deployed addresses.
2. **Open the café**: A walks to the kitchen (the counter and fridge in the Lounge) and presses **E**. Balance 20 PULSE (welcome grant). Pressing E elsewhere does nothing; buying from elsewhere is refused by the server.
3. **Buy**: Pepsi → receipt with purchase number, block, gas and transaction hash; balance 18. B sees A holding a can for 3 minutes.
4. **Not enough coins**: buy dinners until "Need 6 more" appears: the contract would refuse it anyway (permit for more than the balance).
5. **Daily allowance (rule on-chain)**: Wallet → Claim 5 daily coins; the button counts down until the next period; with 60 s it comes back after a minute.
6. **Earn by working**: B closes a task on the board (move it to Done) → toast "+3 PulseCoin"; moving it back and to Done again pays nothing. Win a baby foot or Uno match → +2.
7. **Admin grant**: A (owner) → Wallet → Give coins to B with a note → B's toast. B (member) has no such form, and the API refuses (403).
8. **Ledger and proof**: Ledger tab → every transaction with its block and hash; click a hash → "Confirmed on-chain" with the decoded events (Transfer, Purchased, Rewarded, DailyClaimed) read from the chain.
9. **How the contracts work**: Contracts tab → the purchase in 5 steps, functions and roles, live state, Solidity source.
10. **Check without the app**: copy a command from the Contracts tab and run it in a terminal, e.g.
    `docker compose exec chain cast call <PulseCoin address> "balanceOf(address)(uint256)" <wallet address>` → the same balance (in wei, 18 decimals), and `docker compose exec chain cast receipt <tx hash>` for a ledger line.
11. **Tests**: `cd apps/api && pnpm test` (rules), and the contract tests on a throwaway chain (see Tests below).

---

## Running on Avalanche Fuji instead

The contracts are plain EVM, compiled for `cancun`. In `.env`:

```
CHAIN_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
CHAIN_RELAYER_KEY=0x<a key whose address you funded with test AVAX>
```

The API deploys the contracts there on start (one `ChainDeployment` row per chain id). Without `CHAIN_RELAYER_KEY`, the relayer key is derived from `JWT_SECRET`.

---

## Tests

- `apps/api/src/kitchen/kitchen.rules.spec.ts`: menu, caps, units, earning day, kitchen reach (in CI).
- `apps/api/src/chain/contracts.chain.spec.ts`: the contracts on a real chain. Only minters mint, the daily allowance once per period (clock moved with `evm_increaseTime`), only the admin changes the period (60 s works, 0 is refused), a purchase for exactly the price with the buyer's permit, forged / replayed / under-priced permits refused, poor buyers and items off the menu refused, menu owner-only. Needs a throwaway Anvil:

```bash
docker run -d --rm --name anvil-test -p 8546:8545 ghcr.io/foundry-rs/foundry:v1.5.1 "anvil --host 0.0.0.0"
cd apps/api && pnpm contracts && CHAIN_TEST_RPC_URL=http://localhost:8546 pnpm vitest run src/chain
docker rm -f anvil-test
```

---

## Known limits

- **Custodial wallets:** the server holds the keys (encrypted), so it could sign for its members. That is the price of "no MetaMask, no gas". Coins have no value outside the office.
- **Local chain resets:** deleting the `chain_data` volume (`make clean`) resets balances. The API then redeploys and the old ledger lines no longer have proofs (the proof says so).
- **Single API instance:** the "one at a time" lock is in-process.
