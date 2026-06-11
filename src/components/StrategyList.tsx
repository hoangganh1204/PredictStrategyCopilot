"use client";
// Constitution III: loading skeleton appears only after 300ms.
import { useEffect, useState } from "react";
import type { ApiStrategy, StrategiesResult } from "@/hooks/useStrategies.js";
import { volLevel, VOL_META } from "@/lib/strategy/volLevel.js";
import { StrategyCard } from "./StrategyCard.js";

function VolatilityBanner({ impliedVol }: { impliedVol: number }) {
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
  /** DUSDC the user wants to spend — scales each card's cost/win/profit. */
  stakeDusdc: number;
  onSelect?: (strategy: ApiStrategy) => void;
  onBet?: (strategy: ApiStrategy) => void;
  isBetting?: boolean;
  selectedType?: ApiStrategy["type"] | null;
}

export function StrategyList({ isLoading, data, stakeDusdc, onSelect, onBet, isBetting, selectedType }: StrategyListProps) {
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

  const { strategies, expiry, impliedVol } = data;

  return (
    <div className="flex flex-col gap-3">
      <VolatilityBanner impliedVol={impliedVol} />
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
        {strategies.map((s: ApiStrategy) => (
          <StrategyCard
            key={`${s.type}-${s.strike_raw ?? s.lowerStrike_raw}`}
            strategy={s}
            expiryMs={expiry}
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
