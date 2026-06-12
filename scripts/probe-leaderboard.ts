// T060 — Probe: how do we enumerate every PredictManager (and find the ones with
// settled positions) on testnet?
//
// Findings (run 2026-06-12):
//   • GET /predicts/:predict_id/managers  → returns EMPTY. Not usable.
//   • GET /managers (unfiltered)          → returns one record per
//       PredictManagerCreated event: { manager_id, owner, checkpoint, ... }.
//       This is the complete manager index (391 managers at probe time).
//   • GET /managers/:id/positions/summary → per-manager positions incl. `status`
//       and `realized_pnl`; settled ones have status redeemable/lost/redeemed.
//
// Conclusion: enumerate via the unfiltered `/managers` index (no chain
// queryEvents needed), then fan out to /positions/summary to find settled
// activity. This is what `fetchAllManagerIds()` in predict-client.ts uses.
//
// Run: npx tsx scripts/probe-leaderboard.ts
import { PREDICT_CONFIG } from "../src/config/predict.js";

const SRV = PREDICT_CONFIG.SERVER_URL;
const SETTLED = new Set(["redeemable", "lost", "redeemed", "settled_won", "settled_lost"]);

async function main() {
  // 1. Confirm the dedicated endpoint is empty.
  const dedicated = await fetch(`${SRV}/predicts/${PREDICT_CONFIG.PREDICT_OBJECT}/managers`)
    .then((r) => r.json())
    .catch(() => null);
  console.log(`/predicts/:id/managers →`, Array.isArray(dedicated) ? `${dedicated.length} records` : dedicated);

  // 2. The working path: unfiltered /managers.
  const all = (await fetch(`${SRV}/managers`).then((r) => r.json())) as Array<{
    manager_id: string;
    owner: string;
    checkpoint: number;
  }>;
  const unique = [...new Map(all.map((m) => [m.manager_id, m])).values()];
  console.log(`/managers → ${all.length} records, ${unique.length} unique managers`);

  // 3. Sample a slice of the most recent managers for settled activity.
  const recent = [...unique].sort((a, b) => (b.checkpoint ?? 0) - (a.checkpoint ?? 0)).slice(0, 40);
  const withSettled: Array<{ manager_id: string; owner: string; settled: number }> = [];
  for (const m of recent) {
    try {
      const positions = (await fetch(`${SRV}/managers/${m.manager_id}/positions/summary`).then((r) =>
        r.json()
      )) as Array<{ status: string }>;
      const settled = positions.filter((p) => SETTLED.has(p.status)).length;
      if (settled > 0) withSettled.push({ manager_id: m.manager_id, owner: m.owner, settled });
    } catch {
      // skip unreachable managers
    }
  }

  console.log(`\nManagers with ≥1 settled position (top-40 recent scanned): ${withSettled.length}`);
  for (const w of withSettled.slice(0, 15)) {
    console.log(`  ${w.manager_id}  owner=${w.owner.slice(0, 10)}…  settled=${w.settled}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
