"use client";
// FR-009: plain Vietnamese labels — no option jargon.
import type { ApiStrategy } from "@/hooks/useStrategies.js";
import { formatPrice, formatDusdcNumber, formatCountdown } from "@/lib/format.js";
import { computeBetEconomics } from "@/lib/strategy/sizing.js";
import { useCountdown } from "@/hooks/useCountdown.js";

type StrategyType = ApiStrategy["type"];

interface TypeStyle {
  label: string;
  description: string;
  icon: string;
  /** Tailwind classes for the icon chip + accent. */
  chip: string;
  bar: string;
  ring: string;
}

const TYPE_STYLES: Record<StrategyType, TypeStyle> = {
  binary_up: {
    label: "Đặt giá lên",
    description: "Thắng nếu giá BTC tăng vượt mức dự đoán khi đáo hạn.",
    icon: "↗",
    chip: "bg-emerald-500/15 text-emerald-400",
    bar: "bg-emerald-500",
    ring: "hover:border-emerald-500/40",
  },
  binary_down: {
    label: "Phòng cú sập",
    description: "Thắng nếu giá BTC giảm dưới mức dự đoán — chiến lược phòng thủ.",
    icon: "🛡",
    chip: "bg-amber-500/15 text-amber-400",
    bar: "bg-amber-500",
    ring: "hover:border-amber-500/40",
  },
  range: {
    label: "Đặt giá đứng yên",
    description: "Thắng nếu giá BTC dao động trong biên độ hẹp đến khi đáo hạn.",
    icon: "↔",
    chip: "bg-violet-500/15 text-violet-400",
    bar: "bg-violet-500",
    ring: "hover:border-violet-500/40",
  },
};

/** Map win probability → a plain-language risk label. */
function riskLabel(prob: number): { text: string; color: string } {
  if (prob >= 0.55) return { text: "Khả năng cao", color: "text-emerald-400" };
  if (prob >= 0.3) return { text: "Cân bằng", color: "text-zinc-300" };
  return { text: "Rủi ro cao · thưởng lớn", color: "text-amber-400" };
}

interface StrategyCardProps {
  strategy: ApiStrategy;
  expiryMs: number;
  /** DUSDC the user wants to spend (stake). Scales cost/win/profit on the card. */
  stakeDusdc: number;
  onSelect?: (strategy: ApiStrategy) => void;
  /** Called when user clicks "Vào lệnh" to place the bet */
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
  // (verified on testnet). Scale to the user's stake: spend = stake, win = stake / prob.
  const econ = computeBetEconomics(stakeDusdc, Number(strategy.cost_raw));
  const cost = formatDusdcNumber(econ.stakeRaw);
  const winPayout = formatDusdcNumber(econ.winRaw);
  const profit = `${econ.profitRaw >= 0 ? "+" : ""}${formatDusdcNumber(econ.profitRaw)}`;
  const probPct = Math.round(strategy.prob * 100);
  const multiple = econ.stakeRaw > 0 ? econ.winRaw / econ.stakeRaw : 0;
  const risk = riskLabel(strategy.prob);
  const remaining = useCountdown(expiryMs);
  const isExpired = remaining !== null && remaining <= 0;

  const priceInfo =
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
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-zinc-100">{style.label}</h3>
            <span className={`shrink-0 text-xs font-medium ${risk.color}`}>{risk.text}</span>
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{style.description}</p>
        </div>
      </div>

      {/* Probability bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Khả năng thắng</span>
          <span className="font-mono text-zinc-300">{probPct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${probPct}%` }} />
        </div>
      </div>

      {/* Economics */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-900/60 p-3">
        <div>
          <div className="text-xs text-zinc-500">Bạn chi</div>
          <div className="mt-0.5 font-mono text-sm text-zinc-100">{cost}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Nhận nếu thắng</div>
          <div className="mt-0.5 font-mono text-sm text-emerald-400">{winPayout}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Lãi · hệ số</div>
          <div className="mt-0.5 font-mono text-sm text-emerald-400">
            {profit} <span className="text-zinc-500">·{multiple.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs">
        {priceInfo ? (
          <span className="text-zinc-500">
            Mức giá: <span className="text-zinc-300">{priceInfo}</span>
          </span>
        ) : <span />}
        <span className="flex items-center gap-1.5 text-zinc-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono text-sm text-zinc-300">
            {remaining === null ? "—" : remaining === 0 ? "Đã đóng" : formatCountdown(remaining)}
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
          disabled={isBetting || isExpired}
          className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {isBetting ? "Đang xử lý..." : isExpired ? "Thị trường đã đóng" : "Vào lệnh"}
        </button>
      )}
    </div>
  );
}
