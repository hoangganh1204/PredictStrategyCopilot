// Shared display formatting helpers (FR-010: always 2 decimal places + DUSDC label).

const DUSDC_SCALE = 1_000_000;

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
 * Format a raw price (scale 1e9) to USD display.
 * Example: 67_000_000_000_000n → "$67,000"
 */
export function formatPrice(amount_raw: bigint | number | undefined): string {
  if (amount_raw === undefined) return "—";
  const value = Number(amount_raw) / 1_000_000_000;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
