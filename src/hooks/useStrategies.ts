"use client";
// TanStack Query hook for fetching strategies from GET /api/strategies.
import { useQuery } from "@tanstack/react-query";

// Serialized from API (bigints come as strings)
export interface ApiStrategy {
  type: "range" | "binary_up" | "binary_down";
  strike_raw?: string;
  lowerStrike_raw?: string;
  upperStrike_raw?: string;
  cost_raw: string;
  payout_raw: string;
  prob: number;
}

export interface MarketPulse {
  averageVol: number;
  deltaPct: number;
  level: "elevated" | "subdued" | "steady";
}

export interface StrategiesResponse {
  ok: true;
  oracle_id: string;
  expiry: number;
  /** Annualized at-the-money implied volatility (e.g. 0.42 = 42%/yr). */
  impliedVol: number;
  /** Current vol vs its recent norm. */
  pulse?: MarketPulse | null;
  /** Settlement prices (scale 1e9) of the last few settled markets, oldest→newest. */
  recentCloses?: number[];
  strategies: ApiStrategy[];
}

export interface StrategiesError {
  ok: false;
  code: string;
  message: string;
}

export type StrategiesResult = StrategiesResponse | StrategiesError;

export const STRATEGIES_KEY = ["strategies"] as const;

export function useStrategies(oracleId: string | null) {
  return useQuery<StrategiesResult>({
    queryKey: [...STRATEGIES_KEY, oracleId],
    enabled: !!oracleId,
    staleTime: 30_000,
    // Keep SVI well under the 30s staleness limit so the bet-time guard
    // (FR-006c) almost never has to block a click.
    refetchInterval: 15_000,
    queryFn: async () => {
      // The computed strategies are per-token and do NOT depend on the stake — the
      // UI scales cost/payout by the live amount. Send a stub amount to satisfy the
      // route's amount > 0 guard.
      const params = new URLSearchParams({ amount: "1", oracleId: oracleId! });
      const res = await fetch(`/api/strategies?${params}`);
      return res.json() as Promise<StrategiesResult>;
    },
  });
}
