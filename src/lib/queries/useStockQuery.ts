import { fetchJson } from "@/lib/apiClient";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";
import type { StockPayload } from "@/types/stock";
import { stockPayloadSchema } from "@/contracts/apiContracts";

type UseStockQueryOptions = {
  symbol: string;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
};

export function useStockQuery(options: UseStockQueryOptions) {
  const symbol = String(options.symbol || "").toUpperCase().trim();

  return useCachedApiQuery<StockPayload>({
    queryKey: ["stock", symbol],
    enabled: (options.enabled ?? true) && Boolean(symbol),
    fallbackTtlMs: 60 * 1000,
    gcTimeMs: 30 * 60 * 1000,
    refetchIntervalMs: options.refetchIntervalMs || false,
    fetcher: () =>
      fetchJson<StockPayload>(
        `/api/stock?symbol=${encodeURIComponent(symbol)}`,
        15000,
        stockPayloadSchema
      )
  });
}
