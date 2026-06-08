// Single source of truth for all on-chain constants and verified probe findings.
// Probe run: 2026-06-03. All values verified against Sui Testnet.

export const PREDICT_CONFIG = {
  PACKAGE:
    "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  REGISTRY:
    "0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64",
  PREDICT_OBJECT:
    "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  DUSDC_TYPE:
    "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
  DUSDC_DECIMALS: 6,
  CLOCK_OBJECT: "0x6",
  DUSDC_CURRENCY_ID:
    "0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c",
  SERVER_URL: "https://predict-server.testnet.mystenlabs.com",
} as const;

// ─── Scale Factors (verified via probe #3) ────────────────────────────────────

/**
 * All price/strike fields from Public Server and on-chain are scaled by 1e9.
 * Example: spot = 67_074_059_995_523 → $67,074.06 when divided by PRICE_SCALE.
 */
export const PRICE_SCALE = 1_000_000_000n; // 1e9

/**
 * DUSDC amounts from the chain (mint_cost, redeem_payout, balance) use 6 decimals.
 * Example: 485_525 raw → 0.485525 DUSDC.
 */
export const DUSDC_SCALE = 1_000_000n; // 1e6 = 10^DUSDC_DECIMALS

/**
 * Max age of volatility (SVI) data before a strategy is considered stale.
 * FR-006c: block placing a bet on data older than this. 30 seconds.
 */
export const SVI_STALENESS_MS = 30_000;

// ─── SVI Scale & Convention (verified via probe #7) ──────────────────────────

/**
 * All SVI parameters (a, b, sigma, rho magnitude, m magnitude) are stored
 * as u64 integers scaled by SVI_SCALE (÷1e9 gives Float64 value).
 *
 * Sign is encoded separately via `rho_negative` and `m_negative` boolean fields.
 * Apply: rho_signed = rho_negative ? -rho : rho (after dividing by SVI_SCALE)
 *
 * SVI formula (Gatheral raw SVI at log-moneyness k):
 *   w(k) = a + b * (rho*(k - m) + sqrt((k - m)^2 + sigma^2))
 *
 * Convention: w(k) is TOTAL VARIANCE (σ²T), not instantaneous variance.
 * → Implied vol: σ = sqrt(w / T)   where T = timeToExpiry in years.
 *
 * Verified: scale=1e9 gives σ_ATM ≈ 51.8% annually for BTC. ✓
 */
export const SVI_SCALE = 1_000_000_000n; // 1e9

// ─── Expiry Unit (verified via probe #5) ─────────────────────────────────────

/**
 * oracle.expiry is in MILLISECONDS (Unix ms timestamp).
 * Verified: expiry value ~1.78e12 ≫ Date.now() in seconds (~1.78e9).
 * Use directly with Date.now() for TTL calculations.
 */
export const EXPIRY_UNIT = "milliseconds" as const;

// ─── Strike Grid (verified via probe #4) ─────────────────────────────────────

/**
 * Valid strikes are NOT provided as an explicit list by the ask-bounds endpoint
 * (returns null for all active oracles). The grid is computed from oracle fields:
 *   validStrikes = [min_strike, min_strike + tick_size, min_strike + 2*tick_size, ...]
 *
 * Both min_strike and tick_size are scale 1e9.
 * Example: min_strike=50_000_000_000_000 (=$50k), tick_size=1_000_000_000 (=$1 step)
 * → grid: $50,000, $50,001, $50,002, ...
 *
 * Upper bound: inferred from ask-bounds endpoint (when non-null) or spot ± N*sigma.
 */
export const STRIKE_GRID_SOURCE = "min_strike_plus_tick" as const;

// ─── MarketKey / RangeKey Constructors (verified via probe #1+#2, ABI) ───────

/**
 * MarketKey — identifies a binary prediction position.
 * On-chain module: predict_package::market_key
 *
 * Constructors:
 *   market_key::up(oracle_id: ID, expiry: u64, strike: u64): MarketKey
 *   market_key::down(oracle_id: ID, expiry: u64, strike: u64): MarketKey
 *   market_key::new(oracle_id: ID, expiry: u64, strike: u64, is_up: bool): MarketKey
 *
 * Note: oracle_id is the object ID (as ID type, not &OracleSVI).
 * Note: expiry is in MILLISECONDS (matching oracle.expiry field).
 */
export const MARKET_KEY_MODULE = "market_key" as const;

/**
 * RangeKey — identifies a range prediction position.
 * On-chain module: predict_package::range_key
 *
 * Constructor:
 *   range_key::new(oracle_id: ID, expiry: u64, lower_strike: u64, higher_strike: u64): RangeKey
 *
 * Note: lower_strike < higher_strike (both scale 1e9).
 */
export const RANGE_KEY_MODULE = "range_key" as const;

// ─── devInspect Verified Function Signatures (probe #8) ──────────────────────

/**
 * predict::get_trade_amounts(predict: &Predict, oracle: &OracleSVI, key: MarketKey, quantity: u64, clock: &Clock)
 * Returns: (mint_cost: u64, redeem_payout: u64)  — both in raw DUSDC (scale 1e6)
 *
 * NO type arguments. oracle is the OracleSVI object (not the ID).
 *
 * Verified sample (strike near ATM $67,054, quantity=1_000_000):
 *   mint_cost    = 485,525 raw = 0.4855 DUSDC (~48.5% probability)
 *   redeem_payout = 465,549 raw = 0.4655 DUSDC (bid-back / sell value)
 */
export const GET_TRADE_AMOUNTS_FN =
  `${PREDICT_CONFIG.PACKAGE}::predict::get_trade_amounts` as const;

/**
 * predict::get_range_trade_amounts(predict, oracle, key: RangeKey, quantity, clock)
 * Returns: (mint_cost: u64, redeem_payout: u64)
 * NO type arguments.
 */
export const GET_RANGE_TRADE_AMOUNTS_FN =
  `${PREDICT_CONFIG.PACKAGE}::predict::get_range_trade_amounts` as const;
