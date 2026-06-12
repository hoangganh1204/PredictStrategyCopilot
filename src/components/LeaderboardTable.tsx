"use client";
// T072 — Ranked leaderboard list. Plain-language, truncated addresses only (FR-016),
// honest sparse state (FR-017), 300ms-delayed skeleton (Constitution III).
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDusdcNumber } from "@/lib/format.js";
import { truncateAddress } from "@/lib/leaderboard/computeLeaderboard.js";
import { STRATEGY_LABELS } from "@/lib/leaderboard/investorDetail.js";
import type { LeaderboardResult, RankedLeader, StrategyType } from "@/lib/leaderboard/types.js";

const RANK_BADGE = ["bg-amber-400/20 text-amber-300", "bg-zinc-400/20 text-zinc-200", "bg-orange-500/20 text-orange-300"];

const STRATEGY_ICON: Record<StrategyType, string> = {
  binary_up: "↗",
  binary_down: "🛡",
  range: "↔",
};

function pnlClass(raw: number): string {
  return raw > 0 ? "text-emerald-400" : raw < 0 ? "text-red-400" : "text-zinc-400";
}

function signed(raw: number): string {
  return `${raw > 0 ? "+" : ""}${formatDusdcNumber(raw)}`;
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3">
      <div className="h-6 w-6 rounded-full bg-zinc-800" />
      <div className="h-4 w-32 rounded bg-zinc-800" />
      <div className="ml-auto h-4 w-24 rounded bg-zinc-800" />
    </div>
  );
}

function LeaderRow({ leader }: { leader: RankedLeader }) {
  const badge = RANK_BADGE[leader.rank - 1] ?? "bg-zinc-800 text-zinc-400";
  return (
    <Link
      href={`/leaderboard/${leader.address}`}
      className="flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3 transition-all hover:border-zinc-700 hover:bg-zinc-900/80 sm:gap-4"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>
        {leader.rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm text-zinc-100">{truncateAddress(leader.address)}</div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
          {leader.recentStrategyTypes.length > 0 ? (
            leader.recentStrategyTypes.map((t, i) => (
              <span key={i} title={STRATEGY_LABELS[t]}>
                {STRATEGY_ICON[t]}
              </span>
            ))
          ) : (
            <span>—</span>
          )}
        </div>
      </div>

      {/* Wins shown — the data source only publishes claimed (won) bets. */}
      <div className="hidden w-20 text-right sm:block">
        <div className="font-mono text-sm text-zinc-200">{leader.settledCount}</div>
        <div className="text-xs text-zinc-600">wins shown</div>
      </div>

      {/* Winnings claimed (not full net P&L — losses aren't exposed). */}
      <div className="w-28 text-right sm:w-32">
        <div className={`font-mono text-sm font-semibold ${pnlClass(leader.netPnl_raw)}`}>
          {signed(leader.netPnl_raw)}
        </div>
        <div className="text-xs text-zinc-600">winnings</div>
      </div>

      <svg className="hidden h-4 w-4 shrink-0 text-zinc-600 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

interface LeaderboardTableProps {
  isLoading: boolean;
  isError: boolean;
  data: LeaderboardResult | undefined;
}

export function LeaderboardTable({ isLoading, isError, data }: LeaderboardTableProps) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const id = setTimeout(() => setShowSkeleton(true), 300);
    return () => {
      clearTimeout(id);
      setShowSkeleton(false);
    };
  }, [isLoading]);

  if (isLoading) {
    if (!showSkeleton) return null;
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-500/10 p-4 text-sm text-red-400">
        Couldn&apos;t load the leaderboard. Please try again in a moment.
      </div>
    );
  }

  if (!data) return null;

  const hasLeaders = data.leaders.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Sparse / empty honesty banner (FR-017) */}
      {data.sparse && (
        <div className="rounded-xl border border-amber-900/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200/90">
          {data.message ?? "Data is still thin on testnet — the leaderboard fills out as more people play."}
        </div>
      )}

      {/* Honesty note: the indexer only publishes claimed wins, not losses. */}
      {hasLeaders && (
        <p className="px-1 text-xs leading-relaxed text-zinc-500">
          Ranked by winnings claimed on-chain. The data source only publishes claimed (won) bets, so
          this isn&apos;t a full win/loss record — treat it as a wins-claimed board, not lifetime P&amp;L.
        </p>
      )}

      {hasLeaders ? (
        <div className="flex flex-col gap-2">
          {data.leaders.map((l) => (
            <LeaderRow key={l.address} leader={l} />
          ))}
        </div>
      ) : (
        !data.sparse && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            No settled bets yet. Be the first to land on the board.
          </div>
        )
      )}
    </div>
  );
}
