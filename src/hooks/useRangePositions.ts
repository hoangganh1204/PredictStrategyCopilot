"use client";
// The Public Server does NOT index range positions, so we reconstruct them from
// on-chain RangeMinted / RangeRedeemed events and resolve settlement via /api/oracles.
// Range mints are rare, so a global MoveEventType query + manager filter is complete.
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PREDICT_CONFIG } from "@/config/predict.js";
import { useManagerBalance } from "./useManagerBalance.js";
import type { Position } from "./usePositions.js";
import type { PositionState } from "@/lib/execute/types.js";

const RANGE_MINTED = `${PREDICT_CONFIG.PACKAGE}::predict::RangeMinted`;
const RANGE_REDEEMED = `${PREDICT_CONFIG.PACKAGE}::predict::RangeRedeemed`;

interface RangeEventJson {
  manager_id: string;
  oracle_id: string;
  predict_id?: string;
  expiry: string;
  lower_strike: string;
  higher_strike: string;
  quantity: string;
  cost?: string;
}

interface OracleInfo {
  oracle_id: string;
  status: string;
  expiry: number;
  settlement_price: number | null;
  underlying_asset: string;
}

export const RANGE_POSITIONS_KEY = ["range-positions"] as const;

interface Agg {
  json: RangeEventJson;
  mintedQty: bigint;
  redeemedQty: bigint;
  cost: bigint;
  /** Latest mint tx digest (events are newest-first), for an explorer link. */
  digest?: string;
}

const keyOf = (p: RangeEventJson) =>
  `${p.oracle_id}|${p.expiry}|${p.lower_strike}|${p.higher_strike}`;

export function useRangePositions() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { data: balance } = useManagerBalance();
  const managerId = balance?.managerId;

  return useQuery<Position[]>({
    queryKey: [...RANGE_POSITIONS_KEY, account?.address, managerId],
    enabled: !!account && !!managerId,
    staleTime: 5_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!managerId) return [];

      const [mintedEv, redeemedEv, oraclesRes] = await Promise.all([
        suiClient.queryEvents({ query: { MoveEventType: RANGE_MINTED }, limit: 50, order: "descending" }),
        suiClient.queryEvents({ query: { MoveEventType: RANGE_REDEEMED }, limit: 50, order: "descending" }),
        fetch("/api/oracles").then((r) => r.json()),
      ]);

      const oracles: Record<string, OracleInfo> = {};
      for (const o of oraclesRes.oracles ?? []) oracles[o.oracle_id] = o;

      const mine = (e: { parsedJson?: unknown }) =>
        (e.parsedJson as RangeEventJson | undefined)?.manager_id === managerId;

      const agg = new Map<string, Agg>();
      for (const e of mintedEv.data.filter(mine)) {
        const j = e.parsedJson as RangeEventJson;
        const k = keyOf(j);
        // Events are newest-first, so the first one seen carries the latest digest.
        const a = agg.get(k) ?? {
          json: j, mintedQty: 0n, redeemedQty: 0n, cost: 0n,
          digest: (e as { id?: { txDigest?: string } }).id?.txDigest,
        };
        a.mintedQty += BigInt(j.quantity);
        a.cost += BigInt(j.cost ?? "0");
        agg.set(k, a);
      }
      for (const e of redeemedEv.data.filter(mine)) {
        const j = e.parsedJson as RangeEventJson;
        const a = agg.get(keyOf(j));
        if (a) a.redeemedQty += BigInt(j.quantity);
      }

      const positions: Position[] = [];
      for (const [k, a] of agg.entries()) {
        const { json: j } = a;
        const openQty = a.mintedQty - a.redeemedQty;
        const lower = Number(j.lower_strike);
        const higher = Number(j.higher_strike);
        const settlement = oracles[j.oracle_id]?.settlement_price ?? null;

        let positionState: PositionState;
        if (a.redeemedQty >= a.mintedQty) positionState = "redeemed";
        else if (settlement != null)
          positionState = settlement >= lower && settlement <= higher ? "settled_won" : "settled_lost";
        else positionState = "active";

        const open_quantity = Number(openQty);
        const total_cost = Number(a.cost);
        // Range tokens redeem 1:1 at face value on a win (same as binary, verified).
        const realized_pnl =
          positionState === "settled_won" ? open_quantity - total_cost
          : positionState === "settled_lost" ? -total_cost
          : 0;

        positions.push({
          predict_id: j.predict_id ?? "",
          manager_id: managerId,
          oracle_id: j.oracle_id,
          underlying_asset: oracles[j.oracle_id]?.underlying_asset ?? "BTC",
          expiry: Number(j.expiry),
          lower_strike: lower,
          higher_strike: higher,
          minted_quantity: Number(a.mintedQty),
          open_quantity,
          total_cost,
          unrealized_pnl: 0,
          realized_pnl,
          status: positionState,
          positionState,
          direction: undefined,
          mintDigest: a.digest,
          // Stash the aggregation key so we can attach the live mark below.
          _key: k,
        } as Position & { _key: string });
      }

      // Live P&L for active positions: current sell-back value − cost basis.
      const activeMarks = positions
        .filter((p) => p.positionState === "active" && p.open_quantity > 0)
        .map((p) => ({
          key: (p as Position & { _key: string })._key,
          oracleId: p.oracle_id,
          lower: String(p.lower_strike),
          higher: String(p.higher_strike),
          quantity: String(p.open_quantity),
          expiry: p.expiry,
        }));

      if (activeMarks.length > 0) {
        try {
          const res = await fetch("/api/range-mark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: activeMarks }),
          });
          const body = await res.json();
          const markByKey = new Map<string, number | null>(
            (body.marks ?? []).map((m: { key: string; redeem_payout: number | null }) => [m.key, m.redeem_payout])
          );
          for (const p of positions) {
            const key = (p as Position & { _key: string })._key;
            const mark = markByKey.get(key);
            if (mark != null) p.unrealized_pnl = mark - p.total_cost;
          }
        } catch {
          // Leave unrealized_pnl at 0 if pricing is unavailable.
        }
      }

      return positions.map((p) => {
        const { _key, ...rest } = p as Position & { _key: string };
        void _key;
        return rest as Position;
      });
    },
  });
}
