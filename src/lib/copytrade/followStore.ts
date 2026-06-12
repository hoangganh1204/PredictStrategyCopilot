// Follow state, persisted in localStorage. Pure module (no React) so it can be
// unit-tested and shared by an external store. Following is purely local — it
// never touches on-chain positions (FR-022).
import type { FollowConfig } from "./types.js";

const KEY = "psc.followed-leaders.v1";

interface StoredEntry {
  leaderAddress: string;
  /** bigint serialized as a decimal string (localStorage can't hold bigint). */
  followerAmount_raw: string;
}

const listeners = new Set<() => void>();
const EMPTY: FollowConfig[] = [];

function readRaw(): StoredEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: StoredEntry[]): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }
  for (const l of listeners) l();
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Cache so getSnapshot returns a stable reference until the data actually changes
// (required by useSyncExternalStore to avoid render loops).
let cache: FollowConfig[] = EMPTY;
let cacheKey = "";

export function getFollowedLeaders(): FollowConfig[] {
  const raw = readRaw();
  const key = JSON.stringify(raw);
  if (key === cacheKey) return cache;
  cacheKey = key;
  cache = raw.length === 0 ? EMPTY : raw.map((e) => ({
    leaderAddress: e.leaderAddress,
    followerAmount_raw: BigInt(e.followerAmount_raw),
  }));
  return cache;
}

/** Stable empty snapshot for SSR (no localStorage on the server). */
export function getServerSnapshot(): FollowConfig[] {
  return EMPTY;
}

export function isFollowing(address: string): boolean {
  return readRaw().some((e) => same(e.leaderAddress, address));
}

export function followLeader(address: string, amount_raw: bigint): void {
  const next = readRaw().filter((e) => !same(e.leaderAddress, address));
  next.push({ leaderAddress: address, followerAmount_raw: amount_raw.toString() });
  writeRaw(next);
}

export function unfollowLeader(address: string): void {
  writeRaw(readRaw().filter((e) => !same(e.leaderAddress, address)));
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Cross-tab + reload sync.
  if (typeof window !== "undefined") window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", cb);
  };
}
