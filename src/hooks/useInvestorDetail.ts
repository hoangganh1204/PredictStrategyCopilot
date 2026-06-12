"use client";
// T071 — Per-investor detail from GET /api/leaders/:address.
// A 404 (no settled activity) is a normal state, not an error — surfaced via `notFound`.
import { useQuery } from "@tanstack/react-query";
import type { InvestorDetail } from "@/lib/leaderboard/types.js";

export const INVESTOR_DETAIL_KEY = ["investor-detail"] as const;

export interface InvestorDetailState {
  detail: InvestorDetail | null;
  /** True when the address has no settled activity (HTTP 404 ERR_NO_ACTIVITY). */
  notFound: boolean;
}

export function useInvestorDetail(address: string | undefined) {
  return useQuery<InvestorDetailState>({
    queryKey: [...INVESTOR_DETAIL_KEY, address],
    enabled: !!address,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/leaders/${address}`);
      if (res.status === 404) return { detail: null, notFound: true };
      if (!res.ok) throw new Error(`Investor request failed (${res.status})`);
      return { detail: (await res.json()) as InvestorDetail, notFound: false };
    },
  });
}
