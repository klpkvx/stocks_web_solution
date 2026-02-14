import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import StoriesFeed from "@/components/StoriesFeed";
import StatCard from "@/components/StatCard";
import SentimentBadge from "@/components/SentimentBadge";
import InsightTile from "@/components/InsightTile";
import StockIcon from "@/components/StockIcon";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { Quote, TimeSeriesPoint } from "@/lib/twelveData";
import type { NewsCardItem } from "@/components/NewsCard";
import type { MarketInsights, Thesis } from "@/lib/insights";
import { useStoredState } from "@/lib/useStoredState";
import { useVisibility } from "@/lib/useVisibility";
import { useStockQuery } from "@/lib/queries/useStockQuery";
import type { StockPayload } from "@/types/stock";
import { useQuotes } from "@/lib/useQuotes";

const PriceChart = dynamic(() => import("@/components/PriceChart"), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-[352px] w-full rounded-2xl" />
});

const NewsCard = dynamic(() => import("@/components/NewsCard"), {
  loading: () => <LoadingSkeleton className="h-32 w-full rounded-2xl" />
});

type MomentumAlert = {
  symbol: string;
  threshold: number;
  lastScore?: number;
  lastUpdated?: string;
};

function normalizeChartSeries(points: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (!Array.isArray(points) || points.length === 0) return [];

  const deduped = new Map<string, TimeSeriesPoint>();
  points.forEach((point) => {
    const time = String(point.time || "").trim();
    const open = Number(point.open);
    const high = Number(point.high);
    const low = Number(point.low);
    const close = Number(point.close);
    const volume = Number(point.volume || 0);
    if (!time) return;
    if (![open, high, low, close].every((value) => Number.isFinite(value))) return;

    deduped.set(time, {
      time,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0
    });
  });

  return Array.from(deduped.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export default function StockDetailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const isVisible = useVisibility();
  const symbol = useMemo(() => {
    if (!router.query.symbol) return "";
    return String(router.query.symbol).toUpperCase();
  }, [router.query.symbol]);

  const [momentumAlerts, setMomentumAlerts] = useStoredState<MomentumAlert[]>(
    "momentum-alerts",
    []
  );
  const [alertThreshold, setAlertThreshold] = useState(9);

  useEffect(() => {
    const existing = momentumAlerts.find((item) => item.symbol === symbol);
    if (existing?.threshold) {
      setAlertThreshold(existing.threshold);
    }
  }, [symbol, momentumAlerts]);
  const [chartType, setChartType] = useStoredState<"candlestick" | "line">(
    "stock-chart-type",
    "candlestick"
  );
  const stockQuery = useStockQuery({
    symbol,
    enabled: Boolean(symbol) && isVisible,
    refetchIntervalMs: isVisible && symbol ? 90 * 1000 : false
  });
  const quickQuoteQuery = useQuotes(symbol ? [symbol] : [], {
    enabled: Boolean(symbol) && isVisible,
    intervalMs: 45 * 1000
  });

  const quote: Quote | null =
    stockQuery.data?.quote ||
    quickQuoteQuery.quotes.find((item) => item.symbol === symbol) ||
    null;
  const series: TimeSeriesPoint[] = stockQuery.data?.series || [];
  const news: NewsCardItem[] = stockQuery.data?.news || [];
  const sentiment: StockPayload["sentiment"] | null = stockQuery.data?.sentiment || null;
  const insights: MarketInsights | null = stockQuery.data?.insights || null;
  const thesis: Thesis | null = stockQuery.data?.thesis || null;
  const analytics: StockPayload["analytics"] | null = stockQuery.data?.analytics || null;
  const secSummary: StockPayload["secSummary"] | null = stockQuery.data?.secSummary || null;
  const newsWarning = stockQuery.data?.warning || null;
  const secWarning = stockQuery.data?.secWarning || null;
  const loading = stockQuery.isLoading && !quickQuoteQuery.quotes.length;
  const error =
    stockQuery.error?.message === "Request timeout"
      ? t("stock.error.timeout")
      : stockQuery.error?.message || null;

  useEffect(() => {
    if (!symbol || !analytics?.aiScore) return;
    setMomentumAlerts((prev) => {
      const existing = prev.find((item) => item.symbol === symbol);
      if (!existing) return prev;
      return prev.map((item) =>
        item.symbol === symbol
          ? {
              ...item,
              lastScore: analytics.aiScore,
              lastUpdated: new Date().toISOString()
            }
          : item
      );
    });
  }, [analytics?.aiScore, setMomentumAlerts, symbol]);

  const chartSeries = useMemo(() => {
    const normalized = normalizeChartSeries(series);
    if (normalized.length) {
      return normalized;
    }

    if (quote?.price === null || quote?.price === undefined) {
      return [];
    }

    const close = Number(quote.price);
    if (!Number.isFinite(close)) {
      return [];
    }

    const previousCandidate =
      quote.previousClose ?? quote.open ?? quote.price;
    const previous = Number(previousCandidate);
    const prev = Number.isFinite(previous) ? previous : close;
    const high = Math.max(close, prev);
    const low = Math.min(close, prev);
    const nowDate =
      quote.timestamp && !Number.isNaN(new Date(quote.timestamp).getTime())
        ? new Date(quote.timestamp)
        : new Date();
    const prevDate = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000);

    return [
      {
        time: prevDate.toISOString().slice(0, 10),
        open: prev,
        high,
        low,
        close: prev,
        volume: Number(quote.volume || 0)
      },
      {
        time: nowDate.toISOString().slice(0, 10),
        open: prev,
        high,
        low,
        close,
        volume: Number(quote.volume || 0)
      }
    ];
  }, [series, quote]);

  return (
    <Layout>
      <div className="space-y-8">
        <section className="glass rounded-3xl px-8 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                {t("stock.detail")}
              </p>
              <div
                className="mt-3 flex items-center gap-3"
                title={
                  quote?.name
                    ? `${symbol} - ${quote.name}`
                    : symbol || t("stock.loadingSymbol")
                }
              >
                <StockIcon symbol={symbol || "?"} />
                <h2 className="text-3xl font-semibold text-ink">
                  {symbol || t("stock.loading")}
                </h2>
              </div>
              <p className="mt-2 text-sm text-muted">
                {quote?.name || t("stock.fetchingQuote")}
              </p>
            </div>
            {quote && (
              <div className="text-right">
                <p className="text-2xl font-semibold text-ink">
                  {formatCurrency(quote.price, quote.currency)}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    (quote.change || 0) >= 0 ? "text-neon" : "text-ember"
                  }`}
                >
                  {t("stock.todayChange", undefined, {
                    value: formatPercent(quote.percentChange)
                  })}
                </p>
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-ember">{error}</p>}
          {loading && !error && (
            <div className="mt-4 space-y-3">
              <LoadingDots label={t("stock.loadingMarketData")} />
              <LoadingSkeleton className="h-4 w-52" />
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr,0.9fr]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("stock.priceAction")}</h3>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
                <button
                  className={`rounded-full border px-3 py-1 transition ${
                    chartType === "candlestick"
                      ? "border-white/40 text-ink"
                      : "border-white/10 hover:border-white/30"
                  }`}
                  onClick={() => setChartType("candlestick")}
                >
                  {t("stock.chart.candlestick")}
                </button>
                <button
                  className={`rounded-full border px-3 py-1 transition ${
                    chartType === "line"
                      ? "border-white/40 text-ink"
                      : "border-white/10 hover:border-white/30"
                  }`}
                  onClick={() => setChartType("line")}
                >
                  {t("stock.chart.line")}
                </button>
              </div>
            </div>
            {chartSeries.length ? (
              <PriceChart
                key={`${symbol}-${chartType}-${stockQuery.dataUpdatedAt}`}
                data={chartSeries}
                type={chartType}
              />
            ) : (
              <div className="glass flex h-[320px] items-center justify-center rounded-2xl text-sm text-muted">
                {loading ? (
                  <div className="w-full px-6">
                    <LoadingSkeleton className="h-[240px] w-full rounded-2xl" />
                  </div>
                ) : (
                  t("stock.chart.unavailable")
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("stock.keyStats")}</h3>
              <span className="text-xs uppercase tracking-[0.3em] text-muted">
                {t("stock.live")}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {loading ? (
                <>
                  <LoadingSkeleton className="h-[88px] w-full" />
                  <LoadingSkeleton className="h-[88px] w-full" />
                  <LoadingSkeleton className="h-[88px] w-full" />
                  <LoadingSkeleton className="h-[88px] w-full" />
                </>
              ) : (
                <>
                  <StatCard
                    label={t("stock.stat.open")}
                    value={formatCurrency(quote?.open ?? null, quote?.currency)}
                  />
                  <StatCard
                    label={t("stock.stat.high")}
                    value={formatCurrency(quote?.high ?? null, quote?.currency)}
                  />
                  <StatCard
                    label={t("stock.stat.low")}
                    value={formatCurrency(quote?.low ?? null, quote?.currency)}
                  />
                  <StatCard
                    label={t("stock.stat.volume")}
                    value={formatNumber(quote?.volume ?? null)}
                  />
                </>
              )}
            </div>
            {insights && (
              <div className="grid gap-4 sm:grid-cols-2">
                <InsightTile
                  label={t("stock.insight.momentum")}
                  value={`${(insights.momentum * 100).toFixed(2)}%`}
                  hint={t("stock.insight.momentumHint")}
                />
                <InsightTile
                  label={t("stock.insight.volatility")}
                  value={`${(insights.volatility * 100).toFixed(2)}%`}
                  hint={t("stock.insight.volatilityHint")}
                />
                <InsightTile
                  label={t("stock.insight.volumeSpike")}
                  value={
                    insights.volumeSpike
                      ? `${insights.volumeSpike.toFixed(2)}x`
                      : "--"
                  }
                  hint={t("stock.insight.volumeSpikeHint")}
                />
                <InsightTile
                  label={t("stock.insight.anomaly")}
                  value={
                    insights.anomaly
                      ? t("stock.insight.anomalyDetected")
                      : t("stock.insight.anomalyNormal")
                  }
                  hint={t("stock.insight.anomalyHint")}
                />
                <InsightTile
                  label={t("stock.insight.support")}
                  value={formatCurrency(insights.support, quote?.currency)}
                  hint={t("stock.insight.supportHint")}
                />
                <InsightTile
                  label={t("stock.insight.resistance")}
                  value={formatCurrency(insights.resistance, quote?.currency)}
                  hint={t("stock.insight.resistanceHint")}
                />
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-3xl px-8 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{t("stock.aiPrediction.title")}</h3>
              <p className="mt-2 text-sm text-muted">
                {t("stock.aiPrediction.subtitle")}
              </p>
            </div>
            {sentiment && (
              <SentimentBadge label={sentiment.label} score={sentiment.score} />
            )}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr,0.6fr]">
            <div className="glass rounded-2xl px-5 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                {t("stock.aiPrediction.signal")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {sentiment
                  ? t(`sentiment.${sentiment.label}`, sentiment.label)
                  : t("sentiment.neutral")}
              </p>
              <p className="mt-2 text-sm text-muted">
                {t("stock.aiPrediction.confidence", undefined, {
                  value: (sentiment?.confidence ?? 0).toFixed(2)
                })}
              </p>
              {newsWarning && (
                <p className="mt-3 text-xs text-ember">{newsWarning}</p>
              )}
            </div>
            <div className="glass rounded-2xl px-5 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                {t("stock.aiPrediction.sentimentScore")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {sentiment ? sentiment.score.toFixed(2) : "0.00"}
              </p>
              <p className="mt-2 text-sm text-muted">
                {t("stock.aiPrediction.thresholds")}
              </p>
            </div>
          </div>
        </section>

        {thesis && (
          <section className="glass rounded-3xl px-8 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{t("stock.thesis.title")}</h3>
                <p className="mt-2 text-sm text-muted">{thesis.summary}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-ink">{t("stock.thesis.bullCase")}</h4>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {thesis.bullCase.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink">{t("stock.thesis.bearCase")}</h4>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {thesis.bearCase.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink">{t("stock.thesis.risks")}</h4>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {thesis.risks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink">{t("stock.thesis.catalysts")}</h4>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {thesis.catalysts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {analytics && (
          <section className="glass rounded-3xl px-8 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{t("stock.analytics.title")}</h3>
                <p className="mt-2 text-sm text-muted">
                  {t("stock.analytics.subtitle")}
                </p>
              </div>
              <div className="text-xs text-muted">{t("stock.analytics.source")}</div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {t("stock.analytics.momentumScore")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {analytics.aiScore.toFixed(1)} / 10
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    className="w-20 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                    type="number"
                    min={1}
                    max={10}
                    value={alertThreshold}
                    onChange={(event) =>
                      setAlertThreshold(Number(event.target.value))
                    }
                  />
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                    onClick={() =>
                      setMomentumAlerts((prev) => {
                        const next = prev.filter(
                          (item) => item.symbol !== symbol
                        );
                        return [
                          ...next,
                          {
                            symbol,
                            threshold: alertThreshold,
                            lastScore: analytics.aiScore,
                            lastUpdated: new Date().toISOString()
                          }
                        ];
                      })
                    }
                  >
                    {t("stock.analytics.addAlert")}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {t("stock.analytics.superStack")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {analytics.superStackScore} / 100
                </p>
                <p className="mt-2 text-xs text-muted">
                  {t("stock.analytics.superStackHint")}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {t("stock.analytics.earningsPredictor")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {t(
                    `sentiment.${analytics.earnings.direction}`,
                    analytics.earnings.direction
                  )}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t("stock.analytics.earningsStats", undefined, {
                    up: Math.round(analytics.earnings.probabilityUp * 100),
                    confidence: Math.round(analytics.earnings.confidence * 100)
                  })}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-muted">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {t("stock.analytics.rationale")}
                </p>
                <ul className="mt-3 space-y-2">
                  {analytics.earnings.rationale.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-muted">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {t("stock.analytics.secHighlight")}
                </p>
                <p className="mt-2 text-sm text-ink">
                  {secSummary?.headline || t("stock.analytics.noSecSummary")}
                </p>
                <p className="mt-2 text-xs text-muted">{secSummary?.message}</p>
                {secWarning && (
                  <p className="mt-2 text-xs text-ember">{secWarning}</p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t("stock.news.title")}</h3>
            <span className="text-xs uppercase tracking-[0.3em] text-muted">
              {t("stock.news.stories", undefined, { count: news.length || 0 })}
            </span>
          </div>
          {news.length > 0 && (
            <div className="glass rounded-2xl px-4 py-4">
              <StoriesFeed articles={news} symbol={symbol} />
            </div>
          )}
          {news.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {news.map((article) => (
                <NewsCard key={article.url} article={article} />
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl px-6 py-6 text-sm text-muted">
              {t("stock.news.empty")}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
