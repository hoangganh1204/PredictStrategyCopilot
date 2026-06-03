"use client";
// Mutation hook for signing and executing on-chain transactions.
// Wraps useSignAndExecuteTransaction (dapp-kit) and normalizes all outcomes
// into TxResult: success | failed | rejected.
import { useCallback, useState } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "@mysten/sui/transactions";
import type { TxResult } from "@/lib/execute/types.js";

const USER_REJECT_PATTERNS = [
  "user rejected",
  "user cancelled",
  "user canceled",
  "rejected by user",
  "cancel",
];

function isUserRejection(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  return USER_REJECT_PATTERNS.some((p) => msg.includes(p));
}

export interface UseExecuteTxReturn {
  execute: (tx: Transaction, invalidateKeys?: unknown[][]) => Promise<TxResult>;
  isPending: boolean;
  lastResult: TxResult | null;
}

/**
 * Hook for signing and executing a Sui Transaction.
 * Handles 3 outcomes: success, failed, rejected by user.
 * On success, optionally invalidates TanStack Query cache keys.
 */
export function useExecuteTx(): UseExecuteTxReturn {
  const queryClient = useQueryClient();
  const { mutateAsync } = useSignAndExecuteTransaction();
  const [isPending, setIsPending] = useState(false);
  const [lastResult, setLastResult] = useState<TxResult | null>(null);

  const execute = useCallback(
    async (
      tx: Transaction,
      invalidateKeys: unknown[][] = []
    ): Promise<TxResult> => {
      setIsPending(true);
      try {
        const output = await mutateAsync({ transaction: tx });
        const result: TxResult = {
          status: "success",
          digest: output.digest,
        };
        setLastResult(result);

        // Invalidate related queries on success
        for (const key of invalidateKeys) {
          await queryClient.invalidateQueries({ queryKey: key });
        }

        return result;
      } catch (err) {
        const result: TxResult = isUserRejection(err)
          ? { status: "rejected", error: "Bạn đã hủy giao dịch" }
          : {
              status: "failed",
              error:
                err instanceof Error
                  ? err.message
                  : "Giao dịch thất bại. Vui lòng thử lại.",
            };
        setLastResult(result);
        return result;
      } finally {
        setIsPending(false);
      }
    },
    [mutateAsync, queryClient]
  );

  return { execute, isPending, lastResult };
}
