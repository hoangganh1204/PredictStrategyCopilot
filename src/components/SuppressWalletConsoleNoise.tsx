"use client";
// The Sui wallet browser extension logs its own console.error for every
// signTransactionBlock that fails or is rejected (e.g. gas-coin contention when
// a bot signs on the same wallet). Those logs come entirely from
// chrome-extension://…/dapp-interface.js — they are NOT app errors, but Next's
// dev overlay surfaces every console.error, so they show up as red "issues".
//
// This narrowly drops ONLY those wallet-extension sign logs so the dev overlay
// stays clean. It never touches real application errors. No-op in production
// (the dev overlay doesn't exist there).
import { useEffect } from "react";

export function SuppressWalletConsoleNoise() {
  useEffect(() => {
    const original = console.error;
    console.error = (...args: unknown[]) => {
      let text = "";
      for (const a of args) {
        if (typeof a === "string") text += a;
        else {
          try {
            text += JSON.stringify(a);
          } catch {
            text += String(a);
          }
        }
      }
      // Only swallow the wallet extension's own sign logs.
      if (text.includes("signTransactionBlock") || text.includes("dapp-interface.js")) return;
      original(...(args as Parameters<typeof console.error>));
    };
    return () => {
      console.error = original;
    };
  }, []);

  return null;
}
