// Helpers for the multi-asset UI. Markets carry an `underlying_asset` string
// (e.g. "BTC", "ETH", "SOL") set on-chain; the app adapts chart/labels to it.

/**
 * Assets always offered in the selector so the chart can be browsed even before
 * the protocol lists betting markets for them. Any extra asset that does have an
 * open market is added alongside these automatically.
 */
export const SUPPORTED_ASSETS = ["BTC", "ETH", "SOL", "SUI"] as const;

/** TradingView symbol for an asset's price chart. */
export function tradingViewSymbol(asset: string): string {
  const map: Record<string, string> = {
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
    SUI: "BINANCE:SUIUSDT",
  };
  return map[asset] ?? `BINANCE:${asset}USDT`;
}
