// GET /api/oracles — full oracle list incl. settled ones, for resolving range
// position settlement (the Public Server doesn't index range positions, so we
// reconstruct them from chain events and need each oracle's settlement price).
import { NextResponse } from "next/server";
import { PREDICT_CONFIG } from "@/config/predict.js";
import { fetchOracleList } from "@/lib/predict-client.js";

export async function GET() {
  try {
    const oracles = await fetchOracleList(PREDICT_CONFIG.PREDICT_OBJECT);
    return NextResponse.json({
      ok: true,
      oracles: oracles.map((o) => ({
        oracle_id: o.oracle_id,
        status: o.status,
        expiry: o.expiry,
        settlement_price: o.settlement_price,
        underlying_asset: o.underlying_asset,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, oracles: [] }, { status: 200 });
  }
}
