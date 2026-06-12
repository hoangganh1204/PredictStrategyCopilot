// T067 — GET /api/leaderboard
// Enumerate managers (T060/T062) → fan out to positions → aggregate + rank.
// All data is real on-chain settled activity (FR-014). Honest sparse handling (FR-017).
import { NextResponse } from "next/server";
import { PREDICT_CONFIG } from "@/config/predict.js";
import { fetchAllManagerIds, fetchManagerPositions } from "@/lib/predict-client.js";
import { aggregateLeaderStats, rankLeaders } from "@/lib/leaderboard/computeLeaderboard.js";
import type { LeaderStats } from "@/lib/leaderboard/types.js";

// Scan the most-recently-created managers first and cap the fan-out so the board
// loads in under 3s (SC-008). On testnet the active managers are the recent ones,
// and high settled-count leaders cluster there. The cap is logged when it bites.
const MAX_MANAGERS = 120;
const CONCURRENCY = 60;
const TOP_N = 20;

export async function GET() {
  try {
    const managers = await fetchAllManagerIds(PREDICT_CONFIG.PREDICT_OBJECT);
    const recent = [...managers]
      .sort((a, b) => (b.checkpoint ?? 0) - (a.checkpoint ?? 0))
      .slice(0, MAX_MANAGERS);

    const stats: LeaderStats[] = [];
    for (let i = 0; i < recent.length; i += CONCURRENCY) {
      const batch = recent.slice(i, i + CONCURRENCY);
      const settledBatch = await Promise.all(
        batch.map(async (m) => {
          try {
            const positions = await fetchManagerPositions(m.manager_id);
            return aggregateLeaderStats(m.owner, positions);
          } catch {
            return null; // skip unreachable managers, don't fail the whole board
          }
        })
      );
      for (const s of settledBatch) if (s) stats.push(s);
    }

    const result = rankLeaders(stats);
    result.leaders = result.leaders.slice(0, TOP_N);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        leaders: [],
        sparse: true,
        message: "Couldn't load the leaderboard right now. Please try again.",
      },
      { status: 200 }
    );
  }
}
