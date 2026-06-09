"use client";
// FR-013: deposit DUSDC from wallet into game account.
import { useState } from "react";
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { buildDepositTxFromCoin } from "@/lib/execute/depositDusdc.js";
import { PREDICT_CONFIG, DUSDC_SCALE } from "@/config/predict.js";
import { MANAGER_BALANCE_KEY, useManagerBalance } from "@/hooks/useManagerBalance.js";
import { TxStatusOverlay } from "./TxStatusOverlay.js";
import type { TxResult } from "@/lib/execute/types.js";

export function DepositForm() {
  const account = useCurrentAccount();
  const { data: balanceData, isLoading: balanceLoading, isFetching } = useManagerBalance();
  const { execute, isPending } = useExecuteTx();
  const [amount, setAmount] = useState("");
  const [overlayResult, setOverlayResult] = useState<TxResult | null>(null);

  const { data: coins } = useSuiClientQuery("getCoins", {
    owner: account?.address ?? "",
    coinType: PREDICT_CONFIG.DUSDC_TYPE,
  }, { enabled: !!account });

  const walletBalance_raw = coins?.data.reduce((sum, c) => sum + BigInt(c.balance), 0n) ?? 0n;
  const walletBalance_dusdc = Number(walletBalance_raw) / Number(DUSDC_SCALE);
  const coinIds = coins?.data.map((c) => c.coinObjectId) ?? [];
  const managerId = balanceData?.managerId ?? null;

  const amountNum = parseFloat(amount);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0 && amountNum <= walletBalance_dusdc;
  const amount_raw = isValidAmount ? BigInt(Math.round(amountNum * Number(DUSDC_SCALE))) : 0n;

  async function handleCreateManager() {
    const tx = new Transaction();
    tx.moveCall({ target: `${PREDICT_CONFIG.PACKAGE}::predict::create_manager`, arguments: [] });
    // Don't pass keys to invalidate — refetchInterval handles polling
    const result = await execute(tx, []);
    setOverlayResult(result);
  }

  async function handleDeposit() {
    if (!isValidAmount || coinIds.length === 0 || !managerId) return;
    const tx = buildDepositTxFromCoin(managerId, coinIds, amount_raw);
    const result = await execute(tx, [[...MANAGER_BALANCE_KEY, account?.address]]);
    setOverlayResult(result);
    if (result.status === "success") setAmount("");
  }

  if (!account) return null;

  // Still loading or polling after create_manager
  if (balanceLoading || (isFetching && managerId === null)) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
        <p className="text-sm text-zinc-400">Loading game account...</p>
      </div>
    );
  }

  // No manager — prompt creation
  if (managerId === null) {
    return (
      <>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-400">
            Create your on-chain game account (one time only) to hold your betting funds.
          </p>
          <button
            onClick={handleCreateManager}
            disabled={isPending}
            className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {isPending ? "Creating..." : "Create game account"}
          </button>
        </div>
        <TxStatusOverlay isPending={isPending} result={overlayResult} onDismiss={() => setOverlayResult(null)} />
      </>
    );
  }

  // Manager exists — deposit form
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Deposit DUSDC into game account</label>
          <span className="text-xs text-zinc-500">Wallet: {walletBalance_dusdc.toFixed(2)} DUSDC</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleDeposit}
            disabled={!isValidAmount || coinIds.length === 0 || isPending}
            className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {isPending ? "Depositing..." : "Deposit"}
          </button>
        </div>
        {!isNaN(amountNum) && amountNum > walletBalance_dusdc && amountNum > 0 && (
          <p className="text-xs text-red-400">Amount exceeds your wallet balance</p>
        )}
        {walletBalance_raw === 0n && (
          <p className="text-xs text-zinc-500">No DUSDC in wallet. Get some from the testnet faucet.</p>
        )}
      </div>
      <TxStatusOverlay isPending={isPending} result={overlayResult} onDismiss={() => setOverlayResult(null)} />
    </>
  );
}
