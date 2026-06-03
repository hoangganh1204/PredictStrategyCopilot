"use client";
// TanStack Query hook for fetching strategies from GET /api/strategies.
import { useQuery } from "@tanstack/react-query";

export type ExpiryLabel = "15m" | "30m" | "1h";

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

export interface StrategiesResponse {
  ok: true;
  oracle_id: string;
  expiry: number;
  strategies: ApiStrategy[];
}

export interface StrategiesError {
  ok: false;
  code: string;
  message: string;
}

export type StrategiesResult = StrategiesResponse | StrategiesError;

export const STRATEGIES_KEY = ["strategies"] as const;

export function useStrategies(amount: number | null, expiry: ExpiryLabel | null) {
  return useQuery<StrategiesResult>({
    queryKey: [...STRATEGIES_KEY, amount, expiry],
    enabled: !!amount && amount > 0 && !!expiry,
    staleTime: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams({
        amount: String(amount),
        expiry: expiry!,
      });
      const res = await fetch(`/api/strategies?${params}`);
      return res.json() as Promise<StrategiesResult>;
    },
  });
}
