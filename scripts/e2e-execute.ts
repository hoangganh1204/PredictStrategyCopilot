/**
 * End-to-end testnet execution script: getOrCreateManager → deposit → mint → verify.
 *
 * Security: private key loaded from env var TEST_KEYPAIR or .env.local — NEVER hardcode.
 * Usage:
 *   TEST_KEYPAIR="<bech32-private-key>" pnpm tsx scripts/e2e-execute.ts
 *   Or set TEST_KEYPAIR in .env.local and run: pnpm tsx --env-file=.env.local scripts/e2e-execute.ts
 *
 * .env.local is in .gitignore — never commit it.
 */
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "../src/config/predict.js";
import { fetchOracleList, fetchOracleState, fetchSviLatest } from "../src/lib/predict-client.js";
import { buildBinaryMintTx } from "../src/lib/execute/buildMintTx.js";
import { buildDepositTxFromCoin } from "../src/lib/execute/depositDusdc.js";
import { findManagerId } from "../src/lib/execute/findManager.js";
import type { TxResult } from "../src/lib/execute/types.js";

// ─── Keypair from env ─────────────────────────────────────────────────────────

const keypairEnv = process.env.TEST_KEYPAIR;
if (!keypairEnv) {
  console.error(
    "ERROR: Set TEST_KEYPAIR env var to a bech32-encoded Sui private key.\n" +
    "       Never commit private keys. Use .env.local (already in .gitignore)."
  );
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(keypairEnv);
const walletAddress = keypair.getPublicKey().toSuiAddress();

console.log(`\n=== E2E Execute — Sui Testnet ===`);
console.log(`Wallet: ${walletAddress}\n`);

// ─── Client setup ─────────────────────────────────────────────────────────────

const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

async function signAndExecute(tx: Transaction): Promise<TxResult> {
  tx.setSender(walletAddress);
  const { bytes, signature } = await tx.sign({ signer: keypair, client });
  const result = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: { showEffects: true },
  });
  const status = result.effects?.status?.status;
  if (status === "success") {
    return { status: "success", digest: result.digest };
  }
  return { status: "failed", error: result.effects?.status?.error ?? "unknown" };
}

// ─── Step 1: Find or create PredictManager ────────────────────────────────────

async function getOrCreateManager(): Promise<string> {
  console.log("Step 1: Finding PredictManager...");

  // PredictManager is a SHARED object — discover via creation event, not owned objects.
  const existing = await findManagerId(walletAddress);
  if (existing) {
    console.log(`  Found: ${existing}`);
    return existing;
  }

  console.log("  Not found. Creating PredictManager...");
  const tx = new Transaction();
  tx.moveCall({
    target: `${PREDICT_CONFIG.PACKAGE}::predict::create_manager`,
    arguments: [],
  });

  const result = await signAndExecute(tx);
  if (result.status !== "success") throw new Error(`create_manager failed: ${result.error}`);
  console.log(`  Created. Digest: ${result.digest}`);

  // Re-query events (indexer may lag a few seconds after the tx)
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = await findManagerId(walletAddress);
    if (id) {
      console.log(`  Manager ID: ${id}`);
      return id;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("PredictManager created but not found via events");
}

// ─── Step 2: Deposit 1 DUSDC ──────────────────────────────────────────────────

async function depositDusdc(managerId: string): Promise<void> {
  console.log("\nStep 2: Depositing 1 DUSDC...");
  const amount = 1_000_000n; // 1 DUSDC

  // Find a DUSDC coin
  const coins = await client.getCoins({
    owner: walletAddress,
    coinType: PREDICT_CONFIG.DUSDC_TYPE,
  });

  if (coins.data.length === 0) {
    console.log("  WARNING: No DUSDC coins found — skipping deposit.");
    console.log("           Get testnet DUSDC from the faucet first.");
    return;
  }

  const coinId = coins.data[0].coinObjectId;
  console.log(`  Using DUSDC coin: ${coinId}`);

  const tx = buildDepositTxFromCoin(managerId, coinId, amount);
  const result = await signAndExecute(tx);
  if (result.status !== "success") {
    console.log(`  WARNING: Deposit failed: ${result.error}`);
    return;
  }
  console.log(`  Deposited 1 DUSDC. Digest: ${result.digest}`);
}

// ─── Step 3: Mint a binary position ───────────────────────────────────────────

async function mintBinaryPosition(managerId: string): Promise<void> {
  console.log("\nStep 3: Minting binary position...");

  // Fetch active oracle
  const oracles = await fetchOracleList(PREDICT_CONFIG.PREDICT_OBJECT);
  const activeOracle = oracles.find((o) => o.status === "active");
  if (!activeOracle) {
    console.log("  No active oracle found — skipping mint.");
    return;
  }
  console.log(`  Using oracle: ${activeOracle.oracle_id}`);

  const state = await fetchOracleState(activeOracle.oracle_id);
  const spot = BigInt(state.latest_price?.spot ?? activeOracle.min_strike);
  const tick = BigInt(activeOracle.tick_size);
  const min = BigInt(activeOracle.min_strike);

  // Snap to nearest valid strike
  const strike = ((spot / tick) * tick >= min ? (spot / tick) * tick : min);
  console.log(`  Strike: ${strike} (spot: ${spot})`);

  const tx = buildBinaryMintTx({
    oracleId: activeOracle.oracle_id,
    managerId,
    strike_raw: strike,
    isUp: true,
    quantity_raw: 1_000_000n,
    expiryMs: activeOracle.expiry,
  });

  const result = await signAndExecute(tx);
  if (result.status !== "success") {
    console.log(`  WARNING: Mint failed: ${result.error}`);
    console.log("           If balance is 0, deposit DUSDC first.");
    return;
  }
  console.log(`  Minted binary-up position. Digest: ${result.digest}`);
}

// ─── Step 4: Verify via Public Server ─────────────────────────────────────────

async function verifyPosition(managerId: string): Promise<void> {
  console.log("\nStep 4: Verifying position via Public Server...");
  const res = await fetch(
    `${PREDICT_CONFIG.SERVER_URL}/managers/${managerId}/positions/summary`
  );
  if (!res.ok) {
    console.log(`  WARNING: HTTP ${res.status} from server.`);
    return;
  }
  const positions = await res.json();
  console.log(`  Positions found: ${Array.isArray(positions) ? positions.length : "N/A"}`);
  if (Array.isArray(positions) && positions.length > 0) {
    console.log("  Latest position:", JSON.stringify(positions[0], null, 2));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const managerId = await getOrCreateManager();
  await depositDusdc(managerId);
  await mintBinaryPosition(managerId);
  await verifyPosition(managerId);
  console.log("\n=== E2E complete ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
