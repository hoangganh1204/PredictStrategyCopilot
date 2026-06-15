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

// Transient input-contention errors: another in-flight tx (e.g. the keeper bot
// signing on the same wallet) momentarily locked a gas coin / object or bumped
// its version. The failed tx never executed, so retrying once — after the other
// tx settles — is safe and usually succeeds. We deliberately do NOT retry real
// MoveAborts (e.g. "already redeemed") or rejections.
const RETRYABLE_PATTERNS = [
  "equivocat",
  "object version",
  "objectversionunavailable",
  "not available for consumption",
  "is not available",
  "reserved for another",
  "could not be locked",
  "object is locked",
  "is locked by",
];

function msgOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).toLowerCase();
}

function isUserRejection(error: unknown): boolean {
  return USER_REJECT_PATTERNS.some((p) => msgOf(error).includes(p));
}

function isRetryableConflict(error: unknown): boolean {
  const m = msgOf(error);
  return RETRYABLE_PATTERNS.some((p) => m.includes(p));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_ATTEMPTS = 3;

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
        let lastErr: unknown;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const output = await mutateAsync({ transaction: tx });
            const result: TxResult = { status: "success", digest: output.digest };
            setLastResult(result);
            for (const key of invalidateKeys) {
              await queryClient.invalidateQueries({ queryKey: key });
            }
            return result;
          } catch (err) {
            lastErr = err;
            if (isUserRejection(err)) break; // never retry a rejection
            // Retry transient contention (e.g. keeper signing on the same wallet).
            if (attempt < MAX_ATTEMPTS && isRetryableConflict(err)) {
              await sleep(900 * attempt);
              continue;
            }
            break; // non-retryable, or out of attempts
          }
        }

        const result: TxResult = isUserRejection(lastErr)
          ? { status: "rejected", error: "You cancelled the transaction" }
          : isRetryableConflict(lastErr)
          ? {
              status: "failed",
              error: "The network was busy (another transaction was in flight). Please try again.",
            }
          : {
              status: "failed",
              error: lastErr instanceof Error ? lastErr.message : "Transaction failed. Please try again.",
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
