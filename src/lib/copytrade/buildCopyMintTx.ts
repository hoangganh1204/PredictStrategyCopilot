// T082 — Build the unsigned mint PTB for a copy-trade. Preserves the leader's
// strategy via the existing mint builders.
//
// CRITICAL (SC-011): this module stays signer-free — it never imports a signing
// or browser-extension SDK. It returns an UNSIGNED Transaction only; the follower
// approves and signs it themselves (FR-021: no auto-signing, no custody).
import { Transaction } from "@mysten/sui/transactions";
import { buildBinaryMintTx, buildRangeMintTx } from "@/lib/execute/buildMintTx.js";
import type { CopyParams } from "./types.js";

export function buildCopyMintTx(params: CopyParams, managerId: string): Transaction {
  if (params.strategyType === "range") {
    if (params.lowerStrike_raw === undefined || params.upperStrike_raw === undefined) {
      throw new Error("range copy requires lower and upper strikes");
    }
    return buildRangeMintTx({
      oracleId: params.oracleId,
      managerId,
      lowerStrike_raw: params.lowerStrike_raw,
      upperStrike_raw: params.upperStrike_raw,
      quantity_raw: params.quantity_raw,
      expiryMs: params.expiryMs,
    });
  }

  if (params.strike_raw === undefined) {
    throw new Error("binary copy requires a strike");
  }
  return buildBinaryMintTx({
    oracleId: params.oracleId,
    managerId,
    strike_raw: params.strike_raw,
    isUp: params.isUp ?? params.strategyType === "binary_up",
    quantity_raw: params.quantity_raw,
    expiryMs: params.expiryMs,
  });
}
