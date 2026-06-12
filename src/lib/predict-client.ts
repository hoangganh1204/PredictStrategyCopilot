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
