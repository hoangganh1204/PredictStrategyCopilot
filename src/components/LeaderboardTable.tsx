"use client";
// T072 — Ranked leaderboard. Plain-language, truncated addresses only (FR-016),
// honest sparse state (FR-017), 300ms-delayed skeleton (Constitution III).
// Top 3 get a medal podium; the rest are rows with a proportional winnings bar.
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDusdcNumber } from "@/lib/format.js";
import { truncateAddress } from "@/lib/leaderboard/computeLeaderboard.js";
import { STRATEGY_LABELS } from "@/lib/leaderboard/investorDetail.js";
import type { LeaderboardResult, RankedLeader, StrategyType } from "@/lib/leaderboard/types.js";

const STRATEGY_CHIP: Record<StrategyType, { icon: string; cls: string }> = {
  binary_up: { icon: "↗", cls: "bg-emerald-500/15 text-emerald-400" },
  binary_down: { icon: "🛡", cls: "bg-amber-500/15 text-amber-400" },
  range: { icon: "↔", cls: "bg-violet-500/15 text-violet-400" },
};

// Medal styling for the top-3 podium.
const MEDALS = [
  { emoji: "🥇", ring: "border-amber-400/50", glow: "shadow-[0_0_40px_-12px_rgba(251,191,36,0.55)]", grad: "from-amber-500/10", text: "text-amber-300" },
  { emoji: "🥈", ring: "border-zinc-400/40", glow: "shadow-[0_0_30px_-14px_rgba(212,212,216,0.5)]", grad: "from-zinc-400/10", text: "text-zinc-200" },
  { emoji: "🥉", ring: "border-orange-500/40", glow: "shadow-[0_0_30px_-14px_rgba(249,115,22,0.45)]", grad: "from-orange-500/10", text: "text-orange-300" },
];

function signed(raw: number): string {
  return `${raw > 0 ? "+" : ""}${formatDusdcNumber(raw)}`;
}

function pnlClass(raw: number): string {
  return raw > 0 ? "text-emerald-400" : raw < 0 ? "text-red-400" : "text-zinc-400";
}

function winPct(rate: number): number {
  return Math.round(rate * 100);
}

function StrategyChips({ types, className = "" }: { types: StrategyType[]; className?: string }) {
  if (types.length === 0) return <span className="text-xs text-zinc-600">—</span>;
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {types.map((t, i) => (
        <span
          key={i}
          title={STRATEGY_LABELS[t]}
          className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] ${STRATEGY_CHIP[t].cls}`}
        >
          {STRATEGY_CHIP[t].icon}
        </span>
      ))}
    </div>
  );
}

function PodiumCard({ leader }: { leader: RankedLeader }) {
  const medal = MEDALS[leader.rank - 1] ?? MEDALS[2];
  const isFirst = leader.rank === 1;
  return (
    <Link
      href={`/leaderboard/${leader.address}`}
      // #1 sits center & taller (order-2); items-end on the grid makes it rise.
      className={`card-surface animate-rise group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border bg-gradient-to-b to-transparent px-4 text-center transition-all hover:-translate-y-0.5 ${medal.ring} ${medal.grad} ${medal.glow} ${
        isFirst ? "py-7 sm:order-2" : "py-5"
      } ${leader.rank === 2 ? "sm:order-1" : ""} ${leader.rank === 3 ? "sm:order-3" : ""}`}
    >
      <div className={`text-3xl leading-none ${isFirst ? "sm:text-4xl" : ""}`}>{medal.emoji}</div>
      <div className="font-mono text-sm text-zinc-100">{truncateAddress(leader.address)}</div>
      <div className={`font-mono text-xl font-bold ${leader.netPnl_raw < 0 ? "text-red-400" : medal.text} ${isFirst ? "sm:text-2xl" : ""}`}>
        {signed(leader.netPnl_raw)}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        net P&amp;L · {winPct(leader.winRate)}% win · {leader.settledCount} bets
      </div>
      <StrategyChips types={leader.recentStrategyTypes} className="mt-0.5" />
    </Link>
  );
}

function LeaderRow({ leader, max }: { leader: RankedLeader; max: number }) {
  // Bar tracks net P&L magnitude vs the top leader; negative nets show empty.
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((leader.netPnl_raw / max) * 100))) : 0;
  return (
    <Link
      href={`/leaderboard/${leader.address}`}
      className="group flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3 transition-all hover:border-zinc-700 hover:bg-zinc-900/80 sm:gap-4"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
        {leader.rank}
      </span>

      <div className="w-36 shrink-0 sm:w-44">
        <div className="truncate font-mono text-sm text-zinc-100">{truncateAddress(leader.address)}</div>
        <StrategyChips types={leader.recentStrategyTypes} className="mt-1" />
      </div>

      {/* Proportional winnings bar fills the middle (desktop only). */}
      <div className="hidden flex-1 sm:block">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all group-hover:from-emerald-500 group-hover:to-emerald-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="ml-auto w-28 text-right sm:ml-0 sm:w-32">
        <div className={`font-mono text-sm font-semibold ${pnlClass(leader.netPnl_raw)}`}>{signed(leader.netPnl_raw)}</div>
        <div className="text-xs text-zinc-600">{winPct(leader.winRate)}% win · {leader.settledCount} bets</div>
      </div>

      <svg className="hidden h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3">
      <div className="h-7 w-7 rounded-full bg-zinc-800" />
      <div className="h-4 w-32 rounded bg-zinc-800" />
      <div className="hidden h-2 flex-1 rounded-full bg-zinc-800 sm:block" />
      <div className="ml-auto h-4 w-24 rounded bg-zinc-800 sm:ml-0" />
    </div>
  );
}

function PodiumSkeleton() {
  const heights = ["h-28 sm:order-1", "h-36 sm:order-2", "h-28 sm:order-3"];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      {heights.map((h, i) => (
        <div key={i} className={`animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/40 ${h}`} />
      ))}
    </div>
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
      <div className="flex flex-col gap-5">
        <PodiumSkeleton />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
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
  const podium = data.leaders.slice(0, 3);
  const rest = data.leaders.slice(3);
  const max = data.leaders[0]?.netPnl_raw ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Sparse / empty honesty banner (FR-017) */}
      {data.sparse && (
        <div className="rounded-xl border border-amber-900/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200/90">
          {data.message ?? "Data is still thin on testnet — the leaderboard fills out as more people play."}
        </div>
      )}

      {!hasLeaders && !data.sparse && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          No winners on the board yet. Be the first to land here.
        </div>
      )}

      {hasLeaders && (
        <>
          {/* Podium — top 3 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            {podium.map((l) => (
              <PodiumCard key={l.address} leader={l} />
            ))}
          </div>

          {/* The rest */}
          {rest.length > 0 && (
            <div className="flex flex-col gap-2">
              {rest.map((l) => (
                <LeaderRow key={l.address} leader={l} max={max} />
              ))}
            </div>
          )}

          {/* Honesty note: the indexer only publishes claimed wins, not losses. */}
          <div className="flex items-start gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-4 py-3 text-xs leading-relaxed text-zinc-500">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Win rate and net P&amp;L are computed live from each player&apos;s real on-chain bets that the indexer
              returns (recent activity) — they may not span a player&apos;s entire history.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
