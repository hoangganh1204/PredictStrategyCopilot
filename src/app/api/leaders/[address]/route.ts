// T068 — GET /api/leaders/:address
// Resolve the owner's PredictManager → its positions → investor detail.
// 404 ERR_NO_ACTIVITY when the address has no settled positions (FR-017).
import { NextResponse } from "next/server";
import { findManagerId } from "@/lib/execute/findManager.js";
import { fetchManagerPositions } from "@/lib/predict-client.js";
import { buildInvestorDetail } from "@/lib/leaderboard/investorDetail.js";
import { classifyOutcome } from "@/lib/leaderboard/classify.js";

const RECENT_LIMIT = 10;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  try {
    const managerId = await findManagerId(address);
    if (!managerId) {
      return NextResponse.json(
        { ok: false, code: "ERR_NO_ACTIVITY", message: "This address has no on-chain activity yet." },
        { status: 404 }
      );
    }

    const positions = await fetchManagerPositions(managerId);
    const hasSettled = positions.some((p) => classifyOutcome(p) !== "open");
    if (!hasSettled) {
      return NextResponse.json(
        { ok: false, code: "ERR_NO_ACTIVITY", message: "This address has no settled bets yet." },
        { status: 404 }
      );
    }

    return NextResponse.json(buildInvestorDetail(address, positions, RECENT_LIMIT));
  } catch {
    return NextResponse.json(
      { ok: false, code: "ERR_INTERNAL", message: "Couldn't load this investor's detail." },
      { status: 500 }
    );
  }
}
