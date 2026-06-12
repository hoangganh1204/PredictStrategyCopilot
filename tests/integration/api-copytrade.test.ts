// T084 — Integration test for GET /api/leaders/:address/latest-position.
// MSW mocks the Public Server; vi.mock stubs devInspect pricing + the RPC client.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PositionSummaryItem } from "@/types/predict-server.js";

// Fixed cost-per-token so sizing is deterministic: 0.5 DUSDC/token.
vi.mock("@/lib/strategy/devInspectPricing.js", () => ({
  makeDevInspectPricingFn: () =>
    vi.fn().mockResolvedValue({ mint_cost_raw: 500_000n, redeem_payout_raw: 480_000n }),
}));

vi.mock("@mysten/sui/jsonRpc", () => ({
  SuiJsonRpcClient: vi.fn(),
  getJsonRpcFullnodeUrl: () => "https://fullnode.testnet.sui.io:443",
}));

import { GET } from "@/app/api/leaders/[address]/latest-position/route.js";

const SERVER_URL = "https://predict-server.testnet.mystenlabs.com";
const LEADER = `0x${"a".repeat(64)}`;
const LEADER_MANAGER = `0x${"b".repeat(64)}`;
const FOLLOWER_MANAGER = `0x${"c".repeat(64)}`;
const ORACLE = `0x${"d".repeat(64)}`;

function leaderPosition(p: Partial<PositionSummaryItem> = {}): PositionSummaryItem {
  return {
    predict_id: "0xpredict",
    manager_id: LEADER_MANAGER,
    oracle_id: ORACLE,
    underlying_asset: "BTC",
    expiry: 1_781_253_000_000,
    strike: 62_000_000_000_000,
    is_up: true,
    minted_quantity: 2,
    open_quantity: 2,
    total_cost: 1_000_000,
    unrealized_pnl: 0,
    realized_pnl: 0,
    status: "active",
    last_activity_at: 1_781_246_000_000,
    ...p,
  } as PositionSummaryItem;
}

function oracleState(over: { status?: string; sviAgeMs?: number } = {}) {
  return {
    oracle: { oracle_id: ORACLE, status: over.status ?? "active", expiry: 1_781_253_000_000 },
    latest_price: { spot: 62_000_000_000_000, forward: 62_000_000_000_000 },
    latest_svi: { checkpoint_timestamp_ms: Date.now() - (over.sviAgeMs ?? 3_000) },
    ask_bounds: null,
  };
}

let positionsResponse: PositionSummaryItem[] = [leaderPosition()];
let stateResponse = oracleState();
let balanceResponse = 100_000_000;

const server = setupServer(
  http.get(`${SERVER_URL}/managers`, ({ request }) => {
    const owner = new URL(request.url).searchParams.get("owner");
    if (owner) return HttpResponse.json([{ manager_id: LEADER_MANAGER, owner, checkpoint: 1 }]);
    return HttpResponse.json([]);
  }),
  http.get(`${SERVER_URL}/managers/:id/positions/summary`, () => HttpResponse.json(positionsResponse)),
  http.get(`${SERVER_URL}/managers/:id/summary`, ({ params }) =>
    HttpResponse.json({ manager_id: params.id, owner: LEADER, trading_balance: balanceResponse })
  ),
  http.get(`${SERVER_URL}/oracles/:id/state`, () => HttpResponse.json(stateResponse))
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  positionsResponse = [leaderPosition()];
  stateResponse = oracleState();
  balanceResponse = 100_000_000;
});
afterAll(() => server.close());

function call(followerAmount: string, followerManager: string | null = FOLLOWER_MANAGER) {
  const url = new URL(`http://localhost/api/leaders/${LEADER}/latest-position`);
  url.searchParams.set("followerAmount", followerAmount);
  if (followerManager) url.searchParams.set("followerManager", followerManager);
  return GET({ nextUrl: url } as Parameters<typeof GET>[0], {
    params: Promise.resolve({ address: LEADER }),
  });
}

describe("GET /api/leaders/:address/latest-position", () => {
  it("returns copyable=true with scaled copyParams preserving strategy type", async () => {
    const res = await call("10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.copyable).toBe(true);
    expect(body.strategyType).toBe("binary_up");
    expect(body.copyParams.isUp).toBe(true);
    expect(body.copyParams.strike_raw).toBe("62000000000000");
    // 10 DUSDC / 0.5 per token = 20 tokens.
    expect(body.copyParams.quantity_raw).toBe("20000000");
    expect(body.copyParams.cost_raw).toBe("10000000");
    expect(body.copyParams.payout_raw).toBe("20000000");
  });

  it("preserves a range leader's bounds", async () => {
    positionsResponse = [
      leaderPosition({ is_up: undefined, strike: undefined, lower_strike: 60_000_000_000_000, higher_strike: 64_000_000_000_000 }),
    ];
    const body = await (await call("10")).json();
    expect(body.copyable).toBe(true);
    expect(body.strategyType).toBe("range");
    expect(body.copyParams.lowerStrike_raw).toBe("60000000000000");
    expect(body.copyParams.upperStrike_raw).toBe("64000000000000");
  });

  it("returns copyable=false (HTTP 200) when the market is closed", async () => {
    stateResponse = oracleState({ status: "settled" });
    const res = await call("10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.copyable).toBe(false);
    expect(body.reason.length).toBeGreaterThan(0);
  });

  it("returns copyable=false when SVI is stale", async () => {
    stateResponse = oracleState({ sviAgeMs: 35_000 });
    const body = await (await call("10")).json();
    expect(body.copyable).toBe(false);
    expect(body.reason.length).toBeGreaterThan(0);
  });

  it("returns copyable=false when the follower balance is insufficient", async () => {
    balanceResponse = 0;
    const body = await (await call("10")).json();
    expect(body.copyable).toBe(false);
    expect(body.reason.length).toBeGreaterThan(0);
  });

  it("returns copyable=false when no follower account is provided", async () => {
    const body = await (await call("10", null)).json();
    expect(body.copyable).toBe(false);
    expect(body.reason.length).toBeGreaterThan(0);
  });
});
