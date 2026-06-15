// T067 — GET /api/leaderboard
// Enumerate managers (T060/T062) → fan out to positions → aggregate + rank.
// All data is real on-chain settled activity (FR-014). Honest sparse handling (FR-017).
import { NextResponse } from "next/server";
import { PREDICT_CONFIG } from "@/config/predict.js";
import { fetchAllManagerIds, fetchManagerPositions } from "@/lib/predict-client.js";
import { aggregateLeaderStats, rankLeaders } from "@/lib/leaderboard/computeLeaderboard.js";
import type { LeaderStats, LeaderboardResult } from "@/lib/leaderboard/types.js";
import type { PositionSummaryItem } from "@/types/predict-server.js";

// Scan the most-recently-created managers first and cap the fan-out so the board
// loads in under 3s (SC-008). On testnet the active managers are the recent ones,
// and high settled-count leaders cluster there.
const MAX_MANAGERS = 120;
const CONCURRENCY = 60;
const TOP_N = 20;

// Short server-side cache so repeat loads are instant and the fan-out to the
// Public Server is shared across users (SC-008). Matches the client staleTime.
const CACHE_TTL_MS = 30_000;
let cache: { result: LeaderboardResult; expiresAt: number } | null = null;
let inFlight: Promise<LeaderboardResult> | null = null;

/** Test-only: clear the module cache so cases stay isolated. */
export function __resetLeaderboardCacheForTests(): void {
  cache = null;
  inFlight = null;
}

async function computeLeaderboard(): Promise<LeaderboardResult> {
  const managers = await fetchAllManagerIds(PREDICT_CONFIG.PREDICT_OBJECT);
  const recent = [...managers]
    .sort((a, b) => (b.checkpoint ?? 0) - (a.checkpoint ?? 0))
    .slice(0, MAX_MANAGERS);

  // A player (owner) can have several managers — merge all their positions so
  // each owner is one leaderboard entry (avoids duplicate-address rows).
  const byOwner = new Map<string, PositionSummaryItem[]>();
  for (let i = 0; i < recent.length; i += CONCURRENCY) {
    const batch = recent.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(
      batch.map(async (m) => {
        try {
          return { owner: m.owner, positions: await fetchManagerPositions(m.manager_id) };
        } catch {
          return null; // skip unreachable managers, don't fail the whole board
        }
      })
    );
    for (const r of fetched) {
      if (!r) continue;
      const arr = byOwner.get(r.owner) ?? [];
      arr.push(...r.positions);
      byOwner.set(r.owner, arr);
    }
  }

  const stats: LeaderStats[] = [...byOwner.entries()].map(([owner, positions]) =>
    aggregateLeaderStats(owner, positions)
  );

  const result = rankLeaders(stats);
  result.leaders = result.leaders.slice(0, TOP_N);
  return result;
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now < cache.expiresAt) {
      return NextResponse.json(cache.result);
    }
    // Coalesce concurrent recomputes into a single fan-out (avoid a thundering herd).
    if (!inFlight) {
      inFlight = computeLeaderboard().finally(() => {
        inFlight = null;
      });
    }
    const result = await inFlight;
    cache = { result, expiresAt: Date.now() + CACHE_TTL_MS };
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
