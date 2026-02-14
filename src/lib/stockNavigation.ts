import type { NextRouter } from "next/router";
import { POPULAR_TICKERS, normalizeTickerInput } from "@/lib/tickers";

const STOCK_ROUTE = "/stock/[symbol]";
const TICKER_TOKEN_PATTERN = /\$?[A-Za-z]{1,5}(?:\.[A-Za-z])?/g;
const TICKER_VALUE_PATTERN = /^[A-Z]{1,5}(?:\.[A-Z])?$/;
const COMMON_COMMAND_WORDS = new Set([
  "OPEN",
  "SHOW",
  "PRICE",
  "STOCK",
  "QUOTE",
  "NEWS",
  "COMPARE",
  "VS",
  "WITH",
  "AND",
  "FOR",
  "ABOUT",
  "PLEASE",
  "ANALYZE",
  "ANALYSIS",
  "STRATEGY",
  "BACKTEST",
  "ALERT",
  "ALERTS",
  "THE",
  "A",
  "AN",
  "ME",
  "TO"
]);
const KNOWN_TICKERS = new Set(POPULAR_TICKERS);

function isTickerPattern(value: string) {
  return TICKER_VALUE_PATTERN.test(value);
}

export function resolveTickerSymbol(input: string): string | null {
  const source = String(input || "").trim();
  if (!source) return null;

  const direct = normalizeTickerInput(source.replace(/^\$/, ""));
  if (isTickerPattern(direct)) return direct;

  const tokens = source.match(TICKER_TOKEN_PATTERN) || [];
  for (const rawToken of tokens) {
    const explicit = rawToken.startsWith("$");
    const token = normalizeTickerInput(explicit ? rawToken.slice(1) : rawToken);
    if (!isTickerPattern(token)) continue;
    if (!explicit && COMMON_COMMAND_WORDS.has(token) && !KNOWN_TICKERS.has(token)) {
      continue;
    }
    const isUpperInInput = rawToken === rawToken.toUpperCase();
    if (explicit || isUpperInInput || KNOWN_TICKERS.has(token)) {
      return token;
    }
  }

  return null;
}

export async function navigateToTicker(
  router: NextRouter,
  input: string,
  options: { replace?: boolean } = {}
) {
  const symbol = resolveTickerSymbol(input);
  if (!symbol) return false;

  const useShallow = router.pathname === STOCK_ROUTE;
  const target = {
    pathname: STOCK_ROUTE,
    query: { symbol }
  };

  if (options.replace) {
    return router.replace(target, undefined, {
      shallow: useShallow,
      scroll: !useShallow
    });
  }

  return router.push(target, undefined, {
    shallow: useShallow,
    scroll: !useShallow
  });
}
