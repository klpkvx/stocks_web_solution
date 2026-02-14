import { useMemo } from "react";
import type { Quote } from "@/lib/twelveData";
import { fetchJson } from "@/lib/apiClient";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";
import { quotesPayloadSchema } from "@/contracts/apiContracts";

const DEFAULT_POLL_MS = 90_000;
const FALLBACK_TTL_MS = 55 * 1000;

type QuotesPayload = {
  quotes: Quote[];
  warning?: string;
  stale?: boolean;
  expiresIn?: number;
};

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))
  ).sort();
}

export function useQuotes(
  symbols: string[],
  options: { enabled?: boolean; intervalMs?: number } = {}
) {
  const enabled = options.enabled ?? true;
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_MS;
  const normalized = useMemo(() => normalizeSymbols(symbols), [symbols]);
  const symbolKey = normalized.join(",");
  const queryKey = useMemo(() => ["quotes", symbolKey] as const, [symbolKey]);
  const query = useCachedApiQuery<QuotesPayload>({
    queryKey: [...queryKey],
    enabled: enabled && normalized.length > 0,
    fallbackTtlMs: FALLBACK_TTL_MS,
    gcTimeMs: 20 * 60 * 1000,
    refetchIntervalMs: enabled && normalized.length > 0 ? intervalMs : false,
    fetcher: () =>
      fetchJson<QuotesPayload>(
        `/api/quotes?symbols=${encodeURIComponent(symbolKey)}`,
        6000,
        quotesPayloadSchema
      )
  });

  return {
    quotes: query.data?.quotes || [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.data?.warning || null
  };
}
