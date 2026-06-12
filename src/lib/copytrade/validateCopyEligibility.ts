// T081 — The three copy-trade eligibility gates (FR-020). Checked in order; the
// first failure wins. Reasons are plain language, consistent with the app (English).
import { SVI_STALENESS_MS } from "@/config/predict.js";
import type { CopyEligibility } from "./types.js";

/**
 * @param oracle              minimal oracle shape — only `status` is read
 * @param sviTimestamp        Unix ms of the latest volatility snapshot
 * @param followerBalance_raw follower's game-account balance, scale 1e6
 * @param estimatedCost_raw   estimated DUSDC the copy would spend, scale 1e6
 * @param now                 injectable clock (defaults to Date.now())
 *
 * Staleness boundary: an age of exactly SVI_STALENESS_MS (30_000ms) is blocked.
 */
export function validateCopyEligibility(
  oracle: { status: string },
  sviTimestamp: number,
  followerBalance_raw: bigint,
  estimatedCost_raw: bigint,
  now: number = Date.now()
): CopyEligibility {
  if (oracle.status !== "active") {
    return { eligible: false, reason: "This market is no longer open to copy." };
  }
  if (now - sviTimestamp >= SVI_STALENESS_MS) {
    return { eligible: false, reason: "Market data is refreshing — try again in a moment." };
  }
  if (followerBalance_raw < estimatedCost_raw) {
    return { eligible: false, reason: "Not enough DUSDC in your account to copy this bet." };
  }
  return { eligible: true };
}
