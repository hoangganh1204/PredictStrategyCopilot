"use client";
// Lists the open prediction markets (active oracles) for the expiry selector.
import { useQuery } from "@tanstack/react-query";

export interface Market {
  oracleId: string;
  expiryMs: number;
}

interface MarketsResponse {
  ok: boolean;
  markets: { oracle_id: string; expiry: number; underlying_asset: string }[];
}

export const MARKETS_KEY = ["markets"] as const;

export function useMarkets() {
  return useQuery<Market[]>({
    queryKey: MARKETS_KEY,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/markets");
      const body = (await res.json()) as MarketsResponse;
      if (!body.ok) return [];
      return body.markets.map((m) => ({ oracleId: m.oracle_id, expiryMs: m.expiry }));
    },
  });
}
