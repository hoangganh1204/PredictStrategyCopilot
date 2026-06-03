// Build PTB for minting binary or range prediction positions.
// Verified ABI (probe #1+#2):
//   market_key::up(oracle_id: ID, expiry: u64, strike: u64): MarketKey
//   range_key::new(oracle_id: ID, expiry: u64, lower: u64, higher: u64): RangeKey
//   predict::mint(predict, manager, oracle, key: MarketKey, quantity, clock, ctx)
//   predict::mint_range(predict, manager, oracle, key: RangeKey, quantity, clock, ctx)
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "@/config/predict.js";
import type { MintParams, MintRangeParams } from "./types.js";

const PKG = PREDICT_CONFIG.PACKAGE;

/**
 * Build a PTB for minting a binary (up or down) prediction position.
 */
export function buildBinaryMintTx(params: MintParams): Transaction {
  const { oracleId, managerId, strike_raw, isUp, quantity_raw, expiryMs } = params;

  const tx = new Transaction();

  const keyFn = isUp
    ? `${PKG}::market_key::up`
    : `${PKG}::market_key::down`;

  const [marketKey] = tx.moveCall({
    target: keyFn,
    arguments: [
      tx.pure.id(oracleId),
      tx.pure.u64(BigInt(expiryMs)),
      tx.pure.u64(strike_raw),
    ],
  });

  tx.moveCall({
    target: `${PKG}::predict::mint`,
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

  return tx;
}

/**
 * Build a PTB for minting a range prediction position.
 */
export function buildRangeMintTx(params: MintRangeParams): Transaction {
  const {
    oracleId,
    managerId,
    lowerStrike_raw,
    upperStrike_raw,
    quantity_raw,
    expiryMs,
  } = params;

  const tx = new Transaction();

  const [rangeKey] = tx.moveCall({
    target: `${PKG}::range_key::new`,
    arguments: [
      tx.pure.id(oracleId),
      tx.pure.u64(BigInt(expiryMs)),
      tx.pure.u64(lowerStrike_raw),
      tx.pure.u64(upperStrike_raw),
    ],
  });

  tx.moveCall({
    target: `${PKG}::predict::mint_range`,
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

  return tx;
}
