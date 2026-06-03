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

- [ ] T016 [P] [US2] Write `tests/unit/strategy/sviMath.test.ts`: test `computeTotalVariance()` with known SVI params → expected w value. Test `computeImpliedVol()` → expected σ. Test `computeSigmaMove()` → expected price move. Use real params captured from probe.
  - **Verify**: Tests exist and FAIL (functions not yet implemented).

- [ ] T017 [P] [US2] Write `tests/unit/strategy/snapToGrid.test.ts`: test `snapToGrid()` — exact match, nearest below, nearest above, target outside grid returns null if > 0.5σ. Test `snapRangeToGrid()` — both bounds snap correctly.
  - **Verify**: Tests exist and FAIL.

- [ ] T018 [P] [US2] Write `tests/unit/strategy/computeStrategies.test.ts`: test full pipeline with a mock `OracleSnapshot` (from probe data). **Mock `SuiClient.devInspectTransactionBlock`** to return sample `(mint_cost, redeem_payout)` captured from T014 probe output — this is required because `computeStrategies` receives `SuiClient` as a dependency for pricing. Assert: returns 3 strategies (range, binary-up, binary-down). Each has strike/range within valid grid. cost_raw > 0. payout_raw > cost_raw. prob in (0,1).
  - **Verify**: Tests exist and FAIL (functions not yet implemented, but mock is complete).

- [ ] T019 [P] [US2] Write `tests/unit/predict-client.test.ts`: test `fetchOracleState()`, `fetchSviLatest()`, `fetchAskBounds()` with MSW mocks matching types from T008. Test error handling for non-200 responses.
  - **Verify**: Tests exist and FAIL.

### Implementation (TDD — Green Phase)

- [ ] T020 [US2] Implement `src/lib/strategy/types.ts`: define `OracleSnapshot`, `SVIParams` (with scale factors from probe), `Strategy`, `StrategyType` enum (`range | binary_up | binary_down`). All price/cost fields use `bigint` suffix `_raw`.
  - **Verify**: `tsc --noEmit` passes.

- [ ] T021 [US2] Implement `src/lib/strategy/sviMath.ts`: `computeTotalVariance()`, `computeImpliedVol()` (formula per probe item #7), `computeSigmaMove()`. Use native `Math.sqrt/exp/log`. Handle I64→signed conversion for rho, m.
  - **Verify**: `pnpm vitest run tests/unit/strategy/sviMath.test.ts` — all GREEN.

- [ ] T022 [US2] Implement `src/lib/strategy/snapToGrid.ts`: `snapToGrid()`, `snapRangeToGrid()`. Accept `validStrikes: bigint[]`, return closest valid strike or `null` if beyond 0.5σ threshold.
  - **Verify**: `pnpm vitest run tests/unit/strategy/snapToGrid.test.ts` — all GREEN.

- [ ] T023 [US2] Implement `src/lib/predict-client.ts`: typed fetch wrapper for all Public Server endpoints. Use `PREDICT_CONFIG.SERVER_URL` as base. Type responses with interfaces from T008. Throw typed errors for non-200.
  - **Verify**: `pnpm vitest run tests/unit/predict-client.test.ts` — all GREEN.

- [ ] T024a [US2] Implement `src/lib/strategy/computeStrategies.ts` — core orchestration: input `OracleSnapshot`, compute σ_move via sviMath, build 3 strategy skeletons per FR-004 (range ±1σ, binary-up, binary-down −2σ), snap to grid via snapToGrid. For cost/payout: accept an abstract `PricingFn` callback `(strike, quantity) => { mint_cost_raw, redeem_payout_raw }`. Return `Strategy[]` or error.
  - **Verify**: `pnpm vitest run tests/unit/strategy/computeStrategies.test.ts` — all GREEN (using mock PricingFn).

- [ ] T024b [US2] Wire devInspect into `computeStrategies`: implement concrete `PricingFn` that calls `SuiClient.devInspectTransactionBlock` with `predict::get_trade_amounts` / `get_range_trade_amounts`. Test with real testnet data.
  - **Verify**: `computeStrategies` returns strategies with cost/payout matching devInspect output from T014.
  - **Depends on**: T014 (devInspect verified), T024a

- [ ] T025 [US2] Implement `src/app/api/strategies/route.ts`: parse query params (amount, expiry). Parallel fetch oracle + SVI + ask-bounds via predict-client. Check staleness: `Date.now() - svi.updatedAt > 30_000` → 400 `ERR_STALE_SVI`. Check market open → 400 `ERR_NO_MARKET`. Init `SuiClient` server-side. Call `computeStrategies()` with devInspect PricingFn. Return JSON.
  - **Verify**: `curl localhost:3000/api/strategies?amount=10&expiry=15m` returns valid strategy JSON from testnet.

- [ ] T026 [US2] Write `tests/integration/api-strategies.test.ts`: hit actual API Route with MSW mocking Public Server responses + mock devInspect. Assert: correct response shape, 3 strategies, error cases (stale SVI, no market).
  - **Verify**: `pnpm vitest run tests/integration/api-strategies.test.ts` — all GREEN.

**Checkpoint**: Strategy Engine complete. `GET /api/strategies` works with real testnet data. ≥80% coverage on `lib/strategy/`. FR-003, FR-004, FR-005 satisfied.

---

## Phase 4: US3 — Execute Flow (Integration-After)

**Goal**: All on-chain transactions work end-to-end: deposit, mint binary, mint range, redeem.

**Independent Test**: Script can execute deposit → mint → verify position on testnet.

**Spec refs**: FR-001, FR-006, FR-008, FR-011, FR-013

### Implementation

- [ ] T027 [US3] Implement `src/lib/execute/types.ts`: `TxResult` type (`status: 'success' | 'failed' | 'rejected'`, `digest?`, `error?`). `PositionState` enum. `MintParams`, `RedeemParams` interfaces. All amount fields `bigint` (`_raw`).
  - **Verify**: `tsc --noEmit` passes.

- [ ] T028 [US3] Implement `src/lib/execute/findOrCreateManager.ts`: query owned objects by type `PredictManager` → return ID if found. If not, build PTB calling `predict::create_manager(ctx)`. Accept `SuiClient` + `signAndExecute` callback as deps (no direct wallet import).
  - **Verify**: Manual test with testnet wallet → PredictManager created or found; ID returned.

- [ ] T029 [US3] Implement `src/lib/execute/depositDusdc.ts` (FR-013): build PTB that splits DUSDC coin from wallet, calls `predict_manager::deposit<DUSDC>(manager, coin, ctx)`. Input: `managerId`, `amount_raw` (bigint). Return `Transaction` object.
  - **Verify**: Manual test → deposit tx succeeds; manager balance increases in Public Server.

- [ ] T030a [US3] Implement `src/lib/execute/buildMintTx.ts` — binary only: build PTB for `predict::mint<DUSDC>`. Construct `MarketKey` using constructor pattern from T009. Input: oracleId, strike, direction, quantity_raw. Return `Transaction`.
  - **Verify**: Manual test → binary mint tx succeeds on testnet; position appears in Public Server.

- [ ] T030b [US3] Extend `buildMintTx.ts` — add range support: build PTB for `predict::mint_range<DUSDC>`. Construct `RangeKey` using constructor pattern from T009. Input: oracleId, lower_strike, upper_strike, quantity_raw. Return `Transaction`.
  - **Verify**: Manual test → range mint tx succeeds on testnet; range position appears in Public Server.
  - **Depends on**: T030a

- [ ] T031 [US3] Implement `src/lib/execute/buildRedeemTx.ts`: build PTB for `predict::redeem<DUSDC>`. Input: managerId, oracleId, key, quantity_raw. Return `Transaction`.
  - **Verify**: Manual test → redeem tx succeeds for a settled winning position (if available).

- [ ] T032 [US3] Implement `src/hooks/useExecuteTx.ts`: mutation hook wrapping `useSignAndExecuteTransaction` (dapp-kit). Handle 3 outcomes: success → return digest + invalidate queries, failed → parse error message, rejected → detect user cancel. Return `TxResult` + `isPending` state.
  - **Verify**: Hook compiles; TypeScript types correct; manual test in browser.

### Integration Test

- [ ] T033 [US3] Write end-to-end testnet script `scripts/e2e-execute.ts`: using a test keypair, run full flow: findOrCreateManager → deposit 1 DUSDC → mint binary (using real strategy params from API) → verify position exists via Public Server. Log each step. **Security: test keypair loaded from env var `TEST_KEYPAIR` or `.env.local` — NEVER commit private key to repo. Add `scripts/e2e-execute.ts` note + `.env.local` to `.gitignore`.**
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

- [ ] T034 [P] [US1] Implement `src/app/layout.tsx`: wrap app with `SuiClientProvider` (Sui Testnet), `WalletProvider` (dapp-kit), `QueryClientProvider` (TanStack Query). Configure Tailwind.
  - **Verify**: `pnpm dev` → app loads without provider errors in console.

- [ ] T035 [P] [US1] Implement `src/components/ConnectButton.tsx`: wrap dapp-kit `ConnectButton` or build custom. Show truncated address after connect. Handle disconnect.
  - **Verify**: Click → wallet popup → address shown; disconnect works.

- [ ] T039 [P] [US1] Implement `src/app/page.tsx` (landing): show ConnectButton if not connected. After connect → redirect to `/play`.
  - **Verify**: Fresh visit → connect button; after connect → navigated to /play.

### Phase 5B — Balance & Deposit (after Phase 4: T028, T029)

- [ ] T036 [US1] Implement `src/hooks/useManagerBalance.ts`: TanStack Query hook. On wallet connect → call `findOrCreateManager()` (from T028) → fetch `GET /managers/:id/summary` → return balance_raw + balance_dusdc. staleTime 5s.
  - **Verify**: Hook returns correct DUSDC balance for connected wallet.
  - **Depends on**: T028 (findOrCreateManager)

- [ ] T037 [US1] Implement `src/components/BalanceDisplay.tsx`: show `balance_dusdc` formatted as `XX.XX DUSDC`. Handle loading state (skeleton). Handle no-wallet state.
  - **Verify**: Balance displays correctly; loading skeleton appears while fetching.
  - **Depends on**: T036 (useManagerBalance)

- [ ] T038 [US1] Implement `src/components/DepositForm.tsx` (FR-013): input for amount, "Nạp tiền" button. Call `depositDusdc` (from T029) via `useExecuteTx`. Show TxStatusOverlay during deposit. Invalidate balance query on success.
  - **Verify**: Deposit DUSDC → balance updates; validation: amount > 0, amount ≤ wallet DUSDC balance.
  - **Depends on**: T029 (depositDusdc), T032 (useExecuteTx)

**Checkpoint**: US1 complete. User connects, account auto-created, balance displayed, deposit works. FR-002, FR-008, FR-010 satisfied.

---

## Phase 6: US2 UI — Strategy Display

**Goal**: User enters amount + expiry, sees 2–3 strategies in plain language within 3s.

**Independent Test**: Enter 10 DUSDC + 15m → 3 strategy cards appear with cost, payout, prob, countdown.

**Spec refs**: FR-003, FR-004, FR-005, FR-009, SC-002

- [ ] T040 [P] [US2] Implement `src/hooks/useStrategies.ts`: TanStack Query hook calling `GET /api/strategies?amount=X&expiry=Y`. Return `Strategy[]` or error state. staleTime 30s.
  - **Verify**: Hook returns strategy data from API Route.

- [ ] T041 [P] [US2] Implement `src/components/StrategyCard.tsx`: display one strategy. Plain language label (FR-009): "Đặt giá đứng yên", "Đặt giá lên", "Phòng cú sập". Show: description, cost_dusdc, payout_dusdc, prob%, countdown timer. No option jargon.
  - **Verify**: Card renders with all 5 info fields; no "strike", "implied volatility", "vol curve" text.

- [ ] T042 [US2] Implement `src/components/StrategyList.tsx`: container for 2–3 StrategyCards. Handle states: loading (skeleton after 300ms — Constitution III), error (ERR_NO_MARKET → friendly message VN), stale SVI warning.
  - **Verify**: Loading skeleton shows if fetch > 300ms; "no market" message shows for closed expiry.

- [ ] T043 [US2] Implement `src/components/AmountInput.tsx`: number input for DUSDC amount + expiry selector (15 phút / 30 phút / 1 giờ). Validate: amount > 0, amount ≤ game account balance (FR-006a). Disable submit if invalid.
  - **Verify**: Invalid amount → button disabled + error message; valid input → strategies fetch triggered.

- [ ] T044 [US2] Implement `src/app/play/page.tsx`: compose BalanceDisplay + DepositForm (if balance=0) + AmountInput + StrategyList. Wire up: amount+expiry → useStrategies → StrategyList.
  - **Verify**: Full flow: enter amount → pick expiry → strategies appear within 3s (SC-002).

**Checkpoint**: US2 UI complete. User sees strategies in plain Vietnamese. SC-002, FR-009 verified.

---

## Phase 7: US3 UI — Place Bet & Transaction Status

**Goal**: User selects strategy, signs transaction, sees success/failure/rejection feedback.

**Independent Test**: Select strategy → sign in wallet → position appears in dashboard OR rejection shows friendly message.

**Spec refs**: FR-006, FR-008, FR-011, SC-005

- [ ] T045 [US3] Add "Vào lệnh" button to `StrategyCard.tsx`. On click: build mint tx (binary or range) via `buildMintTx`, execute via `useExecuteTx`. Pre-validate FR-006 (amount, market open, SVI freshness).
  - **Verify**: Button click → wallet popup → tx submitted.

- [ ] T046 [US3] Implement `src/components/TxStatusOverlay.tsx`: overlay states — pending (spinner + "Đang xử lý..."), success (check + digest link), failed (friendly VN error message + "Thử lại"), rejected ("Bạn đã hủy giao dịch" + return to strategies).
  - **Verify**: All 3 outcomes display correct overlay; app never freezes (FR-011).

- [ ] T047 [US3] Wire TxStatusOverlay into `/play` page. On success → invalidate balance + positions queries → navigate to /positions. On failure/rejection → dismiss overlay → back to strategy selection.
  - **Verify**: Success → positions page; rejection → back to strategies; failure → error shown.

**Checkpoint**: US3 UI complete. Full bet placement flow. SC-005 satisfied (win/lose/reject handled).

---

## Phase 8: US4 — Position Dashboard

**Goal**: User tracks open positions with P&L and countdown.

**Independent Test**: After placing bet → /positions shows position with status, P&L, countdown timer.

**Spec refs**: FR-007, FR-010

- [ ] T048 [P] [US4] Implement `src/hooks/usePositions.ts`: TanStack Query hook calling `GET /managers/:id/positions/summary`. Return typed `Position[]`. staleTime 5s. Map position status to `PositionState` enum.
  - **Verify**: Hook returns positions for connected wallet's manager.

- [ ] T049 [P] [US4] Implement `src/components/PositionCard.tsx`: display one position. Show: bet type (plain language), status badge (Đang hoạt động / Chờ chốt / Thắng / Thua / Đã nhận), P&L in DUSDC (FR-010), countdown to settlement. Countdown uses `oracle.expiry` in correct unit (from probe).
  - **Verify**: Card renders all fields; countdown ticks in real-time.

- [ ] T050 [US4] Implement `src/components/PositionList.tsx`: list of PositionCards. Empty state: "Chưa có vị thế nào" + CTA link to /play. Loading state after 300ms.
  - **Verify**: Empty state shows when no positions; list shows when positions exist.

- [ ] T051 [US4] Implement `src/app/positions/page.tsx`: compose PositionList. Include BalanceDisplay at top. Navigation back to /play.
  - **Verify**: Page loads, shows real positions from testnet, countdown works.

**Checkpoint**: US4 complete. Position tracking with real-time P&L and countdown. FR-007 satisfied.

---

## Phase 9: US5 — Redeem Winnings

**Goal**: User claims winnings for settled-won positions.

**Independent Test**: Position in "Thắng" state → click "Nhận thưởng" → sign → balance increases.

**Spec refs**: FR-007 (full lifecycle), FR-012, SC-004

- [ ] T052 [US5] Add redeem button to `PositionCard.tsx`: visible only when status = `settled_won`. On click → `buildRedeemTx` → `useExecuteTx`. Show TxStatusOverlay.
  - **Verify**: Button appears only for won positions; click → wallet popup.

- [ ] T053 [US5] Handle redeem outcomes: success → update position status to "Đã nhận thưởng", invalidate balance query. Failure → friendly error. For lost positions: show "Lần này không trúng" + link to /play for new strategies.
  - **Verify**: Win → redeem → balance increases; loss → correct message shown.

- [ ] T054 [US5] Integration test: run full lifecycle on testnet. Place binary bet → wait for settlement → redeem if won. Place range bet → verify. (Manual test, use `scripts/e2e-execute.ts` as base.)
  - **Verify**: SC-004 met: at least 1 binary + 1 range bet placed and redeemed on testnet.

**Checkpoint**: US5 complete. Full lifecycle: bet → track → redeem. SC-004, FR-007, FR-012 satisfied.

---

## Phase 10: Polish & Cross-Cutting

**Purpose**: Edge cases, error handling, final validation.

- [ ] T055 [P] Add global error boundary in `layout.tsx`: catch unhandled errors → friendly message, no white screen.
  - **Verify**: Throw error in component → error boundary catches, shows recovery UI.

- [ ] T056 [P] Validate FR-009 compliance: audit all user-facing text. Remove any "strike price", "implied volatility", "vol curve", "expiry" — replace with plain Vietnamese equivalents.
  - **Verify**: Grep codebase for option jargon → 0 matches in components/.

- [ ] T057 [P] Validate FR-010 compliance: audit all DUSDC display. Ensure: always 2 decimal places, "DUSDC" unit label, no floating point artifacts. Add helper `formatDusdc(amount_raw: bigint): string`.
  - **Verify**: All money displays show "XX.XX DUSDC" format.

- [ ] T058 Validate SC-006: test all "no market" scenarios. For each expiry (15m/30m/1h), if no market → confirm friendly message (not empty list, not technical error).
  - **Verify**: Deliberately pick closed expiry → message "Hiện không có thị trường mở cho khung này".

- [ ] T059 End-to-end manual test: fresh wallet → connect → deposit → pick strategy → place bet → track position → redeem. Target: < 5 minutes (SC-001).
  - **Verify**: Timed walkthrough under 5 minutes without external docs.

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
  Phase 10 (Polish) ← after all phases
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
| **Total** | **61 tasks** | |
