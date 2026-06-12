"use client";
// FR-010: show P&L in DUSDC. Countdown uses oracle.expiry in ms (probe #5).
import type { Position } from "@/hooks/usePositions.js";
import type { PositionState } from "@/lib/execute/types.js";
import { formatDusdcNumber, formatPrice, formatCountdown } from "@/lib/format.js";
import { useCountdown } from "@/hooks/useCountdown.js";

const STATUS_LABELS: Record<PositionState, string> = {
  active:              "Active",
  awaiting_settlement: "Awaiting settlement",
  settled_won:         "Won",
  settled_lost:        "Lost",
  redeemed:            "Claimed",
};

const STATUS_COLORS: Record<PositionState, string> = {
  active:              "bg-blue-500/20 text-blue-300",
  awaiting_settlement: "bg-yellow-500/20 text-yellow-300",
  settled_won:         "bg-green-500/20 text-green-300",
  settled_lost:        "bg-red-500/20 text-red-300",
  redeemed:            "bg-zinc-700 text-zinc-400",
};


function getBetTypeStyle(pos: Position): { label: string; icon: string; chip: string } {
  if (pos.direction === "up")
    return { label: "Price up", icon: "↗", chip: "bg-emerald-500/15 text-emerald-400" };
  if (pos.direction === "down")
    return { label: "Crash hedge", icon: "🛡", chip: "bg-amber-500/15 text-amber-400" };
  if (pos.lower_strike !== undefined && pos.higher_strike !== undefined)
    return { label: "Stay in range", icon: "↔", chip: "bg-violet-500/15 text-violet-400" };
  return { label: "Position", icon: "•", chip: "bg-zinc-700 text-zinc-300" };
}

function getPriceInfo(pos: Position): string {
  if (pos.lower_strike !== undefined && pos.higher_strike !== undefined) {
    return `${formatPrice(pos.lower_strike)} – ${formatPrice(pos.higher_strike)}`;
  }
  return formatPrice(pos.strike);
}

function Countdown({ expiryMs }: { expiryMs: number }) {
  const remaining = useCountdown(expiryMs);
  if (remaining === null) return <span className="text-xs text-zinc-500">—</span>;
  if (remaining === 0) return <span className="text-xs text-zinc-500">Expired</span>;
  return <span className="font-mono text-xs text-zinc-400">{formatCountdown(remaining)}</span>;
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
  const betType = getBetTypeStyle(position);
  const priceInfo = getPriceInfo(position);

  const expiryMs = position.expiry;
  const isWin = positionState === "settled_won" || positionState === "redeemed";
  const isSettled = isWin || positionState === "settled_lost";

  // Viral loop: open an X (Twitter) intent pre-filled with the result + app link.
  function handleShare() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = isWin
      ? `🎉 Just won ${formatDusdcNumber(position.realized_pnl)} with "${betType.label}" on DeepBook Predict!`
      : `I'm predicting ${position.underlying_asset} prices with Predict Copilot on DeepBook Predict 📈`;
    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(origin)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="card-surface animate-rise flex flex-col gap-3 rounded-2xl border border-zinc-800 p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${betType.chip}`}>
          {betType.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-zinc-100">{betType.label}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            <span className="text-zinc-400">{position.underlying_asset}</span> · {priceInfo}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="flex gap-4">
          <div>
            <div className="text-xs text-zinc-500">Quantity</div>
            <div className="font-mono text-sm text-zinc-200">
              {formatDusdcNumber(position.open_quantity)}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Cost</div>
            <div className="font-mono text-sm text-zinc-200">
              {formatDusdcNumber(position.total_cost)}
            </div>
          </div>
          {(positionState === "active" || positionState === "awaiting_settlement") && (
            <div>
              <div className="text-xs text-zinc-500">P&L</div>
              <div className={`font-mono text-sm ${position.unrealized_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {position.unrealized_pnl >= 0 ? "+" : ""}{formatDusdcNumber(position.unrealized_pnl)}
              </div>
            </div>
          )}
          {positionState === "settled_won" && (
            <div>
              <div className="text-xs text-zinc-500">P&L</div>
              <div className="font-mono text-sm text-green-400">
                +{formatDusdcNumber(position.realized_pnl)}
              </div>
            </div>
          )}
          {positionState === "settled_lost" && (
            <div>
              <div className="text-xs text-zinc-500">P&L</div>
              <div className="font-mono text-sm text-red-400">
                {formatDusdcNumber(position.realized_pnl)}
              </div>
            </div>
          )}
        </div>

        {(positionState === "active" || positionState === "awaiting_settlement") && (
          <div className="text-right">
            <div className="text-xs text-zinc-500 mb-0.5">Time left</div>
            <Countdown expiryMs={expiryMs} />
          </div>
        )}
      </div>

      {/* Redeem button — only for settled_won */}
      {positionState === "settled_won" && onRedeem && (
        <button
          onClick={() => onRedeem(position)}
          disabled={isRedeeming}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-500 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {isRedeeming ? "Processing..." : "🎉 Claim winnings"}
        </button>
      )}

      {positionState === "settled_lost" && (
        <p className="text-center text-xs text-zinc-500">
          Not a win this time — try another strategy?
        </p>
      )}

      {/* Share to X — viral loop after any settled outcome */}
      {isSettled && (
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </button>
      )}

      {/* On-chain proof — link the mint tx on the explorer */}
      {position.mintDigest && (
        <a
          href={`https://suiscan.xyz/testnet/tx/${position.mintDigest}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          title={position.mintDigest}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Verify on explorer · {position.mintDigest.slice(0, 8)}…
        </a>
      )}
    </div>
  );
}
