"use client";
// FR-009: plain Vietnamese labels — no option jargon.
import { useEffect, useState } from "react";
import type { ApiStrategy } from "@/hooks/useStrategies.js";

const DUSDC_SCALE = 1_000_000;
const PRICE_SCALE = 1_000_000_000;

const LABELS: Record<ApiStrategy["type"], string> = {
  range: "Đặt giá đứng yên",
  binary_up: "Đặt giá lên",
  binary_down: "Phòng cú sập",
};

const DESCRIPTIONS: Record<ApiStrategy["type"], string> = {
  range: "Thắng nếu giá BTC dao động trong biên độ hẹp đến khi đáo hạn",
  binary_up: "Thắng nếu giá BTC đóng cửa trên mức dự đoán khi đáo hạn",
  binary_down: "Thắng nếu giá BTC đóng cửa dưới mức dự đoán khi đáo hạn — chiến lược phòng thủ",
};

function formatDusdc(raw: string): string {
  return (Number(raw) / DUSDC_SCALE).toFixed(2);
}

function formatPrice(raw: string): string {
  return `$${(Number(raw) / PRICE_SCALE).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Countdown({ expiryMs }: { expiryMs: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiryMs - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, expiryMs - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const label = h > 0
    ? `${h}g ${String(m).padStart(2, "0")}p`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return <span className="font-mono text-sm text-zinc-400">{label}</span>;
}

interface StrategyCardProps {
  strategy: ApiStrategy;
  expiryMs: number;
  onSelect?: (strategy: ApiStrategy) => void;
  /** Called when user clicks "Vào lệnh" to place the bet */
  onBet?: (strategy: ApiStrategy) => void;
  isSelected?: boolean;
  isBetting?: boolean;
}

export function StrategyCard({
  strategy,
  expiryMs,
  onSelect,
  onBet,
  isSelected,
  isBetting,
}: StrategyCardProps) {
  const label = LABELS[strategy.type];
  const description = DESCRIPTIONS[strategy.type];
  const cost = formatDusdc(strategy.cost_raw);
  const payout = formatDusdc(strategy.payout_raw);
  const probPct = (strategy.prob * 100).toFixed(0);
  const isExpired = expiryMs <= Date.now();

  const priceInfo =
    strategy.type === "range" && strategy.lowerStrike_raw && strategy.upperStrike_raw
      ? `${formatPrice(strategy.lowerStrike_raw)} – ${formatPrice(strategy.upperStrike_raw)}`
      : strategy.strike_raw
      ? formatPrice(strategy.strike_raw)
      : null;

  return (
    <div
      onClick={() => onSelect?.(strategy)}
      className={`flex flex-col gap-3 rounded-2xl border p-5 transition-all ${
        onSelect ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "border-blue-500 bg-blue-500/10"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100">{label}</h3>
          <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{description}</p>
        </div>
        <span className="ml-3 shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {probPct}%
        </span>
      </div>

      {priceInfo && (
        <div className="text-xs text-zinc-500">Mức giá: {priceInfo}</div>
      )}

      <div className="flex items-end justify-between border-t border-zinc-800 pt-3">
        <div className="flex gap-4">
          <div>
            <div className="text-xs text-zinc-500">Chi phí</div>
            <div className="font-mono text-sm text-zinc-200">{cost} DUSDC</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Thưởng nếu thắng</div>
            <div className="font-mono text-sm text-green-400">{payout} DUSDC</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Còn lại</div>
          <Countdown expiryMs={expiryMs} />
        </div>
      </div>

      {/* T045: "Vào lệnh" bet button — FR-006 pre-validation */}
      {onBet && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // don't trigger card selection
            onBet(strategy);
          }}
          disabled={isBetting || isExpired}
          className="mt-1 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isBetting ? "Đang xử lý..." : isExpired ? "Thị trường đã đóng" : "Vào lệnh"}
        </button>
      )}
    </div>
  );
}
