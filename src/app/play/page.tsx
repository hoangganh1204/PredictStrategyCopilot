"use client";
// Main play page: amount input → fetch strategies → display → select → place bet.
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader.js";
import { AssetSelect } from "@/components/AssetSelect.js";
import { PriceChart } from "@/components/PriceChart.js";
import { DepositForm } from "@/components/DepositForm.js";
import { AmountInput } from "@/components/AmountInput.js";
import { StrategyList } from "@/components/StrategyList.js";
import { ConnectButton } from "@/components/ConnectButton.js";
import { TxStatusOverlay } from "@/components/TxStatusOverlay.js";
import { useManagerBalance, MANAGER_BALANCE_KEY } from "@/hooks/useManagerBalance.js";
import { RANGE_POSITIONS_KEY } from "@/hooks/useRangePositions.js";
import { useMarkets } from "@/hooks/useMarkets.js";
import { useExecuteTx } from "@/hooks/useExecuteTx.js";
import { useStrategies, type ApiStrategy } from "@/hooks/useStrategies.js";
import { buildBinaryMintTx, buildRangeMintTx } from "@/lib/execute/buildMintTx.js";
import { computeBetEconomics } from "@/lib/strategy/sizing.js";
import { SUPPORTED_ASSETS } from "@/lib/assets.js";
import { SVI_STALENESS_MS } from "@/config/predict.js";
import type { TxResult } from "@/lib/execute/types.js";

// Positions query key for invalidation on successful bet
const POSITIONS_KEY = ["positions"] as const;

function StepCard({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface animate-rise rounded-2xl border border-zinc-800 p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-400">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {hint && <span className="ml-auto text-xs text-zinc-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default function PlayPage() {
  const account = useCurrentAccount();
  const router = useRouter();
  const { data: balance } = useManagerBalance();
  const { execute, isPending } = useExecuteTx();

  const { data: markets, isLoading: marketsLoading } = useMarkets();

  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [selectedOracleId, setSelectedOracleId] = useState<string | null>(null);
  const [overlayResult, setOverlayResult] = useState<TxResult | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);

  const maxBalance = balance?.balance_dusdc ?? 0;
  const managerId = balance?.managerId;
  const hasBalance = maxBalance > 0;

  // Asset selector: always offer the supported assets (so the chart is browsable
  // even with no markets), plus any extra asset that does have an open market.
  const assetsWithMarkets = Array.from(new Set((markets ?? []).map((m) => m.asset)));
  const allAssets = Array.from(new Set([...SUPPORTED_ASSETS, ...assetsWithMarkets]));
  const defaultAsset = assetsWithMarkets[0] ?? allAssets[0] ?? "BTC";
  const activeAsset =
    selectedAsset && allAssets.includes(selectedAsset) ? selectedAsset : defaultAsset;
  const assetMarkets = (markets ?? []).filter((m) => m.asset === activeAsset);
  const activeHasMarkets = assetMarkets.length > 0;
  // Default to the soonest market of the active asset until the user picks another.
  const activeOracleId =
    selectedOracleId && assetMarkets.some((m) => m.oracleId === selectedOracleId)
      ? selectedOracleId
      : assetMarkets[0]?.oracleId ?? null;

  // Strategies depend only on the market — they load as soon as one is selected.
  const { data: strategies, isLoading, dataUpdatedAt, refetch } = useStrategies(activeOracleId);

  // Live stake (DUSDC the user spends) — rescales the cards instantly, no refetch.
  const stake = parseFloat(amount);
  const validStake = !isNaN(stake) && stake > 0 && stake <= maxBalance ? stake : 0;

  if (!account) {
    return (
      <>
        <AppHeader />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <p className="text-zinc-400">Connect your wallet to start playing</p>
          <ConnectButton />
        </main>
      </>
    );
  }

  // T045 + T047: build and execute the mint PTB
  async function handleBet(strategy: ApiStrategy) {
    if (!managerId || validStake <= 0) return;

    // FR-006c: never bet on volatility data older than 30s. Instead of bouncing
    // the user, silently refetch and place the bet with the live data.
    let live = strategies;
    if (!live?.ok || Date.now() - dataUpdatedAt > SVI_STALENESS_MS) {
      live = (await refetch()).data;
    }
    if (!live?.ok) {
      setOverlayResult({
        status: "failed",
        error: "Market data is unavailable right now — please try again in a few seconds.",
      });
      return;
    }
    const liveStrategy = live.strategies.find((s) => s.type === strategy.type);
    if (!liveStrategy) {
      setOverlayResult({
        status: "failed",
        error: "This strategy is no longer available on the current market.",
      });
      return;
    }

    const { oracle_id, expiry: expiryMs } = live;
    // User stake = amount they spend; derive token quantity from the per-token cost
    // so the actual mint cost ≈ stake. Each token redeems 1 DUSDC on win.
    const { quantityRaw: quantity_raw } = computeBetEconomics(
      validStake,
      Number(liveStrategy.cost_raw)
    );
    if (quantity_raw <= 0n) return;

    let tx;
    if (liveStrategy.type === "range") {
      if (!liveStrategy.lowerStrike_raw || !liveStrategy.upperStrike_raw) return;
      tx = buildRangeMintTx({
        oracleId: oracle_id,
        managerId,
        lowerStrike_raw: BigInt(liveStrategy.lowerStrike_raw),
        upperStrike_raw: BigInt(liveStrategy.upperStrike_raw),
        quantity_raw,
        expiryMs,
      });
    } else {
      if (!liveStrategy.strike_raw) return;
      tx = buildBinaryMintTx({
        oracleId: oracle_id,
        managerId,
        strike_raw: BigInt(liveStrategy.strike_raw),
        isUp: liveStrategy.type === "binary_up",
        quantity_raw,
        expiryMs,
      });
    }

    // Execute — invalidate balance + positions (binary + range) on success
    const result = await execute(tx, [
      [...MANAGER_BALANCE_KEY, account?.address],
      [...POSITIONS_KEY, account?.address],
      [...RANGE_POSITIONS_KEY, account?.address, managerId],
    ]);
    setOverlayResult(result);
  }

  function handleOverlayDismiss() {
    if (overlayResult?.status === "success") {
      router.push("/positions");
    }
    setOverlayResult(null);
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-6 py-6">
        {/* Title + asset selector */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Predict {activeAsset} price
            </h1>
            <p className="text-sm text-zinc-500">
              Pick an amount, review the suggestions, and bet with a single signature.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Asset</span>
            <AssetSelect
              assets={allAssets}
              value={activeAsset}
              liveAssets={assetsWithMarkets}
              onChange={(a) => {
                setSelectedAsset(a);
                setSelectedOracleId(null);
              }}
            />
          </div>
        </div>

        {/* Top zone: chart (left, wide) + controls/deposit panel (right, sticky) */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <PriceChart asset={activeAsset} />

            {/* No betting markets for this asset yet — chart-only */}
            {hasBalance && !activeHasMarkets && !marketsLoading && (
              <div className="card-surface rounded-2xl border border-zinc-800 p-6 text-center">
                <p className="font-medium text-zinc-300">No open markets for {activeAsset} yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
                  You can still watch the chart. Betting opens when {activeAsset} markets are
                  listed — pick an asset with a green dot (e.g. BTC) to place a bet now.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              {/* Deposit (game balance is zero) */}
              {!hasBalance && (
                <StepCard step={1} title="Deposit DUSDC into game account">
                  <p className="mb-4 text-sm text-zinc-400">
                    Your funds live in an on-chain account. Deposit once to start betting.
                  </p>
                  <DepositForm />
                </StepCard>
              )}

              {/* Choose amount + expiry (with inline top-up) */}
              {hasBalance && activeHasMarkets && (
                <StepCard
                  step={1}
                  title="Choose amount & expiry"
                  hint={`${maxBalance.toFixed(2)} DUSDC left`}
                >
                  <AmountInput
                    amount={amount}
                    maxBalance={maxBalance}
                    markets={assetMarkets}
                    marketsLoading={marketsLoading}
                    selectedOracleId={activeOracleId}
                    onAmountChange={setAmount}
                    onSelectMarket={setSelectedOracleId}
                  />

                  {/* Top-up: deposit more, inline within the controls card */}
                  <div className="mt-4 border-t border-zinc-800 pt-4">
                    {showDeposit ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-300">Add DUSDC</span>
                          <button
                            onClick={() => setShowDeposit(false)}
                            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                          >
                            Close
                          </button>
                        </div>
                        <DepositForm />
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeposit(true)}
                        className="flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                      >
                        <span className="text-base leading-none">＋</span> Add DUSDC
                      </button>
                    )}
                  </div>
                </StepCard>
              )}
            </div>
          </div>
        </div>

        {/* Strategies — full width below, auto-loaded, scaled live by amount */}
        {hasBalance && activeOracleId && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 px-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-400">
                2
              </span>
              <h2 className="text-sm font-semibold text-zinc-200">Pick a strategy & bet</h2>
              {validStake <= 0 && (
                <span className="ml-auto text-xs text-zinc-500">Enter an amount in the panel</span>
              )}
            </div>
            <StrategyList
              isLoading={isLoading}
              data={strategies}
              asset={activeAsset}
              stakeDusdc={validStake}
              onBet={handleBet}
              isBetting={isPending}
            />
          </div>
        )}

        {/* TxStatusOverlay — pending/success/failed/rejected */}
        <TxStatusOverlay
          isPending={isPending}
          result={overlayResult}
          onDismiss={handleOverlayDismiss}
        />
      </main>
    </>
  );
}
