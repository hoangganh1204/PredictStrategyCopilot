"use client";
// Main play page: amount input → fetch strategies → display → select → place bet.
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useRouter } from "next/navigation";
import { BalanceDisplay } from "@/components/BalanceDisplay.js";
import { DepositForm } from "@/components/DepositForm.js";
import { AmountInput } from "@/components/AmountInput.js";
import { StrategyList } from "@/components/StrategyList.js";
import { ConnectButton } from "@/components/ConnectButton.js";
import { useManagerBalance } from "@/hooks/useManagerBalance.js";
import { useStrategies, type ExpiryLabel, type ApiStrategy } from "@/hooks/useStrategies.js";

export default function PlayPage() {
  const account = useCurrentAccount();
  const router = useRouter();
  const { data: balance } = useManagerBalance();

  const [amount, setAmount] = useState("");
  const [expiry, setExpiry] = useState<ExpiryLabel>("15m");
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);
  const [submittedExpiry, setSubmittedExpiry] = useState<ExpiryLabel | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<ApiStrategy | null>(null);

  const { data: strategies, isLoading } = useStrategies(submittedAmount, submittedExpiry);

  const maxBalance = balance?.balance_dusdc ?? 0;
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
    setSelectedStrategy(null);
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

      {/* Strategy list */}
      {(submittedAmount || isLoading) && (
        <StrategyList
          isLoading={isLoading}
          data={strategies}
          onSelect={setSelectedStrategy}
          selectedType={selectedStrategy?.type ?? null}
        />
      )}

      {/* Navigate to positions */}
      {!isLoading && strategies?.ok && (
        <button
          onClick={() => router.push("/positions")}
          className="text-sm text-zinc-500 hover:text-zinc-300 text-center transition-colors"
        >
          Xem vị thế đang mở →
        </button>
      )}
    </main>
  );
}
