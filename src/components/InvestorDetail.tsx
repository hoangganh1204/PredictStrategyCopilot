"use client";
// T073 — Investor drill-down: strategy breakdown + recent settled trades.
// Plain-language labels only, no protocol jargon (FR-023).
import { formatDusdcNumber } from "@/lib/format.js";
import { truncateAddress } from "@/lib/leaderboard/computeLeaderboard.js";
import { STRATEGY_LABELS } from "@/lib/leaderboard/investorDetail.js";
import type { InvestorDetail as InvestorDetailData, StrategyType } from "@/lib/leaderboard/types.js";

const STRATEGY_META: Record<StrategyType, { icon: string; chip: string }> = {
  binary_up: { icon: "↗", chip: "bg-emerald-500/15 text-emerald-400" },
  binary_down: { icon: "🛡", chip: "bg-amber-500/15 text-amber-400" },
  range: { icon: "↔", chip: "bg-violet-500/15 text-violet-400" },
};

function pnlClass(raw: number): string {
  return raw > 0 ? "text-emerald-400" : raw < 0 ? "text-red-400" : "text-zinc-400";
}

function signed(raw: number): string {
  return `${raw > 0 ? "+" : ""}${formatDusdcNumber(raw)}`;
}

export function InvestorDetailView({ detail }: { detail: InvestorDetailData }) {
  const totalSettled = detail.strategyBreakdown.reduce((s, b) => s + b.count, 0);
  const netTotal = detail.strategyBreakdown.reduce((s, b) => s + b.netPnl_raw, 0);
  const maxCount = Math.max(1, ...detail.strategyBreakdown.map((b) => b.count));

  return (
    <div className="flex flex-col gap-5">
      {/* Header card */}
      <section className="card-surface rounded-2xl border border-zinc-800 p-5">
        <div className="text-xs text-zinc-500">Investor</div>
        <div className="mt-1 font-mono text-lg font-semibold text-zinc-100">
          {truncateAddress(detail.address)}
        </div>
        <div className="mt-4 flex flex-wrap gap-6 border-t border-zinc-800 pt-4">
          <div>
            <div className="text-xs text-zinc-500">Wins shown</div>
            <div className="mt-0.5 font-mono text-lg text-zinc-100">{totalSettled}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Winnings claimed</div>
            <div className={`mt-0.5 font-mono text-lg font-semibold ${pnlClass(netTotal)}`}>{signed(netTotal)}</div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Based on bets this investor has claimed on-chain. Losing bets aren&apos;t published by the data
          source, so this reflects claimed wins — not a full win/loss record.
        </p>
      </section>

      {/* Strategy breakdown */}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-zinc-200">By strategy</h2>
        {detail.strategyBreakdown.length === 0 ? (
          <p className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
            No settled bets yet.
          </p>
        ) : (
          detail.strategyBreakdown.map((b) => {
            const meta = STRATEGY_META[b.type];
            return (
              <div
                key={b.type}
                className="flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${meta.chip}`}>
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-200">{STRATEGY_LABELS[b.type]}</span>
                    <span className="text-xs text-zinc-500">{b.count} bets</span>
                  </div>
                  {/* Count bar */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-600"
                      style={{ width: `${(b.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
                <span className={`w-28 text-right font-mono text-sm font-semibold ${pnlClass(b.netPnl_raw)}`}>
                  {signed(b.netPnl_raw)}
                </span>
              </div>
            );
          })
        )}
      </section>

      {/* Recent trades */}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-zinc-200">
          Recent results{detail.recentTrades.length > 0 && ` (${detail.recentTrades.length})`}
        </h2>
        {detail.recentTrades.length === 0 ? (
          <p className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
            No settled results yet.
          </p>
        ) : (
          detail.recentTrades.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-2.5 text-sm"
            >
              <span>{t.outcome === "won" ? "✅" : "❌"}</span>
              <span className="text-zinc-300">{t.label}</span>
              <span className="ml-auto text-xs uppercase tracking-wide text-zinc-600">
                {t.outcome === "won" ? "Won" : "Lost"}
              </span>
              <span className={`w-28 text-right font-mono ${pnlClass(t.pnl_raw)}`}>{signed(t.pnl_raw)}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
