"use client";

interface PaginationProps {
  /** 0-based current page. */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/** Build the list of page indices to show, inserting "…" for gaps. */
function pageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const items: (number | "…")[] = [];
  for (let i = 0; i < total; i++) {
    if (i === 0 || i === total - 1 || Math.abs(i - current) <= 1) {
      items.push(i);
    } else if (items[items.length - 1] !== "…") {
      items.push("…");
    }
  }
  return items;
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={dir === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const go = (p: number) => onChange(Math.max(0, Math.min(totalPages - 1, p)));

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        onClick={() => go(page - 1)}
        disabled={page === 0}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Previous page"
      >
        <Arrow dir="left" />
      </button>

      {pageItems(page, totalPages).map((item, i) =>
        item === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-zinc-600">
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => go(item)}
            aria-current={item === page ? "page" : undefined}
            className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-all ${
              item === page
                ? "btn-primary text-white"
                : "border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
          >
            {item + 1}
          </button>
        )
      )}

      <button
        onClick={() => go(page + 1)}
        disabled={page === totalPages - 1}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next page"
      >
        <Arrow dir="right" />
      </button>
    </nav>
  );
}
