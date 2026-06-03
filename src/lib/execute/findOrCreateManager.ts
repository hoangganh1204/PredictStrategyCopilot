// Find existing PredictManager for the wallet or create a new one.
// No direct wallet import — accepts deps as parameters for testability.
import { Transaction } from "@mysten/sui/transactions";
import { PREDICT_CONFIG } from "@/config/predict.js";
import type { SignAndExecuteFn } from "./types.js";

const MANAGER_TYPE =
  `${PREDICT_CONFIG.PACKAGE}::predict_manager::PredictManager`;

export interface ManagerDeps {
  /** Fetch owned objects for an address */
  listOwnedObjects: (owner: string, structType: string) => Promise<{ data: { objectId: string }[] }>;
  signAndExecute: SignAndExecuteFn;
  walletAddress: string;
}

/**
 * Returns the PredictManager object ID for the current wallet.
 * Creates one on-chain if not found.
 */
export async function findOrCreateManager(deps: ManagerDeps): Promise<string> {
  const { listOwnedObjects, signAndExecute, walletAddress } = deps;

  const existing = await listOwnedObjects(walletAddress, MANAGER_TYPE);
  if (existing.data.length > 0) {
    return existing.data[0].objectId;
  }

  // Create manager
  const tx = new Transaction();
  tx.moveCall({
    target: `${PREDICT_CONFIG.PACKAGE}::predict::create_manager`,
    arguments: [],
  });

  const result = await signAndExecute(tx);
  if (result.status !== "success" || !result.digest) {
    throw new Error(`create_manager failed: ${result.error ?? "unknown error"}`);
  }

  // Re-query to get the created object ID
  const after = await listOwnedObjects(walletAddress, MANAGER_TYPE);
  if (after.data.length === 0) {
    throw new Error("PredictManager created but not found in owned objects");
  }
  return after.data[0].objectId;
}
