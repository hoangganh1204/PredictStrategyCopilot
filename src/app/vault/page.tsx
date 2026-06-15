"use client";
// Auto-Vault dashboard: deposit once, the keeper rolls the strategy every cycle.
// Read-only data + a pause/resume control (nice for judges/spectators).
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader.js";
import { useVault } from "@/hooks/useVault.js";
import { useCountdown, useNow } from "@/hooks/useCountdown.js";
import { formatCountdown, formatDusdcNumber, formatPrice } from "@/lib/format.js";
import { truncateAddress } from "@/lib/leaderboard/computeLeaderboard.js";
import type { VaultOpenRound, VaultRoundResult, VaultStrategyType } from "@/lib/vault/types.js";

const META: Record<VaultStrategyType, { label: string; icon: string; chip: string; level: string }> = {
  binary_up: { label: "Price up", icon: "↗", chip: "bg-emerald-500/15 text-emerald-400", level: "Wins if above" },
  binary_down: { label: "Crash hedge", icon: "🛡", chip: "bg-amber-500/15 text-amber-400", level: "Wins if below" },
  range: { label: "Stay in range", icon: "↔", chip: "bg-violet-500/15 text-violet-400", level: "Safe zone" },
};

function levelOf(r: Pick<VaultOpenRound, "type" | "strike_raw" | "lower_raw" | "upper_raw">): string {
  return r.type === "range"
    ? `${formatPrice(Number(r.lower_raw))} – ${formatPrice(Number(r.upper_raw))}`
    : formatPrice(Number(r.strike_raw));
}

function timeAgo(now: number, ts: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function Stat({ label, value, valueClass = "text-zinc-100" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="card-surface rounded-2xl border border-zinc-800 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function ExplorerLink({ digest, label }: { digest: string; label: string }) {
  return (
    <a
      href={`https://suiscan.xyz/testnet/tx/${digest}`}
      target="_blank"
      rel="noopener noreferrer"
      title={digest}
      className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label}
    </a>
  );
}

function OpenRoundCard({ round }: { round: VaultOpenRound }) {
  const remaining = useCountdown(round.expiryMs);
  const meta = META[round.type];
  return (
    <section className="card-surface animate-rise rounded-2xl border border-zinc-800 p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${meta.chip}`}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-zinc-100">Current round — {meta.label}</h3>
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">
              Live
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {meta.level}: <span className="font-mono text-zinc-300">{levelOf(round)}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
        <span className="text-zinc-500">
          Stake <span className="font-mono text-zinc-200">{formatDusdcNumber(Number(round.cost_raw))}</span>
          <span className="mx-2 text-zinc-700">·</span>
          Max win <span className="font-mono text-emerald-400">{formatDusdcNumber(Number(round.quantity_raw))}</span>
        </span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono">
            {remaining === null ? "—" : remaining === 0 ? "Settling…" : formatCountdown(remaining)}
          </span>
        </span>
      </div>
      {round.mintDigest && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <ExplorerLink digest={round.mintDigest} label="Verify mint on explorer" />
        </div>
      )}
    </section>
  );
}

function HistoryRow({ r, now }: { r: VaultRoundResult; now: number | null }) {
  const meta = META[r.type];
  const pnl = Number(r.pnl_raw);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-2.5 text-sm">
      <span>{r.won ? "✅" : "❌"}</span>
      <span className="text-zinc-300">{meta.label}</span>
      <span className="hidden font-mono text-xs text-zinc-500 sm:inline">{levelOf(r)}</span>
      <span className="ml-auto font-mono text-xs text-zinc-500">
        closed {formatPrice(Number(r.settlementPrice_raw))}
      </span>
      <span className={`w-28 text-right font-mono ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
        {pnl >= 0 ? "+" : ""}{formatDusdcNumber(pnl)}
      </span>
      <span className="hidden w-20 justify-end sm:flex">
        {r.redeemDigest ? <ExplorerLink digest={r.redeemDigest} label="verify" /> : null}
      </span>
      <span className="hidden w-16 text-right text-xs text-zinc-600 sm:inline">
        {now ? timeAgo(now, r.settledAt) : "—"}
      </span>
    </div>
  );
}

function NotRunning() {
  return (
    <section className="card-surface rounded-2xl border border-zinc-800 p-8 text-center">
      <p className="text-lg font-semibold text-zinc-200">Auto-Vault isn&apos;t running</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
        The vault deposits once, then a keeper bot rolls one strategy automatically: every time a
        market settles it redeems any winnings and re-enters the same strategy on the next market.
      </p>
      <pre className="mx-auto mt-5 w-fit rounded-xl bg-zinc-900 px-5 py-3 text-left font-mono text-xs text-zinc-300">
        KEEPER_KEY=suiprivkey1... npm run keeper
      </pre>
      <p className="mt-3 text-xs text-zinc-600">
        Options: VAULT_STRATEGY=range|binary_up|binary_down · VAULT_STAKE=2 · VAULT_FLOOR=5
      </p>
    </section>
  );
}

export default function VaultPage() {
  const { state, paused, setPaused, balanceRaw, ownerAddress, isLoading } = useVault();
  const now = useNow(5000);
  const [toggling, setToggling] = useState(false);

  async function togglePaused(next: boolean) {
    setToggling(true);
    try {
      await setPaused(next);
    } finally {
      setToggling(false);
    }
  }

  const online = !!state && now !== null && now - state.updatedAt < 90_000;
  const pnl = state?.totals.pnl_raw ?? 0;
  const history = state ? [...state.history].reverse() : [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-6 py-6">
        {/* Title + on/off control */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Auto-Vault</h1>
              {state && (
                <span className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-zinc-600"}`} />
                  {online ? "Keeper online" : `Keeper offline · last seen ${now ? timeAgo(now, state.updatedAt) : "—"}`}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500">
              Deposit once — the keeper redeems each settled round and re-enters the strategy automatically.
            </p>
            {ownerAddress && (
              <p className="text-xs text-zinc-600">
                Shared demo vault · runs on the keeper account{" "}
                <span className="font-mono text-zinc-400">{truncateAddress(ownerAddress)}</span> — independent of the
                wallet you&apos;re connected with.
              </p>
            )}
          </div>

          {state && (
            <button
              onClick={() => togglePaused(!paused)}
              disabled={toggling}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${
                paused
                  ? "btn-primary text-white"
                  : "border border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/60"
              }`}
            >
              {paused ? "▶ Resume auto-betting" : "⏸ Pause auto-betting"}
            </button>
          )}
        </div>

        {/* Paused banner (user toggled off) */}
        {state && paused && (
          <div className="rounded-xl border border-amber-900/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200/90">
            ⏸ Auto-betting is off. The keeper settles any open round but won&apos;t enter new ones until you resume.
          </div>
        )}

        {/* Keeper-reported issue (e.g. out of SUI gas / below floor) — self-explains why it stalled */}
        {state && !paused && state.pausedReason && (
          <div className="rounded-xl border border-red-900/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            ⚠️ Auto-trade stalled: {state.pausedReason}
          </div>
        )}

        {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-zinc-900" />}

        {!isLoading && !state && <NotRunning />}

        {state && (
          <>
            {/* Stats — full-width bar */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Vault balance" value={balanceRaw !== null ? formatDusdcNumber(balanceRaw) : "—"} />
              <Stat
                label="Strategy"
                value={`${META[state.config.strategy].icon} ${META[state.config.strategy].label}`}
              />
              <Stat label="Record" value={`${state.totals.wins}W – ${state.totals.losses}L`} />
              <Stat
                label="Net P&L"
                value={`${pnl >= 0 ? "+" : ""}${formatDusdcNumber(pnl)}`}
                valueClass={pnl >= 0 ? "text-emerald-400" : "text-red-400"}
              />
            </div>

            {/* Current round (left) + history (right) */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="flex flex-col gap-4 lg:col-span-1 lg:sticky lg:top-20 lg:self-start">
                {state.openRound ? (
                  <OpenRoundCard round={state.openRound} />
                ) : (
                  <section className="card-surface rounded-2xl border border-zinc-800 p-5 text-sm text-zinc-400">
                    {state.pausedReason
                      ? `⏸ Paused — ${state.pausedReason}`
                      : online
                      ? "Between rounds — the keeper is picking the next market…"
                      : "No open round."}
                  </section>
                )}

                {/* Custody disclaimer — be honest about the trust model */}
                <div className="rounded-xl border border-amber-900/40 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200/80">
                  Custodial demo: a keeper bot signs the vault&apos;s transactions. Trustless
                  delegation isn&apos;t supported by the protocol yet (mint is owner-gated).
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:col-span-2">
                <h2 className="px-1 text-sm font-semibold text-zinc-200">
                  Round history{history.length > 0 && ` (${history.length})`}
                </h2>
                {history.length === 0 ? (
                  <p className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
                    No settled rounds yet — the first one completes when the current market expires.
                  </p>
                ) : (
                  history.map((r, i) => <HistoryRow key={`${r.oracleId}-${r.settledAt}-${i}`} r={r} now={now} />)
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
