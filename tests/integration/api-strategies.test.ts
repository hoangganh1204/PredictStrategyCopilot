// Integration test for GET /api/strategies.
// Uses MSW to mock the Public Server; vi.mock stubs out SuiClient + devInspectPricing.
// vi.mock calls are hoisted by vitest before any imports.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { OracleListItem, OracleSviParams } from "@/types/predict-server.js";

vi.mock("@/lib/strategy/devInspectPricing.js", () => ({
  makeDevInspectPricingFn: () =>
    vi.fn().mockResolvedValue({
      mint_cost_raw: 485_525n,
      redeem_payout_raw: 1_000_000n,
    }),
}));

vi.mock("@mysten/sui/jsonRpc", () => ({
  SuiJsonRpcClient: vi.fn(),
  getJsonRpcFullnodeUrl: () => "https://fullnode.testnet.sui.io:443",
}));

import { GET } from "@/app/api/strategies/route.js";

const SERVER_URL = "https://predict-server.testnet.mystenlabs.com";
const PREDICT_ID = "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a";
const ORACLE_ID = "0x62a0440b74d3594c0196ee0e89a3873fe879d2655e7972fc771cae13f0dfd2f2";

const NOW = Date.now();
const ACTIVE_ORACLE: OracleListItem = {
  predict_id: PREDICT_ID,
  oracle_id: ORACLE_ID,
  oracle_cap_id: "0x09c3",
  underlying_asset: "BTC",
  expiry: NOW + 15 * 60 * 1000,
  min_strike: 50_000_000_000_000,
  tick_size: 1_000_000_000,
  status: "active",
  activated_at: NOW - 5 * 60 * 1000,
  settlement_price: null,
  settled_at: null,
  created_checkpoint: 344000000,
};

const FRESH_SVI: OracleSviParams = {
  event_digest: "e",
  digest: "d",
  sender: "0xcca2",
  checkpoint: 344000000,
  checkpoint_timestamp_ms: NOW - 5000,
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
  sigma: 7977445,
  onchain_timestamp: NOW - 5000,
};

const MOCK_STATE = {
  oracle: ACTIVE_ORACLE,
  latest_price: {
    spot: 67074059995523,
    forward: 67066930290353,
    onchain_timestamp: NOW - 2000,
    event_digest: "e",
    digest: "d",
    sender: "0x",
    checkpoint: 1,
    checkpoint_timestamp_ms: NOW - 2000,
    tx_index: 5,
    event_index: 17,
    package: "f5ea",
    oracle_id: ORACLE_ID,
  },
  latest_svi: FRESH_SVI,
  ask_bounds: null,
};

const server = setupServer(
  http.get(`${SERVER_URL}/predicts/:predictId/oracles`, () =>
    HttpResponse.json([ACTIVE_ORACLE])
  ),
  http.get(`${SERVER_URL}/oracles/:oracleId/state`, () =>
    HttpResponse.json(MOCK_STATE)
  ),
  http.get(`${SERVER_URL}/oracles/:oracleId/svi/latest`, () =>
    HttpResponse.json(FRESH_SVI)
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/strategies");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { nextUrl: url } as Parameters<typeof GET>[0];
}

describe("GET /api/strategies", () => {
  it("returns 3 strategies for valid request", async () => {
    const res = await GET(makeRequest({ amount: "10", oracleId: ORACLE_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.strategies).toHaveLength(3);
    expect(body.oracle_id).toBe(ORACLE_ID);
  });

  it("strategies have correct shape", async () => {
    const res = await GET(makeRequest({ amount: "10", oracleId: ORACLE_ID }));
    const body = await res.json();
    for (const s of body.strategies) {
      expect(["range", "binary_up", "binary_down"]).toContain(s.type);
      expect(typeof s.cost_raw).toBe("string");
      expect(typeof s.payout_raw).toBe("string");
      expect(typeof s.prob).toBe("number");
      expect(s.prob).toBeGreaterThan(0);
      expect(s.prob).toBeLessThan(1);
    }
  });

  it("returns 400 ERR_INVALID_AMOUNT when amount missing", async () => {
    const res = await GET(makeRequest({ oracleId: ORACLE_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("ERR_INVALID_AMOUNT");
  });

  it("returns 400 ERR_INVALID_AMOUNT when oracleId missing", async () => {
    const res = await GET(makeRequest({ amount: "10" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("ERR_INVALID_AMOUNT");
  });

  it("returns 400 ERR_NO_MARKET when the oracle is not open", async () => {
    server.use(
      http.get(`${SERVER_URL}/predicts/:predictId/oracles`, () =>
        HttpResponse.json([{ ...ACTIVE_ORACLE, status: "settled" }])
      )
    );
    const res = await GET(makeRequest({ amount: "10", oracleId: ORACLE_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("ERR_NO_MARKET");
  });

  it("returns 400 ERR_NO_MARKET when the oracleId is unknown", async () => {
    const res = await GET(makeRequest({ amount: "10", oracleId: "0xdeadbeef" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("ERR_NO_MARKET");
  });

  it("returns 400 ERR_STALE_SVI when SVI checkpoint is old", async () => {
    server.use(
      http.get(`${SERVER_URL}/oracles/:oracleId/svi/latest`, () =>
        HttpResponse.json({ ...FRESH_SVI, checkpoint_timestamp_ms: NOW - 35_000 })
      )
    );
    const res = await GET(makeRequest({ amount: "10", oracleId: ORACLE_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("ERR_STALE_SVI");
  });
});
