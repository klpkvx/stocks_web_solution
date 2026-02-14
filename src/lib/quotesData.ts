import { getQuotes, type Quote } from "@/lib/twelveData";
import { cached } from "@/lib/serverStore";

type QuotesPayload = {
  quotes: Quote[];
  warning?: string;
  stale?: boolean;
  expiresIn: number;
};

const REFRESH_MS = (() => {
  const raw = Number(process.env.QUOTES_REFRESH_MS || 75_000);
  if (!Number.isFinite(raw)) return 75_000;
  return Math.max(25_000, raw);
})();

const STALE_MS = (() => {
  const raw = Number(process.env.QUOTES_STALE_MS || 10 * 60 * 1000);
  if (!Number.isFinite(raw)) return 10 * 60 * 1000;
  return Math.max(REFRESH_MS, raw);
})();

const EXPIRES_IN = Math.max(20, Math.min(90, Math.floor(REFRESH_MS / 1000)));

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))
  ).sort();
}

function placeholderQuotes(symbols: string[]): Quote[] {
  return symbols.map((symbol) => ({
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
  }));
}

export async function getCachedQuotesPayload(
  symbolsInput: string[],
  options: { forceRefresh?: boolean } = {}
): Promise<QuotesPayload> {
  const symbols = normalizeSymbols(symbolsInput);
  if (!symbols.length) {
    return {
      quotes: [],
      expiresIn: EXPIRES_IN
    };
  }

  const key = `quotes:${symbols.join(",")}`;

  try {
    const quotes = await cached(
      key,
      async () => {
        return getQuotes(symbols);
      },
      {
        ttlMs: REFRESH_MS,
        staleTtlMs: STALE_MS,
        staleIfError: true,
        forceRefresh: options.forceRefresh,
        backgroundRevalidate: true,
        l2: true
      }
    );

    return {
      quotes,
      expiresIn: EXPIRES_IN
    };
  } catch (error: any) {
    return {
      quotes: placeholderQuotes(symbols),
      warning: error?.message || "Failed to load quotes",
      stale: true,
      expiresIn: EXPIRES_IN
    };
  }
}
