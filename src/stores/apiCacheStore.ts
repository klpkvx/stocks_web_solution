import { create } from "zustand";

type CacheEntry = {
  value: unknown;
  updatedAt: number;
  expiresAt: number;
};

type ApiCacheStore = {
  cache: Record<string, CacheEntry>;
  setEntry: (key: string, value: unknown, ttlMs: number) => void;
  removeEntry: (key: string) => void;
  clearCache: () => void;
  pruneExpired: () => void;
};

const MAX_ENTRIES = 400;

function pruneOldest(cache: Record<string, CacheEntry>) {
  const keys = Object.keys(cache);
  if (keys.length <= MAX_ENTRIES) return cache;
  const sorted = keys.sort((a, b) => cache[a].updatedAt - cache[b].updatedAt);
  const toRemove = sorted.slice(0, Math.max(0, keys.length - MAX_ENTRIES));
  if (!toRemove.length) return cache;
  const next = { ...cache };
  toRemove.forEach((key) => {
    delete next[key];
  });
  return next;
}

export const useApiCacheStore = create<ApiCacheStore>((set, get) => ({
  cache: {},

  setEntry(key, value, ttlMs) {
    const now = Date.now();
    set((state) => {
      const next = {
        ...state.cache,
        [key]: {
          value,
          updatedAt: now,
          expiresAt: now + Math.max(0, ttlMs)
        }
      };
      return { cache: pruneOldest(next) };
    });
  },

  removeEntry(key) {
    set((state) => {
      if (!state.cache[key]) return state;
      const next = { ...state.cache };
      delete next[key];
      return { cache: next };
    });
  },

  clearCache() {
    set({ cache: {} });
  },

  pruneExpired() {
    const now = Date.now();
    const cache = get().cache;
    let changed = false;
    const next: Record<string, CacheEntry> = {};
    Object.entries(cache).forEach(([key, entry]) => {
      if (entry.expiresAt < now) {
        changed = true;
        return;
      }
      next[key] = entry;
    });
    if (changed) {
      set({ cache: next });
    }
  }
}));

export function keyToString(parts: readonly unknown[]) {
  return JSON.stringify(parts);
}

export function readFreshCache<T>(key: string) {
  const entry = useApiCacheStore.getState().cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry as { value: T; updatedAt: number; expiresAt: number };
}

export function readStaleCache<T>(key: string) {
  const entry = useApiCacheStore.getState().cache[key];
  if (!entry) return null;
  return entry as { value: T; updatedAt: number; expiresAt: number };
}

