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
