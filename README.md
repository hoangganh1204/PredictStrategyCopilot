# 🪙 Predict Strategy Copilot

**Bet on BTC price moves in plain language — no options jargon — on top of DeepBook Predict (Sui Testnet).**

Predict Strategy Copilot turns Mysten Labs' **DeepBook Predict** options/prediction primitive into something a non-expert can actually use. Instead of strikes, implied volatility and grids, you pick a plain-language **strategy** ("Price up", "Crash hedge", "Stay in range"), type how much you want to spend, and place a real on-chain bet. Every number on screen — odds, payouts, P&L, win/loss — is computed from **live on-chain data** and is verifiable on the explorer.

> Testnet only. DUSDC is a valueless testnet token. This is a demo of accessibility + tooling on top of DeepBook Predict, not financial advice.

---

## 📌 TL;DR

| | |
|---|---|
| **What** | A consumer-friendly UI + tooling layer over DeepBook Predict: guided betting, an auto-rolling vault, a social leaderboard, and one-click copy-trade. |
| **Why** | DeepBook Predict is powerful but expert-only. We make on-chain prediction usable by normal people and add the social discovery loop (leaderboard → follow → copy) that makes it sticky. |
| **How** | Next.js (App Router) + TypeScript. Reads live oracle/SVI data, builds Sui Programmable Transaction Blocks (PTBs), prices them with `devInspect`, and the user signs in their own wallet. |
| **Sui stack** | `@mysten/sui` (PTBs, devInspect, keypairs), `@mysten/dapp-kit` (wallet connect + sign), DeepBook Predict Move package, the DeepBook Predict Public Server indexer, DUSDC. |
| **Status** | Live on Sui Testnet. 111 unit/integration tests passing. Every position links to Suiscan. |

---

## 🎯 What we built

Five connected pieces, all backed by real on-chain transactions:

### 1. Guided betting ("Play")
- Pick an asset (BTC live on testnet; ETH/SOL/SUI auto-appear when markets exist) and an expiry from the **real open markets**.
- See **three plain-language strategies** generated live from the market:
  - **↗ Price up** — wins if the asset closes above a level (binary up).
  - **🛡 Crash hedge** — wins if it closes below a level (binary down).
  - **↔ Stay in range** — wins if it stays inside a band (range).
- Type a **stake in DUSDC**; the app derives the token quantity so cost ≈ your stake, and shows max win + multiplier. One click → wallet signs → real mint on-chain.
- **Market Pulse** banner: a live volatility signal (current implied vol vs its recent average) instead of static numbers.

### 2. Positions & claim
- Live positions list (binary from the indexer; **range positions reconstructed from on-chain events** because the indexer doesn't expose them).
- Auto-refreshing status: Active → Won/Lost → Claim. Winning positions show a **Claim winnings** button (on-chain redeem).
- Deposit **and withdraw** DUSDC between your wallet and your on-chain game account.
- Every card links to the **mint tx on Suiscan** for verification, plus a "Share on X" viral loop.

### 3. 🤖 Auto-Vault (deposit-once, auto-rolling strategy)
- A keeper bot deposits once and **automatically rolls one strategy forever**: when a market settles → redeem winnings → re-enter the same strategy on the next market.
- Live dashboard: balance, strategy, W/L record, net P&L, full round history (each round verifiable), pause/resume.
- **Self-explaining failure states** — e.g. "Out of SUI gas — top up the keeper" instead of a silent stall.

### 4. 🏆 Leaderboard (social discovery)
- Ranks real investors by **net P&L and win rate**, computed purely from on-chain settled bets — no seeded/demo data.
- Medal podium for the top 3, proportional winnings bars, per-strategy breakdown, recent results.
- Drill into any investor's detail page (truncated addresses only — no PII).

### 5. 📋 Copy-trade
- Follow a leader; when they place a new bet, you get a prompt to **copy it scaled to your own stake** — same strategy, same strike/band, your size.
- Three eligibility gates enforced (market open, data fresh, balance sufficient) **before** any signing.
- **Non-custodial:** the copy builds an unsigned transaction; *you* approve and sign it in your own wallet. The follow toggle never touches your open positions.

---

## 💡 Why it matters

**The problem.** On-chain prediction/options markets like DeepBook Predict are genuinely useful — they let anyone hedge or speculate on price without a centralized counterparty. But the UX is built for experts: strikes, implied volatility, SVI curves, grids, manual settlement. A normal user bounces off it.

**Our take.** The hard part (the protocol, the oracle, the AMM) already exists on Sui. What's missing is the **accessibility + tooling + social layer** that turns a primitive into a product:

- **Accessibility** — plain-language strategies and stake-based sizing mean you never see the word "strike". You decide *what you believe* ("BTC won't crash in the next 15 min"), not *how options are priced*.
- **Hands-off** — the Auto-Vault shows how the same primitive can power a "set it and forget it" product, with a transparent, verifiable track record.
- **Social discovery** — leaderboard → follow → copy is the loop that makes DeFi sticky. Because rankings are computed from on-chain truth, the social proof is **trustless** — you can verify any leader's record yourself.

It's a blueprint for how to bring DeepBook Predict (and similar Sui primitives) to a mainstream audience.

---

## ⚙️ How it works

### Architecture (no backend database)

```
Browser (Next.js App Router, React 19, Tailwind v4)
  │  @mysten/dapp-kit  → wallet connect + sign
  │  @tanstack/react-query → live polling
  ▼
Next.js API routes (/api/*)        ← thin compute layer, stores nothing
  │  ├─ strategy engine (SVI math + devInspect pricing)
  │  ├─ leaderboard / copy-trade aggregation
  │  └─ proxy to the indexer
  ▼
DeepBook Predict Public Server (REST indexer)  +  Sui Fullnode (RPC / devInspect)
  ▼
Sui Testnet — DeepBook Predict Move package  ← single source of truth
```

There is **no database**. The blockchain is the source of truth; the DeepBook Predict Public Server is the read indexer; the only local state is a keeper file (`.vault.json`) and the browser's `localStorage` (your follow list).

### The strategy engine (turning a market into 3 plain bets)

1. Fetch the oracle's **SVI volatility parameters** and spot/forward price from the indexer.
2. Compute the **annualized implied volatility**: with SVI total variance `w(k)`, `σ = sqrt(w / T)`.
3. Derive a sensible **strike / range band** from spot, vol and the strike grid (`min_strike + N·tick_size`).
4. **Price each strategy on-chain** via `devInspect` of `predict::get_trade_amounts` / `get_range_trade_amounts` — so the displayed cost/payout is exactly what the chain will charge, not an estimate.
5. **Stake-based sizing**: given the DUSDC you want to spend and the per-token cost, solve for the token quantity so `cost ≈ stake`. Each winning token redeems 1 DUSDC face value (verified on testnet).

### Placing & settling a bet (PTBs)

- **Mint** builds a Programmable Transaction Block: `market_key::up/down(...)` → `predict::mint<DUSDC>(...)` (or `range_key::new` → `predict::mint_range`). Returned unsigned; the wallet signs.
- **Redeem/claim** mirrors it with `predict::redeem` / `redeem_range`.
- **Robustness:** the execute layer **retries transient object-lock / version conflicts** (e.g. when two transactions hit the same gas coin) and surfaces friendly messages for rejection/failure.

### Auto-Vault keeper

A long-running Node process (`scripts/keeper.ts`) that holds a key and loops: `settle open round → redeem → pick next short market → re-mint the same strategy`. State is persisted to `.vault.json`, which `/api/vault` serves to the dashboard. It deposits idle wallet DUSDC, respects a balance floor, and a user-controlled pause flag.

### Leaderboard & copy-trade (computed from on-chain truth)

- Enumerate managers via the indexer, aggregate each owner's **settled** positions, rank by net P&L (win/loss is decided by the **sign of realized P&L**, not the status string — verified, since the server marks both wins and losses as "redeemed").
- Copy-trade reuses the same mint builders: infer the leader's strategy from their position, **scale the quantity to the follower's stake**, run the eligibility gates, and return an **unsigned** transaction for the follower to sign.

---

## 🛠️ How we used the Sui stack

| Sui tech | How we use it |
|---|---|
| **DeepBook Predict** (Move package `0xf5ea2b…785138`) | The core primitive — binary & range prediction markets, SVI-priced. We mint/redeem against `predict::mint(_range)` / `redeem(_range)` and read prices from `predict::get_trade_amounts`. |
| **`@mysten/sui` — Programmable Transaction Blocks** | Every action is a hand-built PTB composing `market_key`/`range_key` constructors with `predict`/`predict_manager` calls in one atomic transaction. |
| **`devInspectTransactionBlock`** | We price strategies and validate copy-trades by simulating the exact on-chain call — no off-chain price estimation, so what you see is what you pay. |
| **`@mysten/dapp-kit`** | Wallet discovery, connection, balance, and `useSignAndExecuteTransaction` — the user signs every transaction themselves (non-custodial for the main app). |
| **Shared objects & owner-gating** | The `PredictManager` is a shared object whose `mint` is owner-gated. We worked within this: discover managers via the indexer's owner index, and document why a *trustless* delegated vault isn't yet possible (hence the custodial keeper demo). |
| **On-chain events** | Range positions aren't indexed by the server, so we reconstruct them from `RangeMinted`/`RangeRedeemed` events via `suix_queryEvents`. |
| **DeepBook Predict Public Server** | Read indexer for oracles, SVI, managers, positions and settlement prices. |
| **DUSDC** | The quote token for all deposits/bets (testnet, scale 1e6). Prices/strikes use scale 1e9. |
| **`Ed25519Keypair`** | The keeper bot signs autonomously with a held key (the one place that isn't browser-wallet-signed). |

**Verified on-chain constants** (`src/config/predict.ts`):
- Package: `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138`
- Predict object: `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a`
- DUSDC: `0xe95040…::dusdc::DUSDC`
- Indexer: `https://predict-server.testnet.mystenlabs.com`

---

## 🗂️ Project structure

```
src/
  app/
    play/                 Guided betting page
    positions/            Positions + claim/redeem, deposit/withdraw
    vault/                Auto-Vault dashboard
    leaderboard/          Ranked investors + [address] detail
    api/                  strategies, markets, oracles, range-mark,
                          vault, leaderboard, leaders/[address](/latest-position)
  lib/
    strategy/             SVI math, devInspect pricing, sizing, market pulse
    execute/              PTB builders: mint, redeem, deposit, withdraw, findManager
    vault/                pure round evaluation (win/loss/payout)
    leaderboard/          aggregation, classify, investor detail
    copytrade/            scale params, eligibility gates, build copy mint, follow store
    predict-client.ts     typed indexer client (with retry on transient 5xx)
  hooks/                  React Query hooks (live polling) for every feature
  config/predict.ts       verified on-chain constants & scales
scripts/
  keeper.ts               Auto-Vault keeper bot
  e2e-*.ts / probe-*.ts   on-chain e2e + discovery scripts
tests/                    111 unit + integration tests (Vitest + MSW)
```

---

## ▶️ Running locally

**Prereqs:** Node 20+, a Sui wallet (e.g. Slush) on **Testnet**, testnet **SUI** (gas) + **DUSDC** (faucet).

```bash
npm install
npm run dev          # http://localhost:3000
```

Connect your wallet → create your on-chain game account (one click) → deposit DUSDC → start betting.

**Auto-Vault keeper (optional):**
```bash
KEEPER_KEY=suiprivkey1...  npm run keeper
# options: VAULT_STRATEGY=range|binary_up|binary_down  VAULT_STAKE=10  VAULT_FLOOR=5
```
The keeper needs SUI (gas) and DUSDC in its account; it runs while the process is alive.

**Other scripts:** `npm run e2e` (mint), `npm run e2e:redeem`, `npm run e2e:copy` (copy-trade dry-run), `npm run probe`.

---

## ✅ Testing & quality

- **111 tests** (Vitest) — pure strategy/vault/leaderboard/copy-trade logic as unit tests; API routes as integration tests with **MSW** mocking the indexer.
- TypeScript strict, ESLint clean, production build clean.
- On-chain e2e scripts exercise the real mint/redeem/copy flows against testnet (with safe dry-run defaults).

```bash
npm test       # or: npx vitest run
npm run build
```

---

## 🔍 Honest design decisions & limitations

We optimized for **truthfulness over hype** — judges can verify everything:

- **Custodial Auto-Vault.** A trustless on-chain vault isn't possible today: `predict::mint` is owner-gated on a shared object with no delegation/capability path. So the Auto-Vault is a **custodial keeper demo** (a bot signs), clearly labeled in the UI.
- **Leaderboard reflects recent activity, not lifetime.** The indexer returns a recent, windowed slice of positions per account, so rankings are honest about being "recent on-chain activity," and win/loss is derived from realized-P&L sign (the status field marks both as "redeemed").
- **Markets are efficient.** Bets are priced near-fair by the protocol AMM, so automated betting trends slightly negative after spread — the Auto-Vault is a demonstration of automation + transparency, **not** a profit machine. We deliberately don't pitch it as one.
- **Market creation needs an AdminCap** held by the protocol operator, so we can't mint new oracles/assets — the app is multi-asset *ready* and surfaces assets automatically when markets exist (BTC is live on testnet).
- **Testnet + valueless DUSDC.** Nothing here involves real funds.

---

## 🚀 Roadmap

- Trustless vault via a delegated-mint capability if/when the protocol supports it.
- Full lifetime history via an own indexer (remove the windowing dependency).
- Copy-trade auto-execution opt-in (still user-approved per FR-021).
- More assets the moment their markets go live.

---

*Built on Sui Testnet with DeepBook Predict. Every bet, claim, and ranking is a real, verifiable on-chain transaction.*
