"use client";
// T075 — Investor detail page: drill into one leader's settled record.
// FollowButton is a placeholder here; copy-trade wiring lands in Phase 14.
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader.js";
import { InvestorDetailView } from "@/components/InvestorDetail.js";
import { useInvestorDetail } from "@/hooks/useInvestorDetail.js";
import { truncateAddress } from "@/lib/leaderboard/computeLeaderboard.js";

function BackLink() {
  return (
    <Link
      href="/leaderboard"
      className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to leaderboard
    </Link>
  );
}

/** Placeholder follow control — copy-trade is wired in Phase 14. */
function FollowButton() {
  return (
    <button
      type="button"
      disabled
      title="Copy-trade is coming soon"
      className="flex shrink-0 cursor-not-allowed items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-500"
    >
      ＋ Follow <span className="text-xs text-zinc-600">(coming soon)</span>
    </button>
  );
}

export default function InvestorPage() {
  const params = useParams<{ address: string }>();
  const address = params?.address ?? "";
  const { data, isLoading, isError } = useInvestorDetail(address);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <BackLink />
          {data?.detail && <FollowButton />}
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-900" />
            <div className="h-40 animate-pulse rounded-2xl bg-zinc-900" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="rounded-2xl border border-red-900/50 bg-red-500/10 p-4 text-sm text-red-400">
            Couldn&apos;t load this investor. Please try again in a moment.
          </div>
        )}

        {!isLoading && !isError && data?.notFound && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-lg font-semibold text-zinc-200">No activity yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              <span className="font-mono text-zinc-300">{truncateAddress(address)}</span> hasn&apos;t settled any bets
              yet, so there&apos;s nothing to show.
            </p>
          </div>
        )}

        {!isLoading && !isError && data?.detail && <InvestorDetailView detail={data.detail} />}
      </main>
    </>
  );
}
