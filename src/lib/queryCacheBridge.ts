import { useApiCacheStore, readFreshCache, readStaleCache } from "@/stores/apiCacheStore";

type ResolveCacheOptions<T> = {
  key: string;
  ttlMs: number | ((value: T) => number);
  fetcher: () => Promise<T>;
  forceRefresh?: boolean;
  staleIfError?: boolean;
};

const CLIENT_IN_FLIGHT = new Map<string, Promise<unknown>>();

export async function resolveWithClientCache<T>({
  key,
  ttlMs,
  fetcher,
  forceRefresh = false,
  staleIfError = true
}: ResolveCacheOptions<T>): Promise<T> {
  const fresh = !forceRefresh ? readFreshCache<T>(key) : null;
  if (fresh) {
    return fresh.value;
  }

  const stale = readStaleCache<T>(key);
  const inFlight = CLIENT_IN_FLIGHT.get(key);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const task = (async () => {
    try {
      const value = await fetcher();
      const resolvedTtl =
        typeof ttlMs === "function" ? Number(ttlMs(value)) : Number(ttlMs);
      useApiCacheStore
        .getState()
        .setEntry(key, value, Number.isFinite(resolvedTtl) ? resolvedTtl : 0);
      return value;
    } catch (error) {
      if (staleIfError && stale) {
        return stale.value;
      }
      throw error;
    } finally {
      CLIENT_IN_FLIGHT.delete(key);
    }
  })();

  CLIENT_IN_FLIGHT.set(key, task);
  return task;
}

export function primeClientCache<T>(key: string, value: T, ttlMs: number) {
  useApiCacheStore.getState().setEntry(key, value, ttlMs);
}

export function clearClientInFlight() {
  CLIENT_IN_FLIGHT.clear();
}
