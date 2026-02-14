import { POPULAR_TICKERS } from "@/lib/tickers";
import { runWithResilience } from "@/lib/resilience";
import { cached } from "@/lib/serverStore";
import { incrementCounter } from "@/lib/telemetry";

export type TickerItem = {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency?: string;
};

type TickerSearchPayload = {
  tickers: TickerItem[];
  expiresIn: number;
};

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const QUERY_CACHE_SECONDS = 12 * 60 * 60;
const QUERY_CACHE_MS = QUERY_CACHE_SECONDS * 1000;
const INDEX_CACHE_MS = 24 * 60 * 60 * 1000;
const INDEX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_QUERY_LENGTH = 3;
const MAX_INDEX_ITEMS = 12_000;
const NETWORK_TIMEOUT_MS = 2400;

function getUserAgent() {
  return process.env.SEC_USER_AGENT || "StockPulse/1.0 support@stockpulse.app";
}

function normalizeTicker(item: Partial<TickerItem>): TickerItem | null {
  const symbol = String(item.symbol || "").trim().toUpperCase();
  if (!symbol) return null;

  return {
    symbol,
    name: String(item.name || symbol).trim() || symbol,
    exchange: String(item.exchange || "US").trim() || "US",
    country: String(item.country || "US").trim() || "US",
    type: String(item.type || "Common Stock").trim() || "Common Stock",
    currency: item.currency ? String(item.currency) : undefined
  };
}

function mergeUnique(items: TickerItem[], limit: number) {
  const seen = new Set<string>();
  const merged: TickerItem[] = [];

  for (const item of items) {
    const normalized = normalizeTicker(item);
    if (!normalized) continue;
    if (seen.has(normalized.symbol)) continue;
    seen.add(normalized.symbol);
    merged.push(normalized);
    if (merged.length >= limit) break;
  }

  return merged;
}

function matchScore(item: TickerItem, query: string) {
  const symbol = item.symbol.toUpperCase();
  const name = item.name.toUpperCase();
  if (symbol === query) return 140;
  if (symbol.startsWith(query)) return 120;
  if (name.startsWith(query)) return 95;
  if (symbol.includes(query)) return 70;
  if (name.includes(query)) return 40;
  return 0;
}

function searchTickers(items: TickerItem[], query: string, limit: number) {
  const ranked = items
    .map((item) => ({ item, score: matchScore(item, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.symbol.length !== b.item.symbol.length) {
        return a.item.symbol.length - b.item.symbol.length;
      }
      return a.item.symbol.localeCompare(b.item.symbol);
    })
    .slice(0, limit * 2)
    .map((entry) => entry.item);

  return mergeUnique(ranked, limit);
}

function fallbackTickers(query: string, limit: number) {
  const defaults = POPULAR_TICKERS.map((symbol) => ({
    symbol,
    name: symbol,
    exchange: "US",
    country: "US",
    type: "Common Stock"
  }));
  return searchTickers(defaults, query, limit);
}

async function fetchSecTickerIndex(): Promise<TickerItem[]> {
  incrementCounter("tickers.index.fetch");

  const payload = await runWithResilience(
    "tickers:index:sec",
    async ({ signal }) => {
      const response = await fetch(SEC_TICKERS_URL, {
        signal,
        headers: {
          "User-Agent": getUserAgent(),
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`SEC index request failed: ${response.status}`);
      }
      return response.json();
    },
    {
      timeoutMs: NETWORK_TIMEOUT_MS,
      retries: 1,
      openAfterFailures: 4,
      openWindowMs: 60 * 1000
    }
  );

  const mapped = Object.values<any>(payload || {})
    .map((item: any) =>
      normalizeTicker({
        symbol: item?.ticker,
        name: item?.title,
        exchange: "US",
        country: "US",
        type: "Common Stock"
      })
    )
    .filter((item): item is TickerItem => Boolean(item))
    .slice(0, MAX_INDEX_ITEMS);

  return mergeUnique(
    [
      ...mapped,
      ...POPULAR_TICKERS.map((symbol) => ({
        symbol,
        name: symbol,
        exchange: "US",
        country: "US",
        type: "Common Stock"
      }))
    ],
    MAX_INDEX_ITEMS
  );
}

export async function getTickerIndex(forceRefresh = false) {
  return cached(
    "tickers:index:v1",
    fetchSecTickerIndex,
    {
      ttlMs: INDEX_CACHE_MS,
      staleTtlMs: INDEX_STALE_MS,
      staleIfError: true,
      forceRefresh,
      backgroundRevalidate: true,
      l2: true
    }
  );
}

export async function getTickerSearchPayload(
  query: string,
  limit = 12,
  options: { forceRefresh?: boolean } = {}
): Promise<TickerSearchPayload> {
  const q = String(query || "").trim().toUpperCase();
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(40, Number(limit)))
    : 12;

  if (!q || q.length < MIN_QUERY_LENGTH) {
    return { tickers: [], expiresIn: QUERY_CACHE_SECONDS };
  }

  return cached(
    `tickers:query:v1:${q}:${safeLimit}`,
    async () => {
      const fallback = fallbackTickers(q, safeLimit);
      try {
        const index = await getTickerIndex(options.forceRefresh);
        const fromIndex = searchTickers(index, q, safeLimit);
        const merged = mergeUnique([...fromIndex, ...fallback], safeLimit);
        return {
          tickers: merged.length ? merged : fallback,
          expiresIn: QUERY_CACHE_SECONDS
        };
      } catch {
        return {
          tickers: fallback,
          expiresIn: QUERY_CACHE_SECONDS
        };
      }
    },
    {
      ttlMs: QUERY_CACHE_MS,
      staleTtlMs: 2 * QUERY_CACHE_MS,
      staleIfError: true,
      forceRefresh: options.forceRefresh,
      backgroundRevalidate: true,
      l2: true
    }
  );
}

export async function warmTickerSearchCache(symbols: string[]) {
  const seeds = Array.from(
    new Set(
      symbols
        .map((symbol) => String(symbol || "").trim().toUpperCase())
        .filter(Boolean)
        .flatMap((symbol) => [symbol.slice(0, 3), symbol.slice(0, 4), symbol])
        .filter((query) => query.length >= MIN_QUERY_LENGTH)
    )
  ).slice(0, 24);

  await getTickerIndex(false).catch(() => []);
  await Promise.allSettled(seeds.map((query) => getTickerSearchPayload(query, 12)));

  return { queries: seeds.length };
}
