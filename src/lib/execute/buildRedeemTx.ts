// Build PTB for redeeming a winning prediction position.
// ABI (probe #1+#2):
//   predict::redeem(predict, manager, oracle, key: MarketKey, quantity, clock, ctx)
//   predict::redeem_range(predict, manager, oracle, key: RangeKey, quantity, clock, ctx)
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "@/config/predict.js";
import type { RedeemParams } from "./types.js";

const PKG = PREDICT_CONFIG.PACKAGE;

/**
 * Build PTB for redeeming a settled winning position.
 * Handles both binary and range positions based on params.isRange.
 */
export function buildRedeemTx(params: RedeemParams): Transaction {
  const { oracleId, managerId, quantity_raw, expiryMs, isRange } = params;

  const tx = new Transaction();

  if (isRange) {
    if (params.lowerStrike_raw === undefined || params.upperStrike_raw === undefined) {
      throw new Error("lowerStrike_raw and upperStrike_raw required for range redeem");
    }

    const [rangeKey] = tx.moveCall({
      target: `${PKG}::range_key::new`,
      arguments: [
        tx.pure.id(oracleId),
        tx.pure.u64(BigInt(expiryMs)),
        tx.pure.u64(params.lowerStrike_raw),
        tx.pure.u64(params.upperStrike_raw),
      ],
    });

    tx.moveCall({
      target: `${PKG}::predict::redeem_range`,
      typeArguments: [PREDICT_CONFIG.DUSDC_TYPE],
      arguments: [
        tx.object(PREDICT_CONFIG.PREDICT_OBJECT),
        tx.object(managerId),
        tx.object(oracleId),
        rangeKey,
        tx.pure.u64(quantity_raw),
        tx.object(PREDICT_CONFIG.CLOCK_OBJECT),
      ],
    });
  } else {
    if (params.strike_raw === undefined || params.isUp === undefined) {
      throw new Error("strike_raw and isUp required for binary redeem");
    }

    const keyFn = params.isUp
      ? `${PKG}::market_key::up`
      : `${PKG}::market_key::down`;

    const [marketKey] = tx.moveCall({
      target: keyFn,
      arguments: [
        tx.pure.id(oracleId),
        tx.pure.u64(BigInt(expiryMs)),
        tx.pure.u64(params.strike_raw),
      ],
    });

    tx.moveCall({
      target: `${PKG}::predict::redeem`,
      typeArguments: [PREDICT_CONFIG.DUSDC_TYPE],
      arguments: [
        tx.object(PREDICT_CONFIG.PREDICT_OBJECT),
        tx.object(managerId),
        tx.object(oracleId),
        marketKey,
        tx.pure.u64(quantity_raw),
        tx.object(PREDICT_CONFIG.CLOCK_OBJECT),
      ],
    });
  }

  return tx;
}
