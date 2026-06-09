// GET /api/markets — list the open prediction markets (active oracles), soonest first.
// Server-side fetch avoids CORS when reading the public Predict server from the browser.
import { NextResponse } from "next/server";
import { PREDICT_CONFIG } from "@/config/predict.js";
import { fetchOracleList } from "@/lib/predict-client.js";

export async function GET() {
  try {
    const oracles = await fetchOracleList(PREDICT_CONFIG.PREDICT_OBJECT);
    const now = Date.now();
    const markets = oracles
      .filter((o) => o.status === "active" && o.expiry > now)
      .sort((a, b) => a.expiry - b.expiry)
      .map((o) => ({
        oracle_id: o.oracle_id,
        expiry: o.expiry,
        underlying_asset: o.underlying_asset,
      }));
    return NextResponse.json({ ok: true, markets });
  } catch {
    return NextResponse.json({ ok: false, markets: [] }, { status: 200 });
  }
}
