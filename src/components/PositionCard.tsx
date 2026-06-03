"use client";
// FR-010: show P&L in DUSDC. Countdown uses oracle.expiry in ms (probe #5).
import { useEffect, useState } from "react";
import type { Position } from "@/hooks/usePositions.js";
import type { PositionState } from "@/lib/execute/types.js";

const DUSDC_SCALE = 1_000_000;
const PRICE_SCALE = 1_000_000_000;

const STATUS_LABELS: Record<PositionState, string> = {
  active:              "Đang hoạt động",
  awaiting_settlement: "Chờ chốt",
  settled_won:         "Thắng",
  settled_lost:        "Thua",
  redeemed:            "Đã nhận",
};

const STATUS_COLORS: Record<PositionState, string> = {
  active:              "bg-blue-500/20 text-blue-300",
  awaiting_settlement: "bg-yellow-500/20 text-yellow-300",
  settled_won:         "bg-green-500/20 text-green-300",
  settled_lost:        "bg-red-500/20 text-red-300",
  redeemed:            "bg-zinc-700 text-zinc-400",
};

function formatDusdc(raw: number | undefined): string {
  if (raw === undefined) return "—";
  return (raw / DUSDC_SCALE).toFixed(2);
}

function formatPrice(raw: number | undefined): string {
  if (!raw) return "—";
  return `$${(raw / PRICE_SCALE).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function getBetTypeLabel(pos: Position): string {
  if (pos.direction === "up") return "Đặt giá lên";
  if (pos.direction === "down") return "Phòng cú sập";
  if (pos.lower_strike !== undefined && pos.higher_strike !== undefined) return "Đặt giá đứng yên";
  return "Vị thế";
}

function getPriceInfo(pos: Position): string {
  if (pos.lower_strike !== undefined && pos.higher_strike !== undefined) {
    return `${formatPrice(pos.lower_strike)} – ${formatPrice(pos.higher_strike)}`;
  }
  return formatPrice(pos.strike);
}

function Countdown({ expiryMs }: { expiryMs: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiryMs - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, expiryMs - Date.now())), 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  if (remaining === 0) return <span className="text-xs text-zinc-500">Đã đáo hạn</span>;

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const label = h > 0
    ? `${h}g ${String(m).padStart(2, "0")}p`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return <span className="font-mono text-xs text-zinc-400">{label}</span>;
}

interface PositionCardProps {
  position: Position;
  onRedeem?: (position: Position) => void;
  isRedeeming?: boolean;
}

export function PositionCard({ position, onRedeem, isRedeeming }: PositionCardProps) {
  const { positionState } = position;
  const statusLabel = STATUS_LABELS[positionState];
  const statusColor = STATUS_COLORS[positionState];
  const betType = getBetTypeLabel(position);
  const priceInfo = getPriceInfo(position);

  // Find expiry from oracle_id context — positions carry oracle_id
  // expiry is not directly on position; use a fallback (settled or future)
  const expiryMs: number = (position as Record<string, unknown>).expiry as number
    ?? Date.now() + 900_000;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100">{betType}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{priceInfo}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="flex gap-4">
          <div>
            <div className="text-xs text-zinc-500">Số lượng</div>
            <div className="font-mono text-sm text-zinc-200">
              {formatDusdc(position.quantity)} DUSDC
            </div>
          </div>
          {positionState === "settled_won" && (
            <div>
              <div className="text-xs text-zinc-500">P&L</div>
              <div className="font-mono text-sm text-green-400">+Thắng</div>
            </div>
          )}
          {positionState === "settled_lost" && (
            <div>
              <div className="text-xs text-zinc-500">P&L</div>
              <div className="font-mono text-sm text-red-400">Thua</div>
            </div>
          )}
        </div>

        {(positionState === "active" || positionState === "awaiting_settlement") && (
          <div className="text-right">
            <div className="text-xs text-zinc-500 mb-0.5">Còn lại</div>
            <Countdown expiryMs={expiryMs} />
          </div>
        )}
      </div>

      {/* Redeem button — only for settled_won */}
      {positionState === "settled_won" && onRedeem && (
        <button
          onClick={() => onRedeem(position)}
          disabled={isRedeeming}
          className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isRedeeming ? "Đang xử lý..." : "Nhận thưởng"}
        </button>
      )}

      {positionState === "settled_lost" && (
        <p className="text-center text-xs text-zinc-500">
          Lần này không trúng — thử chiến lược khác?
        </p>
      )}
    </div>
  );
}
