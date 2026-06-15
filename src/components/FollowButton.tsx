"use client";
// T087 — Follow/unfollow toggle. First follow asks for a stake (DUSDC); the
// follower confirms each copied bet later (FR-021). Following is local state
// only — it never touches open positions (FR-022).
import { useState } from "react";
import { DUSDC_SCALE } from "@/config/predict.js";
import { useFollowState } from "@/hooks/useFollowState.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { truncateAddress } from "@/lib/leaderboard/computeLeaderboard.js";

const SCALE = Number(DUSDC_SCALE);
const DEFAULT_AMOUNT = "5";

export function FollowButton({ leaderAddress }: { leaderAddress: string }) {
  const { isFollowing, followLeader, unfollowLeader } = useFollowState();
  const following = isFollowing(leaderAddress);
  const [entering, setEntering] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);

  function confirmFollow() {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return;
    followLeader(leaderAddress, BigInt(Math.round(value * SCALE)));
    setEntering(false);
  }

  if (following) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirmUnfollow(true)}
          className="group flex shrink-0 items-center gap-2 rounded-xl border border-emerald-700/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:border-red-700/60 hover:bg-red-500/10 hover:text-red-300"
        >
          <span className="group-hover:hidden">Following ✓</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </button>
        <ConfirmDialog
          open={confirmUnfollow}
          title="Stop following?"
          message={`You'll no longer be prompted to copy ${truncateAddress(leaderAddress)}'s bets. Your open positions are unaffected.`}
          confirmLabel="Unfollow"
          cancelLabel="Keep following"
          tone="danger"
          onConfirm={() => {
            unfollowLeader(leaderAddress);
            setConfirmUnfollow(false);
          }}
          onCancel={() => setConfirmUnfollow(false)}
        />
      </>
    );
  }

  if (entering) {
    return (
      <div className="flex shrink-0 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 p-1.5 pl-3">
        <span className="text-xs text-zinc-500">Copy each bet with</span>
        <input
          type="number"
          min="0"
          step="0.1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && confirmFollow()}
          className="w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-right font-mono text-sm text-zinc-100 outline-none focus:border-blue-500"
        />
        <span className="text-xs text-zinc-500">DUSDC</span>
        <button
          type="button"
          onClick={confirmFollow}
          className="btn-primary rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => setEntering(false)}
          className="rounded-lg px-2 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEntering(true)}
      className="btn-primary flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all"
    >
      ＋ Follow to copy
    </button>
  );
}
