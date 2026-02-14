import { runWithResilience } from "@/lib/resilience";
import { incrementCounter } from "@/lib/telemetry";

const API_BASE = "https://api.twelvedata.com";
const STOOQ_BASE = "https://stooq.com/q/d/l/";
const NEWS_API_BASE = process.env.NEWS_API_BASE || "https://newsapi.org/v2";
const CACHE = new Map<string, { timestamp: number; data: unknown }>();
const IN_FLIGHT = new Map<string, Promise<unknown>>();
const QUOTE_TTL = 90 * 1000;
const SERIES_TTL = 15 * 60 * 1000;
const NEWS_TTL = 5 * 60 * 1000;
const TICKER_TTL = 6 * 60 * 60 * 1000;
const MAX_SYMBOLS_PER_REQUEST = Math.max(
  1,
  Number(process.env.TWELVE_BATCH_SIZE || 24) || 24
);
const MIN_GAP_MS = (() => {
  const raw = process.env.TWELVE_MIN_GAP_MS;
  if (raw === undefined || raw === "") return 200;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 200;
  return Math.max(0, value);
})();
const MAX_REQUESTS_PER_MIN = (() => {
  const raw = process.env.TWELVE_MAX_PER_MIN;
  if (raw === undefined || raw === "") return 8;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 8;
  return Math.max(1, Math.floor(value));
})();
const RATE_WINDOW_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = (() => {
  const raw = process.env.TWELVE_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 2500;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 2500;
  return Math.max(800, value);
})();
const NEWS_TIMEOUT_MS = (() => {
  const raw = process.env.NEWS_TIMEOUT_MS;
  if (raw === undefined || raw === "") return Math.max(REQUEST_TIMEOUT_MS, 4200);
  const value = Number(raw);
  if (!Number.isFinite(value)) return Math.max(REQUEST_TIMEOUT_MS, 4200);
  return Math.max(1200, value);
})();
const MAX_THROTTLE_WAIT_MS = (() => {
  const raw = process.env.TWELVE_MAX_WAIT_MS;
  if (raw === undefined || raw === "") return 1200;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1200;
  return Math.max(200, value);
})();

let lastRequestAt = 0;
let requestQueue = Promise.resolve();
const recentRequestTimestamps: number[] = [];

export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  previousClose: number | null;
  timestamp: string | null;
};

export type TimeSeriesPoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type NewsArticle = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  content?: string;
};

export type StockTicker = {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency?: string;
};

const QUOTE_CACHE = new Map<string, { timestamp: number; data: Quote }>();

function getCache<T>(key: string, ttl: number): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    CACHE.delete(key);
    return null;
  }
  return entry.data as T;
}

function getStale<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  CACHE.set(key, { timestamp: Date.now(), data });
}

function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
  options: { staleIfError?: boolean } = {}
): Promise<T> {
  const stale = options.staleIfError ? getStale<T>(key) : null;
  const cached = getCache<T>(key, ttl);
  if (cached) return Promise.resolve(cached);

  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  const task = (async () => {
    try {
      const data = await fetcher();
      setCache(key, data);
      return data;
    } catch (error) {
      if (options.staleIfError) {
        if (stale) return stale;
      }
      throw error;
    } finally {
      IN_FLIGHT.delete(key);
    }
  })();

  IN_FLIGHT.set(key, task);
  return task;
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function throttle() {
  requestQueue = requestQueue
    .catch(() => undefined)
    .then(async () => {
      while (true) {
        const now = Date.now();
        while (
          recentRequestTimestamps.length > 0 &&
          now - recentRequestTimestamps[0] >= RATE_WINDOW_MS
        ) {
          recentRequestTimestamps.shift();
        }

        const gapWait = Math.max(0, lastRequestAt + MIN_GAP_MS - now);
        const windowWait =
          recentRequestTimestamps.length >= MAX_REQUESTS_PER_MIN
            ? Math.max(0, recentRequestTimestamps[0] + RATE_WINDOW_MS - now)
            : 0;
        const wait = Math.max(gapWait, windowWait);

        if (wait <= 0) {
          break;
        }
        if (wait > MAX_THROTTLE_WAIT_MS) {
          incrementCounter("quota.twelve.local_limit_block");
          throw new Error("Twelve Data local rate limit reached");
        }

        await new Promise((resolve) => setTimeout(resolve, wait));
      }

      const timestamp = Date.now();
      lastRequestAt = timestamp;
      recentRequestTimestamps.push(timestamp);
      incrementCounter("quota.twelve.request_slot");
    });
  await requestQueue;
}

async function twelveFetch<T>(endpoint: string, params: Record<string, string>) {
  const apiKey = process.env.TWELVE_DATA_KEY;
  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_KEY in .env.local");
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  const searchParams = new URLSearchParams(params);
  searchParams.set("apikey", apiKey);
  url.search = searchParams.toString();

  const { response, payload } = await runWithResilience(
    `twelve:${endpoint}`,
    async ({ signal }) => {
      await throttle();
      incrementCounter("api.twelve.fetch");
      const response = await fetch(url.toString(), { signal });
      const payload = await response.json();
      return { response, payload };
    },
    {
      timeoutMs: REQUEST_TIMEOUT_MS,
      retries: 1,
      openAfterFailures: 4,
      openWindowMs: 60 * 1000,
      shouldRetry: (error) => {
        const message = String((error as any)?.message || "");
        return !/invalid|parameter|forbidden|unauthorized|404/i.test(message);
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Twelve Data error: ${response.status}`);
  }

  if (payload?.status === "error") {
    throw new Error(payload.message || "Twelve Data returned an error");
  }

  if (payload?.code && payload?.message) {
    throw new Error(payload.message);
  }

  return payload as T;
}

function stooqSymbols(symbol: string) {
  const normalized = symbol.trim().toLowerCase().replace(/\./g, "-");
  const candidates = [`${normalized}.us`, normalized];
  return Array.from(new Set(candidates));
}

function parseStooqCsv(csv: string): TimeSeriesPoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rows = lines.slice(1);

  const parsed = rows
    .map((line) => line.split(","))
    .filter((cols) => cols.length >= 6)
    .map((cols) => {
      const [date, open, high, low, close, volume] = cols;
      if (!date || [open, high, low, close].some((value) => value === "N/D")) {
        return null;
      }
      const point: TimeSeriesPoint = {
        time: date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume || 0)
      };
      if (
        !Number.isFinite(point.open) ||
        !Number.isFinite(point.high) ||
        !Number.isFinite(point.low) ||
        !Number.isFinite(point.close)
      ) {
        return null;
      }
      return point;
    })
    .filter((point): point is TimeSeriesPoint => Boolean(point))
    .sort((a, b) => a.time.localeCompare(b.time));

  return parsed.slice(-180);
}

async function fetchStooqSeries(symbol: string): Promise<TimeSeriesPoint[]> {
  for (const candidate of stooqSymbols(symbol)) {
    const url = new URL(STOOQ_BASE);
    url.searchParams.set("s", candidate);
    url.searchParams.set("i", "d");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) continue;
      const csv = await response.text();
      const parsed = parseStooqCsv(csv);
      if (parsed.length) return parsed;
    } catch {
      // Ignore and continue with the next candidate.
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

function normalizeQuote(raw: any): Quote {
  return {
    symbol: raw.symbol,
    name: raw.name || raw.symbol,
    currency: raw.currency || "USD",
    price: toNumber(raw.price),
    change: toNumber(raw.change),
    percentChange: toNumber(raw.percent_change),
    open: toNumber(raw.open),
    high: toNumber(raw.high),
    low: toNumber(raw.low),
    volume: toNumber(raw.volume),
    previousClose: toNumber(raw.previous_close),
    timestamp: raw.datetime || raw.timestamp || null
  };
}

function getQuoteCache(symbol: string, ttl: number) {
  const entry = QUOTE_CACHE.get(symbol);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) return null;
  return entry.data;
}

function getQuoteStale(symbol: string) {
  const entry = QUOTE_CACHE.get(symbol);
  return entry ? entry.data : null;
}

function setQuoteCache(symbol: string, quote: Quote) {
  QUOTE_CACHE.set(symbol, { timestamp: Date.now(), data: quote });
}

export async function getQuote(symbol: string): Promise<Quote> {
  const [quote] = await getQuotes([symbol]);
  if (!quote) {
    throw new Error("Quote not found");
  }
  return quote;
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const normalized = Array.from(
    new Set(symbols.map((symbol) => symbol.toUpperCase()))
  ).filter(Boolean);
  if (normalized.length === 0) return [];
  const sorted = [...normalized].sort();

  const resultMap = new Map<string, Quote>();
  const staleMap = new Map<string, Quote>();
  const missing: string[] = [];

  sorted.forEach((symbol) => {
    const fresh = getQuoteCache(symbol, QUOTE_TTL);
    if (fresh) {
      incrementCounter("cache.quote.hit");
      resultMap.set(symbol, fresh);
      return;
    }
    const stale = getQuoteStale(symbol);
    if (stale) {
      staleMap.set(symbol, stale);
    }
    missing.push(symbol);
  });

  if (missing.length) {
    try {
      async function fetchQuoteBatchAdaptive(batch: string[]): Promise<any[]> {
        if (batch.length === 0) return [];
        if (batch.length > MAX_SYMBOLS_PER_REQUEST) {
          const middle = Math.ceil(batch.length / 2);
          const [left, right] = await Promise.all([
            fetchQuoteBatchAdaptive(batch.slice(0, middle)),
            fetchQuoteBatchAdaptive(batch.slice(middle))
          ]);
          return [...left, ...right];
        }
        try {
          const payload = await twelveFetch<any>("quote", {
            symbol: batch.join(",")
          });
          if (Array.isArray(payload?.data)) return payload.data;
          if (payload?.symbol) return [payload];
          return [];
        } catch (error: any) {
          const message = String(error?.message || "");
          const shouldSplit =
            batch.length > 1 &&
            /(symbol|parameter|length|too many|too long|invalid|400|414|422)/i.test(
              message
            );
          if (!shouldSplit) throw error;

          const middle = Math.ceil(batch.length / 2);
          const [left, right] = await Promise.all([
            fetchQuoteBatchAdaptive(batch.slice(0, middle)),
            fetchQuoteBatchAdaptive(batch.slice(middle))
          ]);
          return [...left, ...right];
        }
      }

      const merged = await fetchQuoteBatchAdaptive(missing);

      merged.map(normalizeQuote).forEach((quote) => {
        if (!quote.symbol) return;
        setQuoteCache(quote.symbol, quote);
        incrementCounter("cache.quote.write");
        resultMap.set(quote.symbol, quote);
      });
    } catch (error) {
      if (!staleMap.size) throw error;
    }
  }

  staleMap.forEach((quote, symbol) => {
    if (!resultMap.has(symbol)) {
      resultMap.set(symbol, quote);
    }
  });

  return sorted
    .map((symbol) => resultMap.get(symbol))
    .filter((quote): quote is Quote => Boolean(quote));
}

export async function getTimeSeries(
  symbol: string,
  interval = "1day"
): Promise<TimeSeriesPoint[]> {
  const cacheKey = `series:${symbol}:${interval}`;
  return withCache(
    cacheKey,
    SERIES_TTL,
    async () => {
      let twelveError: Error | null = null;

      try {
        const payload = await twelveFetch<any>("time_series", {
          symbol,
          interval,
          outputsize: "90"
        });

        if (payload?.values?.length) {
          const parsed = payload.values
            .map((value: any) => ({
              time: String(value.datetime || "").trim(),
              open: Number(value.open),
              high: Number(value.high),
              low: Number(value.low),
              close: Number(value.close),
              volume: Number(value.volume || 0)
            }))
            .filter((point: TimeSeriesPoint) => {
              if (!point.time) return false;
              return [point.open, point.high, point.low, point.close].every((item) =>
                Number.isFinite(item)
              );
            })
            .sort((a: TimeSeriesPoint, b: TimeSeriesPoint) =>
              a.time.localeCompare(b.time)
            );
          if (parsed.length) {
            return parsed.slice(-180);
          }
        }
        twelveError = new Error("No time series data available");
      } catch (error: any) {
        twelveError =
          error instanceof Error
            ? error
            : new Error(error?.message || "Failed to load time series");
      }

      // Free fallback data source to keep charts available when Twelve Data is slow/limited.
      const fallback = await fetchStooqSeries(symbol);
      if (fallback.length) {
        return fallback;
      }

      throw twelveError || new Error("No time series data available");
    },
    { staleIfError: true }
  );
}

export async function getNews(
  symbol: string,
  options: { from?: string; to?: string } = {}
): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return [];
  }

  const query = symbol
    ? `${symbol} OR ${symbol} stock`
    : "stock market";

  const cacheKey = `news:${query}:${options.from || ""}:${options.to || ""}`;
  return withCache(
    cacheKey,
    NEWS_TTL,
    async () => {
      const url = new URL(`${NEWS_API_BASE}/everything`);
      url.searchParams.set("q", query);
      url.searchParams.set("sortBy", "publishedAt");
      url.searchParams.set("language", "en");
      url.searchParams.set("pageSize", "8");
      if (options.from) {
        url.searchParams.set("from", options.from);
      }
      if (options.to) {
        url.searchParams.set("to", options.to);
      }
      url.searchParams.set("apiKey", apiKey);

      const { response, payload } = await runWithResilience(
        "news-api:everything",
        async ({ signal }) => {
          const response = await fetch(url.toString(), { signal });
          const payload = await response.json();
          return { response, payload };
        },
        {
          timeoutMs: NEWS_TIMEOUT_MS,
          retries: 1,
          openAfterFailures: 3,
          openWindowMs: 45 * 1000,
          shouldRetry: (error) => {
            const message = String((error as any)?.message || "");
            return !/api key|unauthorized|forbidden|429/i.test(message);
          }
        }
      );

      if (!response.ok) {
        throw new Error(payload?.message || "News API error");
      }

      return (payload.articles || []).map((article: any) => ({
        title: article.title,
        description: article.description || article.content || "",
        url: article.url,
        source: article.source?.name || "News",
        publishedAt: article.publishedAt,
        imageUrl: article.urlToImage || undefined,
        content: article.content || undefined
      }));
    },
    { staleIfError: true }
  );
}

export async function searchTickers(
  query: string,
  limit = 12
): Promise<StockTicker[]> {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return [];
  const safeLimit = Math.max(1, Math.min(30, limit));
  const cacheKey = `tickers:${normalized}:${safeLimit}`;
  return withCache(
    cacheKey,
    TICKER_TTL,
    async () => {
      const payload = await twelveFetch<any>("symbol_search", {
        symbol: normalized,
        outputsize: String(safeLimit)
      });
      const data = Array.isArray(payload?.data) ? payload.data : [];
      return data
        .map((item: any) => ({
          symbol: String(item?.symbol || "").toUpperCase(),
          name: String(item?.instrument_name || item?.symbol || ""),
          exchange: String(item?.exchange || ""),
          country: String(item?.country || ""),
          type: String(item?.type || ""),
          currency: item?.currency ? String(item.currency) : undefined
        }))
        .filter((item: StockTicker) => item.symbol.length > 0);
    },
    { staleIfError: true }
  );
}
