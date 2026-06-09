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

/**
 * Current timestamp, refreshed on an interval. null until mounted so Date.now()
 * is never called during render. Use to derive live labels for a list of items.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
