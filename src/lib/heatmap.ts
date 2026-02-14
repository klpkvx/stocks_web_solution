import { HEATMAP_UNIVERSE } from "@/lib/heatmapUniverse";
import { getQuotes, type Quote } from "@/lib/twelveData";
import type {
  HeatmapChangeSet,
  HeatmapPayload,
  HeatmapPeriod,
  HeatmapSector,
  HeatmapTicker
} from "@/types/heatmap";

const STOOQ_BASE = "https://stooq.com/q/d/l/";
const REQUEST_TIMEOUT_MS = 1600;
const CONCURRENCY = 12;
const CLOSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ClosePoint = { time: string; close: number };
type CloseRefs = {
  latest: number | null;
  day: number | null;
  week: number | null;
  month: number | null;
  year: number | null;
};

const CLOSE_CACHE = new Map<string, { at: number; data: ClosePoint[] }>();

function stooqSymbols(symbol: string) {
  const normalized = symbol.trim().toLowerCase().replace(/\./g, "-");
  const candidates = [`${normalized}.us`, normalized];
  return Array.from(new Set(candidates));
}

function parseCsv(csv: string): ClosePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rows = lines.slice(1);

  return rows
    .map((line) => line.split(","))
    .filter((cols) => cols.length >= 5)
    .map((cols) => {
      const [date, , , , close] = cols;
      if (!date || !close || close === "N/D") return null;
      const value = Number(close);
      if (!Number.isFinite(value)) return null;
      return { time: date, close: value };
    })
    .filter((point): point is ClosePoint => Boolean(point))
    .sort((a, b) => a.time.localeCompare(b.time));
}

async function fetchCloses(symbol: string): Promise<ClosePoint[]> {
  const cached = CLOSE_CACHE.get(symbol);
  if (cached && Date.now() - cached.at < CLOSE_CACHE_TTL_MS) {
    return cached.data;
  }

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
      const parsed = parseCsv(csv);
      if (parsed.length) {
        const capped = parsed.slice(-320);
        CLOSE_CACHE.set(symbol, { at: Date.now(), data: capped });
        return capped;
      }
    } catch {
      // Try next symbol format.
    } finally {
      clearTimeout(timer);
    }
  }

  CLOSE_CACHE.set(symbol, { at: Date.now(), data: [] });
  return [];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  if (items.length === 0) return [] as R[];
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function refAt(series: ClosePoint[], lookback: number): number | null {
  if (series.length <= lookback) return null;
  const point = series[series.length - 1 - lookback];
  return Number.isFinite(point?.close) ? point.close : null;
}

function buildRefs(series: ClosePoint[]): CloseRefs {
  const latest = series.length ? series[series.length - 1].close : null;
  return {
    latest: Number.isFinite(latest) ? latest : null,
    day: refAt(series, 1),
    week: refAt(series, 5),
    month: refAt(series, 21),
    year: refAt(series, 252)
  };
}

function changeFrom(current: number | null, reference: number | null): number | null {
  if (
    current === null ||
    reference === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(reference) ||
    reference === 0
  ) {
    return null;
  }
  return ((current - reference) / reference) * 100;
}

function pickLivePrice(quote: Quote | undefined, refs: CloseRefs): number | null {
  const quotePrice = Number(quote?.price);
  if (Number.isFinite(quotePrice)) return quotePrice;
  return refs.latest;
}

function computeChangesFromQuote(quote: Quote | undefined, price: number | null, refs: CloseRefs) {
  const quoteDay = Number(quote?.percentChange);
  const day = Number.isFinite(quoteDay) ? quoteDay : changeFrom(price, refs.day);
  return {
    day,
    week: changeFrom(price, refs.week),
    month: changeFrom(price, refs.month),
    year: changeFrom(price, refs.year)
  } satisfies HeatmapChangeSet;
}

function buildSectorStats(tickers: HeatmapTicker[]): HeatmapSector[] {
  const periods: HeatmapPeriod[] = ["day", "week", "month", "year"];
  const grouped = new Map<
    string,
    {
      sector: string;
      marketCapB: number;
      count: number;
      weightedSums: Record<HeatmapPeriod, number>;
      weightedCaps: Record<HeatmapPeriod, number>;
    }
  >();

  tickers.forEach((ticker) => {
    const current =
      grouped.get(ticker.sector) ||
      {
        sector: ticker.sector,
        marketCapB: 0,
        count: 0,
        weightedSums: { day: 0, week: 0, month: 0, year: 0 },
        weightedCaps: { day: 0, week: 0, month: 0, year: 0 }
      };

    current.marketCapB += ticker.marketCapB;
    current.count += 1;
    periods.forEach((period) => {
      const value = ticker.changes[period];
      if (value === null) return;
      current.weightedSums[period] += value * ticker.marketCapB;
      current.weightedCaps[period] += ticker.marketCapB;
    });
    grouped.set(ticker.sector, current);
  });

  return Array.from(grouped.values())
    .map((entry) => ({
      sector: entry.sector,
      marketCapB: entry.marketCapB,
      count: entry.count,
      changes: {
        day:
          entry.weightedCaps.day > 0
            ? entry.weightedSums.day / entry.weightedCaps.day
            : null,
        week:
          entry.weightedCaps.week > 0
            ? entry.weightedSums.week / entry.weightedCaps.week
            : null,
        month:
          entry.weightedCaps.month > 0
            ? entry.weightedSums.month / entry.weightedCaps.month
            : null,
        year:
          entry.weightedCaps.year > 0
            ? entry.weightedSums.year / entry.weightedCaps.year
            : null
      }
    }))
    .sort((a, b) => b.marketCapB - a.marketCapB);
}

export async function buildHeatmapPayload(): Promise<HeatmapPayload> {
  const symbols = HEATMAP_UNIVERSE.map((item) => item.symbol);

  const closePairs = await mapWithConcurrency(HEATMAP_UNIVERSE, CONCURRENCY, async (item) => {
    const series = await fetchCloses(item.symbol);
    return [item.symbol, buildRefs(series)] as const;
  });
  const closeMap = new Map<string, CloseRefs>(closePairs);

  let quotes: Quote[] = [];
  try {
    quotes = await getQuotes(symbols);
  } catch {
    // Keep stale historical-only heatmap if quote API is limited.
  }
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

  const tickers = HEATMAP_UNIVERSE.map((item) => {
    const refs = closeMap.get(item.symbol) || {
      latest: null,
      day: null,
      week: null,
      month: null,
      year: null
    };
    const quote = quoteMap.get(item.symbol);
    const livePrice = pickLivePrice(quote, refs);

    return {
      symbol: item.symbol,
      name: item.name,
      sector: item.sector,
      marketCapB: item.marketCapB,
      currency: quote?.currency || "USD",
      price: livePrice,
      changes: computeChangesFromQuote(quote, livePrice, refs)
    } satisfies HeatmapTicker;
  });

  const sectors = buildSectorStats(tickers);

  return {
    updatedAt: new Date().toISOString(),
    source: "Twelve Data quotes + Stooq history",
    tickers,
    sectors
  };
}
