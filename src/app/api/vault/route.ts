// GET  /api/vault — serve the keeper's state (.vault.json) + control flag.
// POST /api/vault — set the pause flag (.vault-control.json) the keeper reads.
// The keeper owns the state file; this route only reads it and writes control.
import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { VaultState } from "@/lib/vault/types.js";

export const dynamic = "force-dynamic";

const STATE_PATH = path.join(process.cwd(), ".vault.json");
const CONTROL_PATH = path.join(process.cwd(), ".vault-control.json");

function readPaused(): boolean {
  try {
    return JSON.parse(fs.readFileSync(CONTROL_PATH, "utf8")).paused === true;
  } catch {
    return false;
  }
}

export async function GET() {
  const paused = readPaused();
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as VaultState;
    return NextResponse.json({ ok: true, state, paused });
  } catch {
    // Keeper not started yet — the page shows setup instructions.
    return NextResponse.json({ ok: false, state: null, paused });
  }
}

export async function POST(req: NextRequest) {
  let paused = false;
  try {
    paused = (await req.json())?.paused === true;
  } catch {
    /* default false */
  }
  fs.writeFileSync(CONTROL_PATH, JSON.stringify({ paused }, null, 2));
  return NextResponse.json({ ok: true, paused });
}
