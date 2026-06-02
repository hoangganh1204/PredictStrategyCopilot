# Implementation Plan: Predict Strategy Copilot

**Branch**: `predict-strategy-copilot` | **Date**: 2026-06-02 | **Spec**: `.specify/memory/spec.md`

## Summary

Xây dựng ứng dụng Next.js giúp người dùng phổ thông tham gia thị trường dự đoán BTC ngắn hạn của DeepBook Predict trên Sui Testnet. Ứng dụng đọc dữ liệu biến động thị trường thật, tính 3 chiến lược (range ±1σ, binary lên, hedge −2σ), diễn đạt bằng ngôn ngữ thường, và cho vào lệnh bằng vài cú bấm. Không có backend riêng — Strategy Engine chạy trong Next.js API Routes; dữ liệu 100% read-only từ DeepBook Public Server và on-chain.

## Technical Context

**Language/Version**: TypeScript strict mode, ES2022, NodeNext module resolution
**Framework**: Next.js 14 (App Router), Turbopack dev / webpack prod
**Primary Dependencies**:
- `@mysten/sui` (latest stable, verify testnet compatibility trước init)
- `@mysten/dapp-kit` (latest stable, cùng major version với @mysten/sui)
- ~~`mathjs`~~ → dùng native `Math` (sqrt/exp/log). SVI chỉ cần Float64 arithmetic; u64 scale factors được convert sang number sau khi chia. Tiết kiệm ~300KB bundle. Cẩn thận khi convert I64 SVI params (rho, m) sang signed number.
- `@tanstack/react-query` (server state: fetch Predict server + chain)
**Package Manager**: pnpm
**Storage**: KHÔNG CÓ database — in-memory cache qua React Query (staleTime 30s SVI/oracle, 5s positions)
**Testing**: Vitest (unit), Playwright hoặc Cypress (E2E nếu thời gian cho phép)
**Target Platform**: Desktop browser (Sui Testnet)
**Project Type**: Single-page web application (Next.js monolith)
**Performance Goals**: Strategy API response ≤ 3s (SC-002); parallel fetch oracle + SVI
**Constraints**: Testnet only; không lưu private key; mọi số tiền dùng bigint on-chain, chỉ convert khi hiển thị
**Scale/Scope**: 1 actor (người chơi phổ thông), ~5 pages/views, hackathon scope

## Constitution Check

| Nguyên tắc | Tuân thủ | Ghi chú |
|---|---|---|
| I. Code Quality | ✅ | Hàm ≤ 30 dòng, camelCase/PascalCase, constant cho magic numbers |
| II. Testing | ✅ | Strategy Engine pure → unit testable 100%; integration test cho API Routes |
| III. UX Consistency | ⚠️ | Không có Figma design system → dùng Tailwind minimal, đảm bảo loading states > 300ms |
| IV. Performance | ✅ | API ≤ 3s, parallel fetch, no N+1 (không có DB) |
| V. Security | ✅ | Không lưu key, dùng wallet signing, không log DUSDC amounts riêng tư |
| VI. Governance | ✅ | UX Consistency violation ghi chú: hackathon không có Figma, dùng Tailwind thay thế |

## Project Structure

### Documentation

```text
.specify/memory/
├── constitution.md     # Đã tạo
├── spec.md             # Đã tạo
├── plan.md             # File này
└── tasks.md            # Sẽ tạo sau (speckit.tasks)
```

### Source Code

```text
src/
├── app/
│   ├── layout.tsx              # Root layout: WalletProvider, QueryClientProvider
│   ├── page.tsx                # Landing → redirect to /play nếu đã kết nối
│   ├── play/
│   │   └── page.tsx            # Màn chính: nhập tiền, chọn kỳ hạn, xem chiến lược, vào lệnh
│   └── positions/
│       └── page.tsx            # Theo dõi vị thế đang mở + nhận thưởng
├── components/
│   ├── ConnectButton.tsx       # Nút kết nối ví (wrap dapp-kit)
│   ├── StrategyCard.tsx        # Card hiển thị 1 chiến lược (mô tả, cost, payout, prob, countdown)
│   ├── StrategyList.tsx        # Container 2-3 StrategyCard
│   ├── PositionCard.tsx        # Card 1 vị thế (trạng thái, P&L, countdown)
│   ├── PositionList.tsx        # Danh sách vị thế đang mở
│   ├── DepositForm.tsx         # Form nạp DUSDC từ ví vào tài khoản chơi
│   ├── AmountInput.tsx         # Input số tiền + chọn kỳ hạn
│   ├── TxStatusOverlay.tsx     # Overlay trạng thái giao dịch (pending/success/failed/rejected)
│   └── BalanceDisplay.tsx      # Hiển thị số dư DUSDC tài khoản chơi
├── config/
│   └── predict.ts              # ALL on-chain constants, server URL, decimals (single source of truth)
├── lib/
│   ├── strategy/
│   │   ├── computeStrategies.ts    # Entry: OracleSnapshot → Strategy[]
│   │   ├── sviMath.ts              # SVI math: computeSigmaMove(), impliedVol(), totalVariance()
│   │   ├── snapToGrid.ts           # Snap strike/range to valid protocol grid
│   │   └── types.ts                # OracleSnapshot, SVIParams, Strategy, StrategyType
│   ├── execute/
│   │   ├── findOrCreateManager.ts  # Tìm hoặc tạo PredictManager
│   │   ├── depositDusdc.ts         # Nạp DUSDC vào manager (FR-013)
│   │   ├── buildMintTx.ts          # Dựng PTB cho mint binary/range
│   │   ├── buildRedeemTx.ts        # Dựng PTB cho redeem
│   │   └── types.ts                # TxResult, PositionState enum
│   └── predict-client.ts           # Fetch wrapper cho Public Server endpoints (typed)
├── hooks/
│   ├── useOracleState.ts           # TanStack Query: fetch oracle state + SVI
│   ├── useStrategies.ts            # TanStack Query: GET /api/strategies
│   ├── useManagerBalance.ts        # TanStack Query: fetch manager summary
│   ├── usePositions.ts             # TanStack Query: fetch positions summary
│   └── useExecuteTx.ts             # Mutation hook: sign+execute PTB, handle all outcomes
├── types/
│   └── predict-server.ts           # Type definitions cho mọi Public Server response
└── app/api/
    └── strategies/
        └── route.ts                # GET /api/strategies: fetch oracle+SVI → computeStrategies()

scripts/
└── probe.ts                        # MS0: verify endpoints, units, MarketKey constructor

tests/
├── unit/
│   ├── strategy/
│   │   ├── computeStrategies.test.ts
│   │   ├── sviMath.test.ts
│   │   └── snapToGrid.test.ts
│   └── predict-client.test.ts
└── integration/
    └── api-strategies.test.ts
```

**Structure Decision**: Single Next.js monolith. Phân tầng logic bên trong: `lib/strategy/` (pure, testable, không biết wallet) → `lib/execute/` (on-chain, phụ thuộc SDK) → `components/` + `app/` (UI only). Import một chiều: strategy ← execute ← UI. `config/predict.ts` là single source of truth cho mọi constant.

---

## Milestones

### MS0 — Probe & Verify (Prerequisite)

**Mục tiêu**: Đóng tất cả điểm thiếu (⚠️ CÒN THIẾU) trước khi code bất kỳ thứ gì.

**Deliverable**: `scripts/probe.ts` — chạy được, log rõ ràng.

**Tasks**:
1. Init Next.js project: `pnpm create next-app`, cài dependencies, cấu hình tsconfig strict
2. Tạo `src/config/predict.ts` với tất cả on-chain constants đã biết
3. Viết `scripts/probe.ts`:
   - Gọi từng endpoint Public Server → log JSON shape thật → tạo types trong `src/types/predict-server.ts`
   - Verify: `MarketKey` constructor (tên hàm + tham số chính xác)
   - Verify: `RangeKey` constructor (tên hàm + tham số chính xác)
   - Verify: scale factor của u64 fields (quantity, cost, strike, SVI params a/b/sigma vs rho/m I64)
   - Verify: đơn vị `oracle.expiry` (ms hay seconds)
   - Verify: cách lấy strike grid hợp lệ ngoài ask-bounds
4. Chạy probe → cập nhật types + config dựa trên kết quả thực

**Exit criteria**: Tất cả 6 điểm ⚠️ được giải quyết. Types match JSON thật. Config constants đúng.

---

### MS1 — Strategy Engine (Pure Logic)

**Mục tiêu**: `computeStrategies()` hoạt động đúng với dữ liệu thật, 100% unit tested.

**Deliverable**: `GET /api/strategies` trả về 3 chiến lược chính xác.

**Tasks**:
1. Implement `src/lib/strategy/types.ts` — define `OracleSnapshot`, `SVIParams`, `Strategy`, `StrategyType`
2. Implement `src/lib/strategy/sviMath.ts`:
   - `computeTotalVariance(sviParams, logMoneyness)` — SVI formula
   - `computeImpliedVol(sviParams, logMoneyness)` — formula depends on MS0 probe item #7: `√(w/T)` if w = total variance (Gatheral), `√w` if instantaneous
   - `computeSigmaMove(spot, forward, sviParams, timeToExpiry)` — ATM σ × √T → price move in DUSDC
   - Dùng native `Math.sqrt/exp/log` — Float64 đủ cho SVI tại scale u64 chuẩn. Cẩn thận convert I64 (rho, m) sang signed number trước khi tính.
3. Implement `src/lib/strategy/snapToGrid.ts`:
   - `snapToGrid(targetStrike, validStrikes)` — tìm strike hợp lệ gần nhất
   - `snapRangeToGrid(lowerTarget, upperTarget, validStrikes)` — snap cả 2 biên
   - Return `null` nếu snap quá xa (> 0.5σ) → chiến lược bị loại
4. Implement `src/lib/strategy/computeStrategies.ts`:
   - Input: `OracleSnapshot` (spot, forward, sviParams, expiry, strikeGrid, askBounds)
   - Compute σ_move = ATM σ × √T
   - Strategy "Đặt giá đứng yên": range [spot − 1σ, spot + 1σ], snap to grid
   - Strategy "Đặt giá lên": binary strike = spot (hoặc nearest above), hướng lên
   - Strategy "Phòng cú sập": binary strike = spot − 2σ, hướng xuống
   - Cho mỗi strategy: tính cost và max payout qua `devInspectTransactionBlock` gọi `predict::get_trade_amounts` / `predict::get_range_trade_amounts` (dry-run, không cần signer — chính xác hơn local estimate vì dùng đúng pricing logic của protocol). API Route khởi tạo `SuiClient` server-side cho mục đích này. Tính prob ≈ N(d) locally từ SVI.
   - Return `Strategy[]` hoặc lỗi nếu không có market mở / data stale
5. Implement `src/lib/predict-client.ts` — typed fetch wrapper:
   - `fetchOracleState(oracleId)` → OracleState
   - `fetchSviLatest(oracleId)` → SVIParams
   - `fetchAskBounds(oracleId)` → AskBounds
   - `fetchManagerSummary(managerId)` → ManagerSummary
   - `fetchPositionsSummary(managerId)` → PositionSummary[]
6. Implement `src/app/api/strategies/route.ts`:
   - Parse query: `amount`, `expiry` (15m/30m/1h)
   - Fetch oracle + SVI + ask-bounds (parallel)
   - Check staleness (> 30s → 400 `ERR_STALE_SVI`)
   - Check market open (nếu không → 400 `ERR_NO_MARKET`)
   - Call `computeStrategies()` → return JSON
7. Unit tests:
   - `sviMath.test.ts` — test với known SVI params → expected σ output
   - `snapToGrid.test.ts` — test snap logic, edge cases (target outside grid, exact match)
   - `computeStrategies.test.ts` — test full pipeline với mock OracleSnapshot
   - `predict-client.test.ts` — test typed fetch wrapper với MSW mocks
8. Integration test: `api-strategies.test.ts` — hit actual API Route với mocked server responses

**Exit criteria**: `computeStrategies()` passes all unit tests. API Route returns valid strategies from real testnet data. 80%+ coverage trên `lib/strategy/`.

---

### MS2 — Execute Flow (On-chain Transactions)

**Mục tiêu**: Mọi giao dịch on-chain hoạt động đầu-cuối: tạo manager, deposit, mint, redeem.

**Deliverable**: Có thể gọi từng hàm execute với ví testnet thật.

**Tasks**:
1. Implement `src/lib/execute/findOrCreateManager.ts`:
   - Query owned objects → tìm PredictManager
   - Nếu không có → build PTB `predict::create_manager(ctx)` → sign+execute → return ID
   - Cache manager ID trong React Query
2. Implement `src/lib/execute/depositDusdc.ts` (FR-013):
   - Input: managerId, amount_raw (bigint)
   - Build PTB: split coin DUSDC từ ví → `predict_manager::deposit<DUSDC>(manager, coin, ctx)`
   - Return TxResult
3. Implement `src/lib/execute/buildMintTx.ts`:
   - Input: strategy (binary/range), managerId, oracleId, key (MarketKey/RangeKey), quantity_raw
   - Build PTB: `predict::mint<DUSDC>(...)` hoặc `predict::mint_range<DUSDC>(...)`
   - Return Transaction object (chưa sign)
4. Implement `src/lib/execute/buildRedeemTx.ts`:
   - Input: managerId, oracleId, key, quantity_raw
   - Build PTB: `predict::redeem<DUSDC>(...)`
   - Return Transaction object
5. Implement `src/lib/execute/types.ts`:
   - `TxResult = { status: 'success' | 'failed' | 'rejected'; digest?: string; error?: string }`
   - `PositionState = 'active' | 'awaiting_settlement' | 'settled_won' | 'settled_lost' | 'redeemed'`
6. Implement `src/hooks/useExecuteTx.ts` — mutation hook wrapping `useSignAndExecuteTransaction` (dapp-kit):
   - Input: Transaction object từ buildMintTx/buildRedeemTx/depositDusdc
   - Handle 3 outcomes: success (return digest) / failed (parse error) / rejected (user cancelled in wallet)
   - Return `TxResult` + loading state
7. Unit tests cho PTB builder logic (mock SuiClient)

**Exit criteria**: Chạy được script test gọi findOrCreateManager → deposit → mint → redeem trên testnet thật. Tối thiểu 1 lệnh binary + 1 lệnh range thành công (SC-004).

---

### MS3 — UI & Full Flow

**Mục tiêu**: Giao diện hoàn chỉnh, người dùng vào lệnh đầu-cuối chỉ bằng vài cú bấm.

**Deliverable**: App chạy được trên localhost, trọn vòng kết nối → chiến lược → vào lệnh → nhận thưởng.

**Tasks**:
1. Setup root layout (`src/app/layout.tsx`):
   - `WalletProvider` (dapp-kit, Sui Testnet)
   - `QueryClientProvider` (TanStack Query)
   - Tailwind CSS base
2. Implement hooks:
   - `useOracleState.ts` — fetch + cache oracle state & SVI (staleTime 30s)
   - `useStrategies.ts` — call `GET /api/strategies` with amount + expiry
   - `useManagerBalance.ts` — fetch manager summary (staleTime 5s)
   - `usePositions.ts` — fetch positions summary (staleTime 5s)
   - `useExecuteTx.ts` — mutation: signAndExecuteTransaction, handle success/failed/rejected
3. Implement components:
   - `ConnectButton` — wrap dapp-kit, hiển thị địa chỉ rút gọn sau kết nối
   - `BalanceDisplay` — số dư DUSDC tài khoản chơi, format đúng decimals
   - `DepositForm` — input số tiền DUSDC, nút nạp, trạng thái xử lý
   - `AmountInput` — input số tiền đặt + selector kỳ hạn (15m/30m/1h)
   - `StrategyCard` — mô tả ngôn ngữ thường, cost_dusdc, payout_dusdc, prob%, countdown
   - `StrategyList` — hiển thị 2-3 cards hoặc thông báo "không có thị trường"
   - `TxStatusOverlay` — pending spinner, success check, failed/rejected message thân thiện
   - `PositionCard` — trạng thái, P&L, countdown, nút "Nhận thưởng" nếu won
   - `PositionList` — danh sách vị thế, empty state nếu chưa có
4. Implement pages:
   - `/` (landing): ConnectButton, redirect to /play sau kết nối
   - `/play`: BalanceDisplay + DepositForm (nếu balance = 0) + AmountInput + StrategyList → chọn → TxStatusOverlay
   - `/positions`: PositionList + PositionCard (redeem flow)
5. UX requirements:
   - Loading state cho mọi fetch > 300ms (Constitution III)
   - Không thuật ngữ chuyên ngành — FR-009: "strike" → "mức giá", "implied vol" → không hiện
   - Số tiền format: `10.00 DUSDC` — luôn 2 decimals, đơn vị rõ ràng
   - Error messages tiếng Việt, thân thiện (FR-011)
6. Validation trước vào lệnh (FR-006):
   - amount > 0 && amount ≤ balance (game account)
   - market open cho kỳ hạn đã chọn
   - SVI data < 30s old
   - Nếu vi phạm → disable nút + hiển thị lý do

**Exit criteria**: Trọn vòng hoàn thành < 5 phút (SC-001). 3 tình huống (win/lose/reject) xử lý đúng (SC-005). Không thông báo lỗi kỹ thuật cho user (SC-006).

---

## Unit Convention (BẮT BUỘC)

| Hậu tố | Ý nghĩa | Kiểu | Ví dụ |
|---|---|---|---|
| `_raw` | u64 bigint as-is từ chain | `bigint` | `cost_raw = 10_000_000n` |
| `_dusdc` | Đã chia decimals (÷ 10^6), để hiển thị | `number` | `cost_dusdc = 10.0` |

**Quy tắc**: KHÔNG BAO GIỜ mix `_raw` với `_dusdc` trong cùng một phép tính. Convert tại ranh giới UI.

## Error Convention (API Routes)

```typescript
// Response shape cho lỗi
{ ok: false, code: "ERR_STALE_SVI" | "ERR_NO_MARKET" | "ERR_INVALID_AMOUNT" | ..., message: string }
```

`code` là string constant. `message` là human-readable tiếng Việt.

## On-chain Config (Single Source of Truth)

Tất cả nhúng trong `src/config/predict.ts`:

```typescript
export const PREDICT_CONFIG = {
  PACKAGE: "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138",
  REGISTRY: "0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64",
  PREDICT_OBJECT: "0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a",
  DUSDC_TYPE: "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC",
  DUSDC_DECIMALS: 6,
  CLOCK_OBJECT: "0x6",
  DUSDC_CURRENCY_ID: "0xf3000dff421833d4bb8ed58fac146d691a3aaba2785aa1989af65a7089ca3e9c",
  SERVER_URL: "https://predict-server.testnet.mystenlabs.com",
} as const;
```

## Integration Map

| Source | Protocol | Dùng cho | Cache |
|---|---|---|---|
| DeepBook Public Server | REST (fetch) | Oracle state, SVI, ask-bounds, manager, positions | TanStack Query 30s/5s |
| Sui Testnet RPC | JSON-RPC (@mysten/sui) | Submit PTB, query owned objects | Không cache |
| Wallet (Slush/Suiet) | dapp-kit | Sign transactions | N/A |

## Staleness Rule

Có 2 ngưỡng staleness phục vụ 2 mục đích khác nhau:

1. **FR-006c — Data freshness check (30s)**: Kiểm tra trường `updatedAt` trong JSON response từ `GET /oracles/:id/svi/latest`. Nếu `Date.now() - svi.updatedAt > 30_000ms` → dữ liệu biến động đã cũ → chặn vào lệnh + hiển thị cảnh báo. Đây là check trên **tuổi của dữ liệu nguồn**, không phải tuổi của cache.
2. **Hard safety block (5 phút)**: Nếu `svi.updatedAt` cách hiện tại > 5 phút → protocol có thể đã ngừng cập nhật → cảnh báo nghiêm trọng, chặn tuyệt đối.

React Query staleTime (**30s** cho oracle/SVI, **5s** cho positions/balance) chỉ kiểm soát tần suất refetch — không thay thế cho FR-006c check.

## Items Phải Verify Trước MS1 (probe.ts)

1. ☐ `market_key::MarketKey` constructor — tên hàm + tham số chính xác
2. ☐ `range_key::RangeKey` constructor — tên hàm + tham số chính xác
3. ☐ Scale factor u64: quantity, cost, strike, SVI params (a/b/sigma vs rho/m I64)
4. ☐ Cách lấy strike grid hợp lệ ngoài ask-bounds
5. ☐ Đơn vị `oracle.expiry` — ms hay seconds
6. ☐ JSON shape thật của mọi Public Server endpoint
7. ☐ SVI `w(k)` là total variance (`σ²T`, Gatheral convention) hay instantaneous variance (`σ²`) — quyết định trực tiếp công thức `computeImpliedVol`: nếu total → `σ = √(w/T)`, nếu instantaneous → `σ = √w`. Sai ở đây = sai toàn bộ σ_move.
8. ☐ Verify `devInspectTransactionBlock` hoạt động đúng với `predict::get_trade_amounts` trên testnet (dry-run không cần signer)

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Không dùng design system Figma (Constitution III) | Hackathon không có Figma | Tailwind minimal thay thế, loading states vẫn đảm bảo |
| SVI staleness dùng 2 ngưỡng (30s FR-006 vs 5 phút hard block) | 30s là cache freshness cho UX; 5 phút là safety hard stop vì data quá cũ có thể gây lỗ | Một ngưỡng duy nhất không phân biệt được "stale nhưng OK" vs "nguy hiểm" |
