"use client";
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { usePositions, POSITIONS_KEY } from "@/hooks/usePositions.js";
import { useRangePositions, RANGE_POSITIONS_KEY } from "@/hooks/useRangePositions.js";
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
  const { data: binaryPositions, isLoading } = usePositions();
  // Range positions aren't indexed by the Public Server — read them from chain.
  const { data: rangePositions } = useRangePositions();
  const { execute, isPending } = useExecuteTx();
  const [overlayResult, setOverlayResult] = useState<TxResult | null>(null);

  if (!account) {
    return (
      <>
        <AppHeader />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <p className="text-zinc-400">Connect your wallet to view positions</p>
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
      [...RANGE_POSITIONS_KEY, account?.address, balance?.managerId],
    ]);
    setOverlayResult(result);
  }

  // Merge binary (server) + range (on-chain) positions; surface claimable first.
  const STATE_ORDER: Record<string, number> = {
    settled_won: 0, active: 1, awaiting_settlement: 1, settled_lost: 2, redeemed: 3,
  };
  const positions = [...(binaryPositions ?? []), ...(rangePositions ?? [])].sort(
    (a, b) =>
      (STATE_ORDER[a.positionState] ?? 9) - (STATE_ORDER[b.positionState] ?? 9) ||
      a.expiry - b.expiry
  );

  const activeCount = positions.filter(
    (p) => p.positionState === "active" || p.positionState === "awaiting_settlement"
  ).length;
  const claimableCount = positions.filter((p) => p.positionState === "settled_won").length;

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-6 py-6">
        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">My positions</h1>
          <p className="text-sm text-zinc-500">
            {activeCount} active
            {claimableCount > 0 && (
              <span className="text-emerald-400"> · {claimableCount} ready to claim</span>
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
