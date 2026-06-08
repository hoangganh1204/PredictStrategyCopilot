"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    TradingView?: { widget: new (config: Record<string, unknown>) => void };
  }
}

const CONTAINER_ID = "tv_btc_chart";
const SCRIPT_ID = "tv-widget-script";

export function PriceChart() {
  useEffect(() => {
    function createWidget() {
      const el = document.getElementById(CONTAINER_ID);
      if (!el || !window.TradingView) return;
      el.innerHTML = "";
      new window.TradingView.widget({
        container_id: CONTAINER_ID,
        autosize: true,
        symbol: "BINANCE:BTCUSDT",
        interval: "15",
        timezone: "Asia/Ho_Chi_Minh",
        theme: "dark",
        style: "1",
        locale: "vi",
        enable_publishing: false,
        hide_side_toolbar: true,
        allow_symbol_change: false,
        save_image: false,
        withdateranges: true,
        hide_legend: false,
      });
    }

    if (window.TradingView) {
      createWidget();
      return;
    }

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = createWidget;
      document.head.appendChild(script);
    } else {
      const timer = setInterval(() => {
        if (window.TradingView) {
          clearInterval(timer);
          createWidget();
        }
      }, 100);
      return () => clearInterval(timer);
    }
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 overflow-hidden" style={{ height: 380 }}>
      <div id={CONTAINER_ID} className="h-full w-full" />
    </div>
  );
}
