// Shared display formatting helpers (FR-010: always 2 decimal places + DUSDC label).
import { DUSDC_SCALE as DUSDC_SCALE_RAW } from "@/config/predict.js";

const DUSDC_SCALE = Number(DUSDC_SCALE_RAW);

/**
 * Format a raw DUSDC bigint amount for display.
 * Always shows 2 decimal places and "DUSDC" unit label.
 * Example: 10_500_000n → "10.50 DUSDC"
 */
export function formatDusdc(amount_raw: bigint): string {
  const value = Number(amount_raw) / DUSDC_SCALE;
  return `${value.toFixed(2)} DUSDC`;
}

/**
 * Format a raw DUSDC number (from server JSON) for display.
 * Example: 10500000 → "10.50 DUSDC"
 */
export function formatDusdcNumber(amount_raw: number | undefined): string {
  if (amount_raw === undefined) return "—";
  const value = amount_raw / DUSDC_SCALE;
  return `${value.toFixed(2)} DUSDC`;
}

/**
 * Format remaining milliseconds as a countdown label.
 * ≥1h → "2h 05m"; otherwise "MM:SS".
 */
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Human-readable duration for a future gap (ms): "45m" · "4h 11m" · "3d 4h".
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "closed";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

/**
 * Format a raw price (scale 1e9) to USD display.
 * Example: 67_000_000_000_000n → "$67,000"
 */
export function formatPrice(amount_raw: bigint | number | undefined): string {
  if (amount_raw === undefined) return "—";
  const value = Number(amount_raw) / 1_000_000_000;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
