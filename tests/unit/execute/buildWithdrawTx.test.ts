import { describe, it, expect } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { buildWithdrawTx } from "../../../src/lib/execute/withdrawDusdc.js";
import { PREDICT_CONFIG } from "../../../src/config/predict.js";

const MANAGER = `0x${"a".repeat(64)}`;
const RECIPIENT = `0x${"b".repeat(64)}`;

describe("buildWithdrawTx", () => {
  it("returns an unsigned Transaction", () => {
    expect(buildWithdrawTx(MANAGER, 1_000_000n, RECIPIENT)).toBeInstanceOf(Transaction);
  });

  it("calls predict_manager::withdraw with the DUSDC type and transfers the coin out", () => {
    const cmds = buildWithdrawTx(MANAGER, 1_000_000n, RECIPIENT).getData().commands;
    const withdraw = cmds.find((c) => c.MoveCall)?.MoveCall;
    expect(`${withdraw!.module}::${withdraw!.function}`).toBe("predict_manager::withdraw");
    expect(withdraw!.typeArguments).toEqual([PREDICT_CONFIG.DUSDC_TYPE]);
    // The withdrawn coin must be transferred to the recipient (else the tx aborts).
    expect(cmds.some((c) => c.$kind === "TransferObjects")).toBe(true);
  });

  it("has signature (managerId, amount_raw, recipient)", () => {
    expect(buildWithdrawTx.length).toBe(3);
  });
});
