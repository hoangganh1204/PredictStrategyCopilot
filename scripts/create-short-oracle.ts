/**
 * ADMIN DEMO TOOL — create a short-dated BTC oracle so the full bet lifecycle
 * (place → settle → claim) can be demoed in minutes instead of days.
 *
 * It relays the REAL BTC price (Binance) on-chain; it does NOT fake prices. But
 * since the operator (you) also bets, this is for TESTNET DEMO ONLY, not a real
 * trustless market.
 *
 * Requires the OracleSVICap, owned by the operator wallet
 * 0xcca26f7ae2e40604498294e95bacccc4652cc8cb2aa074d7ee608c7e7bdf0c29.
 *
 * Usage (key never committed — put it in .env.local):
 *   ORACLE_ADMIN_KEY="suiprivkey1..." pnpm tsx scripts/create-short-oracle.ts
 *   EXPIRY_MINUTES=15 pnpm tsx --env-file=.env.local scripts/create-short-oracle.ts
 */
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "../src/config/predict.js";
import { fetchOracleList, fetchSviLatest } from "../src/lib/predict-client.js";

const PKG = PREDICT_CONFIG.PACKAGE;
const PREDICT = PREDICT_CONFIG.PREDICT_OBJECT;
const CAP = PREDICT_CONFIG.ORACLE_SVI_CAP;
const CLOCK = PREDICT_CONFIG.CLOCK_OBJECT;

const PRICE_SCALE = 1_000_000_000; // 1e9
const MIN_STRIKE = 50_000_000_000_000n; // $50,000
const TICK = 1_000_000_000n; // $1
const FEED_INTERVAL_MS = 20_000; // refresh price/SVI well under the 30s staleness limit
const EXPIRY_MINUTES = Number(process.env.EXPIRY_MINUTES ?? "15");
const SETTLE_BUFFER_MS = 90_000; // keep feeding past expiry so the market settles

const ORACLE_TYPE = `${PKG}::oracle::OracleSVI`;
const EXPECTED_ADMIN =
  "0xcca26f7ae2e40604498294e95bacccc4652cc8cb2aa074d7ee608c7e7bdf0c29";

// ─── Keypair ─────────────────────────────────────────────────────────────────

const keyEnv = process.env.ORACLE_ADMIN_KEY;
if (!keyEnv) {
  console.error(
    "ERROR: set ORACLE_ADMIN_KEY to the operator wallet's bech32 private key.\n" +
    "       It must own the OracleSVICap. Use .env.local (gitignored)."
  );
  process.exit(1);
}
const keypair = Ed25519Keypair.fromSecretKey(keyEnv);
const address = keypair.getPublicKey().toSuiAddress();

const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

async function signAndExecute(tx: Transaction) {
  tx.setSender(address);
  const { bytes, signature } = await tx.sign({ signer: keypair, client });
  const res = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: { showEffects: true, showObjectChanges: true },
  });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`tx failed: ${res.effects?.status?.error ?? "unknown"}`);
  }
  return res;
}

// ─── Live data ─────────────────────────────────────────────────────────────

async function btcPriceRaw(): Promise<bigint> {
  const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
  const j = (await r.json()) as { price: string };
  return BigInt(Math.round(parseFloat(j.price) * PRICE_SCALE));
}

/** Reuse a real oracle's SVI surface so the volatility/pricing is realistic. */
async function sviTemplate() {
  const oracles = await fetchOracleList(PREDICT);
  const active = oracles.find((o) => o.status === "active");
  if (!active) throw new Error("No active oracle to copy an SVI surface from.");
  return fetchSviLatest(active.oracle_id);
}

type Svi = Awaited<ReturnType<typeof sviTemplate>>;

// ─── PTB builders ────────────────────────────────────────────────────────────

function feedCalls(tx: Transaction, oracle: ReturnType<Transaction["object"]>, spot: bigint, svi: Svi) {
  const [pd] = tx.moveCall({
    target: `${PKG}::oracle::new_price_data`,
    arguments: [tx.pure.u64(spot), tx.pure.u64(spot)],
  });
  tx.moveCall({
    target: `${PKG}::oracle::update_prices`,
    arguments: [oracle, tx.object(CAP), pd, tx.object(CLOCK)],
  });
  const [rho] = tx.moveCall({
    target: `${PKG}::i64::from_parts`,
    arguments: [tx.pure.u64(BigInt(svi.rho)), tx.pure.bool(svi.rho_negative)],
  });
  const [m] = tx.moveCall({
    target: `${PKG}::i64::from_parts`,
    arguments: [tx.pure.u64(BigInt(svi.m)), tx.pure.bool(svi.m_negative)],
  });
  const [params] = tx.moveCall({
    target: `${PKG}::oracle::new_svi_params`,
    arguments: [tx.pure.u64(BigInt(svi.a)), tx.pure.u64(BigInt(svi.b)), rho, m, tx.pure.u64(BigInt(svi.sigma))],
  });
  tx.moveCall({
    target: `${PKG}::oracle::update_svi`,
    arguments: [oracle, tx.object(CAP), params, tx.object(CLOCK)],
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Create short oracle — Sui Testnet ===`);
  console.log(`Operator: ${address}`);
  if (address !== EXPECTED_ADMIN) {
    console.warn(`⚠️  This wallet is not the known cap owner (${EXPECTED_ADMIN}). The tx will fail if it doesn't own the OracleSVICap.`);
  }

  const expiry = Date.now() + EXPIRY_MINUTES * 60_000;
  const svi = await sviTemplate();
  let spot = await btcPriceRaw();
  console.log(`BTC now: $${(Number(spot) / PRICE_SCALE).toLocaleString()}`);
  console.log(`Expiry : ${new Date(expiry).toLocaleTimeString()} (in ${EXPIRY_MINUTES} min)\n`);

  // 1. Create oracle + register it in the Predict grid.
  console.log("Step 1: create_oracle + add_oracle_grid...");
  const createTx = new Transaction();
  const [oracleId] = createTx.moveCall({
    target: `${PKG}::oracle::create_oracle`,
    arguments: [createTx.pure.string("BTC"), createTx.pure.u64(BigInt(expiry))],
  });
  createTx.moveCall({
    target: `${PKG}::predict::add_oracle_grid`,
    arguments: [createTx.object(PREDICT), oracleId, createTx.pure.u64(MIN_STRIKE), createTx.pure.u64(TICK)],
  });
  const created = await signAndExecute(createTx);
  const newOracleId = created.objectChanges?.find(
    (c) => c.type === "created" && "objectType" in c && c.objectType === ORACLE_TYPE
  );
  const ORACLE = (newOracleId as { objectId: string } | undefined)?.objectId;
  if (!ORACLE) throw new Error("Created oracle id not found in object changes.");
  console.log(`  ✓ Oracle: ${ORACLE}`);

  // 2. Activate + seed first price/SVI.
  console.log("Step 2: activate + seed price/SVI...");
  const initTx = new Transaction();
  const oArg = initTx.object(ORACLE);
  initTx.moveCall({ target: `${PKG}::oracle::activate`, arguments: [oArg, initTx.object(CAP), initTx.object(CLOCK)] });
  feedCalls(initTx, oArg, spot, svi);
  await signAndExecute(initTx);
  console.log(`  ✓ Active and seeded.\n`);
  console.log(`→ Open the app — a "${EXPIRY_MINUTES}m" market should appear within ~60s.\n`);

  // 3. Keep price/SVI fresh until past expiry so the app accepts bets and the
  //    market settles (settlement is recorded on the first update past expiry).
  console.log("Step 3: feeding live price every 20s until settlement...");
  while (Date.now() < expiry + SETTLE_BUFFER_MS) {
    await sleep(FEED_INTERVAL_MS);
    try {
      spot = await btcPriceRaw();
      const tx = new Transaction();
      feedCalls(tx, tx.object(ORACLE), spot, svi);
      await signAndExecute(tx);
      const left = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      process.stdout.write(`  fed $${(Number(spot) / PRICE_SCALE).toLocaleString()} · ${left}s to expiry\n`);
    } catch (e) {
      console.warn("  feed tick failed:", e instanceof Error ? e.message : e);
    }
  }

  const after = await fetchOracleList(PREDICT);
  const final = after.find((o) => o.oracle_id === ORACLE);
  console.log(`\nFinal status: ${final?.status}  settlement_price=${final?.settlement_price ?? "—"}`);
  console.log("=== Done. Winners can now claim in the app. ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
