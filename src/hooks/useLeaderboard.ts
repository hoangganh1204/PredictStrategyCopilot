"use client";
// T070 — Ranked leaderboard data from GET /api/leaderboard.
import { useQuery } from "@tanstack/react-query";
import type { LeaderboardResult } from "@/lib/leaderboard/types.js";

export const LEADERBOARD_KEY = ["leaderboard"] as const;

export function useLeaderboard() {
  return useQuery<LeaderboardResult>({
    queryKey: LEADERBOARD_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error(`Leaderboard request failed (${res.status})`);
      return res.json() as Promise<LeaderboardResult>;
    },
  });
}
