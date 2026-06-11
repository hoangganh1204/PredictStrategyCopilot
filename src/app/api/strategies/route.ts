import { NextRequest, NextResponse } from "next/server";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { PREDICT_CONFIG } from "@/config/predict.js";
import {
  fetchOracleList,
  fetchOracleState,
  fetchSviLatest,
} from "@/lib/predict-client.js";
import { computeStrategies } from "@/lib/strategy/computeStrategies.js";
import { makeDevInspectPricingFn } from "@/lib/strategy/devInspectPricing.js";
import type { OracleSnapshot, SVIParams } from "@/lib/strategy/types.js";

const suiClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const amountStr = searchParams.get("amount");
  const oracleId = searchParams.get("oracleId");

  if (!amountStr || !oracleId) {
    return errorResponse(
      "ERR_INVALID_AMOUNT",
      "Missing amount or oracleId parameter",
      400
    );
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return errorResponse("ERR_INVALID_AMOUNT", "Invalid amount", 400);
  }

  // Find the requested market; it must still be open.
  const oracles = await fetchOracleList(PREDICT_CONFIG.PREDICT_OBJECT);
  const now = Date.now();
  const oracle = oracles.find(
    (o) => o.oracle_id === oracleId && o.status === "active" && o.expiry > now
  );

  if (!oracle) {
    return errorResponse(
      "ERR_NO_MARKET",
      "This market is no longer open",
      400
    );
  }

  // Parallel fetch oracle state and SVI
  const [state, svi] = await Promise.all([
    fetchOracleState(oracle.oracle_id),
    fetchSviLatest(oracle.oracle_id),
  ]);

  const latestPrice = state.latest_price;
  if (!latestPrice) {
    return errorResponse("ERR_NO_MARKET", "No price data available yet", 400);
  }

  const sviParams: SVIParams = {
    a: svi.a,
    b: svi.b,
    rho: svi.rho,
    rho_negative: svi.rho_negative,
    m: svi.m,
    m_negative: svi.m_negative,
    sigma: svi.sigma,
    updatedAtMs: svi.checkpoint_timestamp_ms,
  };

  const snapshot: OracleSnapshot = {
    oracleId: oracle.oracle_id,
    spot_raw: BigInt(latestPrice.spot),
    forward_raw: BigInt(latestPrice.forward),
    expiryMs: oracle.expiry,
    minStrike_raw: BigInt(oracle.min_strike),
    tickSize_raw: BigInt(oracle.tick_size),
    svi: sviParams,
  };

  const pricingFn = makeDevInspectPricingFn(suiClient);
  const result = await computeStrategies(snapshot, pricingFn);

  if (!result.ok) {
    const status = result.code === "ERR_STALE_SVI" ? 400 : 400;
    return errorResponse(result.code, result.message, status);
  }

  // Serialize bigints for JSON
  const strategies = result.strategies.map((s) => ({
    ...s,
    strike_raw: s.strike_raw?.toString(),
    lowerStrike_raw: s.lowerStrike_raw?.toString(),
    upperStrike_raw: s.upperStrike_raw?.toString(),
    cost_raw: s.cost_raw.toString(),
    payout_raw: s.payout_raw.toString(),
  }));

  return NextResponse.json({
    ok: true,
    oracle_id: oracle.oracle_id,
    expiry: oracle.expiry,
    impliedVol: result.impliedVol,
    strategies,
  });
}
