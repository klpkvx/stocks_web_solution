import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import ModuleCard from "@/components/ModuleCard";
import StockIcon from "@/components/StockIcon";
import TickerSearchInput from "@/components/TickerSearchInput";
import { formatPercent } from "@/lib/format";
import { normalizeTickerInput } from "@/lib/tickers";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";
import { fetchJson } from "@/lib/apiClient";

const MultiLineChart = dynamic(() => import("@/components/MultiLineChart"), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[332px] w-full rounded-2xl" />
});

type BacktestResponse = {
  symbol: string;
  shortWindow: number;
  longWindow: number;
  equityCurve: { time: string; value: number }[];
  stats: {
    totalReturn: number;
    winRate: number;
    trades: number;
    maxDrawdown: number;
  };
};

export default function StrategyPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [symbol, setSymbol] = useState("AAPL");
  const [shortWindow, setShortWindow] = useState(20);
  const [longWindow, setLongWindow] = useState(50);
  const [request, setRequest] = useState<{
    symbol: string;
    shortWindow: number;
    longWindow: number;
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (router.query.symbol) {
      setSymbol(normalizeTickerInput(String(router.query.symbol)));
    }
  }, [router.query.symbol]);

  const backtestQuery = useCachedApiQuery<BacktestResponse>({
    queryKey: [
      "backtest",
      request?.symbol || "",
      request?.shortWindow || 0,
      request?.longWindow || 0
    ],
    enabled: Boolean(request),
    fallbackTtlMs: 10 * 60 * 1000,
    gcTimeMs: 60 * 60 * 1000,
    fetcher: () => {
      if (!request) {
        throw new Error(t("strategy.error.selectSymbol"));
      }
      const params = new URLSearchParams({
        symbol: request.symbol,
        short: String(request.shortWindow),
        long: String(request.longWindow)
      });
      return fetchJson<BacktestResponse>(`/api/backtest?${params.toString()}`, 12000);
    }
  });

  function runBacktest() {
    setValidationError(null);
    const cleanSymbol = normalizeTickerInput(symbol);
    if (!cleanSymbol) {
      setValidationError(t("strategy.error.selectSymbol"));
      return;
    }
    if (!shortWindow || !longWindow || shortWindow >= longWindow) {
      setValidationError(t("strategy.error.backtestFailed"));
      return;
    }
    setRequest({
      symbol: cleanSymbol,
      shortWindow,
      longWindow
    });
  }

  const result = backtestQuery.data || null;
  const loading = backtestQuery.isFetching;
  const error =
    validationError ||
    backtestQuery.error?.message ||
    null;

  const chartSeries = result
    ? [
        {
          name: "Equity",
          color: "#38bdf8",
          data: result.equityCurve.map((point) => ({
            time: point.time,
            value: point.value
          }))
        }
      ]
    : [];

  return (
    <Layout>
      <div className="space-y-8">
        <ModuleCard
          title={t("strategy.title")}
          subtitle={t("strategy.subtitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TickerSearchInput
                placeholder={t("strategy.searchSymbol")}
                buttonLabel={t("common.pick")}
                onSubmit={(ticker) => setSymbol(normalizeTickerInput(ticker))}
              />
              <p className="mt-2 text-xs text-muted">
                {t("common.selectedSymbol")} {symbol || "--"}
              </p>
            </div>
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              type="number"
              value={shortWindow}
              onChange={(event) => setShortWindow(Number(event.target.value))}
              placeholder={t("strategy.shortSma")}
            />
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              type="number"
              value={longWindow}
              onChange={(event) => setLongWindow(Number(event.target.value))}
              placeholder={t("strategy.longSma")}
            />
          </div>
          <button
            className="mt-4 rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night"
            onClick={runBacktest}
          >
            {t("strategy.runBacktest")}
          </button>
          {loading && <p className="mt-3 text-sm text-muted">{t("strategy.running")}</p>}
          {error && <p className="mt-3 text-sm text-ember">{error}</p>}
        </ModuleCard>

        {result && (
          <section className="grid gap-6 lg:grid-cols-[1.4fr,0.6fr]">
            <ModuleCard title={t("strategy.equityCurve")} subtitle={t("strategy.simulatedPerformance")}>
              {chartSeries.length ? (
                <MultiLineChart series={chartSeries} />
              ) : (
                <p className="text-sm text-muted">{t("strategy.noChartData")}</p>
              )}
            </ModuleCard>
            <ModuleCard title={t("strategy.performance")} subtitle={t("strategy.metrics")}>
              <div
                className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2"
                title={`${result.symbol} strategy results`}
              >
                <StockIcon symbol={result.symbol} size="sm" />
                <span className="text-sm text-ink">{result.symbol}</span>
              </div>
              <div className="space-y-3 text-sm text-muted">
                <div className="flex items-center justify-between">
                  <span>{t("strategy.totalReturn")}</span>
                  <span className="text-ink">
                    {formatPercent(result.stats.totalReturn * 100)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("strategy.winRate")}</span>
                  <span className="text-ink">
                    {(result.stats.winRate * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("strategy.trades")}</span>
                  <span className="text-ink">{result.stats.trades}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("strategy.maxDrawdown")}</span>
                  <span className="text-ember">
                    {(result.stats.maxDrawdown * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </ModuleCard>
            <ModuleCard title={t("strategy.guidance")} subtitle={t("strategy.heuristicInsights")}>
              <ul className="space-y-2 text-sm text-muted">
                <li>
                  {result.stats.totalReturn > 0
                    ? t("strategy.guidance.positive")
                    : t("strategy.guidance.negative")}
                </li>
                <li>
                  {result.stats.maxDrawdown > 0.2
                    ? t("strategy.guidance.drawdownHigh")
                    : t("strategy.guidance.drawdownOk")}
                </li>
                <li>
                  {result.stats.winRate > 0.5
                    ? t("strategy.guidance.winRateHigh")
                    : t("strategy.guidance.winRateLow")}
                </li>
              </ul>
            </ModuleCard>
          </section>
        )}
      </div>
    </Layout>
  );
}
