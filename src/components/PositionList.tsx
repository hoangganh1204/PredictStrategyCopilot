"use client";
// Constitution III: loading skeleton after 300ms; empty state with CTA.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Position } from "@/hooks/usePositions.js";
import { PositionCard } from "./PositionCard.js";
import { Pagination } from "./Pagination.js";

const PAGE_SIZE = 5;

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-28 rounded bg-zinc-700" />
        <div className="h-5 w-20 rounded-full bg-zinc-700" />
      </div>
      <div className="h-3 w-24 rounded bg-zinc-800" />
      <div className="flex gap-4 pt-3 border-t border-zinc-800">
        <div className="h-8 w-20 rounded bg-zinc-700" />
      </div>
    </div>
  );
}

interface PositionListProps {
  isLoading: boolean;
  positions: Position[] | undefined;
  onRedeem?: (position: Position) => void;
  isRedeeming?: boolean;
}

export function PositionList({ isLoading, positions, onRedeem, isRedeeming }: PositionListProps) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [page, setPage] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading) return;
    const id = setTimeout(() => setShowSkeleton(true), 300);
    // Reset on cleanup (runs when loading ends or component unmounts).
    return () => {
      clearTimeout(id);
      setShowSkeleton(false);
    };
  }, [isLoading]);

  const total = positions?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = positions?.slice(start, start + PAGE_SIZE) ?? [];

  function goToPage(p: number) {
    setPage(p);
    // Smoothly bring the list top into view (offset for the sticky header).
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (isLoading) {
    if (!showSkeleton) return null;
    return (
      <div className="flex flex-col gap-3">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 py-12 px-6 text-center">
        <p className="text-zinc-400">No positions yet</p>
        <Link
          href="/play"
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          Place a bet now
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Scroll anchor — offset so the sticky header doesn't cover the first card */}
      <div ref={topRef} className="scroll-mt-28" />

      {/* Keyed by page so cards re-trigger their entrance animation on flip */}
      <div key={safePage} className="flex flex-col gap-3">
        {visible.map((pos, idx) => (
          <PositionCard
            key={`${pos.oracle_id}-${pos.expiry}-${pos.strike ?? pos.lower_strike ?? idx}`}
            position={pos}
            onRedeem={onRedeem}
            isRedeeming={isRedeeming}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <Pagination page={safePage} totalPages={totalPages} onChange={goToPage} />
          <p className="text-xs text-zinc-600">
            {start + 1}–{Math.min(start + PAGE_SIZE, total)} / {total}
          </p>
        </div>
      )}
    </div>
  );
}
