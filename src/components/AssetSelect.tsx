"use client";
import { useEffect, useRef, useState } from "react";

interface AssetSelectProps {
  assets: string[];
  value: string;
  /** Assets that currently have open betting markets (shown with a green dot). */
  liveAssets: string[];
  onChange: (asset: string) => void;
}

function Dot({ live }: { live: boolean }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "bg-emerald-400" : "bg-zinc-600"}`} />;
}

export function AssetSelect({ assets, value, liveAssets, onChange }: AssetSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3.5 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600"
      >
        <Dot live={liveAssets.includes(value)} />
        {value}
        <svg
          className={`h-4 w-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="animate-rise absolute z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {assets.map((a) => {
            const live = liveAssets.includes(a);
            return (
              <button
                key={a}
                onClick={() => {
                  onChange(a);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-sm transition-colors ${
                  a === value ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800/60"
                }`}
              >
                <Dot live={live} />
                <span className="flex-1 text-left">{a}</span>
                {!live && <span className="text-xs text-zinc-600">soon</span>}
                {a === value && (
                  <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
