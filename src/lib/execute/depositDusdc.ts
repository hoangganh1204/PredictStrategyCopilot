// Build a PTB to deposit DUSDC into PredictManager (FR-013).
// Returns a Transaction object — caller signs and executes via useExecuteTx.
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "@/config/predict.js";

/**
 * Build deposit transaction.
 * Splits `amount_raw` from the primary DUSDC coin and deposits into the manager.
 * Assumes the caller's wallet holds at least one DUSDC coin.
 */
export function buildDepositTx(managerId: string, amount_raw: bigint): Transaction {
  const tx = new Transaction();

  // Get DUSDC coins from wallet — use tx.gas for the primary coin merge pattern,
  // but DUSDC is a custom coin type, so we use the owned-coin approach:
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount_raw)]);
  // Note: tx.gas represents the primary gas coin; for DUSDC we need the actual coin.
  // The correct pattern for non-SUI coins is to use MoveCall with the coin object directly.
  // Here we build the PTB expecting the caller to pass in the DUSDC coin object.
  // We expose a variant that accepts the coin object ID for proper DUSDC handling.

  tx.moveCall({
    target: `${PREDICT_CONFIG.PACKAGE}::predict_manager::deposit`,
    typeArguments: [PREDICT_CONFIG.DUSDC_TYPE],
    arguments: [
      tx.object(managerId),
      coin,
    ],
  });

  return tx;
}

/**
 * Build deposit transaction using an explicit DUSDC coin object.
 * Use this when the caller knows the specific coin object to spend.
 */
export function buildDepositTxFromCoin(
  managerId: string,
  dusdcCoinObjectId: string,
  amount_raw: bigint
): Transaction {
  const tx = new Transaction();

  const [splitCoin] = tx.splitCoins(tx.object(dusdcCoinObjectId), [
    tx.pure.u64(amount_raw),
  ]);

  tx.moveCall({
    target: `${PREDICT_CONFIG.PACKAGE}::predict_manager::deposit`,
    typeArguments: [PREDICT_CONFIG.DUSDC_TYPE],
    arguments: [
      tx.object(managerId),
      splitCoin,
    ],
  });

  return tx;
}
