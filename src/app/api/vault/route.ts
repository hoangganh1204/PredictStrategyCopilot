// GET /api/vault — serve the Auto-Vault keeper's state (.vault.json) to the
// dashboard. The keeper script owns the file; this route only reads it.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { VaultState } from "@/lib/vault/types.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".vault.json"), "utf8");
    const state = JSON.parse(raw) as VaultState;
    return NextResponse.json({ ok: true, state });
  } catch {
    // Keeper not started yet — the page shows setup instructions.
    return NextResponse.json({ ok: false, state: null });
  }
}
