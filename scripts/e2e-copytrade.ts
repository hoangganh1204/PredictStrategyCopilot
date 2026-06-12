/**
 * End-to-end copy-trade script — proves the full copy pipeline on real testnet
 * data: resolve a leader's latest bet → run the three eligibility gates →
 * scale to the follower's stake → build the UNSIGNED mint tx. This is the exact
 * pipeline GET /api/leaders/:address/latest-position runs, exercised against the
 * chain so we can validate the on-chain leg of T095 without a browser wallet.
 *
 * SAFE BY DEFAULT: dry-run (no signing, no spend, no state change). Set EXECUTE=1
 * to actually sign + mint with the loaded key and confirm the position appears.
 *
 * Usage:
 *   # read-only proof (default):
 *   tsx --env-file=.env.local scripts/e2e-copytrade.ts
 *   # against a specific leader, custom follower stake:
 *   LEADER=0x... FOLLOWER_AMOUNT=2 tsx --env-file=.env.local scripts/e2e-copytrade.ts
 *   # actually execute the copy (spends DUSDC from the loaded wallet):
 *   EXECUTE=1 tsx --env-file=.env.local scripts/e2e-copytrade.ts
 *
 * Env:
 *   COPYTRADE_TEST_KEY | KEEPER_KEY   bech32 private key of the FOLLOWER wallet
 *   LEADER                            leader address to copy (default: self)
 *   FOLLOWER_AMOUNT                   DUSDC stake to copy with (default 1)
 *   EXECUTE=1                         sign + send (otherwise dry-run)
 */
import fs from "node:fs";
import path from "node:path";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { DUSDC_SCALE } from "../src/config/predict.js";
import { fetchManagerPositions, fetchManagerSummary, fetchOracleState } from "../src/lib/predict-client.js";
import { findManagerId } from "../src/lib/execute/findManager.js";
import { makeDevInspectPricingFn } from "../src/lib/strategy/devInspectPricing.js";
import { validateCopyEligibility } from "../src/lib/copytrade/validateCopyEligibility.js";
import { scaleCopyParams } from "../src/lib/copytrade/scaleCopyParams.js";
import { buildCopyMintTx } from "../src/lib/copytrade/buildCopyMintTx.js";
import { formatDusdcNumber } from "../src/lib/format.js";
import type { PositionSummaryItem } from "../src/types/predict-server.js";

function loadEnvLocal() {
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* optional */
  }
}
loadEnvLocal();

const KEY = process.env.COPYTRADE_TEST_KEY ?? process.env.KEEPER_KEY;
if (!KEY) {
  console.error("ERROR: set COPYTRADE_TEST_KEY (or KEEPER_KEY) in .env.local — the follower wallet's bech32 key.");
  process.exit(1);
}
const EXECUTE = process.env.EXECUTE === "1";
const FOLLOWER_AMOUNT = Number(process.env.FOLLOWER_AMOUNT ?? "1");

const keypair = Ed25519Keypair.fromSecretKey(KEY);
const followerAddress = keypair.getPublicKey().toSuiAddress();
const LEADER = process.env.LEADER ?? followerAddress;

const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" });

function activityTs(p: PositionSummaryItem): number {
  return Number((p.last_activity_at as number | undefined) ?? (p.first_minted_at as number | undefined) ?? 0);
}
function pickLatestPosition(positions: PositionSummaryItem[]): PositionSummaryItem | null {
  if (positions.length === 0) return null;
  const open = positions.filter((p) => p.status === "active");
  const pool = open.length > 0 ? open : positions;
  return [...pool].sort((a, b) => activityTs(b) - activityTs(a))[0];
}

async function main() {
  console.log("\n=== E2E Copy-trade — Sui Testnet ===");
  console.log(`Follower wallet : ${followerAddress}`);
  console.log(`Leader          : ${LEADER}${LEADER === followerAddress ? "  (self — copying your own latest bet)" : ""}`);
  console.log(`Follower stake  : ${FOLLOWER_AMOUNT} DUSDC`);
  console.log(`Mode            : ${EXECUTE ? "EXECUTE (will sign + mint)" : "DRY-RUN (read-only)"}\n`);

  // 1) Resolve both managers.
  const [leaderManager, followerManager] = await Promise.all([
    findManagerId(LEADER),
    findManagerId(followerAddress),
  ]);
  console.log(`Leader manager  : ${leaderManager ?? "—"}`);
  console.log(`Follower manager: ${followerManager ?? "—"}`);
  if (!leaderManager) return console.log("\n✗ Leader has no account — nothing to copy.");
  if (!followerManager) return console.log("\n✗ Follower has no account — create one first.");

  // 2) Leader's latest bet.
  const positions = await fetchManagerPositions(leaderManager);
  const latest = pickLatestPosition(positions);
  if (!latest) return console.log("\n✗ Leader has no recent bet to copy.");
  console.log(`\nLeader latest bet: oracle=${latest.oracle_id.slice(0, 10)}… status=${latest.status} is_up=${latest.is_up} ` +
    `${latest.lower_strike ? `range[${latest.lower_strike}-${latest.higher_strike}]` : `strike=${latest.strike}`}`);

  // 3) Oracle state + follower balance.
  const [state, summary] = await Promise.all([
    fetchOracleState(latest.oracle_id),
    fetchManagerSummary(followerManager),
  ]);
  const sviTs = state.latest_svi?.checkpoint_timestamp_ms ?? 0;
  const balance_raw = BigInt(Math.round(summary.trading_balance ?? summary.balances?.[0]?.balance ?? 0));
  const followerAmount_raw = BigInt(Math.round(FOLLOWER_AMOUNT * Number(DUSDC_SCALE)));
  console.log(`Oracle status    : ${state.oracle.status}   SVI age: ${Math.round((Date.now() - sviTs) / 1000)}s`);
  console.log(`Follower balance : ${formatDusdcNumber(Number(balance_raw))}`);

  // 4) Eligibility gates (FR-020).
  const elig = validateCopyEligibility(state.oracle, sviTs, balance_raw, followerAmount_raw);
  console.log(`\nEligibility      : ${elig.eligible ? "✓ eligible" : `✗ ${elig.reason}`}`);
  if (!elig.eligible) {
    console.log("\n(Stopped at the gate — exactly as the UI would, with the Copy button disabled.)");
    return;
  }

  // 5) Scale to the follower's stake (preserves leader's strategy + strikes).
  const pricingFn = makeDevInspectPricingFn(client);
  const params = await scaleCopyParams(latest, followerAmount_raw, pricingFn);
  console.log("\nScaled CopyParams:");
  console.log(`  strategyType : ${params.strategyType}`);
  console.log(`  ${params.strategyType === "range"
    ? `range        : ${params.lowerStrike_raw} – ${params.upperStrike_raw}`
    : `strike       : ${params.strike_raw}  (isUp=${params.isUp})`}`);
  console.log(`  quantity_raw : ${params.quantity_raw}`);
  console.log(`  you pay      : ${formatDusdcNumber(Number(params.cost_raw))}`);
  console.log(`  max win      : ${formatDusdcNumber(Number(params.payout_raw))}`);

  // 6) Build the UNSIGNED tx (same builder the UI uses).
  const tx = buildCopyMintTx(params, followerManager);
  const targets = tx.getData().commands.filter((c) => c.MoveCall).map((c) => `${c.MoveCall!.module}::${c.MoveCall!.function}`);
  console.log(`\nUnsigned tx built. Move calls: ${targets.join(" → ")}`);

  if (!EXECUTE) {
    console.log("\n✓ DRY-RUN complete — pipeline validated end-to-end. Set EXECUTE=1 to sign + mint.");
    return;
  }

  // 7) Sign + execute (the leg a browser wallet performs for the follower).
  console.log("\nSigning + executing…");
  tx.setSender(followerAddress);
  const { bytes, signature } = await tx.sign({ signer: keypair, client });
  const res = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: { showEffects: true },
  });
  const ok = res.effects?.status?.status === "success";
  console.log(ok ? `✓ Copy minted. Digest: ${res.digest}` : `✗ Failed: ${res.effects?.status?.error}`);
  if (!ok) return;

  // 8) Confirm the copied position appears (standard lifecycle, FR-021).
  console.log("\nVerifying position appears (indexer may lag a few seconds)…");
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const after = await fetchManagerPositions(followerManager);
    const match = after.find((p) => p.oracle_id === params.oracleId && p.status === "active");
    if (match) {
      console.log(`✓ Position present: oracle=${match.oracle_id.slice(0, 10)}… qty=${match.open_quantity} status=${match.status}`);
      return;
    }
  }
  console.log("… not indexed yet — check /positions in the app shortly.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
