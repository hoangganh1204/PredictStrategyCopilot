"use client";
// FR-006a: validate amount > 0 and ≤ game account balance before enabling fetch.
import { formatDuration } from "@/lib/format.js";
import { useNow } from "@/hooks/useCountdown.js";
import type { Market } from "@/hooks/useMarkets.js";

const QUICK_FRACTIONS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "Max", value: 1 },
];

interface AmountInputProps {
  amount: string;
  maxBalance: number;
  markets: Market[];
  marketsLoading: boolean;
  selectedOracleId: string | null;
  onAmountChange: (v: string) => void;
  onSelectMarket: (oracleId: string) => void;
}

export function AmountInput({
  amount,
  maxBalance,
  markets,
  marketsLoading,
  selectedOracleId,
  onAmountChange,
  onSelectMarket,
}: AmountInputProps) {
  const now = useNow(30_000);
  const amountNum = parseFloat(amount);
  const tooHigh = !isNaN(amountNum) && amountNum > maxBalance;
  const tooLow = !isNaN(amountNum) && amountNum <= 0;

  function setFraction(frac: number) {
    const v = maxBalance * frac;
    onAmountChange(String(Math.floor(v * 100) / 100));
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      {/* Amount */}
      <div className="flex flex-col gap-2 lg:w-80 lg:shrink-0">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-300">Amount to spend</label>
          <span className="text-xs text-zinc-500">
            Available: <span className="font-mono text-zinc-300">{maxBalance.toFixed(2)}</span> DUSDC
          </span>
        </div>

        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 pr-20 text-lg font-mono text-zinc-100 placeholder-zinc-600 transition-colors focus:border-blue-500 focus:outline-none"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
            DUSDC
          </span>
        </div>

        {/* Quick fractions */}
        <div className="flex gap-2">
          {QUICK_FRACTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setFraction(q.value)}
              disabled={maxBalance <= 0}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>

        {tooHigh && (
          <p className="text-xs text-red-400">Amount exceeds your game account balance</p>
        )}
        {tooLow && amount !== "" && (
          <p className="text-xs text-red-400">Amount must be greater than 0</p>
        )}
      </div>

      {/* Market (real expiries) */}
      <div className="flex flex-col gap-2 lg:flex-1">
        <label className="text-sm font-medium text-zinc-300">Expiry (open markets)</label>
        {marketsLoading ? (
          <div className="h-10 animate-pulse rounded-xl bg-zinc-800" />
        ) : markets.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-xs text-zinc-500">
            No markets are open right now. Please try again later.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {markets.map((m) => {
              const active = m.oracleId === selectedOracleId;
              const label = now !== null ? formatDuration(m.expiryMs - now) : "…";
              return (
                <button
                  key={m.oracleId}
                  onClick={() => onSelectMarket(m.oracleId)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-700 text-zinc-100 ring-1 ring-zinc-600"
                      : "bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
