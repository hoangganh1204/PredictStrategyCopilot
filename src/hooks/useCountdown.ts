"use client";
import { useEffect, useState } from "react";

/**
 * Milliseconds remaining until `expiryMs`, refreshed every second.
 * Returns null until mounted so Date.now() is never called during render
 * (keeps the component pure — see react-hooks/purity).
 */
export function useCountdown(expiryMs: number): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiryMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiryMs]);

  return remaining;
}
