"use client";
// Main play page: amount input → fetch strategies → display → select → place bet.
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader.js";
import { PriceChart } from "@/components/PriceChart.js";
import { DepositForm } from "@/components/DepositForm.js";
import { AmountInput } from "@/components/AmountInput.js";
import { StrategyList } from "@/components/StrategyList.js";
import { ConnectButton } from "@/components/ConnectButton.js";
import { TxStatusOverlay } from "@/components/TxStatusOverlay.js";
import { useManagerBalance, MANAGER_BALANCE_KEY } from "@/hooks/useManagerBalance.js";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { useStrategies, type ExpiryLabel, type ApiStrategy } from "@/hooks/useStrategies.js";
import { buildBinaryMintTx, buildRangeMintTx } from "@/lib/execute/buildMintTx.js";
import { computeBetEconomics } from "@/lib/strategy/sizing.js";
import { SVI_STALENESS_MS } from "@/config/predict.js";
import type { TxResult } from "@/lib/execute/types.js";

// Positions query key for invalidation on successful bet
const POSITIONS_KEY = ["positions"] as const;

function StepCard({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface animate-rise rounded-2xl border border-zinc-800 p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-400">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {hint && <span className="ml-auto text-xs text-zinc-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default function PlayPage() {
  const account = useCurrentAccount();
  const router = useRouter();
  const { data: balance } = useManagerBalance();
  const { execute, isPending } = useExecuteTx();

  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState<ExpiryLabel>("15m");
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);
  const [submittedExpiry, setSubmittedExpiry] = useState<ExpiryLabel | null>(null);
  const [overlayResult, setOverlayResult] = useState<TxResult | null>(null);

  const { data: strategies, isLoading, dataUpdatedAt, refetch } = useStrategies(
    submittedAmount,
    submittedExpiry
  );

  const maxBalance = balance?.balance_dusdc ?? 0;
  const managerId = balance?.managerId;
  const hasBalance = maxBalance > 0;

  if (!account) {
    return (
      <>
        <AppHeader />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <p className="text-zinc-400">Kết nối ví để bắt đầu chơi</p>
          <ConnectButton />
        </main>
      </>
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

    // FR-006c: block betting on volatility data older than 30s; refresh first.
    if (Date.now() - dataUpdatedAt > SVI_STALENESS_MS) {
      await refetch();
      setOverlayResult({
        status: "failed",
        error: "Dữ liệu biến động đã cũ. Đã làm mới — vui lòng vào lệnh lại.",
      });
      return;
    }

    const { oracle_id, expiry: expiryMs } = strategies;
    // User stake = amount they spend; derive token quantity from the per-token cost
    // so the actual mint cost ≈ stake. Each token redeems 1 DUSDC on win.
    const { quantityRaw: quantity_raw } = computeBetEconomics(
      submittedAmount ?? 0,
      Number(strategy.cost_raw)
    );
    if (quantity_raw <= 0n) return;

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
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        {/* Title */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Dự đoán giá BTC</h1>
          <p className="text-sm text-zinc-500">
            Chọn số tiền, xem gợi ý, và vào lệnh chỉ với một cú ký.
          </p>
        </div>

        {/* BTC price chart */}
        <PriceChart />

        {/* Step 1: deposit (only when game balance is zero) */}
        {!hasBalance && (
          <StepCard step={1} title="Nạp DUSDC vào tài khoản chơi">
            <p className="mb-4 text-sm text-zinc-400">
              Tiền chơi nằm trong tài khoản trên chuỗi. Nạp một lần để bắt đầu đặt lệnh.
            </p>
            <DepositForm />
          </StepCard>
        )}

        {/* Step: choose amount + expiry */}
        {hasBalance && (
          <StepCard
            step={1}
            title="Chọn số tiền & kỳ hạn"
            hint={`Còn ${maxBalance.toFixed(2)} DUSDC`}
          >
            <AmountInput
              amount={amount}
              expiry={expiry}
              maxBalance={maxBalance}
              onAmountChange={setAmount}
              onExpiryChange={setExpiry}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          </StepCard>
        )}

        {/* Step: strategy list with bet buttons */}
        {(submittedAmount || isLoading) && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 px-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-400">
                2
              </span>
              <h2 className="text-sm font-semibold text-zinc-200">Chọn chiến lược & vào lệnh</h2>
            </div>
            <StrategyList
              isLoading={isLoading}
              data={strategies}
              stakeDusdc={submittedAmount ?? 0}
              onBet={handleBet}
              isBetting={isPending}
            />
          </div>
        )}

        {/* TxStatusOverlay — pending/success/failed/rejected */}
        <TxStatusOverlay
          isPending={isPending}
          result={overlayResult}
          onDismiss={handleOverlayDismiss}
        />
      </main>
    </>
  );
}
