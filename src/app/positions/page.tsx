"use client";
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { usePositions, POSITIONS_KEY } from "@/hooks/usePositions.js";
import { useManagerBalance, MANAGER_BALANCE_KEY } from "@/hooks/useManagerBalance.js";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { buildRedeemTx } from "@/lib/execute/buildRedeemTx.js";
import { AppHeader } from "@/components/AppHeader.js";
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
      <>
        <AppHeader />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <p className="text-zinc-400">Kết nối ví để xem vị thế</p>
          <ConnectButton />
        </main>
      </>
    );
  }

  async function handleRedeem(pos: Position) {
    const managerId = balance?.managerId;
    if (!managerId) return;

    const isRange = pos.lower_strike !== undefined && pos.higher_strike !== undefined;

    const tx = buildRedeemTx({
      oracleId: pos.oracle_id,
      managerId,
      strike_raw: pos.strike !== undefined ? BigInt(pos.strike) : undefined,
      isUp: pos.direction === "up",
      lowerStrike_raw: pos.lower_strike !== undefined ? BigInt(pos.lower_strike) : undefined,
      upperStrike_raw: pos.higher_strike !== undefined ? BigInt(pos.higher_strike) : undefined,
      quantity_raw: BigInt(pos.open_quantity),
      expiryMs: pos.expiry,
      isRange,
    });

    const result = await execute(tx, [
      [...MANAGER_BALANCE_KEY, account?.address],
      [...POSITIONS_KEY, account?.address],
    ]);
    setOverlayResult(result);
  }

  const activeCount = positions?.filter(
    (p) => p.positionState === "active" || p.positionState === "awaiting_settlement"
  ).length ?? 0;
  const claimableCount = positions?.filter((p) => p.positionState === "settled_won").length ?? 0;

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Vị thế của tôi</h1>
          <p className="text-sm text-zinc-500">
            {activeCount} đang chạy
            {claimableCount > 0 && (
              <span className="text-emerald-400"> · {claimableCount} chờ nhận thưởng</span>
            )}
          </p>
        </div>

        {/* Position list */}
        <PositionList
          isLoading={isLoading}
          positions={positions}
          onRedeem={handleRedeem}
          isRedeeming={isPending}
        />

        {/* Redeem status overlay */}
        <TxStatusOverlay
          isPending={isPending}
          result={overlayResult}
          onDismiss={() => setOverlayResult(null)}
        />
      </main>
    </>
  );
}
