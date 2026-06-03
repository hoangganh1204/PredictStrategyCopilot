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

const EXPIRY_LABELS: Record<string, number> = {
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};

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
  const expiryLabel = searchParams.get("expiry");

  if (!amountStr || !expiryLabel) {
    return errorResponse(
      "ERR_INVALID_AMOUNT",
      "Thiếu tham số amount hoặc expiry",
      400
    );
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return errorResponse("ERR_INVALID_AMOUNT", "Số tiền không hợp lệ", 400);
  }

  const expiryWindow = EXPIRY_LABELS[expiryLabel];
  if (!expiryWindow) {
    return errorResponse(
      "ERR_INVALID_AMOUNT",
      "Kỳ hạn không hợp lệ — dùng 15m, 30m, hoặc 1h",
      400
    );
  }

  // Fetch oracle list and find active oracle closest to requested expiry window
  const oracles = await fetchOracleList(PREDICT_CONFIG.PREDICT_OBJECT);
  const now = Date.now();
  const activeOracles = oracles.filter(
    (o) => o.status === "active" && o.expiry > now
  );

  if (activeOracles.length === 0) {
    return errorResponse(
      "ERR_NO_MARKET",
      "Hiện không có thị trường mở cho khung này",
      400
    );
  }

  // Pick oracle whose remaining time is closest to requested expiry window
  const target = now + expiryWindow;
  const oracle = activeOracles.reduce((best, o) =>
    Math.abs(o.expiry - target) < Math.abs(best.expiry - target) ? o : best
  );

  // Parallel fetch oracle state and SVI
  const [state, svi] = await Promise.all([
    fetchOracleState(oracle.oracle_id),
    fetchSviLatest(oracle.oracle_id),
  ]);

  const latestPrice = state.latest_price;
  if (!latestPrice) {
    return errorResponse("ERR_NO_MARKET", "Chưa có dữ liệu giá", 400);
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
    strategies,
  });
}
