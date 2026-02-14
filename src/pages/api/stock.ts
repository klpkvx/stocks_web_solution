import type { NextApiRequest, NextApiResponse } from "next";
import { type Quote, type TimeSeriesPoint } from "@/lib/twelveData";
import { analyzeSentiment, summarizeSentiment } from "@/lib/sentiment";
import { buildThesis, computeInsights } from "@/lib/insights";
import { buildAnalytics } from "@/lib/analytics";
import { cached as serverCached, getStale as getServerStale } from "@/lib/serverStore";
import { withApiObservability } from "@/lib/apiObservability";
import { dataAccess } from "@/lib/dataAccess/service";
import { parseQuery } from "@/lib/apiValidation";
import { stockQuerySchema } from "@/contracts/requestContracts";

type StockPayload = {
  quote: Quote;
  series: TimeSeriesPoint[];
  news: Array<{
    title: string;
    description: string;
    url: string;
    source: string;
    publishedAt: string;
    sentiment: number;
  }>;
  sentiment: {
    score: number;
    label: "bullish" | "bearish" | "neutral";
    confidence: number;
  };
  insights: ReturnType<typeof computeInsights>;
  thesis: ReturnType<typeof buildThesis>;
  analytics: ReturnType<typeof buildAnalytics>;
  secSummary: { headline: string; message: string } | null;
  warning: string | null;
  secWarning: string | null;
  stale?: boolean;
};

const STOCK_CACHE_TTL_MS = 45 * 1000;
const STOCK_STALE_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_CACHE_TTL_MS = 20 * 60 * 1000;
const ANALYTICS_STALE_TTL_MS = 2 * 60 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

function fallbackQuote(symbol: string): Quote {
  return {
    symbol,
    name: symbol,
    currency: "USD",
    price: null,
    change: null,
    percentChange: null,
    open: null,
    high: null,
    low: null,
    volume: null,
    previousClose: null,
    timestamp: null
  };
}

function shouldCache(payload: StockPayload) {
  return payload.series.length > 0 || payload.quote.price !== null;
}

function fillQuoteFromSeries(
  symbol: string,
  quote: Quote,
  series: TimeSeriesPoint[]
): Quote {
  if (!series.length) return quote;
  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const previousClose = previous?.close ?? latest.open;
  const hasPreviousClose =
    previousClose !== null && previousClose !== undefined && Number.isFinite(previousClose);
  const change =
    hasPreviousClose
      ? Number((latest.close - Number(previousClose)).toFixed(4))
      : null;
  const percentChange =
    hasPreviousClose && Number(previousClose) !== 0
      ? Number((((latest.close - Number(previousClose)) / Number(previousClose)) * 100).toFixed(4))
      : null;

  return {
    ...quote,
    symbol: quote.symbol || symbol,
    name: quote.name || symbol,
    currency: quote.currency || "USD",
    price: quote.price ?? latest.close,
    change: quote.change ?? change,
    percentChange: quote.percentChange ?? percentChange,
    open: quote.open ?? latest.open,
    high: quote.high ?? latest.high,
    low: quote.low ?? latest.low,
    volume: quote.volume ?? latest.volume,
    previousClose: quote.previousClose ?? (hasPreviousClose ? Number(previousClose) : null),
    timestamp: quote.timestamp || latest.time
  };
}

function miniSeriesFromQuote(quote: Quote): TimeSeriesPoint[] {
  if (quote.price === null || quote.price === undefined) return [];
  const close = Number(quote.price);
  if (!Number.isFinite(close)) return [];

  const previousCandidate = quote.previousClose ?? quote.open ?? quote.price;
  const previous = Number(previousCandidate);
  const prev = Number.isFinite(previous) ? previous : close;
  const high = Math.max(close, prev);
  const low = Math.min(close, prev);
  const now = quote.timestamp && !Number.isNaN(new Date(quote.timestamp).getTime())
    ? new Date(quote.timestamp)
    : new Date();
  const prevDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
      time: now.toISOString().slice(0, 10),
      open: prev,
      high,
      low,
      close,
      volume: Number(quote.volume || 0)
    }
  ];
}

async function buildStockPayload(symbol: string, interval: string): Promise<StockPayload> {
  const [quoteResult, seriesResult, newsResult, secResult] = await Promise.allSettled([
    withTimeout(
      dataAccess.quotes([symbol]).then((payload) => payload.quotes[0] || fallbackQuote(symbol)),
      2800,
      "Quote timeout"
    ),
    withTimeout(dataAccess.timeSeries(symbol, interval), 7000, "Time series timeout"),
    withTimeout(dataAccess.news(symbol).then((payload) => payload.articles), 2300, "News timeout"),
    withTimeout(dataAccess.sec(symbol), 2500, "SEC timeout")
  ]);

  let quote =
    quoteResult.status === "fulfilled" ? quoteResult.value : fallbackQuote(symbol);
  let series =
    seriesResult.status === "fulfilled" ? seriesResult.value : [];
  const articles =
    newsResult.status === "fulfilled" ? newsResult.value : [];

  if (quote.price === null && series.length) {
    quote = fillQuoteFromSeries(symbol, quote, series);
  }
  if (!series.length && quote.price !== null) {
    series = miniSeriesFromQuote(quote);
  }

  const enriched = articles.map((article) => {
    const text = `${article.title}. ${article.description}`;
    const sentiment = analyzeSentiment(text);
    return {
      ...article,
      sentiment: sentiment.normalized
    };
  });

  const sentiment = summarizeSentiment(enriched.map((article) => article.sentiment));
  const insights = computeInsights(series, quote);

  let secSummary: { headline: string; message: string } | null = null;
  let secWarning: string | null = null;
  if (secResult.status === "fulfilled") {
    secSummary = secResult.value.summary;
  } else {
    secWarning = secResult.reason?.message || "SEC filings unavailable";
  }

  const analytical = await serverCached(
    `stock:analytics:${symbol}:${interval}`,
    async () => {
      const thesis = buildThesis(symbol, quote, sentiment.score, insights);
      const analytics = buildAnalytics(
        sentiment.score,
        insights,
        quote,
        secSummary?.headline || null
      );
      return { thesis, analytics };
    },
    {
      ttlMs: ANALYTICS_CACHE_TTL_MS,
      staleTtlMs: ANALYTICS_STALE_TTL_MS,
      staleIfError: true,
      backgroundRevalidate: true,
      l2: true
    }
  );

  const warnings: string[] = [];
  if (quoteResult.status === "rejected" && quote.price === null) {
    warnings.push("Quote unavailable");
  }
  if (seriesResult.status === "rejected" && series.length === 0) {
    warnings.push("Chart data unavailable");
  }
  if (newsResult.status === "rejected") warnings.push("News unavailable");
  if (!process.env.NEWS_API_KEY) warnings.push("NEWS_API_KEY not set");

  return {
    quote,
    series,
    news: enriched,
    sentiment,
    insights,
    thesis: analytical.thesis,
    analytics: analytical.analytics,
    secSummary,
    warning: warnings.length ? warnings.join(". ") : null,
    secWarning
  };
}

async function getPayload(symbol: string, interval: string, forceRefresh = false) {
  const key = `stock:${symbol}:${interval}`;
  return serverCached(
    key,
    async () => {
      const data = await buildStockPayload(symbol, interval);
      if (shouldCache(data)) {
        return data;
      }
      const stale = getServerStale<StockPayload>(key, STOCK_STALE_TTL_MS);
      return stale || data;
    },
    {
      ttlMs: STOCK_CACHE_TTL_MS,
      staleTtlMs: STOCK_STALE_TTL_MS,
      staleIfError: true,
      forceRefresh,
      backgroundRevalidate: true,
      l2: true
    }
  );
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = parseQuery(req, res, stockQuerySchema);
  if (!query) return;
  const symbol = query.symbol;
  const interval = query.interval;
  const forceRefresh = query.refresh;

  const key = `${symbol}:${interval}`;
  const stale = getServerStale<StockPayload>(`stock:${key}`, STOCK_STALE_TTL_MS);

  try {
    const payload = await withTimeout(
      getPayload(symbol, interval, forceRefresh),
      12000,
      "Stock request timeout"
    );

    if (stale && payload.quote.price === null && payload.series.length === 0) {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
      return res.status(200).json({
        ...stale,
        stale: true,
        warning: `${stale.warning ? `${stale.warning}. ` : ""}Using cached snapshot`
      });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(payload);
  } catch (error: any) {
    if (stale) {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
      return res.status(200).json({
        ...stale,
        stale: true,
        warning: `${stale.warning ? `${stale.warning}. ` : ""}Using cached snapshot`
      });
    }

    const quote = fallbackQuote(symbol);
    const insights = computeInsights([], quote);
    const minimal: StockPayload = {
      quote,
      series: [],
      news: [],
      sentiment: {
        score: 0,
        label: "neutral",
        confidence: 0
      },
      insights,
      thesis: buildThesis(symbol, quote, 0, insights),
      analytics: buildAnalytics(0, insights, quote, null),
      secSummary: null,
      warning: error?.message || "Failed to load stock data",
      secWarning: null,
      stale: true
    };
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json(minimal);
  }
}

export default withApiObservability("stock", handler);
