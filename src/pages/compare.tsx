import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import ModuleCard from "@/components/ModuleCard";
import StockIcon from "@/components/StockIcon";
import TickerSearchInput from "@/components/TickerSearchInput";
import { normalizeTickerInput } from "@/lib/tickers";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import DataState from "@/components/DataState";
import type { LineSeries } from "@/components/MultiLineChart";
import { fetchJson } from "@/lib/apiClient";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";

const MultiLineChart = dynamic(() => import("@/components/MultiLineChart"), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[332px] w-full rounded-2xl" />
});

const COLORS = ["#38bdf8", "#a78bfa", "#4ade80", "#f97316"];

type CompareResponse = {
  series: { symbol: string; data: { time: string; value: number }[] }[];
  expiresIn?: number;
};

export default function ComparePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [input, setInput] = useState("AAPL,MSFT");
  const [requestedSymbols, setRequestedSymbols] = useState("AAPL,MSFT");

  useEffect(() => {
    if (!router.query.symbols) return;
    const next = String(router.query.symbols).toUpperCase();
    setInput(next);
    setRequestedSymbols(next);
  }, [router.query.symbols]);

  const compareQuery = useCachedApiQuery<CompareResponse>({
    queryKey: ["compare", requestedSymbols],
    enabled: Boolean(requestedSymbols),
    fallbackTtlMs: 2 * 60 * 1000,
    gcTimeMs: 20 * 60 * 1000,
    fetcher: () =>
      fetchJson<CompareResponse>(
        `/api/compare?symbols=${encodeURIComponent(requestedSymbols)}`,
        9000
      )
  });

  const series: LineSeries[] = useMemo(
    () =>
      (compareQuery.data?.series || []).map((item, index) => ({
        name: item.symbol,
        color: COLORS[index % COLORS.length],
        data: item.data
      })),
    [compareQuery.data?.series]
  );

  function runCompare(symbolOverride?: string) {
    const symbolsValue = (symbolOverride || input).toUpperCase();
    if (!symbolsValue) return;
    setRequestedSymbols(symbolsValue);
    router
      .replace(
        {
          pathname: router.pathname,
          query: { ...router.query, symbols: symbolsValue }
        },
        undefined,
        { shallow: true }
      )
      .catch(() => undefined);
  }

  function addSymbol(ticker: string) {
    const clean = normalizeTickerInput(ticker);
    if (!clean) return;
    const current = input
      .split(",")
      .map((part) => normalizeTickerInput(part))
      .filter(Boolean);
    if (current.includes(clean)) return;
    setInput([...current, clean].join(","));
  }

  return (
    <Layout>
      <div className="space-y-8">
        <ModuleCard title={t("compare.title")} subtitle={t("compare.subtitle")}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              value={input}
              onChange={(event) => setInput(event.target.value.toUpperCase())}
              placeholder={t("compare.symbolsPlaceholder")}
            />
            <div className="w-[220px]">
              <TickerSearchInput
                compact
                placeholder={t("search.addTicker")}
                buttonLabel={t("search.go")}
                onSubmit={addSymbol}
              />
            </div>
            <button
              className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night"
              onClick={() => runCompare()}
            >
              {t("compare.run")}
            </button>
          </div>
          <div className="mt-3">
            <DataState
              loading={compareQuery.isLoading}
              error={compareQuery.error?.message || null}
              empty={false}
              loadingLabel={t("common.loading")}
            >
              <></>
            </DataState>
          </div>
        </ModuleCard>

        {series.length > 0 && (
          <ModuleCard title={t("compare.chartTitle")} subtitle={t("compare.chartSubtitle")}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {series.map((item) => (
                <div
                  key={item.name}
                  title={item.name}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                >
                  <StockIcon symbol={item.name} size="sm" />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
            <MultiLineChart series={series} />
          </ModuleCard>
        )}
      </div>
    </Layout>
  );
}
