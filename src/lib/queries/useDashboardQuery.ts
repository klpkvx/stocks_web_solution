import { useMemo } from "react";
import { fetchJson } from "@/lib/apiClient";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";
import type { DashboardPayload } from "@/types/dashboard";
import { dashboardPayloadSchema } from "@/contracts/apiContracts";

const FALLBACK_TTL_MS = 60 * 1000;

type UseDashboardQueryOptions = {
  symbols: string[];
  newsEnabled: boolean;
  heatmapEnabled: boolean;
  newsSymbol?: string;
  enabled?: boolean;
  refetchIntervalMs?: number;
};

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(symbols.map((item) => String(item || "").toUpperCase().trim()).filter(Boolean))
  ).sort();
}

export function useDashboardQuery(options: UseDashboardQueryOptions) {
  const symbols = useMemo(() => normalizeSymbols(options.symbols), [options.symbols]);
  const symbolKey = symbols.join(",");
  const queryKey = useMemo(
    () =>
      [
        "dashboard",
        symbolKey,
        options.newsEnabled ? 1 : 0,
        options.heatmapEnabled ? 1 : 0,
        String(options.newsSymbol || "").toUpperCase()
      ] as const,
    [options.heatmapEnabled, options.newsEnabled, options.newsSymbol, symbolKey]
  );
  return useCachedApiQuery<DashboardPayload>({
    queryKey,
    enabled: (options.enabled ?? true) && symbols.length > 0,
    fallbackTtlMs: FALLBACK_TTL_MS,
    gcTimeMs: 30 * 60 * 1000,
    refetchIntervalMs: options.refetchIntervalMs || false,
    fetcher: async () => {
      const params = new URLSearchParams();
      params.set("symbols", symbolKey);
      params.set("news", options.newsEnabled ? "1" : "0");
      params.set("heatmap", options.heatmapEnabled ? "1" : "0");
      if (options.newsSymbol) {
        params.set("newsSymbol", String(options.newsSymbol).toUpperCase());
      }
      return fetchJson<DashboardPayload>(
        `/api/dashboard?${params.toString()}`,
        10000,
        dashboardPayloadSchema
      );
    }
  });
}
