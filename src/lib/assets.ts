// Helpers for the multi-asset UI. Markets carry an `underlying_asset` string
// (e.g. "BTC", "ETH", "SOL") set on-chain; the app adapts chart/labels to it.

/** TradingView symbol for an asset's price chart. */
export function tradingViewSymbol(asset: string): string {
  const map: Record<string, string> = {
    BTC: "BINANCE:BTCUSDT",
    ETH: "BINANCE:ETHUSDT",
    SOL: "BINANCE:SOLUSDT",
  };
  return map[asset] ?? `BINANCE:${asset}USDT`;
}
