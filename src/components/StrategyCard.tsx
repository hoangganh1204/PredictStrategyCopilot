"use client";
// FR-009: plain-language labels — no options jargon.
import type { ApiStrategy } from "@/hooks/useStrategies.js";
import { formatPrice, formatDusdcNumber, formatCountdown } from "@/lib/format.js";
import { computeBetEconomics } from "@/lib/strategy/sizing.js";
import { useCountdown } from "@/hooks/useCountdown.js";

type StrategyType = ApiStrategy["type"];

interface TypeStyle {
  label: string;
  description: string;
  icon: string;
  /** Label for the prominent price/level box. */
  levelTitle: string;
  /** Tailwind classes for the icon chip + hover accent. */
  chip: string;
  ring: string;
}

const TYPE_STYLES: Record<StrategyType, TypeStyle> = {
  binary_up: {
    label: "Price up",
    description: "Win if BTC rises above the predicted level at expiry.",
    icon: "↗",
    levelTitle: "Wins if above",
    chip: "bg-emerald-500/15 text-emerald-400",
    ring: "hover:border-emerald-500/40",
  },
  binary_down: {
    label: "Crash hedge",
    description: "Win if BTC falls below the predicted level — a defensive play.",
    icon: "🛡",
    levelTitle: "Wins if below",
    chip: "bg-amber-500/15 text-amber-400",
    ring: "hover:border-amber-500/40",
  },
  range: {
    label: "Stay in range",
    description: "Win if BTC stays within a narrow band until expiry.",
    icon: "↔",
    levelTitle: "Safe zone",
    chip: "bg-violet-500/15 text-violet-400",
    ring: "hover:border-violet-500/40",
  },
};

/** One metric row: label on the left, value (mono) on the right — never wraps. */
function StatRow({
  label,
  value,
  valueClass,
  unit,
  extra,
}: {
  label: string;
  value: string;
  valueClass: string;
  unit: boolean;
  extra?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">
        {label}
        {extra && <span className="text-zinc-600"> {extra}</span>}
      </span>
      <span className={`whitespace-nowrap font-mono ${valueClass}`}>
        {value}
        {unit && <span className="text-zinc-500"> DUSDC</span>}
      </span>
    </div>
  );
}

interface StrategyCardProps {
  strategy: ApiStrategy;
  expiryMs: number;
  /** DUSDC the user wants to spend (stake). Scales cost/win/profit on the card. */
  stakeDusdc: number;
  onSelect?: (strategy: ApiStrategy) => void;
  /** Called when the user clicks "Place bet" to submit the bet */
  onBet?: (strategy: ApiStrategy) => void;
  isSelected?: boolean;
  isBetting?: boolean;
}

export function StrategyCard({
  strategy,
  expiryMs,
  stakeDusdc,
  onSelect,
  onBet,
  isSelected,
  isBetting,
}: StrategyCardProps) {
  const style = TYPE_STYLES[strategy.type];
  // cost_raw is the cost to mint 1 token; each token redeems 1 DUSDC on win
  // (verified on testnet). Scale to the user's stake: spend = stake, win = stake / cost.
  const hasStake = stakeDusdc > 0;
  const econ = computeBetEconomics(stakeDusdc, Number(strategy.cost_raw));
  // Number only (unit rendered separately and muted, so it never wraps awkwardly).
  const num = (raw: number) => formatDusdcNumber(raw).replace(" DUSDC", "");
  const cost = hasStake ? num(econ.stakeRaw) : "—";
  const winPayout = hasStake ? num(econ.winRaw) : "—";
  const profit = hasStake ? `${econ.profitRaw >= 0 ? "+" : ""}${num(econ.profitRaw)}` : "—";
  const multiple = econ.stakeRaw > 0 ? econ.winRaw / econ.stakeRaw : 0;
  const remaining = useCountdown(expiryMs);
  const isExpired = remaining !== null && remaining <= 0;

  // The price/level genuinely moves with the market — this is the headline number.
  const levelValue =
    strategy.type === "range" && strategy.lowerStrike_raw && strategy.upperStrike_raw
      ? `${formatPrice(Number(strategy.lowerStrike_raw))} – ${formatPrice(Number(strategy.upperStrike_raw))}`
      : strategy.strike_raw
      ? formatPrice(Number(strategy.strike_raw))
      : null;

  return (
    <div
      onClick={() => onSelect?.(strategy)}
      className={`card-surface animate-rise flex flex-col gap-4 rounded-2xl border p-5 transition-all ${
        onSelect ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "border-blue-500 ring-1 ring-blue-500/40"
          : `border-zinc-800 ${style.ring}`
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${style.chip}`}>
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-zinc-100">{style.label}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{style.description}</p>
        </div>
      </div>

      {/* Price level — the headline number that moves with the market */}
      {levelValue && (
        <div className="flex items-center justify-between rounded-xl bg-zinc-900/60 px-3.5 py-3">
          <span className="text-xs text-zinc-500">{style.levelTitle}</span>
          <span className="font-mono text-base font-semibold text-zinc-100">{levelValue}</span>
        </div>
      )}

      {/* Economics — vertical rows so the value + unit never wrap */}
      <div className="flex flex-col gap-2.5 rounded-xl bg-zinc-900/60 p-3.5 text-sm">
        <StatRow label="You pay" value={cost} valueClass="text-zinc-100" unit={hasStake} />
        <StatRow label="Max win" value={winPayout} valueClass="text-emerald-400" unit={hasStake} />
        <StatRow
          label="Profit"
          value={profit}
          valueClass="text-emerald-400"
          unit={hasStake}
          extra={hasStake ? `· ${multiple.toFixed(1)}x` : undefined}
        />
      </div>

      {/* Meta: time left */}
      <div className="flex items-center justify-end text-xs">
        <span className="flex items-center gap-1.5 text-zinc-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono text-sm text-zinc-300">
            {remaining === null ? "—" : remaining === 0 ? "Closed" : formatCountdown(remaining)}
          </span>
        </span>
      </div>

      {/* Bet button — FR-006 pre-validation */}
      {onBet && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBet(strategy);
          }}
          disabled={isBetting || isExpired || !hasStake}
          className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {isBetting
            ? "Processing..."
            : isExpired
            ? "Market closed"
            : !hasStake
            ? "Enter an amount"
            : "Place bet"}
        </button>
      )}
    </div>
  );
}
