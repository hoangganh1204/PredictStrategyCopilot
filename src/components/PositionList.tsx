"use client";
// Constitution III: loading skeleton after 300ms; empty state with CTA.
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Position } from "@/hooks/usePositions.js";
import { PositionCard } from "./PositionCard.js";

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

  useEffect(() => {
    if (!isLoading) { setShowSkeleton(false); return; }
    const id = setTimeout(() => setShowSkeleton(true), 300);
    return () => clearTimeout(id);
  }, [isLoading]);

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
        <p className="text-zinc-400">Chưa có vị thế nào</p>
        <Link
          href="/play"
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          Đặt lệnh ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {positions.map((pos, idx) => (
        <PositionCard
          key={`${pos.oracle_id}-${pos.strike ?? pos.lower_strike ?? idx}`}
          position={pos}
          onRedeem={onRedeem}
          isRedeeming={isRedeeming}
        />
      ))}
    </div>
  );
}
