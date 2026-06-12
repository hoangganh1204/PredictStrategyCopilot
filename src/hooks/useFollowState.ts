"use client";
// T085 — Reactive follow state backed by localStorage (via followStore).
// useSyncExternalStore keeps FollowButton and the global copy host in sync.
import { useSyncExternalStore } from "react";
import {
  subscribe,
  getFollowedLeaders,
  getServerSnapshot,
  followLeader,
  unfollowLeader,
  isFollowing as isFollowingStore,
} from "@/lib/copytrade/followStore.js";
import type { FollowConfig } from "@/lib/copytrade/types.js";

export interface UseFollowStateReturn {
  followed: FollowConfig[];
  isFollowing: (address: string) => boolean;
  followLeader: (address: string, amount_raw: bigint) => void;
  unfollowLeader: (address: string) => void;
}

export function useFollowState(): UseFollowStateReturn {
  const followed = useSyncExternalStore(subscribe, getFollowedLeaders, getServerSnapshot);

  return {
    followed,
    // Derived from the reactive snapshot so callers re-render on change.
    isFollowing: (address: string) =>
      followed.some((f) => f.leaderAddress.toLowerCase() === address.toLowerCase()) ||
      isFollowingStore(address),
    followLeader,
    unfollowLeader,
  };
}
