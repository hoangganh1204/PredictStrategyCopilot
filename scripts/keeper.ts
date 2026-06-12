/**
 * Auto-Vault keeper — continuously rolls one strategy on DeepBook Predict.
 *
 * Cycle: when the open round's market settles → redeem winnings (if any) →
 * pick the next short-dated market → mint the same strategy again. State is
 * persisted to .vault.json (gitignored), which /api/vault serves to the
 * Vault dashboard page.
 *
 * CUSTODY NOTE: the keeper wallet owns the vault's PredictManager and signs
 * every mint/redeem. This is a custodial demo vault — predict::mint is
 * owner-gated with no capability/delegation path, so a trustless on-chain
 * vault is not possible on this protocol today.
 *
 * Usage:
 *   KEEPER_KEY=suiprivkey1... npm run keeper     (or put KEEPER_KEY in .env.local)
 * Options (env):
 *   VAULT_STRATEGY  range | binary_up | binary_down   (default range)
 *   VAULT_ASSET     underlying asset                  (default BTC)
 *   VAULT_STAKE     DUSDC per round                   (default 2)
 *   VAULT_FLOOR     pause below this balance, DUSDC   (default 5)
 *   VAULT_POLL_SEC  loop interval seconds             (default 20)
 *   DRY_RUN=1       single read-only cycle: log the decision, send nothing
 */
import fs from "node:fs";
import path from "node:path";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "../src/config/predict.js";
import {
  fetchOracleList,
  fetchOracleState,
  fetchSviLatest,
  fetchManagerSummary,
} from "../src/lib/predict-client.js";
import { computeStrategies } from "../src/lib/strategy/computeStrategies.js";
import { makeDevInspectPricingFn } from "../src/lib/strategy/devInspectPricing.js";
import { computeBetEconomics } from "../src/lib/strategy/sizing.js";
import { buildBinaryMintTx, buildRangeMintTx } from "../src/lib/execute/buildMintTx.js";
import { buildRedeemTx } from "../src/lib/execute/buildRedeemTx.js";
import { buildDepositTxFromCoin } from "../src/lib/execute/depositDusdc.js";
import { findManagerId } from "../src/lib/execute/findManager.js";
import { evaluateRound } from "../src/lib/vault/evaluateRound.js";
import type { OracleSnapshot, SVIParams } from "../src/lib/strategy/types.js";
import type { VaultState, VaultStrategyType } from "../src/lib/vault/types.js";

// ─── Env & config ─────────────────────────────────────────────────────────────

function loadEnvLocal() {
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* .env.local is optional */
  }
}
loadEnvLocal();

const STRATEGIES: VaultStrategyType[] = ["range", "binary_up", "binary_down"];
const CFG = {
  asset: process.env.VAULT_ASSET ?? "BTC",
  strategy: (process.env.VAULT_STRATEGY ?? "range") as VaultStrategyType,
  stakeDusdc: Number(process.env.VAULT_STAKE ?? "2"),
  floorDusdc: Number(process.env.VAULT_FLOOR ?? "5"),
};
const POLL_MS = Number(process.env.VAULT_POLL_SEC ?? "20") * 1000;
const MIN_TTL_MS = Number(process.env.VAULT_MIN_TTL_MIN ?? "3") * 60_000;
const MAX_TTL_MS = Number(process.env.VAULT_MAX_TTL_MIN ?? "120") * 60_000;
const MAX_REDEEM_ATTEMPTS = 5;
const HISTORY_CAP = 50;
const DRY_RUN = process.env.DRY_RUN === "1";
const STATE_PATH = path.join(process.cwd(), ".vault.json");

if (!STRATEGIES.includes(CFG.strategy)) {
  console.error(`Invalid VAULT_STRATEGY "${CFG.strategy}" — use ${STRATEGIES.join(" | ")}`);
  process.exit(1);
}
const keyEnv = process.env.KEEPER_KEY ?? process.env.TEST_KEYPAIR;
if (!keyEnv) {
  console.error(
    "ERROR: set KEEPER_KEY to the keeper wallet's bech32 private key.\n" +
    "       Put it in .env.local (gitignored). The wallet needs SUI for gas\n" +
    "       and DUSDC (wallet or game account) to bet with."
  );
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(keyEnv);
const keeperAddress = keypair.getPublicKey().toSuiAddress();
const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" });
const pricing = makeDevInspectPricingFn(client);

const log = (msg: string) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}]${DRY_RUN ? " [dry]" : ""} ${msg}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Chain helpers ────────────────────────────────────────────────────────────

async function signAndExecute(tx: Transaction): Promise<string> {
  tx.setSender(keeperAddress);
  // Use all SUI coins as gas (the SDK may otherwise pick a single small coin
  // and fail the budget check after a faucet top-up created a separate coin).
  const gas = await client.getCoins({ owner: keeperAddress, coinType: "0x2::sui::SUI" });
  if (gas.data.length > 0) {
    tx.setGasPayment(
      gas.data.slice(0, 16).map((c) => ({ objectId: c.coinObjectId, version: c.version, digest: c.digest }))
    );
  }
  const { bytes, signature } = await tx.sign({ signer: keypair, client });
  const res = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: { showEffects: true },
  });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`tx failed: ${res.effects?.status?.error ?? "unknown"}`);
  }
  return res.digest;
}

async function getOrCreateManager(): Promise<string> {
  const existing = await findManagerId(keeperAddress);
  if (existing) return existing;
  if (DRY_RUN) throw new Error("dry-run: keeper has no PredictManager yet (would create one)");

  log("No PredictManager — creating one...");
  const tx = new Transaction();
  tx.moveCall({ target: `${PREDICT_CONFIG.PACKAGE}::predict::create_manager`, arguments: [] });
  await signAndExecute(tx);
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    const id = await findManagerId(keeperAddress);
    if (id) return id;
  }
  throw new Error("manager created but not indexed yet");
}

async function managerBalanceRaw(managerId: string): Promise<number> {
  const s = await fetchManagerSummary(managerId);
  return s.trading_balance ?? s.balances?.[0]?.balance ?? 0;
}

/** Top up the game account from the keeper wallet's DUSDC, if any. */
async function depositWalletDusdc(managerId: string): Promise<boolean> {
  const coins = await client.getCoins({ owner: keeperAddress, coinType: PREDICT_CONFIG.DUSDC_TYPE });
  const total = coins.data.reduce((s, c) => s + BigInt(c.balance), 0n);
  if (total <= 0n) return false;
  if (DRY_RUN) {
    log(`would deposit ${Number(total) / 1e6} DUSDC from wallet into the vault account`);
    return false;
  }
  const ids = coins.data.map((c) => c.coinObjectId);
  const digest = await signAndExecute(buildDepositTxFromCoin(managerId, ids, total));
  log(`deposited ${Number(total) / 1e6} DUSDC into the vault account (${digest.slice(0, 10)}…)`);
  return true;
}

// ─── State ────────────────────────────────────────────────────────────────────

function loadState(): VaultState | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as VaultState;
  } catch {
    return null;
  }
}

function saveState(state: VaultState) {
  if (DRY_RUN) return;
  state.updatedAt = Date.now();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ─── Round lifecycle ──────────────────────────────────────────────────────────

/** Settle the open round if its oracle has settled. Returns true if closed. */
async function settleOpenRound(state: VaultState): Promise<boolean> {
  const round = state.openRound!;
  const oracle = (await fetchOracleState(round.oracleId)).oracle;

  if (oracle.status !== "settled" || oracle.settlement_price == null) {
    const overdueMin = (Date.now() - round.expiryMs) / 60_000;
    if (overdueMin > 0) log(`waiting for settlement (${overdueMin.toFixed(1)}min past expiry)`);
    return false;
  }

  const outcome = evaluateRound(round, oracle.settlement_price);
  let redeemDigest: string | undefined;
  let note: string | undefined;
  let payout_raw = outcome.payout_raw;

  if (outcome.won) {
    try {
      const tx = buildRedeemTx({
        oracleId: round.oracleId,
        managerId: state.managerId,
        strike_raw: round.strike_raw ? BigInt(round.strike_raw) : undefined,
        isUp: round.type === "binary_up",
        lowerStrike_raw: round.lower_raw ? BigInt(round.lower_raw) : undefined,
        upperStrike_raw: round.upper_raw ? BigInt(round.upper_raw) : undefined,
        quantity_raw: BigInt(round.quantity_raw),
        expiryMs: round.expiryMs,
        isRange: round.type === "range",
      });
      redeemDigest = await signAndExecute(tx);
    } catch (e) {
      round.redeemAttempts = (round.redeemAttempts ?? 0) + 1;
      log(`redeem failed (attempt ${round.redeemAttempts}): ${e instanceof Error ? e.message : e}`);
      if (round.redeemAttempts < MAX_REDEEM_ATTEMPTS) return false; // retry next cycle
      note = `redeem failed ${round.redeemAttempts}x — funds may need manual redeem`;
      payout_raw = 0;
    }
  }

  const pnl_raw = payout_raw - Number(round.cost_raw);
  state.history.push({
    oracleId: round.oracleId,
    expiryMs: round.expiryMs,
    type: round.type,
    strike_raw: round.strike_raw,
    lower_raw: round.lower_raw,
    upper_raw: round.upper_raw,
    quantity_raw: round.quantity_raw,
    cost_raw: round.cost_raw,
    settlementPrice_raw: String(oracle.settlement_price),
    won: outcome.won,
    payout_raw: String(payout_raw),
    pnl_raw: String(pnl_raw),
    settledAt: oracle.settled_at ?? Date.now(),
    redeemDigest,
    note,
  });
  if (state.history.length > HISTORY_CAP) state.history.splice(0, state.history.length - HISTORY_CAP);
  state.totals.rounds += 1;
  state.totals[outcome.won ? "wins" : "losses"] += 1;
  state.totals.pnl_raw += pnl_raw;
  state.openRound = null;

  log(
    `round settled: ${outcome.won ? "WON ✅" : "LOST ❌"} at $${(oracle.settlement_price / 1e9).toFixed(0)} ` +
    `| pnl ${(pnl_raw / 1e6).toFixed(2)} DUSDC | record ${state.totals.wins}W-${state.totals.losses}L`
  );
  return true;
}

/** Pick the soonest in-window market, compute the strategy, mint. */
async function openNewRound(state: VaultState): Promise<void> {
  let balDusdc = (await managerBalanceRaw(state.managerId)) / 1e6;
  if (balDusdc < CFG.stakeDusdc && (await depositWalletDusdc(state.managerId))) {
    balDusdc = (await managerBalanceRaw(state.managerId)) / 1e6;
  }
  if (balDusdc < CFG.floorDusdc) {
    state.pausedReason = `balance ${balDusdc.toFixed(2)} DUSDC below floor ${CFG.floorDusdc}`;
    log(`paused: ${state.pausedReason}`);
    return;
  }
  state.pausedReason = null;
  const stake = Math.min(CFG.stakeDusdc, balDusdc);

  const now = Date.now();
  const oracle = (await fetchOracleList(PREDICT_CONFIG.PREDICT_OBJECT))
    .filter(
      (o) =>
        o.status === "active" &&
        o.underlying_asset === CFG.asset &&
        o.expiry - now >= MIN_TTL_MS &&
        o.expiry - now <= MAX_TTL_MS
    )
    .sort((a, b) => a.expiry - b.expiry)[0];
  if (!oracle) {
    log(`no open ${CFG.asset} market within ${MIN_TTL_MS / 60000}–${MAX_TTL_MS / 60000}min — waiting`);
    return;
  }

  const [st, svi] = await Promise.all([fetchOracleState(oracle.oracle_id), fetchSviLatest(oracle.oracle_id)]);
  if (!st.latest_price) {
    log("market has no price data yet — waiting");
    return;
  }
  const sviParams: SVIParams = {
    a: svi.a, b: svi.b, rho: svi.rho, rho_negative: svi.rho_negative,
    m: svi.m, m_negative: svi.m_negative, sigma: svi.sigma,
    updatedAtMs: svi.checkpoint_timestamp_ms,
  };
  const snapshot: OracleSnapshot = {
    oracleId: oracle.oracle_id,
    spot_raw: BigInt(st.latest_price.spot),
    forward_raw: BigInt(st.latest_price.forward),
    expiryMs: oracle.expiry,
    minStrike_raw: BigInt(oracle.min_strike),
    tickSize_raw: BigInt(oracle.tick_size),
    svi: sviParams,
  };

  const computed = await computeStrategies(snapshot, pricing);
  if (!computed.ok) {
    log(`strategies unavailable (${computed.code}: ${computed.message}) — waiting`);
    return;
  }
  const strat = computed.strategies.find((s) => s.type === CFG.strategy);
  if (!strat) {
    log(`strategy "${CFG.strategy}" not available on this market — waiting`);
    return;
  }

  const econ = computeBetEconomics(stake, Number(strat.cost_raw));
  if (econ.quantityRaw <= 0n) {
    log("computed zero quantity — waiting");
    return;
  }

  const ttlMin = ((oracle.expiry - now) / 60000).toFixed(0);
  const levels =
    strat.type === "range"
      ? `$${(Number(strat.lowerStrike_raw) / 1e9).toFixed(0)}–$${(Number(strat.upperStrike_raw) / 1e9).toFixed(0)}`
      : `$${(Number(strat.strike_raw) / 1e9).toFixed(0)}`;
  log(`opening round: ${CFG.strategy} ${levels} | expiry in ${ttlMin}min | stake ${stake} DUSDC`);
  if (DRY_RUN) return;

  const tx =
    strat.type === "range"
      ? buildRangeMintTx({
          oracleId: oracle.oracle_id,
          managerId: state.managerId,
          lowerStrike_raw: strat.lowerStrike_raw!,
          upperStrike_raw: strat.upperStrike_raw!,
          quantity_raw: econ.quantityRaw,
          expiryMs: oracle.expiry,
        })
      : buildBinaryMintTx({
          oracleId: oracle.oracle_id,
          managerId: state.managerId,
          strike_raw: strat.strike_raw!,
          isUp: strat.type === "binary_up",
          quantity_raw: econ.quantityRaw,
          expiryMs: oracle.expiry,
        });
  const digest = await signAndExecute(tx);

  state.openRound = {
    oracleId: oracle.oracle_id,
    expiryMs: oracle.expiry,
    type: strat.type,
    strike_raw: strat.strike_raw?.toString(),
    lower_raw: strat.lowerStrike_raw?.toString(),
    upper_raw: strat.upperStrike_raw?.toString(),
    quantity_raw: econ.quantityRaw.toString(),
    cost_raw: String(Math.round(econ.stakeRaw)),
    mintedAt: Date.now(),
    mintDigest: digest,
  };
  log(`minted ✔ (${digest.slice(0, 10)}…)`);
}

// ─── Main loop ────────────────────────────────────────────────────────────────

let running = true;
process.on("SIGINT", () => { running = false; log("stopping after this cycle..."); });
process.on("SIGTERM", () => { running = false; });

async function main() {
  log(`Auto-Vault keeper | ${keeperAddress.slice(0, 10)}… | ${CFG.strategy} on ${CFG.asset} | stake ${CFG.stakeDusdc} floor ${CFG.floorDusdc}`);

  const gas = await client.getBalance({ owner: keeperAddress });
  if (Number(gas.totalBalance) < 50_000_000) {
    log(`⚠️  low SUI for gas: ${(Number(gas.totalBalance) / 1e9).toFixed(3)} SUI`);
  }

  const managerId = await getOrCreateManager();
  log(`vault account: ${managerId}`);

  const prev = loadState();
  const state: VaultState =
    prev && prev.managerId === managerId
      ? { ...prev, config: { ...CFG }, keeperAddress }
      : {
          version: 1,
          keeperAddress,
          managerId,
          config: { ...CFG },
          openRound: null,
          history: [],
          totals: { rounds: 0, wins: 0, losses: 0, pnl_raw: 0 },
          startedAt: Date.now(),
          updatedAt: Date.now(),
          pausedReason: null,
        };
  if (prev && prev.managerId !== managerId) log("manager changed — starting fresh state");
  if (state.openRound) log(`resuming open round on ${state.openRound.oracleId.slice(0, 10)}…`);
  saveState(state);

  let consecutiveErrors = 0;
  while (running) {
    try {
      if (state.openRound) await settleOpenRound(state);
      else await openNewRound(state);
      saveState(state);
      consecutiveErrors = 0;
    } catch (e) {
      consecutiveErrors++;
      log(`cycle error (${consecutiveErrors}): ${e instanceof Error ? e.message : e}`);
      if (consecutiveErrors >= 10) {
        log("too many consecutive errors — backing off 5min");
        await sleep(300_000);
        consecutiveErrors = 0;
      }
    }
    if (DRY_RUN) { log("dry-run complete — exiting"); break; }
    await sleep(POLL_MS);
  }
  saveState(state);
  log("keeper stopped");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
