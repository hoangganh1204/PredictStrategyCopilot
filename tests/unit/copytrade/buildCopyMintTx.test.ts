import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import { buildCopyMintTx } from "../../../src/lib/copytrade/buildCopyMintTx.js";
import type { CopyParams } from "../../../src/lib/copytrade/types.js";

const MANAGER = `0x${"b".repeat(64)}`;
const ORACLE = `0x${"a".repeat(64)}`;

function targetsOf(tx: Transaction): string[] {
  return tx
    .getData()
    .commands.filter((c) => c.MoveCall)
    .map((c) => `${c.MoveCall!.module}::${c.MoveCall!.function}`);
}

const binaryParams: CopyParams = {
  strategyType: "binary_up",
  oracleId: ORACLE,
  strike_raw: 62_000_000_000_000n,
  isUp: true,
  quantity_raw: 20_000_000n,
  cost_raw: 10_000_000n,
  payout_raw: 20_000_000n,
  expiryMs: 1_781_253_000_000,
};

const rangeParams: CopyParams = {
  strategyType: "range",
  oracleId: ORACLE,
  lowerStrike_raw: 60_000_000_000_000n,
  upperStrike_raw: 64_000_000_000_000n,
  quantity_raw: 20_000_000n,
  cost_raw: 10_000_000n,
  payout_raw: 20_000_000n,
  expiryMs: 1_781_253_000_000,
};

describe("buildCopyMintTx", () => {
  it("returns an unsigned Transaction object (not a digest)", () => {
    const tx = buildCopyMintTx(binaryParams, MANAGER);
    expect(tx).toBeInstanceOf(Transaction);
  });

  it("binary copy calls predict::mint with a market_key", () => {
    const targets = targetsOf(buildCopyMintTx(binaryParams, MANAGER));
    expect(targets).toContain("predict::mint");
    expect(targets.some((t) => t.startsWith("market_key::"))).toBe(true);
    expect(targets).not.toContain("predict::mint_range");
  });

  it("range copy calls predict::mint_range with a range_key", () => {
    const targets = targetsOf(buildCopyMintTx(rangeParams, MANAGER));
    expect(targets).toContain("predict::mint_range");
    expect(targets).toContain("range_key::new");
    expect(targets).not.toContain("predict::mint");
  });

  it("has NO signer/wallet parameter — signature is (params, managerId)", () => {
    expect(buildCopyMintTx.length).toBe(2);
  });

  it("does not import any wallet/signer module (no auto-signing)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/copytrade/buildCopyMintTx.ts"), "utf8");
    // Inspect import statements only (comments may legitimately mention these terms).
    const imports = src
      .split("\n")
      .filter((l) => l.trim().startsWith("import"))
      .join("\n");
    expect(imports).not.toMatch(/dapp-kit/);
    expect(imports).not.toMatch(/Keypair|Signer|wallet/i);
  });
});
