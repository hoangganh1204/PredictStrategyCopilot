// Concrete PricingFn implementation using devInspectTransactionBlock.
// Verified via probe #8: market_key::up → predict::get_trade_amounts.
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "@/config/predict.js";
import type { PricingFn } from "./types.js";

const PKG = PREDICT_CONFIG.PACKAGE;
const PREDICT_OBJ = PREDICT_CONFIG.PREDICT_OBJECT;
const CLOCK = PREDICT_CONFIG.CLOCK_OBJECT;
const NULL_SENDER = "0x0000000000000000000000000000000000000000000000000000000000000000";

function decodeU64LE(bytes: number[]): bigint {
  const lo = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
  const hi = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  return BigInt(lo >>> 0) + (BigInt(hi >>> 0) << 32n);
}

export function makeDevInspectPricingFn(client: SuiJsonRpcClient): PricingFn {
  return async (oracleId, strike, isUp, lowerStrike, upperStrike, quantity, expiryMs) => {
    const tx = new Transaction();

    if (isUp !== null) {
      // Binary: build MarketKey then call get_trade_amounts
      const keyFn = isUp
        ? `${PKG}::market_key::up`
        : `${PKG}::market_key::down`;

      const [marketKey] = tx.moveCall({
        target: keyFn,
        arguments: [
          tx.pure.id(oracleId),
          tx.pure.u64(BigInt(expiryMs)),
          tx.pure.u64(strike),
        ],
      });

      tx.moveCall({
        target: `${PKG}::predict::get_trade_amounts`,
        arguments: [
          tx.object(PREDICT_OBJ),
          tx.object(oracleId),
          marketKey,
          tx.pure.u64(quantity),
          tx.object(CLOCK),
        ],
      });
    } else {
      // Range: build RangeKey then call get_range_trade_amounts
      if (lowerStrike === null || upperStrike === null) {
        throw new Error("lowerStrike and upperStrike required for range pricing");
      }

      const [rangeKey] = tx.moveCall({
        target: `${PKG}::range_key::new`,
        arguments: [
          tx.pure.id(oracleId),
          tx.pure.u64(BigInt(expiryMs)),
          tx.pure.u64(lowerStrike),
          tx.pure.u64(upperStrike),
        ],
      });

      tx.moveCall({
        target: `${PKG}::predict::get_range_trade_amounts`,
        arguments: [
          tx.object(PREDICT_OBJ),
          tx.object(oracleId),
          rangeKey,
          tx.pure.u64(quantity),
          tx.object(CLOCK),
        ],
      });
    }

    const result = await client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: NULL_SENDER,
    });

    if (result.error || result.effects?.status?.status !== "success") {
      throw new Error(`devInspect failed: ${result.error ?? result.effects?.status?.error}`);
    }

    // Command 0: MarketKey/RangeKey (ignore); Command 1: trade amounts
    const tradeResults = result.results?.[1];
    if (!tradeResults?.returnValues || tradeResults.returnValues.length < 2) {
      throw new Error("devInspect returned unexpected structure");
    }

    const mint_cost_raw = decodeU64LE(tradeResults.returnValues[0][0] as number[]);
    const redeem_payout_raw = decodeU64LE(tradeResults.returnValues[1][0] as number[]);

    return { mint_cost_raw, redeem_payout_raw };
  };
}
