// Build a PTB to deposit DUSDC into PredictManager (FR-013).
// Returns a Transaction object — caller signs and executes via useExecuteTx.
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "@/config/predict.js";

/**
 * Build deposit transaction from one or more DUSDC coin objects.
 * If several coins are given they are merged first, so a deposit can draw on the
 * wallet's full DUSDC balance even when it is split across multiple coin objects.
 * Splits `amount_raw` from the (merged) coin and deposits it into the manager.
 */
export function buildDepositTxFromCoin(
  managerId: string,
  dusdcCoinObjectIds: string | string[],
  amount_raw: bigint
): Transaction {
  const tx = new Transaction();

  const ids = Array.isArray(dusdcCoinObjectIds)
    ? dusdcCoinObjectIds
    : [dusdcCoinObjectIds];
  if (ids.length === 0) {
    throw new Error("buildDepositTxFromCoin: at least one DUSDC coin is required");
  }

  const [primary, ...rest] = ids;
  if (rest.length > 0) {
    tx.mergeCoins(tx.object(primary), rest.map((id) => tx.object(id)));
  }

  const [splitCoin] = tx.splitCoins(tx.object(primary), [tx.pure.u64(amount_raw)]);

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
