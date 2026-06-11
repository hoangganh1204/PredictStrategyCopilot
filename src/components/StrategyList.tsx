"use client";
// Constitution III: loading skeleton appears only after 300ms.
import { useEffect, useState } from "react";
import type { ApiStrategy, MarketPulse, StrategiesResult } from "@/hooks/useStrategies.js";
import { volLevel, VOL_META } from "@/lib/strategy/volLevel.js";
import { formatPrice } from "@/lib/format.js";
import { StrategyCard } from "./StrategyCard.js";

/** Real settlement closes of the last few settled markets — shows live history. */
function RecentCloses({ asset, closes }: { asset: string; closes: number[] }) {
  if (closes.length < 2) return null;
  const netUp = closes[closes.length - 1] >= closes[0];
  const changePct = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-2 text-xs">
      <span className="text-zinc-500">Recent {asset} closes</span>
      <span className="flex items-center gap-1.5 font-mono text-zinc-400">
        {closes.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className={closes[i] >= closes[i - 1] ? "text-emerald-500" : "text-red-500"}>
                {closes[i] >= closes[i - 1] ? "↑" : "↓"}
              </span>
            )}
            <span className={i === closes.length - 1 ? "text-zinc-200" : ""}>{formatPrice(c)}</span>
          </span>
        ))}
      </span>
      <span className={`ml-auto font-mono ${netUp ? "text-emerald-400" : "text-red-400"}`}>
        {changePct >= 0 ? "+" : ""}
        {changePct.toFixed(2)}%
      </span>
    </div>
  );
}

const PULSE_META: Record<
  MarketPulse["level"],
  { icon: string; text: string; title: string; note: string }
> = {
  elevated: {
    icon: "⚡",
    text: "text-amber-400",
    title: "Volatility running high",
    note: "Market is nervous — wider ranges, pricier crash hedges",
  },
  subdued: {
    icon: "🟢",
    text: "text-emerald-400",
    title: "Volatility below normal",
    note: "Calmer than usual — tighter ranges, cheaper bets",
  },
  steady: {
    icon: "〰️",
    text: "text-zinc-300",
    title: "Volatility steady",
    note: "In line with its recent average",
  },
};

/** Market Pulse: current vol vs its recent norm. Falls back to absolute level. */
function MarketPulseBanner({ impliedVol, pulse }: { impliedVol: number; pulse?: MarketPulse | null }) {
  const volPct = `${Math.round(impliedVol * 100)}%`;

  if (!pulse) {
    const meta = VOL_META[volLevel(impliedVol)];
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <span className="text-sm text-zinc-300">
          Market volatility: <span className={`font-medium ${meta.text}`}>{meta.label}</span>
        </span>
        <span className="ml-auto text-xs text-zinc-500">{meta.note}</span>
      </div>
    );
  }

  const meta = PULSE_META[pulse.level];
  const sign = pulse.deltaPct >= 0 ? "+" : "";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <span className="text-lg leading-none">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${meta.text}`}>{meta.title}</div>
        <div className="text-xs text-zinc-500">{meta.note}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-zinc-200">
          {volPct}
          <span className="text-zinc-600">/yr</span>
        </div>
        <div className="text-xs text-zinc-500">
          {sign}
          {pulse.deltaPct.toFixed(0)}% vs avg
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 animate-pulse">
      <div className="h-4 w-32 rounded bg-zinc-700" />
      <div className="h-3 w-full rounded bg-zinc-800" />
      <div className="h-3 w-2/3 rounded bg-zinc-800" />
      <div className="flex gap-4 pt-3 border-t border-zinc-800">
        <div className="h-8 w-20 rounded bg-zinc-700" />
        <div className="h-8 w-24 rounded bg-zinc-700" />
      </div>
    </div>
  );
}

interface StrategyListProps {
  isLoading: boolean;
  data: StrategiesResult | undefined;
  /** Underlying asset for plain-language copy (e.g. "BTC"). */
  asset: string;
  /** DUSDC the user wants to spend — scales each card's cost/win/profit. */
  stakeDusdc: number;
  onSelect?: (strategy: ApiStrategy) => void;
  onBet?: (strategy: ApiStrategy) => void;
  isBetting?: boolean;
  selectedType?: ApiStrategy["type"] | null;
}

export function StrategyList({ isLoading, data, asset, stakeDusdc, onSelect, onBet, isBetting, selectedType }: StrategyListProps) {
  // Delay skeleton to 300ms to avoid flash on fast connections (Constitution III)
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const id = setTimeout(() => setShowSkeleton(true), 300);
    // Reset on cleanup (runs when loading ends or component unmounts).
    return () => {
      clearTimeout(id);
      setShowSkeleton(false);
    };
  }, [isLoading]);

  if (isLoading) {
    if (!showSkeleton) return null;
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!data) return null;

  if (!data.ok) {
    if (data.code === "ERR_NO_MARKET") {
      return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-400">
          No market is open for this timeframe.
          <br />
          <span className="text-sm text-zinc-500">Try picking a different expiry.</span>
        </div>
      );
    }
    if (data.code === "ERR_STALE_SVI") {
      return (
        <div className="rounded-2xl border border-yellow-900/50 bg-yellow-500/10 p-4 text-sm text-yellow-400">
          ⚠️ Volatility data is stale. Please try again in a few seconds.
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-500/10 p-4 text-sm text-red-400">
        Could not load strategies: {data.message}
      </div>
    );
  }

  const { strategies, expiry, impliedVol, pulse, recentCloses } = data;

  return (
    <div className="flex flex-col gap-3">
      <MarketPulseBanner impliedVol={impliedVol} pulse={pulse} />
      {recentCloses && <RecentCloses asset={asset} closes={recentCloses} />}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
        {strategies.map((s: ApiStrategy) => (
          <StrategyCard
            key={`${s.type}-${s.strike_raw ?? s.lowerStrike_raw}`}
            strategy={s}
            expiryMs={expiry}
            asset={asset}
            stakeDusdc={stakeDusdc}
            onSelect={onSelect}
            onBet={onBet}
            isBetting={isBetting}
            isSelected={selectedType === s.type}
          />
        ))}
      </div>
    </div>
  );
}
