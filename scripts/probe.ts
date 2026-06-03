/**
 * MS0 Probe script — verifies all 8 unknowns before implementation begins.
 * Run: pnpm probe
 */
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

const SERVER_URL = "https://predict-server.testnet.mystenlabs.com";
const PREDICT_PACKAGE =
  "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138";
const PREDICT_OBJECT =
  "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a";
const CLOCK_OBJECT = "0x6";
const DUSDC_TYPE =
  "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC";
const NULL_SENDER =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(`${SERVER_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

// ─── Probe #6: All Public Server endpoint shapes ─────────────────────────────

async function probeEndpoints() {
  console.log("\n=== PROBE #6: Public Server Endpoint Shapes ===\n");

  console.log("--- GET /predicts/:predict_id/oracles ---");
  const oracles = await fetchJson(`/predicts/${PREDICT_OBJECT}/oracles`);
  console.log(JSON.stringify(oracles, null, 2));

  const oracleList = oracles as { oracle_id: string; status: string }[];
  const activeOracle =
    oracleList.find((o) => o.status === "active") ?? oracleList[0];
  if (!activeOracle) {
    console.log("No oracles found — cannot probe further endpoints");
    return null;
  }
  const oracleId = activeOracle.oracle_id;
  console.log(`\nUsing oracle (status=${activeOracle.status}): ${oracleId}\n`);

  console.log("--- GET /oracles/:oracle_id/state ---");
  const oracleStateRaw = await fetchJson(`/oracles/${oracleId}/state`) as Record<string, unknown>;
  console.log(JSON.stringify(oracleStateRaw, null, 2));
  // State is nested: { oracle, latest_price, latest_svi, ask_bounds }
  const oracleState = oracleStateRaw.oracle as Record<string, unknown>;
  const latestPrice = oracleStateRaw.latest_price as Record<string, unknown>;
  const latestSvi = oracleStateRaw.latest_svi as Record<string, unknown>;

  console.log("\n--- GET /oracles/:oracle_id/svi/latest ---");
  const sviLatest = await fetchJson(`/oracles/${oracleId}/svi/latest`);
  console.log(JSON.stringify(sviLatest, null, 2));

  // Find an oracle WITH ask_bounds (try active ones)
  let askBounds: unknown = null;
  let askBoundsOracleId = oracleId;
  for (const o of oracleList.filter((x) => x.status === "active")) {
    console.log(`\n--- GET /oracles/${o.oracle_id}/ask-bounds ---`);
    const ab = await fetchJson(`/oracles/${o.oracle_id}/ask-bounds`);
    console.log(JSON.stringify(ab, null, 2));
    if (ab !== null) {
      askBounds = ab;
      askBoundsOracleId = o.oracle_id;
      break;
    }
  }
  if (!askBounds) {
    console.log("NOTE: ask_bounds is null for all active oracles — market may not be active yet");
  }

  return { oracleId, oracleState, latestPrice, latestSvi, sviLatest, askBounds, askBoundsOracleId };
}

// ─── Probe #3: Scale factors & signed I64 ────────────────────────────────────

function probeScaleFactors(
  oracleState: Record<string, unknown>,
  latestPrice: Record<string, unknown>,
  sviLatest: unknown,
  askBounds: unknown
) {
  console.log("\n=== PROBE #3: Scale Factors & Field Types ===\n");

  const svi = sviLatest as Record<string, unknown>;

  console.log("oracle keys:", Object.keys(oracleState));
  console.log("latest_price keys:", Object.keys(latestPrice));
  console.log("svi keys:", Object.keys(svi));

  console.log(`\nspot: ${latestPrice.spot}`);
  console.log(`forward: ${latestPrice.forward}`);
  console.log(`min_strike: ${oracleState.min_strike}`);
  console.log(`tick_size: ${oracleState.tick_size}`);

  console.log("\nSVI params raw values:");
  for (const [k, v] of Object.entries(svi)) {
    if (["a","b","rho","rho_negative","m","m_negative","sigma"].includes(k)) {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
  }

  // Apply sign flags
  const rhoRaw = Number(svi.rho);
  const mRaw = Number(svi.m);
  const rho = svi.rho_negative ? -rhoRaw : rhoRaw;
  const m = svi.m_negative ? -mRaw : mRaw;
  console.log(`  → rho (signed): ${rho}`);
  console.log(`  → m (signed): ${m}`);

  if (askBounds !== null) {
    const bounds = askBounds as Record<string, unknown>;
    console.log("\nAsk-bounds keys:", Object.keys(bounds));
    for (const [k, v] of Object.entries(bounds)) {
      if (!Array.isArray(v)) {
        console.log(`  ${k}: ${JSON.stringify(v)}`);
      } else {
        console.log(`  ${k}: [array len=${(v as unknown[]).length}] first=${JSON.stringify((v as unknown[])[0])} last=${JSON.stringify((v as unknown[]).at(-1))}`);
      }
    }
  } else {
    console.log("\nask_bounds: null — cannot probe scale from bounds");
  }
}

// ─── Probe #5: Expiry unit (ms vs seconds) ───────────────────────────────────

function probeExpiryUnit(oracleState: Record<string, unknown>) {
  console.log("\n=== PROBE #5: Expiry Unit (ms vs seconds) ===\n");

  const now = Date.now();
  const expiryField = Object.keys(oracleState).find((k) =>
    /expir|settl|maturity/i.test(k)
  );
  if (!expiryField) {
    console.log("No expiry field found. All oracle keys:", Object.keys(oracleState));
    return;
  }
  const expiry = oracleState[expiryField];
  console.log(`Field: "${expiryField}", raw value: ${expiry}`);
  console.log(`Date.now() (ms): ${now}`);

  const expiryNum = Number(expiry);
  const diffMs = expiryNum - now;
  const diffSec = expiryNum * 1000 - now;

  console.log(
    `If ms:  diff = ${(diffMs / 60000).toFixed(1)} min from now (${expiryNum > now ? "FUTURE" : "PAST"})`
  );
  console.log(
    `If sec: diff = ${(diffSec / 60000).toFixed(1)} min from now (${expiryNum * 1000 > now ? "FUTURE" : "PAST"})`
  );

  if (expiryNum > now) {
    console.log("CONCLUSION: expiry is in MILLISECONDS");
  } else if (expiryNum * 1000 > now) {
    console.log("CONCLUSION: expiry is in SECONDS");
  } else {
    console.log(
      "CONCLUSION: expiry is in the PAST (market may be settled/closed)"
    );
  }
}

// ─── Probe #4: Strike grid ────────────────────────────────────────────────────

function probeStrikeGrid(askBounds: unknown): bigint {
  console.log("\n=== PROBE #4: Strike Grid Resolution ===\n");

  if (askBounds === null || askBounds === undefined) {
    console.log("ask_bounds is null — grid not available from this endpoint");
    console.log("CONCLUSION: Grid likely computed from oracle.min_strike + oracle.tick_size");
    return 0n;
  }

  const bounds = askBounds as Record<string, unknown>;

  // Check for explicit strikes array
  const strikesKey = Object.keys(bounds).find((k) => /strike/i.test(k));
  if (strikesKey && Array.isArray(bounds[strikesKey])) {
    const strikes = bounds[strikesKey] as unknown[];
    console.log(`Grid type: EXPLICIT LIST (key="${strikesKey}")`);
    console.log(`Total strikes: ${strikes.length}`);
    console.log("First 5:", strikes.slice(0, 5));
    console.log("Last 5:", strikes.slice(-5));
    const mid = strikes[Math.floor(strikes.length / 2)];
    console.log(`Mid strike: ${mid}`);
    return BigInt(String(mid));
  }

  // Otherwise bounds + step
  console.log("Grid type: BOUNDS + STEP");
  const lower =
    bounds.lower_bound ?? bounds.lower ?? bounds.min_strike ?? bounds.lo ?? 0;
  const upper =
    bounds.upper_bound ?? bounds.upper ?? bounds.max_strike ?? bounds.hi ?? 0;
  const step = bounds.step ?? bounds.strike_step ?? null;
  console.log(`lower: ${lower}, upper: ${upper}, step: ${step}`);

  const lowerN = BigInt(String(lower));
  const upperN = BigInt(String(upper));
  return (lowerN + upperN) / 2n;
}

// ─── Probe #7: SVI w(k) convention ───────────────────────────────────────────

function probeSviConvention(sviLatest: unknown, expiryMs: number) {
  console.log("\n=== PROBE #7: SVI w(k) Convention ===\n");

  const svi = sviLatest as Record<string, unknown>;
  const now = Date.now();
  const T = Math.max((expiryMs - now) / (365.25 * 24 * 3600 * 1000), 0.0001);
  console.log(`Time to expiry T = ${T.toFixed(6)} years`);

  // Read raw values — sign determined by _negative flags
  const aRaw = Number(svi.a ?? 0);
  const bRaw = Number(svi.b ?? 0);
  const rhoRaw = Number(svi.rho ?? 0);
  const mRaw = Number(svi.m ?? 0);
  const sigmaRaw = Number(svi.sigma ?? 1);

  // Apply sign flags
  const rhoSigned = svi.rho_negative ? -rhoRaw : rhoRaw;
  const mSigned = svi.m_negative ? -mRaw : mRaw;

  console.log(`Raw: a=${aRaw} b=${bRaw} rho=${rhoRaw}(neg=${svi.rho_negative}) m=${mRaw}(neg=${svi.m_negative}) sigma=${sigmaRaw}`);

  // Test at different scales
  for (const scale of [1, 1e6, 1e9]) {
    const a = aRaw / scale;
    const b = bRaw / scale;
    const rho = rhoSigned / scale;
    const m = mSigned / scale;
    const sigma = sigmaRaw / scale;

    // SVI: w(k) = a + b*(rho*(k-m) + sqrt((k-m)^2 + sigma^2))
    // At ATM k=0: w(0) = a + b*(rho*(0-m) + sqrt(m^2 + sigma^2))
    const w = a + b * (rho * (0 - m) + Math.sqrt(m * m + sigma * sigma));
    if (!isFinite(w) || isNaN(w)) {
      console.log(`\nScale ÷${scale}: invalid w`);
      continue;
    }

    const volTotal = Math.sqrt(Math.max(w / T, 0));
    const volInst = Math.sqrt(Math.max(w, 0));
    console.log(`\nScale ÷${scale}: a=${a.toExponential(3)} b=${b.toExponential(3)} rho=${rho.toFixed(4)} m=${m.toExponential(3)} sigma=${sigma.toExponential(3)}`);
    console.log(`  w(ATM=0) = ${w.toExponential(6)}`);
    console.log(`  If total-variance (Gatheral σ=√(w/T)): ${(volTotal * 100).toFixed(1)}% annually  ← reasonable for BTC if 40-100%`);
    console.log(`  If instantaneous (σ=√w): ${(volInst * 100).toFixed(1)}%`);
  }
}

// ─── Probe #8: devInspect get_trade_amounts ───────────────────────────────────

async function probeDevInspect(oracleId: string, strike: bigint, expiryMs: number) {
  console.log("\n=== PROBE #8: devInspectTransactionBlock ===\n");
  console.log(`oracle: ${oracleId}, strike: ${strike}, expiry: ${expiryMs}`);

  // ABI verified:
  // market_key::up(oracle_id: ID, expiry: U64, strike: U64): MarketKey
  // predict::get_trade_amounts(predict: &Predict, oracle: &OracleSVI, key: MarketKey, quantity: U64, clock: &Clock)

  const tx = new Transaction();

  // Step 1: Build MarketKey using market_key::up
  const [marketKey] = tx.moveCall({
    target: `${PREDICT_PACKAGE}::market_key::up`,
    arguments: [
      tx.pure.id(oracleId),           // oracle_id: ID
      tx.pure.u64(BigInt(expiryMs)),  // expiry: U64 (ms)
      tx.pure.u64(strike),            // strike: U64
    ],
  });

  // Step 2: Call get_trade_amounts (no type args — verified from ABI)
  const tradeResult = tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::get_trade_amounts`,
    arguments: [
      tx.object(PREDICT_OBJECT),  // predict: &Predict
      tx.object(oracleId),        // oracle: &OracleSVI
      marketKey,                  // key: MarketKey
      tx.pure.u64(1_000_000n),   // quantity: U64 (1 DUSDC = 1e6)
      tx.object(CLOCK_OBJECT),    // clock: &Clock
    ],
  });

  console.log("Sending devInspect...");
  try {
    const result = await client.devInspectTransactionBlock({
      transactionBlock: tx,  // pass Transaction object directly
      sender: NULL_SENDER,
    });
    console.log("Status:", result.effects?.status);
    if (result.results) {
      console.log("Return values:", JSON.stringify(result.results, null, 2));
      // Decode the return values
      for (const r of result.results) {
        if (r.returnValues) {
          console.log("Decoded return values:");
          for (const [bytes, type] of r.returnValues) {
            const view = new DataView(new Uint8Array(bytes as number[]).buffer);
            if (type === "u64") {
              // Little-endian u64
              const lo = view.getUint32(0, true);
              const hi = view.getUint32(4, true);
              const val = BigInt(lo) + (BigInt(hi) << 32n);
              console.log(`  u64: ${val} (÷1e6 = ${Number(val) / 1e6} DUSDC)`);
            } else {
              console.log(`  type=${type} bytes=${JSON.stringify(bytes)}`);
            }
          }
        }
      }
    }
    if (result.error) {
      console.log("Error:", result.error);
    }
  } catch (e) {
    const err = e as Error;
    console.log("Error thrown:", err.message?.slice(0, 500));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Predict Strategy Copilot — MS0 Probe ===");
  console.log(`SERVER_URL: ${SERVER_URL}`);
  console.log(`PREDICT_OBJECT: ${PREDICT_OBJECT}\n`);

  const endpointData = await probeEndpoints();
  if (!endpointData) return;

  const { oracleId, oracleState, latestPrice, latestSvi, sviLatest, askBounds, askBoundsOracleId } = endpointData;

  probeScaleFactors(oracleState, latestPrice, sviLatest, askBounds);
  probeExpiryUnit(oracleState);

  // Compute expiry ms
  const expiryRaw = Number(oracleState.expiry ?? 0);
  const expiryMs = expiryRaw > Date.now() ? expiryRaw : expiryRaw * 1000;

  const midStrike = probeStrikeGrid(askBounds);
  probeSviConvention(sviLatest, expiryMs);

  // For devInspect use oracle with ask_bounds if available, else primary oracle
  const devInspectOracleId = askBoundsOracleId;
  // Pick a strike: use spot price from latestPrice, rounded to tick_size
  const spot = BigInt(String(latestPrice?.spot ?? 66000000000000n));
  const tickSize = BigInt(String(oracleState.tick_size ?? 1000000000n));
  const minStrike = BigInt(String(oracleState.min_strike ?? 50000000000000n));
  const snappedStrike = ((spot / tickSize) * tickSize);
  const strikeToUse = snappedStrike >= minStrike ? snappedStrike : minStrike;
  console.log(`\nUsing strike for devInspect: ${strikeToUse} (spot=${spot}, tick=${tickSize})`);

  await probeOnChainABI();
  await probeDevInspect(devInspectOracleId, strikeToUse, expiryMs);

  console.log("\n=== Probe complete ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

// ─── Probe #1+#2: MarketKey / RangeKey constructors via on-chain ABI ──────────

async function probeOnChainABI() {
  console.log("\n=== PROBE #1+#2: On-chain Module ABI ===\n");
  try {
    const modules = await client.getNormalizedMoveModulesByPackage({
      package: PREDICT_PACKAGE,
    });
    const moduleNames = Object.keys(modules);
    console.log("Package modules:", moduleNames);

    // Look for predict, market_key, range_key modules
    for (const name of moduleNames) {
      const mod = modules[name];
      const funcs = Object.keys(mod.exposedFunctions);
      console.log(`\n--- Module: ${name} ---`);
      console.log("Functions:", funcs);

      if (name === "predict" || name === "market_key" || name === "range_key") {
        for (const fn of funcs) {
          const f = mod.exposedFunctions[fn];
          console.log(`\n  ${fn}:`);
          console.log(`    params: ${JSON.stringify(f.parameters)}`);
          console.log(`    return: ${JSON.stringify((f as unknown as Record<string, unknown>)["return_"] ?? f.return)}`);
        }
      }
    }
  } catch (e) {
    console.log("ABI probe error:", e);
  }
}
