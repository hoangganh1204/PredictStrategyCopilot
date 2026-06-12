# Tasks: Predict Strategy Copilot

**Input**: `.specify/memory/spec.md`, `.specify/memory/plan.md`
**Prerequisites**: plan.md (done), spec.md (done)

## Conventions

- **[P]**: Can run in parallel within same phase (different files, no dependencies)
- **[USx]**: Which user story this task belongs to
- **TDD**: Strategy Engine (lib/strategy/) — write test first, run to fail, then implement
- **Integration-after**: Execute Flow (lib/execute/) — implement first, integration test after
- **Constraint**: lib/strategy/ MUST NOT import from lib/execute/
- **Constraint**: All on-chain amounts use `bigint` (`_raw`), convert to `number` only at UI boundary (`_dusdc`)
- **Constraint**: No hardcoded strike prices or SVI params — always read from testnet

---

## Phase 1: Setup (Project Init)

**Purpose**: Scaffold Next.js project, install dependencies, configure tooling.

- [X] T001 [P] Init Next.js 14 project with `pnpm create next-app --typescript --app --tailwind` in repo root. Configure `tsconfig.json`: `strict: true`, `target: ES2022`, `moduleResolution: NodeNext`, path alias `@/* → src/*`.
  - **Verify**: `pnpm dev` starts without errors; `tsc --noEmit` passes.

- [X] T002 [P] Install runtime dependencies: `@mysten/sui`, `@mysten/dapp-kit`, `@tanstack/react-query`. Pin `@mysten/sui` and `@mysten/dapp-kit` to same major version. Verify Sui Testnet compatibility.
  - **Verify**: `pnpm ls @mysten/sui @mysten/dapp-kit` shows matching major versions.

- [X] T003 [P] Install dev dependencies: `vitest`, `@testing-library/react`, `msw` (for API mocks). Configure `vitest.config.ts` with path aliases matching tsconfig.
  - **Verify**: `pnpm vitest run` exits 0 (no tests yet, but config valid).

- [X] T004 Create `src/config/predict.ts` with all on-chain constants from plan (PREDICT_PACKAGE, REGISTRY, PREDICT_OBJECT, DUSDC_TYPE, DUSDC_DECIMALS, CLOCK_OBJECT, DUSDC_CURRENCY_ID, SERVER_URL). Export as `PREDICT_CONFIG` const object.
  - **Verify**: `tsc --noEmit` passes; constants match plan exactly.

- [X] T005 Create directory structure: `src/lib/strategy/`, `src/lib/execute/`, `src/types/`, `src/hooks/`, `src/components/`, `scripts/`, `tests/unit/strategy/`, `tests/unit/`, `tests/integration/`.
  - **Verify**: `ls -R src/lib src/types src/hooks src/components scripts tests` shows expected dirs.

**Checkpoint**: Project compiles, dev server runs, test runner configured, config in place.

---

## Phase 2: MS0 — Probe & Verify (BLOCKING PREREQUISITE)

**Purpose**: Close all 8 unknowns from plan before any implementation starts.

**CRITICAL**: No Phase 3+ task may begin until ALL probe items are verified.

- [X] T006 Write `scripts/probe.ts` skeleton: import SuiClient, fetch from PREDICT_CONFIG.SERVER_URL. Add functions for each probe item. Setup `tsx` runner in `package.json` scripts.
  - **Verify**: `pnpm tsx scripts/probe.ts` runs (may have empty output).

- [X] T007 [P] Probe item #6: Fetch all Public Server endpoints and log JSON shape. Endpoints: `GET /predicts/:predict_id/oracles`, `GET /oracles/:oracle_id/state`, `GET /oracles/:oracle_id/svi/latest`, `GET /oracles/:oracle_id/ask-bounds`, `GET /managers/:manager_id/summary`, `GET /managers/:manager_id/positions/summary`. Log full response JSON to console.
  - **Verify**: Console output shows real JSON from each endpoint; save sample responses.

- [X] T008 Create `src/types/predict-server.ts` — define TypeScript interfaces matching JSON shapes from T007. Types: `OracleListResponse`, `OracleStateResponse`, `SviLatestResponse`, `AskBoundsResponse`, `ManagerSummaryResponse`, `PositionsSummaryResponse`.
  - **Verify**: `tsc --noEmit` passes; types match actual endpoint output.

- [X] T009 [P] Probe item #1 + #2: Verify `MarketKey` and `RangeKey` constructors from predict.move source (branch predict-testnet-4-16). Log exact function name, parameter names, and parameter types. Update `scripts/probe.ts` to construct a sample key.
  - **Verify**: Console output shows constructor signatures; document in probe output.

- [X] T010 [P] Probe item #3: Verify scale factors of u64 fields. Test: read oracle state, SVI params, and ask-bounds. Log raw values. Identify which fields are u64, which are I64 (signed). Document: quantity scale, cost scale, strike scale, SVI `a`/`b`/`sigma` scale vs `rho`/`m` I64 encoding.
  - **Verify**: Scale factors documented; can convert a known cost_raw → cost_dusdc correctly.

- [X] T011 [P] Probe item #5: Verify `oracle.expiry` unit. Fetch oracle state → compare `expiry` field with `Date.now()`. Determine if milliseconds or seconds.
  - **Verify**: `expiry` unit documented; expiry compared to current time gives sensible TTL.

- [X] T012 [P] Probe item #4: Verify how to get valid strike grid. Fetch ask-bounds for an active oracle → determine if grid is explicit list or computed from bounds + step. Document grid resolution.
  - **Verify**: Can enumerate all valid strike prices for an active oracle.

- [X] T013 Probe item #7: Verify SVI `w(k)` convention. Compute `w` from SVI params at ATM (k=0). Compare `w / timeToExpiry` against known implied vol range for BTC. Determine: total variance (`σ²T`) or instantaneous (`σ²`).
  - **Verify**: `computeImpliedVol` formula determined: `√(w/T)` or `√w`. Document with numeric evidence.

- [X] T014 Probe item #8: Verify `devInspectTransactionBlock` works with `predict::get_trade_amounts`. Build a dry-run PTB calling `get_trade_amounts` with real oracle + a valid strike + quantity=1. Parse return values (mint_cost, redeem_payout).
  - **Verify**: devInspect returns numeric values that match expected cost/payout for a minimal trade.

- [X] T015 Update `src/config/predict.ts` and `src/types/predict-server.ts` with all findings from T007–T014. Add scale factor constants, expiry unit, SVI convention comment, MarketKey/RangeKey constructor patterns.
  - **Verify**: `tsc --noEmit` passes; all probe findings encoded in code/types/comments.

**Checkpoint**: All 8 probe items resolved. Types match real data. Scale factors documented. `computeImpliedVol` formula determined. devInspect verified. MS1 can begin.

---

## Phase 3: US2 — Strategy Engine (TDD) [Core Value]

**Goal**: `computeStrategies()` returns 3 correct strategies from real market data. API Route serves them in ≤ 3s.

**Independent Test**: `pnpm vitest run tests/unit/strategy/` passes 100%. `GET /api/strategies?amount=10&expiry=15m` returns valid JSON.

**Spec refs**: FR-003, FR-004, FR-005, SC-002, SC-003

### Tests First (TDD — Red Phase)

- [X] T016 [P] [US2] Write `tests/unit/strategy/sviMath.test.ts`: test `computeTotalVariance()` with known SVI params → expected w value. Test `computeImpliedVol()` → expected σ. Test `computeSigmaMove()` → expected price move. Use real params captured from probe.
  - **Verify**: Tests exist and FAIL (functions not yet implemented).

- [X] T017 [P] [US2] Write `tests/unit/strategy/snapToGrid.test.ts`: test `snapToGrid()` — exact match, nearest below, nearest above, target outside grid returns null if > 0.5σ. Test `snapRangeToGrid()` — both bounds snap correctly.
  - **Verify**: Tests exist and FAIL.

- [X] T018 [P] [US2] Write `tests/unit/strategy/computeStrategies.test.ts`: test full pipeline with a mock `OracleSnapshot` (from probe data). **Mock `SuiClient.devInspectTransactionBlock`** to return sample `(mint_cost, redeem_payout)` captured from T014 probe output — this is required because `computeStrategies` receives `SuiClient` as a dependency for pricing. Assert: returns 3 strategies (range, binary-up, binary-down). Each has strike/range within valid grid. cost_raw > 0. payout_raw > cost_raw. prob in (0,1).
  - **Verify**: Tests exist and FAIL (functions not yet implemented, but mock is complete).

- [X] T019 [P] [US2] Write `tests/unit/predict-client.test.ts`: test `fetchOracleState()`, `fetchSviLatest()`, `fetchAskBounds()` with MSW mocks matching types from T008. Test error handling for non-200 responses.
  - **Verify**: Tests exist and FAIL.

### Implementation (TDD — Green Phase)

- [X] T020 [US2] Implement `src/lib/strategy/types.ts`: define `OracleSnapshot`, `SVIParams` (with scale factors from probe), `Strategy`, `StrategyType` enum (`range | binary_up | binary_down`). All price/cost fields use `bigint` suffix `_raw`.
  - **Verify**: `tsc --noEmit` passes.

- [X] T021 [US2] Implement `src/lib/strategy/sviMath.ts`: `computeTotalVariance()`, `computeImpliedVol()` (formula per probe item #7), `computeSigmaMove()`. Use native `Math.sqrt/exp/log`. Handle I64→signed conversion for rho, m.
  - **Verify**: `pnpm vitest run tests/unit/strategy/sviMath.test.ts` — all GREEN.

- [X] T022 [US2] Implement `src/lib/strategy/snapToGrid.ts`: `snapToGrid()`, `snapRangeToGrid()`. Accept `validStrikes: bigint[]`, return closest valid strike or `null` if beyond 0.5σ threshold.
  - **Verify**: `pnpm vitest run tests/unit/strategy/snapToGrid.test.ts` — all GREEN.

- [X] T023 [US2] Implement `src/lib/predict-client.ts`: typed fetch wrapper for all Public Server endpoints. Use `PREDICT_CONFIG.SERVER_URL` as base. Type responses with interfaces from T008. Throw typed errors for non-200.
  - **Verify**: `pnpm vitest run tests/unit/predict-client.test.ts` — all GREEN.

- [X] T024a [US2] Implement `src/lib/strategy/computeStrategies.ts` — core orchestration: input `OracleSnapshot`, compute σ_move via sviMath, build 3 strategy skeletons per FR-004 (range ±1σ, binary-up, binary-down −2σ), snap to grid via snapToGrid. For cost/payout: accept an abstract `PricingFn` callback `(strike, quantity) => { mint_cost_raw, redeem_payout_raw }`. Return `Strategy[]` or error.
  - **Verify**: `pnpm vitest run tests/unit/strategy/computeStrategies.test.ts` — all GREEN (using mock PricingFn).

- [X] T024b [US2] Wire devInspect into `computeStrategies`: implement concrete `PricingFn` that calls `SuiClient.devInspectTransactionBlock` with `predict::get_trade_amounts` / `get_range_trade_amounts`. Test with real testnet data.
  - **Verify**: `computeStrategies` returns strategies with cost/payout matching devInspect output from T014.
  - **Depends on**: T014 (devInspect verified), T024a

- [X] T025 [US2] Implement `src/app/api/strategies/route.ts`: parse query params (amount, expiry). Parallel fetch oracle + SVI + ask-bounds via predict-client. Check staleness: `Date.now() - svi.updatedAt > 30_000` → 400 `ERR_STALE_SVI`. Check market open → 400 `ERR_NO_MARKET`. Init `SuiClient` server-side. Call `computeStrategies()` with devInspect PricingFn. Return JSON.
  - **Verify**: `curl localhost:3000/api/strategies?amount=10&expiry=15m` returns valid strategy JSON from testnet.

- [X] T026 [US2] Write `tests/integration/api-strategies.test.ts`: hit actual API Route with MSW mocking Public Server responses + mock devInspect. Assert: correct response shape, 3 strategies, error cases (stale SVI, no market).
  - **Verify**: `pnpm vitest run tests/integration/api-strategies.test.ts` — all GREEN.

**Checkpoint**: Strategy Engine complete. `GET /api/strategies` works with real testnet data. ≥80% coverage on `lib/strategy/`. FR-003, FR-004, FR-005 satisfied.

---

## Phase 4: US3 — Execute Flow (Integration-After)

**Goal**: All on-chain transactions work end-to-end: deposit, mint binary, mint range, redeem.

**Independent Test**: Script can execute deposit → mint → verify position on testnet.

**Spec refs**: FR-001, FR-006, FR-008, FR-011, FR-013

### Implementation

- [X] T027 [US3] Implement `src/lib/execute/types.ts`: `TxResult` type (`status: 'success' | 'failed' | 'rejected'`, `digest?`, `error?`). `PositionState` enum. `MintParams`, `RedeemParams` interfaces. All amount fields `bigint` (`_raw`).
  - **Verify**: `tsc --noEmit` passes.

- [X] T028 [US3] Implement `src/lib/execute/findOrCreateManager.ts`: query owned objects by type `PredictManager` → return ID if found. If not, build PTB calling `predict::create_manager(ctx)`. Accept `SuiClient` + `signAndExecute` callback as deps (no direct wallet import).
  - **Verify**: Manual test with testnet wallet → PredictManager created or found; ID returned.

- [X] T029 [US3] Implement `src/lib/execute/depositDusdc.ts` (FR-013): build PTB that splits DUSDC coin from wallet, calls `predict_manager::deposit<DUSDC>(manager, coin, ctx)`. Input: `managerId`, `amount_raw` (bigint). Return `Transaction` object.
  - **Verify**: Manual test → deposit tx succeeds; manager balance increases in Public Server.

- [X] T030a [US3] Implement `src/lib/execute/buildMintTx.ts` — binary only: build PTB for `predict::mint<DUSDC>`. Construct `MarketKey` using constructor pattern from T009. Input: oracleId, strike, direction, quantity_raw. Return `Transaction`.
  - **Verify**: Manual test → binary mint tx succeeds on testnet; position appears in Public Server.

- [X] T030b [US3] Extend `buildMintTx.ts` — add range support: build PTB for `predict::mint_range<DUSDC>`. Construct `RangeKey` using constructor pattern from T009. Input: oracleId, lower_strike, upper_strike, quantity_raw. Return `Transaction`.
  - **Verify**: Manual test → range mint tx succeeds on testnet; range position appears in Public Server.
  - **Depends on**: T030a

- [X] T031 [US3] Implement `src/lib/execute/buildRedeemTx.ts`: build PTB for `predict::redeem<DUSDC>`. Input: managerId, oracleId, key, quantity_raw. Return `Transaction`.
  - **Verify**: Manual test → redeem tx succeeds for a settled winning position (if available).

- [X] T032 [US3] Implement `src/hooks/useExecuteTx.ts`: mutation hook wrapping `useSignAndExecuteTransaction` (dapp-kit). Handle 3 outcomes: success → return digest + invalidate queries, failed → parse error message, rejected → detect user cancel. Return `TxResult` + `isPending` state.
  - **Verify**: Hook compiles; TypeScript types correct; manual test in browser.

### Integration Test

- [X] T033 [US3] Write end-to-end testnet script `scripts/e2e-execute.ts`: using a test keypair, run full flow: findOrCreateManager → deposit 1 DUSDC → mint binary (using real strategy params from API) → verify position exists via Public Server. Log each step. **Security: test keypair loaded from env var `TEST_KEYPAIR` or `.env.local` — NEVER commit private key to repo. Add `scripts/e2e-execute.ts` note + `.env.local` to `.gitignore`.**
  - **Verify**: Script completes successfully on testnet; position visible in Public Server. `.env.local` in `.gitignore`.

**Checkpoint**: Execute flow complete. SC-004 partially met (binary mint tested). FR-001, FR-008, FR-013 satisfied.

---

## Phase 5: US1 — Connect Wallet & Init Account

**Goal**: User connects wallet, game account auto-created, balance displayed.

**Independent Test**: Open app → connect Slush/Suiet → balance shown; disconnect → reconnect → same balance.

**Spec refs**: FR-002, FR-008, FR-010

**Dependency note**: Phase 5 is split into two sub-groups:
- **5A** (T034, T035, T039): UI shell — can start after Phase 2, **parallel with Phase 3**
- **5B** (T036, T037, T038): Balance + deposit — depends on T028 (`findOrCreateManager` from Phase 4) and T029 (`depositDusdc`). **Must wait for Phase 4.**

### Phase 5A — UI Shell (parallel with Phase 3)

- [X] T034 [P] [US1] Implement `src/app/layout.tsx`: wrap app with `SuiClientProvider` (Sui Testnet), `WalletProvider` (dapp-kit), `QueryClientProvider` (TanStack Query). Configure Tailwind.
  - **Verify**: `pnpm dev` → app loads without provider errors in console.

- [X] T035 [P] [US1] Implement `src/components/ConnectButton.tsx`: wrap dapp-kit `ConnectButton` or build custom. Show truncated address after connect. Handle disconnect.
  - **Verify**: Click → wallet popup → address shown; disconnect works.

- [X] T039 [P] [US1] Implement `src/app/page.tsx` (landing): show ConnectButton if not connected. After connect → redirect to `/play`.
  - **Verify**: Fresh visit → connect button; after connect → navigated to /play.

### Phase 5B — Balance & Deposit (after Phase 4: T028, T029)

- [X] T036 [US1] Implement `src/hooks/useManagerBalance.ts`: TanStack Query hook. On wallet connect → call `findOrCreateManager()` (from T028) → fetch `GET /managers/:id/summary` → return balance_raw + balance_dusdc. staleTime 5s.
  - **Verify**: Hook returns correct DUSDC balance for connected wallet.
  - **Depends on**: T028 (findOrCreateManager)

- [X] T037 [US1] Implement `src/components/BalanceDisplay.tsx`: show `balance_dusdc` formatted as `XX.XX DUSDC`. Handle loading state (skeleton). Handle no-wallet state.
  - **Verify**: Balance displays correctly; loading skeleton appears while fetching.
  - **Depends on**: T036 (useManagerBalance)

- [X] T038 [US1] Implement `src/components/DepositForm.tsx` (FR-013): input for amount, "Nạp tiền" button. Call `depositDusdc` (from T029) via `useExecuteTx`. Show TxStatusOverlay during deposit. Invalidate balance query on success.
  - **Verify**: Deposit DUSDC → balance updates; validation: amount > 0, amount ≤ wallet DUSDC balance.
  - **Depends on**: T029 (depositDusdc), T032 (useExecuteTx)

**Checkpoint**: US1 complete. User connects, account auto-created, balance displayed, deposit works. FR-002, FR-008, FR-010 satisfied.

---


## Phase 6: US2 UI — Strategy Display

**Goal**: User enters amount + expiry, sees 2–3 strategies in plain language within 3s.

- [X] T040 [P] [US2] Implement `src/hooks/useStrategies.ts`: TanStack Query hook calling `GET /api/strategies?amount=X&expiry=Y`. Return `Strategy[]` or error state. staleTime 30s.
- [X] T041 [P] [US2] Implement `src/components/StrategyCard.tsx`: plain language labels (FR-009), countdown, cost/payout/prob display. No option jargon.
- [X] T042 [US2] Implement `src/components/StrategyList.tsx`: skeleton after 300ms, ERR_NO_MARKET/ERR_STALE_SVI messages in Vietnamese.
- [X] T043 [US2] Implement `src/components/AmountInput.tsx`: amount input + expiry selector (15m/30m/1h). Validates amount > 0 ≤ balance (FR-006a).
- [X] T044 [US2] Implement `src/app/play/page.tsx`: BalanceDisplay + DepositForm (if balance=0) + AmountInput + StrategyList wired together.

**Checkpoint**: US2 UI complete. FR-003, FR-004, FR-005, FR-009, SC-002 satisfied.

---

## Phase 7: US3 UI — Place Bet & Transaction Status

**Goal**: User selects strategy, signs transaction, sees success/failure/rejection feedback.

**Independent Test**: Select strategy → sign in wallet → position appears in dashboard OR rejection shows friendly message.

**Spec refs**: FR-006, FR-008, FR-011, SC-005

- [X] T045 [US3] Add "Vào lệnh" button to `StrategyCard.tsx`. On click: build mint tx (binary or range) via `buildMintTx`, execute via `useExecuteTx`. Pre-validate FR-006 (amount, market open, SVI freshness).
  - **Verify**: Button click → wallet popup → tx submitted.

- [X] T046 [US3] Implement `src/components/TxStatusOverlay.tsx`: overlay states — pending (spinner + "Đang xử lý..."), success (check + digest link), failed (friendly VN error message + "Thử lại"), rejected ("Bạn đã hủy giao dịch" + return to strategies).
  - **Verify**: All 3 outcomes display correct overlay; app never freezes (FR-011).

- [X] T047 [US3] Wire TxStatusOverlay into `/play` page. On success → invalidate balance + positions queries → navigate to /positions. On failure/rejection → dismiss overlay → back to strategy selection.
  - **Verify**: Success → positions page; rejection → back to strategies; failure → error shown.

**Checkpoint**: US3 UI complete. Full bet placement flow. SC-005 satisfied (win/lose/reject handled).

---

## Phase 8: US4 — Position Dashboard

**Goal**: User tracks open positions with P&L and countdown.

**Independent Test**: After placing bet → /positions shows position with status, P&L, countdown timer.

**Spec refs**: FR-007, FR-010

- [X] T048 [P] [US4] Implement `src/hooks/usePositions.ts`: TanStack Query hook calling `GET /managers/:id/positions/summary`. Return typed `Position[]`. staleTime 5s. Map position status to `PositionState` enum.
  - **Verify**: Hook returns positions for connected wallet's manager.

- [X] T049 [P] [US4] Implement `src/components/PositionCard.tsx`: display one position. Show: bet type (plain language), status badge (Đang hoạt động / Chờ chốt / Thắng / Thua / Đã nhận), P&L in DUSDC (FR-010), countdown to settlement. Countdown uses `oracle.expiry` in correct unit (from probe).
  - **Verify**: Card renders all fields; countdown ticks in real-time.

- [X] T050 [US4] Implement `src/components/PositionList.tsx`: list of PositionCards. Empty state: "Chưa có vị thế nào" + CTA link to /play. Loading state after 300ms.
  - **Verify**: Empty state shows when no positions; list shows when positions exist.

- [X] T051 [US4] Implement `src/app/positions/page.tsx`: compose PositionList. Include BalanceDisplay at top. Navigation back to /play.
  - **Verify**: Page loads, shows real positions from testnet, countdown works.

**Checkpoint**: US4 complete. Position tracking with real-time P&L and countdown. FR-007 satisfied.

---

## Phase 9: US5 — Redeem Winnings

**Goal**: User claims winnings for settled-won positions.

**Independent Test**: Position in "Thắng" state → click "Nhận thưởng" → sign → balance increases.

**Spec refs**: FR-007 (full lifecycle), FR-012, SC-004

- [X] T052 [US5] Add redeem button to `PositionCard.tsx`: visible only when status = `settled_won`. On click → `buildRedeemTx` → `useExecuteTx`. Show TxStatusOverlay.
  - **Verify**: Button appears only for won positions; click → wallet popup.

- [X] T053 [US5] Handle redeem outcomes: success → update position status to "Đã nhận thưởng", invalidate balance query. Failure → friendly error. For lost positions: show "Lần này không trúng" + link to /play for new strategies.
  - **Verify**: Win → redeem → balance increases; loss → correct message shown.

- [X] T054 [US5] Integration test: run full lifecycle on testnet. Place binary bet → wait for settlement → redeem if won. Place range bet → verify. (Manual test, use `scripts/e2e-execute.ts` as base.)
  - **Verify**: SC-004 met: at least 1 binary + 1 range bet placed and redeemed on testnet.

**Checkpoint**: US5 complete. Full lifecycle: bet → track → redeem. SC-004, FR-007, FR-012 satisfied.

---

## Phase 10: Polish & Cross-Cutting

**Purpose**: Edge cases, error handling, final validation.

- [X] T055 [P] Add global error boundary in `layout.tsx`: catch unhandled errors → friendly message, no white screen.
  - **Verify**: Throw error in component → error boundary catches, shows recovery UI.

- [X] T056 [P] Validate FR-009 compliance: audit all user-facing text. Remove any "strike price", "implied volatility", "vol curve", "expiry" — replace with plain Vietnamese equivalents.
  - **Verify**: Grep codebase for option jargon → 0 matches in components/.

- [X] T057 [P] Validate FR-010 compliance: audit all DUSDC display. Ensure: always 2 decimal places, "DUSDC" unit label, no floating point artifacts. Add helper `formatDusdc(amount_raw: bigint): string`.
  - **Verify**: All money displays show "XX.XX DUSDC" format.

- [X] T058 Validate SC-006: test all "no market" scenarios. For each expiry (15m/30m/1h), if no market → confirm friendly message (not empty list, not technical error).
  - **Verify**: Deliberately pick closed expiry → message "Hiện không có thị trường mở cho khung này".

- [X] T059 End-to-end manual test: fresh wallet → connect → deposit → pick strategy → place bet → track position → redeem. Target: < 5 minutes (SC-001).
  - **Verify**: Timed walkthrough under 5 minutes without external docs.

---

## Phase 11: US6 — Leaderboard Engine (TDD)

**Goal**: Pure leaderboard aggregation from on-chain settled data. API routes serve ranked leaders in ≤ 3s.

**Independent Test**: `pnpm vitest run tests/unit/leaderboard/ tests/integration/api-leaderboard.test.ts` — all pass.

**Spec refs**: FR-014, FR-015, FR-016, FR-017, SC-007, SC-008

### Probe & Types

- [X] T060 [US6] Probe: discover how to enumerate all managers with settled positions on testnet. Try `GET /predicts/:predict_id/managers` on Public Server. If unavailable, use `suix_queryEvents` filtering for `predict::MintEvent` → extract unique `manager_id` values. Document working approach in `scripts/probe-leaderboard.ts`.
  - **Verify**: Script logs list of manager IDs with at least 1 settled position.

- [X] T061 [US6] Define leaderboard types in `src/lib/leaderboard/types.ts`: `LeaderStats` (address, netPnl_raw, winRate, settledCount, recentStrategyTypes), `RankedLeader` (LeaderStats + rank), `LeaderboardResult` ({ leaders: RankedLeader[], sparse: boolean, message?: string }), `InvestorDetail` (address, recentTrades, strategyBreakdown), `StrategyBreakdown` (type, count, netPnl_raw).
  - **Verify**: `tsc --noEmit` passes.

- [X] T062 [US6] Extend `src/lib/predict-client.ts`: add `fetchAllManagerIds(predictId)` using approach from T060. Add `fetchManagerPositions(managerId)` alias if not already present (wraps existing `fetchPositionsSummary`).
  - **Verify**: `tsc --noEmit` passes; function returns real manager IDs from testnet.
  - **Depends on**: T060

### Tests First (TDD — Red Phase)

- [X] T063 [P] [US6] Write `tests/unit/leaderboard/computeLeaderboard.test.ts`: test `aggregateLeaderStats()` — netPnl from settled only, winRate = won/(won+lost), settledCount excludes active. Test `rankLeaders()` — sorted by netPnl desc, sparse flag when < threshold. Test `truncateAddress()` — "0xABCD...1234" format. Use fixtures from `PositionSummaryItem` type (T008).
  - **Verify**: Tests exist and FAIL (functions not yet implemented).

- [X] T064 [P] [US6] Write `tests/unit/leaderboard/investorDetail.test.ts`: test `getStrategyBreakdown()` — groups positions by inferred StrategyType (from strike/lower_strike/is_up fields), returns count + netPnl per type. Test `getRecentTrades()` — returns last N trades with plain-language strategy labels.
  - **Verify**: Tests exist and FAIL.

### Implementation (TDD — Green Phase)

- [X] T065 [US6] Implement `src/lib/leaderboard/computeLeaderboard.ts`: `aggregateLeaderStats(positions: PositionSummaryItem[]): LeaderStats` — only count settled_won/settled_lost/redeemed in metrics; return 0 winRate (not NaN) when no settled. `rankLeaders(allStats: LeaderStats[]): LeaderboardResult` — sort netPnl desc, tie-break winRate desc; set sparse=true when total settledCount < MIN_SETTLED_THRESHOLD. `truncateAddress(addr: string): string` — 6+"..."+4 chars.
  - **Verify**: `pnpm vitest run tests/unit/leaderboard/computeLeaderboard.test.ts` — all GREEN.

- [X] T066 [US6] Implement `src/lib/leaderboard/investorDetail.ts`: `getStrategyBreakdown(positions)` — infer StrategyType from PositionSummaryItem fields (has lower_strike → range; has is_up=true → binary_up; is_up=false → binary_down). `getRecentTrades(positions, limit)` — return last N settled trades with strategy label in plain Vietnamese.
  - **Verify**: `pnpm vitest run tests/unit/leaderboard/investorDetail.test.ts` — all GREEN.

### API Routes

- [X] T067 [US6] Implement `src/app/api/leaderboard/route.ts`: `GET /api/leaderboard`. Fetch all manager IDs (T062) → parallel fetch positions for each → aggregate + rank → return `LeaderboardResult` JSON. Handle sparse case (FR-017). Cache-friendly: TanStack Query staleTime 30s on client.
  - **Verify**: `curl localhost:3000/api/leaderboard` returns ranked leaders from testnet data.
  - **Depends on**: T062, T065

- [X] T068 [US6] Implement `src/app/api/leaders/[address]/route.ts`: `GET /api/leaders/:address`. Find manager by owner address → fetch positions → return `InvestorDetail` JSON (recentTrades + strategyBreakdown). Return 404 `ERR_NO_ACTIVITY` if no settled positions.
  - **Verify**: `curl localhost:3000/api/leaders/0x...` returns investor detail JSON.
  - **Depends on**: T066

### Integration Test

- [X] T069 [US6] Write `tests/integration/api-leaderboard.test.ts`: hit API Routes with MSW mocking Public Server. Assert: correct ranked order, sparse flag on empty data, 404 for unknown address, response shape matches `LeaderboardResult` / `InvestorDetail`.
  - **Verify**: `pnpm vitest run tests/integration/api-leaderboard.test.ts` — all GREEN.

**Checkpoint**: Leaderboard engine complete. API routes serve ranked leaders from on-chain data. FR-014, FR-015, FR-016, FR-017, SC-007 satisfied.

---

## Phase 12: US6 — Leaderboard UI

**Goal**: User opens leaderboard page, sees ranked investors, drills down into detail — all within 3s.

**Independent Test**: Open /leaderboard → list displays; click investor → detail shows recent trades + strategy breakdown.

**Spec refs**: FR-015, FR-016, FR-017, FR-023, SC-008

- [X] T070 [P] [US6] Implement `src/hooks/useLeaderboard.ts`: TanStack Query hook calling `GET /api/leaderboard`. Return `LeaderboardResult`. staleTime 30s. Handle loading + error states.
  - **Verify**: Hook returns leaders for testnet data.

- [X] T071 [P] [US6] Implement `src/hooks/useInvestorDetail.ts`: TanStack Query hook calling `GET /api/leaders/:address`. Return `InvestorDetail` or 404 state. staleTime 30s.
  - **Verify**: Hook returns detail for a known testnet address.

- [X] T072 [P] [US6] Implement `src/components/LeaderboardTable.tsx`: table/list of ranked leaders. Each row: rank #, truncated address, netPnl (formatted DUSDC), winRate (%), settledCount. Clickable rows → navigate to `/leaderboard/:address`. Loading skeleton after 300ms. Sparse state: Vietnamese message (FR-017).
  - **Verify**: Table renders; click navigates; sparse message shows when no data.

- [X] T073 [US6] Implement `src/components/InvestorDetail.tsx`: recent trades list (strategy label in plain Vietnamese, result, amount). Strategy breakdown chart/table (count + netPnl per type). Back link to /leaderboard. No jargon (FR-023).
  - **Verify**: Detail renders with plain-language labels; no "strike", "SVI", "oracle" text.
  - **Depends on**: T071

- [X] T074 [US6] Implement `src/app/leaderboard/page.tsx`: compose LeaderboardTable + navigation header. Add "Bảng xếp hạng" nav link to app layout.
  - **Verify**: `/leaderboard` loads and displays ranked list from testnet.
  - **Depends on**: T070, T072

- [X] T075 [US6] Implement `src/app/leaderboard/[address]/page.tsx`: compose InvestorDetail + back nav + FollowButton placeholder (wired in Phase 14).
  - **Verify**: `/leaderboard/0x...` loads investor detail; back link works.
  - **Depends on**: T073

**Checkpoint**: US6 UI complete. Leaderboard displays, sparse state handled, detail drill-down works. SC-008 satisfied.

---

## Phase 13: US7 — Copy-trade Engine (TDD)

**Goal**: Copy-trade logic builds correct unsigned transactions preserving leader strategy type, scaled to follower amount. All three eligibility gates enforce correctly.

**Independent Test**: `pnpm vitest run tests/unit/copytrade/ tests/integration/api-copytrade.test.ts` — all pass.

**Spec refs**: FR-018, FR-019, FR-020, FR-021, SC-010, SC-011

### Tests First (TDD — Red Phase)

- [X] T076 [P] [US7] Write `tests/unit/copytrade/scaleCopyParams.test.ts`: test `scaleCopyParams()` — preserves strategyType from leader, scales quantity_raw by follower amount (not leader amount), binary: isUp + strike match leader, range: lowerStrike + upperStrike match leader exactly.
  - **Verify**: Tests exist and FAIL.

- [X] T077 [P] [US7] Write `tests/unit/copytrade/validateCopyEligibility.test.ts`: test `validateCopyEligibility()` — returns { eligible: false, reason } for: oracle not active, SVI > 30s stale (boundary: exactly 30_000ms → blocked), balance < cost. Returns { eligible: true } when all 3 pass. Reason strings are non-empty Vietnamese.
  - **Verify**: Tests exist and FAIL.

- [X] T078 [P] [US7] Write `tests/unit/copytrade/buildCopyMintTx.test.ts`: test `buildCopyMintTx()` — returns `Transaction` object (not signed digest), binary calls `predict::mint`, range calls `predict::mint_range`. **Assert function signature has NO signer/wallet parameter.**
  - **Verify**: Tests exist and FAIL.

### Implementation (TDD — Green Phase)

- [X] T079 [US7] Define copy-trade types in `src/lib/copytrade/types.ts`: `CopyParams` (strategyType, oracleId, strike_raw/lowerStrike_raw/upperStrike_raw, isUp?, quantity_raw, cost_raw, payout_raw, expiryMs), `CopyEligibility` ({ eligible: boolean, reason?: string }), `FollowConfig` (leaderAddress, followerAmount_raw).
  - **Verify**: `tsc --noEmit` passes.

- [X] T080 [US7] Implement `src/lib/copytrade/scaleCopyParams.ts`: `scaleCopyParams(leaderPosition: PositionSummaryItem, followerAmount_raw: bigint, pricingFn: PricingFn): Promise<CopyParams>`. Infer strategyType from leader position fields. Keep leader's strike/range. Compute follower quantity via pricingFn (reuse devInspect pattern from T024b). Return CopyParams with cost_raw + payout_raw.
  - **Verify**: `pnpm vitest run tests/unit/copytrade/scaleCopyParams.test.ts` — all GREEN.
  - **Depends on**: T079

- [X] T081 [US7] Implement `src/lib/copytrade/validateCopyEligibility.ts`: `validateCopyEligibility(oracleState, sviTimestamp, followerBalance_raw, estimatedCost_raw): CopyEligibility`. Check 3 conditions: (a) oracle.status === "active", (b) Date.now() - sviTimestamp ≤ 30_000, (c) followerBalance_raw ≥ estimatedCost_raw. Return { eligible: false, reason } with plain Vietnamese reason on first failure.
  - **Verify**: `pnpm vitest run tests/unit/copytrade/validateCopyEligibility.test.ts` — all GREEN.

- [X] T082 [US7] Implement `src/lib/copytrade/buildCopyMintTx.ts`: `buildCopyMintTx(params: CopyParams, managerId: string): Transaction`. Build PTB using existing `buildMintTx` (T030a) for binary or range. **CRITICAL: function MUST NOT import from `@mysten/dapp-kit` or any wallet/signer module. Returns unsigned Transaction only.**
  - **Verify**: `pnpm vitest run tests/unit/copytrade/buildCopyMintTx.test.ts` — all GREEN.
  - **Depends on**: T030a (buildMintTx), T079

### API Route + Integration

- [X] T083 [US7] Implement `src/app/api/leaders/[address]/latest-position/route.ts`: `GET /api/leaders/:address/latest-position?followerAmount=X&followerManager=Y`. Fetch leader's latest active/recently-minted position. Run `validateCopyEligibility`. If eligible → `scaleCopyParams` → return `{ copyable: true, strategyType, copyParams }`. If not → return `{ copyable: false, reason }` (HTTP 200, not 400).
  - **Verify**: `curl localhost:3000/api/leaders/0x.../latest-position?followerAmount=10&followerManager=0x...` returns copyable response.
  - **Depends on**: T080, T081

- [X] T084 [US7] Write `tests/integration/api-copytrade.test.ts`: hit API Route with MSW. Assert: copyable=true returns valid copyParams with correct strategyType. Assert: market closed → copyable=false. Assert: stale SVI → copyable=false. Assert: insufficient balance → copyable=false. Assert: reason strings are non-empty.
  - **Verify**: `pnpm vitest run tests/integration/api-copytrade.test.ts` — all GREEN.

**Checkpoint**: Copy-trade engine complete. All three eligibility gates enforce. Strategy type preserved. No auto-signing. FR-018, FR-019, FR-020, SC-010, SC-011 satisfied.

---

## Phase 14: US7 — Copy-trade UI

**Goal**: Follower follows a leader, receives copy notification, confirms and signs — position appears in dashboard.

**Independent Test**: Follow leader → leader has recent position → copy modal appears → sign → position in /positions.

**Spec refs**: FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, SC-009

- [X] T085 [P] [US7] Implement `src/hooks/useFollowState.ts`: manage follow state in localStorage. `followLeader(address, amount_raw)`, `unfollowLeader(address)`, `getFollowedLeaders(): FollowConfig[]`, `isFollowing(address): boolean`. Persists across page reloads.
  - **Verify**: Follow/unfollow persists; `getFollowedLeaders()` returns correct list after reload.

- [X] T086 [P] [US7] Implement `src/hooks/useCopyTrade.ts`: TanStack Query hook. When following a leader → poll `GET /api/leaders/:address/latest-position` (interval 10s). When new copyable position detected → set `pendingCopy` state with CopyParams. Expose `clearPendingCopy()`. Stop polling when unfollowed.
  - **Verify**: Hook detects new leader position; pendingCopy state populated.
  - **Depends on**: T085

- [X] T087 [US7] Implement `src/components/FollowButton.tsx`: toggle button — "Theo dõi để sao chép" / "Đang theo dõi ✓". On first follow → prompt for follower amount (DUSDC). On unfollow → confirm dialog. Uses `useFollowState`.
  - **Verify**: Button toggles state; amount prompt appears on first follow.
  - **Depends on**: T085

- [X] T088 [US7] Implement `src/components/CopyTradeModal.tsx`: modal triggered by `pendingCopy` state. Display: leader address (truncated), strategy label (plain Vietnamese), cost_dusdc, payout_dusdc, expiryMs countdown. "Sao chép" button → `buildCopyMintTx` → `useExecuteTx`. Disabled + reason when copyable=false. Uses TxStatusOverlay (T046) for pending/success/failure states.
  - **Verify**: Modal shows scaled params; sign → tx submitted; disabled when ineligible with reason.
  - **Depends on**: T082 (buildCopyMintTx), T086 (useCopyTrade), T046 (TxStatusOverlay)

- [X] T089 [US7] Wire FollowButton into `/leaderboard/[address]` page (T075). Wire CopyTradeModal into app layout (global — shows when any followed leader has pendingCopy).
  - **Verify**: Full flow: /leaderboard/:address → follow → copy modal appears when leader has position.
  - **Depends on**: T075, T087, T088

- [X] T090 [US7] Handle all ineligibility states in CopyTradeModal: market closed → "Thị trường đã đóng", SVI stale → "Dữ liệu chưa được cập nhật", balance insufficient → "Số dư không đủ". Ensure "Sao chép" button stays disabled and `useExecuteTx` is NEVER called when copyable=false (FR-020).
  - **Verify**: Each ineligibility reason displays; button disabled; no wallet popup triggered.

**Checkpoint**: US7 UI complete. Full copy-trade flow works. Follow toggle does not affect open positions (FR-022). All labels in plain Vietnamese (FR-023). SC-009 satisfied.

---

## Phase 15: Social Trading Polish

**Purpose**: Cross-cutting validation for US6 + US7. Security, performance, UX compliance.

- [ ] T091 [P] Validate FR-023 compliance: audit all social-trading components for option jargon. Grep for "strike price", "implied vol", "SVI", "oracle", "expiry" in `src/components/Leaderboard*`, `src/components/Investor*`, `src/components/CopyTrade*`, `src/components/Follow*` — replace with plain Vietnamese equivalents.
  - **Verify**: Grep → 0 jargon matches in social-trading components.

- [ ] T092 [P] Validate FR-016 compliance: audit leaderboard for PII. Verify all addresses use `truncateAddress()`. No full 66-char addresses visible. No wallet metadata beyond address.
  - **Verify**: Inspect rendered leaderboard — only "0xABCD...1234" format visible.

- [ ] T093 [P] Validate SC-011: verify `src/lib/copytrade/buildCopyMintTx.ts` has zero imports from `@mysten/dapp-kit`, `useSignAndExecuteTransaction`, or any wallet API. Grep the file — assert 0 matches.
  - **Verify**: `grep -c "dapp-kit\|signAndExecute\|wallet" src/lib/copytrade/buildCopyMintTx.ts` → 0.

- [ ] T094 Validate SC-008: performance test — open `/leaderboard` with testnet data → measure time from navigation to list render. Target: < 3 seconds.
  - **Verify**: Timed page load < 3s on localhost with real testnet data.

- [ ] T095 End-to-end manual test: full social-trading flow. Open leaderboard → verify leaders reflect real on-chain data → click leader → view detail → follow with 5 DUSDC → wait for/trigger copy notification → sign → position appears in /positions → unfollow → verify no new notifications. Target: trọn vòng < 1 phút (SC-009).
  - **Verify**: Full flow completes; copied position goes through standard lifecycle (FR-021).

**Checkpoint**: Social trading feature complete. All FRs (014–023) and SCs (007–012) satisfied.

---

## Dependencies & Execution Order

### Phase Dependencies (Strict)

```
Phase 1 (Setup)
  └─→ Phase 2 (MS0 Probe) ← BLOCKS EVERYTHING
        ├─→ Phase 3 (US2 Strategy TDD) ← core value, do first
        │     └─→ Phase 4 (US3 Execute) ← needs strategy types
        │           ├─→ Phase 5B (T036/T037/T038: balance + deposit) ← needs T028, T029
        │           └─→ Phase 6 (US2 UI) ← needs API Route
        │                 └─→ Phase 7 (US3 UI) ← needs execute hooks + TxStatusOverlay
        ├─→ Phase 5A (T034/T035/T039: UI shell) ← parallel with Phase 3
        │
        └─→ Phase 8 (US4 Positions) ← needs Phase 5B (manager + balance)
              └─→ Phase 9 (US5 Redeem) ← needs positions
  Phase 10 (Polish) ← after Phase 1–9

  ─── Social Trading Extension (US6 + US7) ───
  Phase 10 (done)
        ├─→ Phase 11 (US6 Leaderboard Engine) ← needs predict-client (T023), types (T008)
        │     └─→ Phase 12 (US6 Leaderboard UI) ← needs API routes
        │
        ├─→ Phase 13 (US7 Copy-trade Engine) ← needs buildMintTx (T030a), PricingFn (T024b)
        │     └─→ Phase 14 (US7 Copy-trade UI) ← needs copy-trade logic + leaderboard UI (T075)
        │
        └─→ Phase 15 (Social Trading Polish) ← after Phase 12 + Phase 14
```

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 all parallel (different configs/files)
- **Phase 2**: T007, T009, T010, T011, T012 parallel (independent probe items)
- **Phase 3 tests**: T016, T017, T018, T019 all parallel (different test files)
- **Phase 5A** (T034, T035, T039): Can start after Phase 2, run parallel with Phase 3
- **Phase 5B** (T036, T037, T038): Must wait for Phase 4 (T028, T029, T032)
- **Phase 6**: T040, T041 parallel (hook vs component)
- **Phase 8**: T048, T049 parallel (hook vs component)
- **Phase 10**: T055, T056, T057 all parallel
- **Phase 11 tests**: T063, T064 parallel (different test files)
- **Phase 11 and Phase 13 are independent** — can start in parallel after Phase 10
- **Phase 12**: T070, T071, T072 all parallel (hook + component files)
- **Phase 13 tests**: T076, T077, T078 all parallel (different test files)
- **Phase 14**: T085, T086 parallel (different hook files)
- **Phase 15**: T091, T092, T093 all parallel

### Critical Path

```
T001 → T004 → T006 → T007 → T008 ──┐
                   (T009–T012 parallel, merge into T015)
                                     ├→ T013 → T014 → T015
  → T016 → T021 (sviMath TDD)
  → T017 → T022 (snapToGrid TDD)
  → T018 → T024a → T024b → T025 (computeStrategies → devInspect → API Route)
  → T028 → T030a → T030b → T033 (execute: binary → range → e2e)
  → T036 → T037 → T038 (balance + deposit — after T028/T029)
  → T044 → T045 → T047 (UI integration)
  → T051 → T052 → T054 (positions + redeem)
  → T055–T059 (polish)

  ─── Social Trading Critical Path ───
  → T060 → T062 → T065 → T067 → T069 (leaderboard engine)
  → T070 → T072 → T074 (leaderboard UI)
  → T076 → T080 → T082 → T083 → T084 (copy-trade engine)
  → T085 → T086 → T088 → T089 → T090 (copy-trade UI)
  → T091–T095 (social trading polish)

  Longest path: T060 → T062 → T065 → T067 → T069 → T074 → T075 → T089 → T095
```

---

## Task Count Summary

| Phase | Tasks | Parallel opportunities |
|---|---|---|
| 1. Setup | T001–T005 (5) | 3 parallel |
| 2. MS0 Probe | T006–T015 (10) | 5 parallel |
| 3. US2 Strategy TDD | T016–T026 (12, incl. T024a/b) | 4 test parallel + impl sequential |
| 4. US3 Execute | T027–T033 (8, incl. T030a/b) | sequential (chain deps) |
| 5A. US1 UI Shell | T034, T035, T039 (3) | all 3 parallel |
| 5B. US1 Balance+Deposit | T036, T037, T038 (3) | sequential (after Phase 4) |
| 6. US2 Strategy UI | T040–T044 (5) | 2 parallel |
| 7. US3 Bet UI | T045–T047 (3) | sequential |
| 8. US4 Positions | T048–T051 (4) | 2 parallel |
| 9. US5 Redeem | T052–T054 (3) | sequential |
| 10. Polish | T055–T059 (5) | 3 parallel |
| 11. US6 Leaderboard Engine | T060–T069 (10) | 2 test parallel |
| 12. US6 Leaderboard UI | T070–T075 (6) | 3 parallel (T070, T071, T072) |
| 13. US7 Copy-trade Engine | T076–T084 (9) | 3 test parallel |
| 14. US7 Copy-trade UI | T085–T090 (6) | 2 parallel (T085, T086) |
| 15. Social Trading Polish | T091–T095 (5) | 3 parallel |
| **Total** | **97 tasks** | |
