// Map annualized implied volatility to a plain-language level for the UI.
// BTC realized vol typically sits ~40–80%/yr; thresholds chosen accordingly.
export type VolLevel = "low" | "medium" | "high";

export function volLevel(impliedVol: number): VolLevel {
  if (impliedVol < 0.45) return "low";
  if (impliedVol < 0.7) return "medium";
  return "high";
}

export const VOL_META: Record<
  VolLevel,
  { label: string; note: string; dot: string; text: string }
> = {
  low: {
    label: "Low",
    note: "BTC is calm right now",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  medium: {
    label: "Medium",
    note: "Moderate swings expected",
    dot: "bg-amber-400",
    text: "text-amber-400",
  },
  high: {
    label: "High",
    note: "Big swings expected ⚠️",
    dot: "bg-red-400",
    text: "text-red-400",
  },
};
