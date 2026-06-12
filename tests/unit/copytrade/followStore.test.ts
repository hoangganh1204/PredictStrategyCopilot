import { describe, it, expect, beforeEach } from "vitest";

// Minimal in-memory localStorage polyfill (the project's jsdom env is broken).
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

import {
  followLeader,
  unfollowLeader,
  getFollowedLeaders,
  isFollowing,
} from "../../../src/lib/copytrade/followStore.js";

const A = `0x${"a".repeat(64)}`;
const B = `0x${"b".repeat(64)}`;

describe("followStore", () => {
  beforeEach(() => localStorage.clear());

  it("follows a leader and persists the amount", () => {
    followLeader(A, 10_000_000n);
    expect(isFollowing(A)).toBe(true);
    const list = getFollowedLeaders();
    expect(list).toHaveLength(1);
    expect(list[0].leaderAddress).toBe(A);
    expect(list[0].followerAmount_raw).toBe(10_000_000n);
  });

  it("unfollows a leader", () => {
    followLeader(A, 5_000_000n);
    unfollowLeader(A);
    expect(isFollowing(A)).toBe(false);
    expect(getFollowedLeaders()).toHaveLength(0);
  });

  it("re-following updates the amount instead of duplicating", () => {
    followLeader(A, 5_000_000n);
    followLeader(A, 8_000_000n);
    const list = getFollowedLeaders();
    expect(list).toHaveLength(1);
    expect(list[0].followerAmount_raw).toBe(8_000_000n);
  });

  it("tracks multiple leaders independently", () => {
    followLeader(A, 1_000_000n);
    followLeader(B, 2_000_000n);
    expect(getFollowedLeaders()).toHaveLength(2);
    expect(isFollowing(A)).toBe(true);
    expect(isFollowing(B)).toBe(true);
  });

  it("survives a reload (reads back from localStorage)", () => {
    followLeader(A, 7_000_000n);
    // Simulate a fresh load: data is read straight from localStorage.
    const reread = getFollowedLeaders();
    expect(reread).toEqual([{ leaderAddress: A, followerAmount_raw: 7_000_000n }]);
    expect(localStorage.getItem("psc.followed-leaders.v1")).toContain("7000000");
  });

  it("returns a stable reference when unchanged (snapshot safety)", () => {
    followLeader(A, 1_000_000n);
    expect(getFollowedLeaders()).toBe(getFollowedLeaders());
  });
});
