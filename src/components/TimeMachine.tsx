import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useStoredState } from "@/lib/useStoredState";
import { Holding } from "@/lib/portfolio";
import { formatCurrency, formatDateTime } from "@/lib/format";
import StockIcon from "@/components/StockIcon";
import { fetchJson } from "@/lib/apiClient";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";

type TimeMachinePayload = {
  series: { symbol: string; series: { time: string; close: number }[] }[];
  expiresIn?: number;
};

type NewsPayload = {
  articles: Array<{
    title: string;
    url: string;
    source: string;
  }>;
  expiresIn?: number;
};

export default function TimeMachine() {
  const { t } = useI18n();
  const [holdings] = useStoredState<Holding[]>("portfolio", []);
  const [index, setIndex] = useState(0);
  const [requestedSymbols, setRequestedSymbols] = useState("");
  const [headlinesRequested, setHeadlinesRequested] = useState(false);

  const historyQuery = useCachedApiQuery<TimeMachinePayload>({
    queryKey: ["time-machine", requestedSymbols],
    enabled: Boolean(requestedSymbols),
    fallbackTtlMs: 10 * 60 * 1000,
    gcTimeMs: 60 * 60 * 1000,
    fetcher: () =>
      fetchJson<TimeMachinePayload>(
        `/api/time-machine?symbols=${encodeURIComponent(requestedSymbols)}`,
        12000
      )
  });

  const seriesData = historyQuery.data?.series || [];
  const dates = useMemo(() => {
    if (!seriesData.length) return [];
    return seriesData[0].series.map((point) => point.time);
  }, [seriesData]);

  const selectedDate = dates[index] ? dates[index].split("T")[0] : "";
  const headlineSymbol = holdings[0]?.symbol || "";
  const headlinesQuery = useCachedApiQuery<NewsPayload>({
    queryKey: ["time-machine", "news", headlineSymbol, selectedDate],
    enabled: false,
    fallbackTtlMs: 10 * 60 * 1000,
    gcTimeMs: 30 * 60 * 1000,
    fetcher: () =>
      fetchJson<NewsPayload>(
        `/api/news?symbol=${encodeURIComponent(headlineSymbol)}&from=${encodeURIComponent(
          selectedDate
        )}&to=${encodeURIComponent(selectedDate)}`,
        9000
      )
  });

  const portfolioValue = useMemo(() => {
    if (!seriesData.length || !holdings.length) return 0;
    return holdings.reduce((acc, holding) => {
      const series = seriesData.find((item) => item.symbol === holding.symbol);
      const point = series?.series[index];
      const price = point?.close ?? holding.costBasis;
      return acc + price * holding.shares;
    }, 0);
  }, [seriesData, holdings, index]);

  function loadReplay() {
    if (!holdings.length) return;
    const symbols = holdings.map((holding) => holding.symbol).join(",");
    setRequestedSymbols(symbols);
    setIndex(0);
    setHeadlinesRequested(false);
  }

  async function loadHeadlines() {
    if (!selectedDate || !headlineSymbol) return;
    setHeadlinesRequested(true);
    await headlinesQuery.refetch();
  }

  const headlines = headlinesQuery.data?.articles || [];
  const historyError = historyQuery.error?.message || null;
  const headlineError = headlinesQuery.error?.message || null;

  return (
    <div className="glass rounded-3xl px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{t("timeMachine.title")}</h3>
          <p className="mt-2 text-sm text-muted">{t("timeMachine.subtitle")}</p>
        </div>
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-xs text-muted"
          onClick={loadReplay}
          disabled={historyQuery.isFetching || holdings.length === 0}
        >
          {t("timeMachine.loadReplay")}
        </button>
      </div>

      {historyQuery.isLoading && (
        <p className="mt-4 text-sm text-muted">{t("timeMachine.loading")}</p>
      )}
      {historyError && <p className="mt-4 text-sm text-ember">{historyError}</p>}
      {!holdings.length && (
        <p className="mt-4 text-sm text-muted">{t("timeMachine.error.addHoldings")}</p>
      )}
      {holdings.length > 4 && (
        <p className="mt-4 text-xs text-muted">{t("timeMachine.limitNote")}</p>
      )}
      {holdings.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {holdings.slice(0, 6).map((holding) => (
            <div
              key={holding.id}
              title={holding.symbol}
              className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
            >
              <StockIcon symbol={holding.symbol} size="sm" />
              <span>{holding.symbol}</span>
            </div>
          ))}
        </div>
      )}
      {!historyQuery.isLoading &&
        holdings.length > 0 &&
        seriesData.length === 0 &&
        !historyError && (
          <p className="mt-4 text-sm text-muted">{t("timeMachine.promptLoad")}</p>
        )}

      {dates.length > 0 && (
        <div className="mt-6">
          <input
            className="w-full"
            type="range"
            min={0}
            max={dates.length - 1}
            value={index}
            onChange={(event) => {
              setIndex(Number(event.target.value));
              setHeadlinesRequested(false);
            }}
          />
          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <span>{dates[index] ? formatDateTime(dates[index]) : "--"}</span>
            <span>
              {t("timeMachine.value")} {formatCurrency(portfolioValue)}
            </span>
          </div>
          <button
            className="mt-4 rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
            onClick={loadHeadlines}
            disabled={headlinesQuery.isFetching}
          >
            {headlinesQuery.isFetching
              ? t("timeMachine.loadingHeadlines")
              : t("timeMachine.loadHeadlines")}
          </button>
          {headlineError && <p className="mt-3 text-xs text-ember">{headlineError}</p>}
        </div>
      )}

      {headlines.length > 0 && (
        <div className="mt-6 space-y-3 text-sm text-muted">
          {headlines.slice(0, 3).map((article) => (
            <div key={article.url} className="rounded-2xl border border-white/10 px-4 py-3">
              <p className="text-ink">{article.title}</p>
              <p className="text-xs text-muted">{article.source}</p>
            </div>
          ))}
        </div>
      )}
      {headlinesRequested && headlines.length === 0 && !headlinesQuery.isFetching && (
        <p className="mt-4 text-sm text-muted">{t("timeMachine.noHeadlines")}</p>
      )}
    </div>
  );
}

