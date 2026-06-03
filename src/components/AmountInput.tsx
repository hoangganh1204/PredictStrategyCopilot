"use client";
// FR-006a: validate amount > 0 and ≤ game account balance before enabling fetch.
import type { ExpiryLabel } from "@/hooks/useStrategies.js";

const EXPIRY_OPTIONS: { label: string; value: ExpiryLabel }[] = [
  { label: "15 phút", value: "15m" },
  { label: "30 phút", value: "30m" },
  { label: "1 giờ", value: "1h" },
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-300">Số tiền đặt</label>
          <span className="text-xs text-zinc-500">Tối đa: {maxBalance.toFixed(2)} DUSDC</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 pr-16 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
              DUSDC
            </span>
          </div>
          <button
            onClick={onSubmit}
            disabled={!isValid || isLoading}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isLoading ? "Đang tải..." : "Xem chiến lược"}
          </button>
        </div>
        {tooHigh && (
          <p className="text-xs text-red-400">Số tiền vượt quá số dư tài khoản chơi</p>
        )}
        {tooLow && amount !== "" && (
          <p className="text-xs text-red-400">Số tiền phải lớn hơn 0</p>
        )}
      </div>

      <div className="flex gap-2">
        {EXPIRY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onExpiryChange(opt.value)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
              expiry === opt.value
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
