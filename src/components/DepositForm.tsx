"use client";
// FR-013: deposit DUSDC from wallet into game account.
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { buildDepositTxFromCoin } from "@/lib/execute/depositDusdc.js";
import { PREDICT_CONFIG, DUSDC_SCALE } from "@/config/predict.js";
import { MANAGER_BALANCE_KEY, useManagerBalance } from "@/hooks/useManagerBalance.js";
import { TxStatusOverlay } from "./TxStatusOverlay.js";

/**
 * Form to deposit DUSDC from wallet into PredictManager game account.
 * Validates: amount > 0 and ≤ wallet DUSDC balance.
 */
export function DepositForm() {
  const account = useCurrentAccount();
  const { data: balanceData } = useManagerBalance();
  const { execute, isPending, lastResult } = useExecuteTx();
  const [amount, setAmount] = useState("");
  const [overlayResult, setOverlayResult] = useState<typeof lastResult>(null);
  const queryClient = useQueryClient();

  // Fetch wallet DUSDC coins
  const { data: coins } = useSuiClientQuery("getCoins", {
    owner: account?.address ?? "",
    coinType: PREDICT_CONFIG.DUSDC_TYPE,
  }, { enabled: !!account });

  const walletBalance_raw = coins?.data.reduce(
    (sum, c) => sum + BigInt(c.balance),
    0n
  ) ?? 0n;
  const walletBalance_dusdc = Number(walletBalance_raw) / Number(DUSDC_SCALE);

  const amountNum = parseFloat(amount);
  const isValidAmount =
    !isNaN(amountNum) && amountNum > 0 && amountNum <= walletBalance_dusdc;
  const amount_raw = isValidAmount
    ? BigInt(Math.round(amountNum * Number(DUSDC_SCALE)))
    : 0n;

  const primaryCoin = coins?.data[0]?.coinObjectId;
  const managerId = balanceData?.managerId;

  async function handleDeposit() {
    if (!isValidAmount || !primaryCoin || !managerId) return;

    const tx = buildDepositTxFromCoin(managerId, primaryCoin, amount_raw);
    const result = await execute(tx, [[...MANAGER_BALANCE_KEY, account?.address]]);
    setOverlayResult(result);
    if (result.status === "success") setAmount("");
  }

  if (!account) return null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Nạp DUSDC vào tài khoản chơi</label>
          <span className="text-xs text-zinc-500">
            Ví: {walletBalance_dusdc.toFixed(2)} DUSDC
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleDeposit}
            disabled={!isValidAmount || !primaryCoin || !managerId || isPending}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Nạp tiền
          </button>
        </div>
        {!isNaN(amountNum) && amountNum > walletBalance_dusdc && amountNum > 0 && (
          <p className="text-xs text-red-400">Số tiền vượt quá số dư trong ví</p>
        )}
        {walletBalance_raw === 0n && (
          <p className="text-xs text-zinc-500">
            Ví không có DUSDC. Hãy lấy từ faucet testnet.
          </p>
        )}
      </div>

      <TxStatusOverlay
        isPending={isPending}
        result={overlayResult}
        onDismiss={() => setOverlayResult(null)}
      />
    </>
  );
}
