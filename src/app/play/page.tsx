"use client";
// Main play page: amount input → fetch strategies → display → select → place bet.
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BalanceDisplay } from "@/components/BalanceDisplay.js";
import { DepositForm } from "@/components/DepositForm.js";
import { AmountInput } from "@/components/AmountInput.js";
import { StrategyList } from "@/components/StrategyList.js";
import { ConnectButton } from "@/components/ConnectButton.js";
import { TxStatusOverlay } from "@/components/TxStatusOverlay.js";
import { useManagerBalance, MANAGER_BALANCE_KEY } from "@/hooks/useManagerBalance.js";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { useStrategies, type ExpiryLabel, type ApiStrategy } from "@/hooks/useStrategies.js";
import { buildBinaryMintTx, buildRangeMintTx } from "@/lib/execute/buildMintTx.js";
import type { TxResult } from "@/lib/execute/types.js";

// Positions query key for invalidation on successful bet
const POSITIONS_KEY = ["positions"] as const;

export default function PlayPage() {
  const account = useCurrentAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: balance } = useManagerBalance();
  const { execute, isPending } = useExecuteTx();

  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState<ExpiryLabel>("15m");
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);
  const [submittedExpiry, setSubmittedExpiry] = useState<ExpiryLabel | null>(null);
  const [overlayResult, setOverlayResult] = useState<TxResult | null>(null);

  const { data: strategies, isLoading } = useStrategies(submittedAmount, submittedExpiry);

  const maxBalance = balance?.balance_dusdc ?? 0;
  const managerId = balance?.managerId;
  const hasBalance = maxBalance > 0;

  if (!account) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <p className="text-zinc-400">Kết nối ví để bắt đầu chơi</p>
        <ConnectButton />
      </main>
    );
  }

  function handleSubmit() {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    setSubmittedAmount(num);
    setSubmittedExpiry(expiry);
  }

  // T045 + T047: build and execute the mint PTB
  async function handleBet(strategy: ApiStrategy) {
    if (!managerId || !strategies?.ok) return;

    const { oracle_id, expiry: expiryMs } = strategies;
    const quantity_raw = BigInt(Math.round((submittedAmount ?? 0) * 1_000_000));

    let tx;
    if (strategy.type === "range") {
      if (!strategy.lowerStrike_raw || !strategy.upperStrike_raw) return;
      tx = buildRangeMintTx({
        oracleId: oracle_id,
        managerId,
        lowerStrike_raw: BigInt(strategy.lowerStrike_raw),
        upperStrike_raw: BigInt(strategy.upperStrike_raw),
        quantity_raw,
        expiryMs,
      });
    } else {
      if (!strategy.strike_raw) return;
      tx = buildBinaryMintTx({
        oracleId: oracle_id,
        managerId,
        strike_raw: BigInt(strategy.strike_raw),
        isUp: strategy.type === "binary_up",
        quantity_raw,
        expiryMs,
      });
    }

    // Execute — invalidate balance + positions on success
    const result = await execute(tx, [
      [...MANAGER_BALANCE_KEY, account?.address],
      [...POSITIONS_KEY, account?.address],
    ]);
    setOverlayResult(result);
  }

  function handleOverlayDismiss() {
    if (overlayResult?.status === "success") {
      router.push("/positions");
    }
    setOverlayResult(null);
  }

  return (
    <main className="flex flex-1 flex-col max-w-lg mx-auto w-full px-4 py-8 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Dự đoán giá BTC</h1>
        <div className="flex items-center gap-3">
          <BalanceDisplay />
          <ConnectButton />
        </div>
      </div>

      {/* Deposit prompt when balance is zero */}
      {!hasBalance && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400 mb-4">
            Nạp DUSDC vào tài khoản chơi để bắt đầu đặt lệnh.
          </p>
          <DepositForm />
        </div>
      )}

      {/* Amount + expiry input */}
      {hasBalance && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <AmountInput
            amount={amount}
            expiry={expiry}
            maxBalance={maxBalance}
            onAmountChange={setAmount}
            onExpiryChange={setExpiry}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Strategy list with bet buttons */}
      {(submittedAmount || isLoading) && (
        <StrategyList
          isLoading={isLoading}
          data={strategies}
          onBet={handleBet}
          isBetting={isPending}
        />
      )}

      {/* Navigate to positions */}
      <button
        onClick={() => router.push("/positions")}
        className="text-sm text-zinc-500 hover:text-zinc-300 text-center transition-colors"
      >
        Xem vị thế đang mở →
      </button>

      {/* T047: TxStatusOverlay — pending/success/failed/rejected */}
      <TxStatusOverlay
        isPending={isPending}
        result={overlayResult}
        onDismiss={handleOverlayDismiss}
      />
    </main>
  );
}
