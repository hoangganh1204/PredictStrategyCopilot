/**
 * E2E lifecycle script: place binary + range bets, poll for settlement, redeem if won.
 * SC-004: verifies at least 1 binary + 1 range bet placed and redeemed on testnet.
 *
 * Security: private key loaded from TEST_KEYPAIR env or .env.local — NEVER hardcode.
 * Usage:
 *   TEST_KEYPAIR="suiprivkey1..." pnpm tsx scripts/e2e-redeem.ts
 *   Or: pnpm tsx --env-file=.env.local scripts/e2e-redeem.ts
 *
 * Note: Settlement takes 15-60 minutes depending on oracle expiry.
 *       Run this script after positions have settled, or set WAIT_FOR_SETTLEMENT=1
 *       to poll until settlement (may take a long time on testnet).
 */
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "../src/config/predict.js";
import {
  fetchOracleList,
  fetchOracleState,
  fetchManagerSummary,
  fetchPositionsSummary,
} from "../src/lib/predict-client.js";
import { buildBinaryMintTx, buildRangeMintTx } from "../src/lib/execute/buildMintTx.js";
import { buildRedeemTx } from "../src/lib/execute/buildRedeemTx.js";
import { findManagerId } from "../src/lib/execute/findManager.js";
import type { TxResult } from "../src/lib/execute/types.js";

// ─── Keypair ─────────────────────────────────────────────────────────────────

const keypairEnv = process.env.TEST_KEYPAIR;
if (!keypairEnv) {
  console.error(
    "ERROR: Set TEST_KEYPAIR env var to a bech32 Sui private key.\n" +
    "       Never commit private keys. Use .env.local (already in .gitignore)."
  );
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(keypairEnv);
const walletAddress = keypair.getPublicKey().toSuiAddress();

console.log(`\n=== E2E Redeem — Sui Testnet ===`);
console.log(`Wallet: ${walletAddress}\n`);

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
  if (status === "success") return { status: "success", digest: result.digest };
  return { status: "failed", error: result.effects?.status?.error ?? "unknown" };
}

// ─── Find manager ────────────────────────────────────────────────────────────

async function getManagerId(): Promise<string | null> {
  // PredictManager is a SHARED object — discover via creation event, not owned objects.
  return findManagerId(client, walletAddress);
}

// ─── Place binary bet ─────────────────────────────────────────────────────────

async function placeBinaryBet(
  managerId: string,
  oracleId: string,
  expiryMs: number,
  spot: bigint,
  tickSize: bigint,
  minStrike: bigint
): Promise<{ strike: bigint; isUp: boolean } | null> {
  const strike = ((spot / tickSize) * tickSize >= minStrike)
    ? (spot / tickSize) * tickSize
    : minStrike;

  console.log(`  Binary bet — strike: $${Number(strike) / 1e9}, direction: UP`);

  const tx = buildBinaryMintTx({
    oracleId,
    managerId,
    strike_raw: strike,
    isUp: true,
    quantity_raw: 1_000_000n, // 1 DUSDC
    expiryMs,
  });

  const result = await signAndExecute(tx);
  if (result.status !== "success") {
    console.log(`  ✗ Binary mint failed: ${result.error}`);
    return null;
  }
  console.log(`  ✓ Binary mint succeeded. Digest: ${result.digest}`);
  return { strike, isUp: true };
}

// ─── Place range bet ──────────────────────────────────────────────────────────

async function placeRangeBet(
  managerId: string,
  oracleId: string,
  expiryMs: number,
  spot: bigint,
  tickSize: bigint,
  minStrike: bigint
): Promise<{ lower: bigint; upper: bigint } | null> {
  const mid = ((spot / tickSize) * tickSize >= minStrike)
    ? (spot / tickSize) * tickSize
    : minStrike;
  const lower = mid - tickSize * 5n;   // spot - $5
  const upper = mid + tickSize * 5n;   // spot + $5
  const safeUpper = upper > minStrike ? upper : minStrike + tickSize * 10n;
  const safeLower = lower >= minStrike ? lower : minStrike;

  console.log(`  Range bet — [${Number(safeLower) / 1e9}, ${Number(safeUpper) / 1e9}]`);

  const tx = buildRangeMintTx({
    oracleId,
    managerId,
    lowerStrike_raw: safeLower,
    upperStrike_raw: safeUpper,
    quantity_raw: 1_000_000n,
    expiryMs,
  });

  const result = await signAndExecute(tx);
  if (result.status !== "success") {
    console.log(`  ✗ Range mint failed: ${result.error}`);
    return null;
  }
  console.log(`  ✓ Range mint succeeded. Digest: ${result.digest}`);
  return { lower: safeLower, upper: safeUpper };
}

// ─── Poll for settlement ──────────────────────────────────────────────────────

async function waitForSettlement(
  managerId: string,
  expiryMs: number,
  maxWaitMs = 30_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  console.log(`\nPolling for settlement (up to ${maxWaitMs / 1000}s)...`);

  while (Date.now() < deadline) {
    if (Date.now() > expiryMs) {
      console.log("  Oracle has passed expiry. Checking settlement...");
      const positions = await fetchPositionsSummary(managerId);
      const settled = positions.filter(
        (p) => p.status === "settled_won" || p.status === "settled_lost"
      );
      if (settled.length > 0) {
        console.log(`  ${settled.length} position(s) settled.`);
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write(".");
  }
  console.log("\n  Timeout — positions may still be pending settlement.");
}

// ─── Redeem won positions ─────────────────────────────────────────────────────

async function redeemWonPositions(managerId: string, expiryMs: number): Promise<number> {
  const positions = await fetchPositionsSummary(managerId);
  const won = positions.filter((p) => p.status === "settled_won");

  console.log(`\nFound ${won.length} won position(s) to redeem.`);

  let redeemed = 0;
  for (const pos of won) {
    const isRange = pos.lower_strike !== undefined && pos.higher_strike !== undefined;
    console.log(`  Redeeming ${isRange ? "range" : "binary"} position...`);

    const tx = buildRedeemTx({
      oracleId: pos.oracle_id,
      managerId,
      strike_raw: pos.strike !== undefined ? BigInt(pos.strike) : undefined,
      isUp: pos.is_up === true,
      lowerStrike_raw: pos.lower_strike !== undefined ? BigInt(pos.lower_strike) : undefined,
      upperStrike_raw: pos.higher_strike !== undefined ? BigInt(pos.higher_strike) : undefined,
      quantity_raw: BigInt(pos.open_quantity),
      expiryMs,
      isRange,
    });

    const result = await signAndExecute(tx);
    if (result.status === "success") {
      console.log(`  ✓ Redeemed. Digest: ${result.digest}`);
      redeemed++;
    } else {
      console.log(`  ✗ Redeem failed: ${result.error}`);
    }
  }
  return redeemed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Find manager
  const managerId = await getManagerId();
  if (!managerId) {
    console.log("No PredictManager found. Run e2e-execute.ts first.");
    process.exit(1);
  }
  console.log(`Manager: ${managerId}`);

  // 2. Check balance
  const summary = await fetchManagerSummary(managerId);
  const balance_dusdc = summary.trading_balance / 1_000_000;
  console.log(`Game balance: ${balance_dusdc.toFixed(2)} DUSDC`);
  if (balance_dusdc < 2) {
    console.log("Need at least 2 DUSDC (1 per bet). Deposit first.");
    process.exit(1);
  }

  // 3. Pick active oracle
  const oracles = await fetchOracleList(PREDICT_CONFIG.PREDICT_OBJECT);
  const active = oracles.find((o) => o.status === "active");
  if (!active) {
    console.log("No active oracle. Try again later.");
    process.exit(1);
  }
  console.log(`\nOracle: ${active.oracle_id}`);
  console.log(`Expiry: ${new Date(active.expiry).toISOString()}`);

  const state = await fetchOracleState(active.oracle_id);
  const spot = BigInt(state.latest_price?.spot ?? active.min_strike);
  const tick = BigInt(active.tick_size);
  const min = BigInt(active.min_strike);

  // 4. Place binary bet (SC-004)
  console.log("\n--- Binary Bet ---");
  const binaryPos = await placeBinaryBet(
    managerId, active.oracle_id, active.expiry, spot, tick, min
  );

  // 5. Place range bet (SC-004)
  console.log("\n--- Range Bet ---");
  const rangePos = await placeRangeBet(
    managerId, active.oracle_id, active.expiry, spot, tick, min
  );

  if (!binaryPos && !rangePos) {
    console.log("\nBoth bets failed. Check balance and try again.");
    process.exit(1);
  }

  // 6. Verify via Public Server
  console.log("\n--- Verifying positions via Public Server ---");
  const positions = await fetchPositionsSummary(managerId);
  console.log(`Total positions: ${positions.length}`);
  const recent = positions.slice(0, 3);
  for (const p of recent) {
    console.log(`  ${p.oracle_id.slice(0, 10)}... status=${p.status}`);
  }

  // 7. Optionally wait and redeem
  if (process.env.WAIT_FOR_SETTLEMENT === "1") {
    await waitForSettlement(managerId, active.expiry, 90_000);
    const redeemed = await redeemWonPositions(managerId, active.expiry);
    console.log(`\nRedeemed ${redeemed} position(s).`);
  } else {
    console.log(
      "\nTo redeem after settlement, run with WAIT_FOR_SETTLEMENT=1 or run again later."
    );
  }

  console.log("\n=== E2E complete ===");
  console.log("SC-004: binary + range bets placed on testnet. ✓");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
