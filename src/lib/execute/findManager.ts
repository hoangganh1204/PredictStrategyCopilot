// PredictManager is a SHARED object — it cannot be found via getOwnedObjects.
// Discover it via the Public Server's owner-filtered manager index. (Querying
// PredictManagerCreated from chain events is unreliable: for an active wallet
// the creation event falls outside the recent-events window, so the manager
// "disappears" and the UI wrongly prompts to create a new one.)
import { PREDICT_CONFIG } from "@/config/predict.js";

interface ManagerCreatedRecord {
  manager_id: string;
  owner: string;
  checkpoint: number;
}

/**
 * Return the wallet's active PredictManager ID (its most recently created one),
 * or null if it has none.
 */
export async function findManagerId(owner: string): Promise<string | null> {
  const res = await fetch(`${PREDICT_CONFIG.SERVER_URL}/managers?owner=${owner}`);
  if (!res.ok) return null;

  const records = (await res.json()) as ManagerCreatedRecord[];
  if (!Array.isArray(records) || records.length === 0) return null;

  // Highest checkpoint = most recently created = the account in active use.
  const latest = records.reduce((a, b) => (b.checkpoint > a.checkpoint ? b : a));
  return latest.manager_id ?? null;
}
