import { useMemo } from "react";
import { useQuery, type QueryKey, type UseQueryResult } from "@tanstack/react-query";
import { resolveWithClientCache } from "@/lib/queryCacheBridge";
import { keyToString, readStaleCache } from "@/stores/apiCacheStore";

type UseCachedApiQueryOptions<TData> = {
  queryKey: QueryKey;
  enabled?: boolean;
  fetcher: () => Promise<TData>;
  fallbackTtlMs?: number;
  gcTimeMs?: number;
  refetchIntervalMs?: number | false;
  staleIfError?: boolean;
};

export function useCachedApiQuery<TData>(
  options: UseCachedApiQueryOptions<TData>
): UseQueryResult<TData, Error> {
  const fallbackTtlMs = options.fallbackTtlMs ?? 60 * 1000;
  const gcTimeMs = options.gcTimeMs ?? 30 * 60 * 1000;
  const cacheKey = useMemo(() => keyToString(options.queryKey), [options.queryKey]);
  const stale = readStaleCache<TData>(cacheKey);

  return useQuery<TData, Error>({
    queryKey: options.queryKey,
    enabled: options.enabled ?? true,
    initialData: stale?.value,
    initialDataUpdatedAt: stale?.updatedAt,
    staleTime: fallbackTtlMs,
    gcTime: gcTimeMs,
    refetchInterval: options.refetchIntervalMs || false,
    refetchIntervalInBackground: false,
    queryFn: () =>
      resolveWithClientCache({
        key: cacheKey,
        ttlMs: (value: any) =>
          Number(value?.expiresIn || 0) > 0
            ? Number(value.expiresIn) * 1000
            : fallbackTtlMs,
        fetcher: options.fetcher,
        staleIfError: options.staleIfError ?? true
      })
  });
}

