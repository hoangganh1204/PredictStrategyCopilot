// T069 — Integration test for the leaderboard API routes.
// MSW mocks the Public Server; we call the Next route handlers directly.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PositionSummaryItem } from "@/types/predict-server.js";
import {
  GET as leaderboardGET,
  __resetLeaderboardCacheForTests,
} from "@/app/api/leaderboard/route.js";
import { GET as leaderGET } from "@/app/api/leaders/[address]/route.js";

const SERVER_URL = "https://predict-server.testnet.mystenlabs.com";

const A1 = "0xaaaa000000000000000000000000000000000000000000000000000000001111";
const A2 = "0xbbbb000000000000000000000000000000000000000000000000000000002222";
const M1 = "0xm1";
const M2 = "0xm2";

const MANAGERS = [
  { manager_id: M1, owner: A1, checkpoint: 20 },
  { manager_id: M2, owner: A2, checkpoint: 10 },
];

let seq = 0;
function mk(p: Partial<PositionSummaryItem>): PositionSummaryItem {
  seq += 1;
  return {
    predict_id: "0xpredict",
    manager_id: "0xmanager",
    oracle_id: "0xoracle",
    underlying_asset: "BTC",
    expiry: 1_781_253_000_000,
    minted_quantity: 1,
    open_quantity: 0,
    total_cost: 0,
    unrealized_pnl: 0,
    realized_pnl: 0,
    status: "active",
    last_activity_at: seq,
    ...p,
  } as PositionSummaryItem;
}

// M1: net +120 over 3 settled (2 won, 1 lost). M2: net 0 over 3 settled (1 won, 2 lost).
const POSITIONS: Record<string, PositionSummaryItem[]> = {
  [M1]: [
    mk({ status: "redeemed", is_up: true, realized_pnl: 100, last_activity_at: 3 }),
    mk({ status: "redeemable", is_up: true, realized_pnl: 50, last_activity_at: 2 }),
    mk({ status: "lost", is_up: false, realized_pnl: -30, last_activity_at: 1 }),
  ],
  [M2]: [
    mk({ status: "redeemed", lower_strike: 1, higher_strike: 2, realized_pnl: 10 }),
    mk({ status: "lost", is_up: true, realized_pnl: -5 }),
    mk({ status: "lost", is_up: true, realized_pnl: -5 }),
  ],
};

const server = setupServer(
  http.get(`${SERVER_URL}/managers`, ({ request }) => {
    const owner = new URL(request.url).searchParams.get("owner");
    if (owner) return HttpResponse.json(MANAGERS.filter((m) => m.owner === owner));
    return HttpResponse.json(MANAGERS);
  }),
  http.get(`${SERVER_URL}/managers/:id/positions/summary`, ({ params }) =>
    HttpResponse.json(POSITIONS[params.id as string] ?? [])
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => __resetLeaderboardCacheForTests()); // isolate the 30s server cache
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GET /api/leaderboard", () => {
  it("ranks investors by net P&L descending with 1-based ranks", async () => {
    const res = await leaderboardGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leaders.map((l: { address: string }) => l.address)).toEqual([A1, A2]);
    expect(body.leaders.map((l: { rank: number }) => l.rank)).toEqual([1, 2]);
    expect(body.leaders[0].netPnl_raw).toBe(120);
    expect(body.sparse).toBe(false);
  });

  it("returns the LeaderboardResult shape", async () => {
    const res = await leaderboardGET();
    const body = await res.json();
    expect(Array.isArray(body.leaders)).toBe(true);
    expect(typeof body.sparse).toBe("boolean");
    for (const l of body.leaders) {
      expect(typeof l.address).toBe("string");
      expect(typeof l.netPnl_raw).toBe("number");
      expect(typeof l.winRate).toBe("number");
      expect(typeof l.settledCount).toBe("number");
      expect(typeof l.rank).toBe("number");
      expect(Array.isArray(l.recentStrategyTypes)).toBe(true);
    }
  });

  it("flags sparse with an honest message when there is no data", async () => {
    server.use(http.get(`${SERVER_URL}/managers`, () => HttpResponse.json([])));
    const res = await leaderboardGET();
    const body = await res.json();
    expect(body.leaders).toHaveLength(0);
    expect(body.sparse).toBe(true);
    expect(body.message).toBeTruthy();
  });
});

describe("GET /api/leaders/:address", () => {
  function call(address: string) {
    return leaderGET(new Request(`http://localhost/api/leaders/${address}`), {
      params: Promise.resolve({ address }),
    });
  }

  it("returns investor detail with recent trades and strategy breakdown", async () => {
    const res = await call(A1);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBe(A1);
    expect(body.recentTrades.length).toBe(3);
    // newest-first: ts=3 (up/won), then ts=2 (up/won), then ts=1 (down/lost)
    expect(body.recentTrades[0]).toMatchObject({ type: "binary_up", outcome: "won" });
    expect(body.recentTrades[2]).toMatchObject({ type: "binary_down", outcome: "lost" });
    const up = body.strategyBreakdown.find((b: { type: string }) => b.type === "binary_up");
    expect(up).toMatchObject({ count: 2, netPnl_raw: 150 });
  });

  it("returns 404 ERR_NO_ACTIVITY for an unknown address", async () => {
    const res = await call("0xunknown");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("ERR_NO_ACTIVITY");
  });
});
