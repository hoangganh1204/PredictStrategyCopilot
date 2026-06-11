"use client";
// Lists the open prediction markets (active oracles) for the expiry selector.
import { useQuery } from "@tanstack/react-query";
import { formatDuration } from "@/lib/format.js";

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

      // Several oracles can share the same display label (e.g. two markets ~30min
      // apart both read "8d 4h"). Collapse same-label markets, keeping the soonest,
      // so the selector shows no visual duplicates.
      const now = Date.now();
      const seen = new Set<string>();
      const markets: Market[] = [];
      for (const m of [...body.markets].sort((a, b) => a.expiry - b.expiry)) {
        const label = formatDuration(m.expiry - now);
        if (seen.has(label)) continue;
        seen.add(label);
        markets.push({ oracleId: m.oracle_id, expiryMs: m.expiry });
      }
      return markets;
    },
  });
}
