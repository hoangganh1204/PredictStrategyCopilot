"use client";
// T074 — Leaderboard page: ranked investors from real on-chain settled bets.
// Public (no wallet required) — it's the entry point to social discovery.
import { AppHeader } from "@/components/AppHeader.js";
import { LeaderboardTable } from "@/components/LeaderboardTable.js";
import { useLeaderboard } from "@/hooks/useLeaderboard.js";

export default function LeaderboardPage() {
  const { data, isLoading, isError } = useLeaderboard();

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-6 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Leaderboard</h1>
          <p className="text-sm text-zinc-500">
            Top players by winnings claimed on-chain. Tap a row to see how they trade.
          </p>
        </div>

        <LeaderboardTable isLoading={isLoading} isError={isError} data={data} />
      </main>
    </>
  );
}
