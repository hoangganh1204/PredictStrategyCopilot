// T083 — GET /api/leaders/:address/latest-position?followerAmount=X&followerManager=Y
// Find the leader's latest bet, run the three eligibility gates, and (if eligible)
// return scaled CopyParams. Non-eligible cases return HTTP 200 { copyable: false }
// so the UI can show a friendly reason rather than treating it as an error.
import { NextRequest, NextResponse } from "next/server";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { DUSDC_SCALE } from "@/config/predict.js";
import { findManagerId } from "@/lib/execute/findManager.js";
import { fetchManagerPositions, fetchManagerSummary, fetchOracleState } from "@/lib/predict-client.js";
import { makeDevInspectPricingFn } from "@/lib/strategy/devInspectPricing.js";
import { validateCopyEligibility } from "@/lib/copytrade/validateCopyEligibility.js";
import { scaleCopyParams } from "@/lib/copytrade/scaleCopyParams.js";
import type { CopyParams } from "@/lib/copytrade/types.js";
import type { PositionSummaryItem } from "@/types/predict-server.js";

const suiClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

function notCopyable(reason: string) {
  return NextResponse.json({ copyable: false, reason });
}

/** Serialize CopyParams (bigints → strings) for JSON transport. */
function serialize(p: CopyParams) {
  return {
    strategyType: p.strategyType,
    oracleId: p.oracleId,
    strike_raw: p.strike_raw?.toString(),
    lowerStrike_raw: p.lowerStrike_raw?.toString(),
    upperStrike_raw: p.upperStrike_raw?.toString(),
    isUp: p.isUp,
    quantity_raw: p.quantity_raw.toString(),
    cost_raw: p.cost_raw.toString(),
    payout_raw: p.payout_raw.toString(),
    expiryMs: p.expiryMs,
  };
}

function activityTs(p: PositionSummaryItem): number {
  return Number((p.last_activity_at as number | undefined) ?? (p.first_minted_at as number | undefined) ?? 0);
}

/** The leader's most recent bet — prefer a still-open one, else newest overall. */
function pickLatestPosition(positions: PositionSummaryItem[]): PositionSummaryItem | null {
  if (positions.length === 0) return null;
  const open = positions.filter((p) => p.status === "active");
  const pool = open.length > 0 ? open : positions;
  return [...pool].sort((a, b) => activityTs(b) - activityTs(a))[0];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const { searchParams } = req.nextUrl;
  const followerAmount = parseFloat(searchParams.get("followerAmount") ?? "");
  const followerManager = searchParams.get("followerManager");

  if (!followerManager || isNaN(followerAmount) || followerAmount <= 0) {
    return notCopyable("Choose an amount and connect your account to copy.");
  }
  const followerAmount_raw = BigInt(Math.round(followerAmount * Number(DUSDC_SCALE)));

  try {
    const leaderManager = await findManagerId(address);
    if (!leaderManager) return notCopyable("This investor has no account yet.");

    const positions = await fetchManagerPositions(leaderManager);
    const latest = pickLatestPosition(positions);
    if (!latest) return notCopyable("This investor has no recent bet to copy.");

    const [state, summary] = await Promise.all([
      fetchOracleState(latest.oracle_id),
      fetchManagerSummary(followerManager),
    ]);

    const sviTs = state.latest_svi?.checkpoint_timestamp_ms ?? 0;
    const balance_raw = BigInt(
      Math.round(summary.trading_balance ?? summary.balances?.[0]?.balance ?? 0)
    );

    // Gate first (cost ≈ stake in the linear model), then scale only if eligible.
    const eligibility = validateCopyEligibility(state.oracle, sviTs, balance_raw, followerAmount_raw);
    if (!eligibility.eligible) return notCopyable(eligibility.reason ?? "Can't copy this bet right now.");

    const pricingFn = makeDevInspectPricingFn(suiClient);
    const copyParams = await scaleCopyParams(latest, followerAmount_raw, pricingFn);

    return NextResponse.json({
      copyable: true,
      strategyType: copyParams.strategyType,
      copyParams: serialize(copyParams),
    });
  } catch {
    return notCopyable("Couldn't check this bet right now. Please try again.");
  }
}
