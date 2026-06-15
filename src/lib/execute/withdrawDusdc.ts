// Build a PTB to withdraw DUSDC from the PredictManager back to the wallet.
// Inverse of deposit. Returns an unsigned Transaction — the owner signs it.
// ABI (verified): predict_manager::withdraw<T>(manager: &mut PredictManager,
//   amount: u64, ctx): Coin<T>  — owner-gated. The returned coin must be
// transferred to the recipient or the tx aborts on an unused value.
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "@/config/predict.js";

export function buildWithdrawTx(
  managerId: string,
  amount_raw: bigint,
  recipient: string
): Transaction {
  const tx = new Transaction();

  const [coin] = tx.moveCall({
    target: `${PREDICT_CONFIG.PACKAGE}::predict_manager::withdraw`,
    typeArguments: [PREDICT_CONFIG.DUSDC_TYPE],
    arguments: [tx.object(managerId), tx.pure.u64(amount_raw)],
  });

  tx.transferObjects([coin], tx.pure.address(recipient));

  return tx;
}
