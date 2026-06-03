import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  fetchOracleList,
  fetchOracleState,
  fetchSviLatest,
  fetchAskBounds,
  PredictClientError,
} from "@/lib/predict-client";
import type { OracleListItem, OracleSviParams } from "@/types/predict-server";

const SERVER_URL = "https://predict-server.testnet.mystenlabs.com";
const ORACLE_ID = "0x62a0440b74d3594c0196ee0e89a3873fe879d2655e7972fc771cae13f0dfd2f2";
const PREDICT_ID = "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a";

const MOCK_ORACLE: OracleListItem = {
  predict_id: PREDICT_ID,
  oracle_id: ORACLE_ID,
  oracle_cap_id: "0x09c3",
  underlying_asset: "BTC",
  expiry: 1780491600000,
  min_strike: 50_000_000_000_000,
  tick_size: 1_000_000_000,
  status: "active",
  activated_at: 1780474000000,
  settlement_price: null,
  settled_at: null,
  created_checkpoint: 344000000,
};

const MOCK_SVI: OracleSviParams = {
  event_digest: "test",
  digest: "test",
  sender: "0xcca2",
  checkpoint: 344080907,
  checkpoint_timestamp_ms: 1780461943321,
  tx_index: 1,
  event_index: 31,
  package: "f5ea",
  oracle_id: ORACLE_ID,
  a: 120350,
  b: 1079485,
  rho: 950000000,
  rho_negative: true,
  m: 11768203,
  m_negative: false,
  sigma: 1000000,
  onchain_timestamp: 1780461943128,
};

const server = setupServer(
  http.get(`${SERVER_URL}/predicts/:predictId/oracles`, () =>
    HttpResponse.json([MOCK_ORACLE])
  ),
  http.get(`${SERVER_URL}/oracles/:oracleId/state`, () =>
    HttpResponse.json({
      oracle: MOCK_ORACLE,
      latest_price: {
        spot: 67074059995523,
        forward: 67066930290353,
        onchain_timestamp: 1780474184239,
        event_digest: "e",
        digest: "d",
        sender: "0x",
        checkpoint: 1,
        checkpoint_timestamp_ms: 1780474184306,
        tx_index: 5,
        event_index: 17,
        package: "f5ea",
        oracle_id: ORACLE_ID,
      },
      latest_svi: MOCK_SVI,
      ask_bounds: null,
    })
  ),
  http.get(`${SERVER_URL}/oracles/:oracleId/svi/latest`, () =>
    HttpResponse.json(MOCK_SVI)
  ),
  http.get(`${SERVER_URL}/oracles/:oracleId/ask-bounds`, () =>
    HttpResponse.json(null)
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("fetchOracleList", () => {
  it("returns array of oracles", async () => {
    const result = await fetchOracleList(PREDICT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].oracle_id).toBe(ORACLE_ID);
    expect(result[0].status).toBe("active");
  });
});

describe("fetchOracleState", () => {
  it("returns oracle state with nested fields", async () => {
    const result = await fetchOracleState(ORACLE_ID);
    expect(result.oracle.oracle_id).toBe(ORACLE_ID);
    expect(result.latest_price?.spot).toBe(67074059995523);
    expect(result.latest_svi?.a).toBe(120350);
    expect(result.ask_bounds).toBeNull();
  });
});

describe("fetchSviLatest", () => {
  it("returns SVI params with sign flags", async () => {
    const result = await fetchSviLatest(ORACLE_ID);
    expect(result.a).toBe(120350);
    expect(result.rho_negative).toBe(true);
    expect(result.m_negative).toBe(false);
  });
});

describe("fetchAskBounds", () => {
  it("returns null when bounds not configured", async () => {
    const result = await fetchAskBounds(ORACLE_ID);
    expect(result).toBeNull();
  });
});

describe("error handling", () => {
  it("throws PredictClientError on 404", async () => {
    server.use(
      http.get(`${SERVER_URL}/oracles/:oracleId/state`, () =>
        HttpResponse.json({ error: "not found" }, { status: 404 })
      )
    );
    await expect(fetchOracleState(ORACLE_ID)).rejects.toThrow(PredictClientError);
  });

  it("throws PredictClientError on 500", async () => {
    server.use(
      http.get(`${SERVER_URL}/oracles/:oracleId/svi/latest`, () =>
        HttpResponse.json({ error: "server error" }, { status: 500 })
      )
    );
    await expect(fetchSviLatest(ORACLE_ID)).rejects.toThrow(PredictClientError);
  });
});
