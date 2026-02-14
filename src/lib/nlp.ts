export type CommandAction =
  | { type: "open"; symbols: string[] }
  | { type: "compare"; symbols: string[] }
  | { type: "news"; symbols: string[] }
  | { type: "strategy"; symbols: string[] }
  | { type: "alerts"; symbols: string[] }
  | { type: "search"; query: string };

const tickerPattern = /\b[A-Z]{1,5}(?:\.[A-Z])?\b/g;

function extractSymbols(input: string) {
  return Array.from(new Set(input.match(tickerPattern) || [])).map((symbol) =>
    symbol.toUpperCase()
  );
}

export function parseCommand(input: string): CommandAction {
  const normalized = input.trim();
  const upper = normalized.toUpperCase();
  const symbols = extractSymbols(upper);

  if (upper.includes("COMPARE") || upper.includes("VS")) {
    return { type: "compare", symbols: symbols.slice(0, 4) };
  }

  if (upper.includes("NEWS")) {
    return { type: "news", symbols: symbols.slice(0, 1) };
  }

  if (upper.includes("STRATEGY") || upper.includes("BACKTEST")) {
    return { type: "strategy", symbols: symbols.slice(0, 1) };
  }

  if (upper.includes("ALERT")) {
    return { type: "alerts", symbols: symbols.slice(0, 1) };
  }

  if (symbols.length === 1) {
    return { type: "open", symbols };
  }

  return { type: "search", query: normalized };
}
