// Brand mark: a BTC-orange coin glyph + wordmark.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 text-base font-bold text-zinc-950 shadow-lg shadow-orange-500/20">
        ₿
      </span>
      {!compact && (
        <span className="text-base font-semibold tracking-tight text-zinc-100">
          Predict<span className="text-gradient"> Copilot</span>
        </span>
      )}
    </div>
  );
}
