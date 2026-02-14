import {
  acquireL2Lock,
  readL2Cache,
  releaseL2Lock,
  writeL2Cache
} from "@/lib/cache/l2Redis";
import { incrementCounter } from "@/lib/telemetry";

type CacheEntry<T> = {
  value: T;
  updatedAt: number;
  expiresAt: number;
};

type CachedOptions = {
  ttlMs: number;
  staleTtlMs?: number;
  forceRefresh?: boolean;
  staleIfError?: boolean;
  backgroundRevalidate?: boolean;
  l2?: boolean;
};

type ServerStore = {
  cache: Map<string, CacheEntry<any>>;
  inFlight: Map<string, Promise<any>>;
};

const MAX_ENTRIES = 1200;

const globalStore =
  (globalThis as any).__STOCK_PULSE_SERVER_STORE__ ||
  ({
    cache: new Map<string, CacheEntry<any>>(),
    inFlight: new Map<string, Promise<any>>()
  } satisfies ServerStore);

(globalThis as any).__STOCK_PULSE_SERVER_STORE__ = globalStore;

function now() {
  return Date.now();
}

function prune() {
  while (globalStore.cache.size > MAX_ENTRIES) {
    const first = globalStore.cache.keys().next().value;
    if (!first) break;
    globalStore.cache.delete(first);
  }
}

export function getFresh<T>(key: string): T | null {
  const cached = globalStore.cache.get(key);
  if (!cached) return null;
  if (now() > cached.expiresAt) return null;
  incrementCounter("cache.l1.hit");
  return cached.value as T;
}

export function getStale<T>(key: string, staleTtlMs = Number.POSITIVE_INFINITY): T | null {
  const cached = globalStore.cache.get(key);
  if (!cached) return null;
  if (now() - cached.updatedAt > staleTtlMs) return null;
  incrementCounter("cache.l1.stale_hit");
  return cached.value as T;
}

export function setValue<T>(key: string, value: T, ttlMs: number) {
  const entry = {
    value,
    updatedAt: now(),
    expiresAt: now() + Math.max(0, ttlMs)
  };
  globalStore.cache.set(key, entry);
  prune();
  incrementCounter("cache.l1.write");
  void writeL2Cache(key, entry, ttlMs);
}

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CachedOptions
): Promise<T> {
  const fresh = !options.forceRefresh ? getFresh<T>(key) : null;
  if (fresh !== null) return fresh;

  const stale = getStale<T>(key, options.staleTtlMs);
  if (!fresh && options.l2 !== false) {
    const l2 = await readL2Cache<T>(key);
    if (l2 && now() <= l2.expiresAt) {
      globalStore.cache.set(key, l2);
      incrementCounter("cache.l2.hit");
      return l2.value;
    }
    if (l2 && !stale && options.staleTtlMs && now() - l2.updatedAt <= options.staleTtlMs) {
      globalStore.cache.set(key, l2);
      incrementCounter("cache.l2.stale_hit");
    }
  }

  if (stale !== null && options.backgroundRevalidate) {
    if (!globalStore.inFlight.has(key)) {
      const bgTask = (async () => {
        const lockKey = `refresh:${key}`;
        const locked = options.l2 === false ? true : await acquireL2Lock(lockKey);
        if (!locked) return stale;
        return fetcher()
        .then((value) => {
          setValue(key, value, options.ttlMs);
          return value;
        })
        .catch(() => stale)
        .finally(() => {
          globalStore.inFlight.delete(key);
          if (options.l2 !== false) {
            void releaseL2Lock(lockKey);
          }
        });
      })();
      globalStore.inFlight.set(key, bgTask);
      incrementCounter("cache.revalidate.background");
    }
    return stale;
  }

  if (globalStore.inFlight.has(key)) {
    incrementCounter("cache.inflight.hit");
    return globalStore.inFlight.get(key) as Promise<T>;
  }

  incrementCounter("cache.miss");
  const task = (async () => {
    const lockKey = `fetch:${key}`;
    const locked = options.l2 === false ? true : await acquireL2Lock(lockKey);
    if (!locked && stale !== null) {
      incrementCounter("cache.lock.contended_return_stale");
      return stale;
    }
    return fetcher()
    .then((value) => {
      setValue(key, value, options.ttlMs);
      return value;
    })
    .catch((error) => {
      if (options.staleIfError !== false && stale !== null) {
        return stale;
      }
      throw error;
    })
    .finally(() => {
      globalStore.inFlight.delete(key);
      if (options.l2 !== false) {
        void releaseL2Lock(lockKey);
      }
    });
  })();

  globalStore.inFlight.set(key, task);
  return task;
}

export function isRefreshing(key: string) {
  return globalStore.inFlight.has(key);
}
