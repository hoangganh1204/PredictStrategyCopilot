"use client";
import { useState } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { usePositions, POSITIONS_KEY } from "@/hooks/usePositions.js";
import { useManagerBalance, MANAGER_BALANCE_KEY } from "@/hooks/useManagerBalance.js";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { buildRedeemTx } from "@/lib/execute/buildRedeemTx.js";
import { BalanceDisplay } from "@/components/BalanceDisplay.js";
import { ConnectButton } from "@/components/ConnectButton.js";
import { PositionList } from "@/components/PositionList.js";
import { TxStatusOverlay } from "@/components/TxStatusOverlay.js";
import type { Position } from "@/hooks/usePositions.js";
import type { TxResult } from "@/lib/execute/types.js";

export default function PositionsPage() {
  const account = useCurrentAccount();
  const { data: balance } = useManagerBalance();
  const { data: positions, isLoading } = usePositions();
  const { execute, isPending } = useExecuteTx();
  const [overlayResult, setOverlayResult] = useState<TxResult | null>(null);

  if (!account) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <p className="text-zinc-400">Kết nối ví để xem vị thế</p>
        <ConnectButton />
      </main>
    );
  }

  async function handleRedeem(pos: Position) {
    const managerId = balance?.managerId;
    if (!managerId) return;

    const isRange = pos.lower_strike !== undefined && pos.higher_strike !== undefined;

    // oracle_id and expiry from position — expiry may come from joined data
    const expiryMs: number = (pos as Record<string, unknown>).expiry as number
      ?? Date.now() + 900_000;

    const tx = buildRedeemTx({
      oracleId: pos.oracle_id,
      managerId,
      strike_raw: pos.strike !== undefined ? BigInt(pos.strike) : undefined,
      isUp: pos.direction === "up",
      lowerStrike_raw: pos.lower_strike !== undefined ? BigInt(pos.lower_strike) : undefined,
      upperStrike_raw: pos.higher_strike !== undefined ? BigInt(pos.higher_strike) : undefined,
      quantity_raw: BigInt(pos.quantity),
      expiryMs,
      isRange,
    });

    const result = await execute(tx, [
      [...MANAGER_BALANCE_KEY, account?.address],
      [...POSITIONS_KEY, account?.address],
    ]);
    setOverlayResult(result);
  }

  return (
    <main className="flex flex-1 flex-col max-w-lg mx-auto w-full px-4 py-8 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Vị thế của tôi</h1>
        <div className="flex items-center gap-3">
          <BalanceDisplay />
          <ConnectButton />
        </div>
      </div>

      {/* Position list */}
      <PositionList
        isLoading={isLoading}
        positions={positions}
        onRedeem={handleRedeem}
        isRedeeming={isPending}
      />

      {/* Back to play */}
      <Link
        href="/play"
        className="text-sm text-zinc-500 hover:text-zinc-300 text-center transition-colors"
      >
        ← Quay lại đặt lệnh
      </Link>

      {/* Redeem status overlay */}
      <TxStatusOverlay
        isPending={isPending}
        result={overlayResult}
        onDismiss={() => setOverlayResult(null)}
      />
    </main>
  );
}
