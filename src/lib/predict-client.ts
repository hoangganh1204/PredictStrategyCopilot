// Typed fetch wrapper for DeepBook Predict Public Server endpoints.
import { PREDICT_CONFIG } from "@/config/predict.js";
import type {
  OracleListResponse,
  OracleStateResponse,
  SviLatestResponse,
  AskBoundsResponse,
  ManagerSummaryResponse,
  PositionsSummaryResponse,
} from "@/types/predict-server.js";

export class PredictClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "PredictClientError";
  }
}

async function get<T>(path: string): Promise<T> {
  const url = `${PREDICT_CONFIG.SERVER_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new PredictClientError(
      res.status,
      path,
      `Predict server returned ${res.status} for ${path}`
    );
  }
  return res.json() as Promise<T>;
}

export function fetchOracleList(predictId: string): Promise<OracleListResponse> {
  return get(`/predicts/${predictId}/oracles`);
}

export function fetchOracleState(oracleId: string): Promise<OracleStateResponse> {
  return get(`/oracles/${oracleId}/state`);
}

export function fetchSviLatest(oracleId: string): Promise<SviLatestResponse> {
  return get(`/oracles/${oracleId}/svi/latest`);
}

/** Recent SVI snapshots (newest first) — used to gauge current vol vs its norm. */
export function fetchSviHistory(oracleId: string): Promise<SviLatestResponse[]> {
  return get(`/oracles/${oracleId}/svi`);
}

export function fetchAskBounds(oracleId: string): Promise<AskBoundsResponse | null> {
  return get(`/oracles/${oracleId}/ask-bounds`);
}

export function fetchManagerSummary(managerId: string): Promise<ManagerSummaryResponse> {
  return get(`/managers/${managerId}/summary`);
}

export function fetchPositionsSummary(
  managerId: string
): Promise<PositionsSummaryResponse> {
  return get(`/managers/${managerId}/positions/summary`);
}

/** One on-chain mint event (binary) — carries the tx digest for explorer links. */
export interface MintedEventRecord {
  oracle_id: string;
  is_up: boolean;
  strike: number;
  digest: string;
  checkpoint_timestamp_ms: number;
}

/** Raw minted/redeemed events for a manager (binary). The summary endpoint omits
 *  the tx digest, so we read it from here to link each position to its mint tx. */
export function fetchPositionsRaw(
  managerId: string
): Promise<{ minted: MintedEventRecord[]; redeemed: unknown[] }> {
  return get(`/managers/${managerId}/positions`);
}

/** One PredictManager as indexed by the server's manager-created feed. */
export interface ManagerRecord {
  manager_id: string;
  owner: string;
  checkpoint: number;
}

/**
 * Every PredictManager known to the server (leaderboard enumeration — T060).
 * The dedicated `/predicts/:id/managers` endpoint is empty on testnet, so we use
 * the unfiltered `/managers` index (one record per creation event) and de-dupe.
 * `predictId` is accepted for API symmetry but the index is not predict-scoped.
 */
export async function fetchAllManagerIds(_predictId?: string): Promise<ManagerRecord[]> {
  const records = await get<ManagerRecord[]>(`/managers`);
  if (!Array.isArray(records)) return [];
  const byId = new Map<string, ManagerRecord>();
  for (const r of records) if (r?.manager_id) byId.set(r.manager_id, r);
  return [...byId.values()];
}

/** Alias for fetchPositionsSummary — reads as the leaderboard's intent. */
export function fetchManagerPositions(
  managerId: string
): Promise<PositionsSummaryResponse> {
  return fetchPositionsSummary(managerId);
}
