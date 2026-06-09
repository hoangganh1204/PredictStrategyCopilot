// POST /api/range-mark — current sell-back value (mark) for open range positions.
// Range positions aren't indexed by the Public Server, so we price them on demand
// via devInspect get_range_trade_amounts and let the client derive live P&L.
import { NextRequest, NextResponse } from "next/server";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { makeDevInspectPricingFn } from "@/lib/strategy/devInspectPricing.js";

const suiClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});
const price = makeDevInspectPricingFn(suiClient);

interface MarkItem {
  key: string;
  oracleId: string;
  lower: string;
  higher: string;
  quantity: string;
  expiry: number;
}

export async function POST(req: NextRequest) {
  let items: MarkItem[] = [];
  try {
    items = (await req.json())?.items ?? [];
  } catch {
    return NextResponse.json({ ok: false, marks: [] }, { status: 200 });
  }

  const marks = await Promise.all(
    items.map(async (it) => {
      try {
        const { redeem_payout_raw } = await price(
          it.oracleId,
          0n,
          null, // range
          BigInt(it.lower),
          BigInt(it.higher),
          BigInt(it.quantity),
          it.expiry
        );
        return { key: it.key, redeem_payout: Number(redeem_payout_raw) };
      } catch {
        return { key: it.key, redeem_payout: null };
      }
    })
  );

  return NextResponse.json({ ok: true, marks });
}
