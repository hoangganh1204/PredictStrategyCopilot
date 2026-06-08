"use client";
// FR-006a: validate amount > 0 and ≤ game account balance before enabling fetch.
import type { ExpiryLabel } from "@/hooks/useStrategies.js";

const EXPIRY_OPTIONS: { label: string; value: ExpiryLabel }[] = [
  { label: "15 phút", value: "15m" },
  { label: "30 phút", value: "30m" },
  { label: "1 giờ", value: "1h" },
];

const QUICK_FRACTIONS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "Tối đa", value: 1 },
];

interface AmountInputProps {
  amount: string;
  expiry: ExpiryLabel;
  maxBalance: number;
  onAmountChange: (v: string) => void;
  onExpiryChange: (v: ExpiryLabel) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function AmountInput({
  amount,
  expiry,
  maxBalance,
  onAmountChange,
  onExpiryChange,
  onSubmit,
  isLoading,
}: AmountInputProps) {
  const amountNum = parseFloat(amount);
  const tooHigh = !isNaN(amountNum) && amountNum > maxBalance;
  const tooLow = !isNaN(amountNum) && amountNum <= 0;
  const isValid = !isNaN(amountNum) && amountNum > 0 && amountNum <= maxBalance;

  function setFraction(frac: number) {
    const v = maxBalance * frac;
    // Trim to 2 decimals without trailing zeros
    onAmountChange(String(Math.floor(v * 100) / 100));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Amount */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-300">Số tiền muốn chi</label>
          <span className="text-xs text-zinc-500">
            Khả dụng: <span className="font-mono text-zinc-300">{maxBalance.toFixed(2)}</span> DUSDC
          </span>
        </div>

        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 pr-20 text-lg font-mono text-zinc-100 placeholder-zinc-600 transition-colors focus:border-blue-500 focus:outline-none"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
            DUSDC
          </span>
        </div>

        {/* Quick fractions */}
        <div className="flex gap-2">
          {QUICK_FRACTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setFraction(q.value)}
              disabled={maxBalance <= 0}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>

        {tooHigh && (
          <p className="text-xs text-red-400">Số tiền vượt quá số dư tài khoản chơi</p>
        )}
        {tooLow && amount !== "" && (
          <p className="text-xs text-red-400">Số tiền phải lớn hơn 0</p>
        )}
      </div>

      {/* Expiry */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-300">Kỳ hạn</label>
        <div className="flex gap-2">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onExpiryChange(opt.value)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                expiry === opt.value
                  ? "bg-zinc-700 text-zinc-100 ring-1 ring-zinc-600"
                  : "bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={!isValid || isLoading}
        className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        {isLoading ? "Đang tải chiến lược..." : "Xem chiến lược"}
      </button>
    </div>
  );
}
