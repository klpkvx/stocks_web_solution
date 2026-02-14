export type CopyTrader = {
  id: string;
  name: string;
  style: string;
  monthlyReturn: number;
  risk: "Low" | "Medium" | "High";
  followers: number;
  topHoldings: string[];
  narrative: string;
};

export const COPY_TRADERS: CopyTrader[] = [
  {
    id: "zen-quant",
    name: "Zen Quant",
    style: "Low-volatility factor tilt",
    monthlyReturn: 0.028,
    risk: "Low",
    followers: 1834,
    topHoldings: ["MSFT", "COST", "BRK.B"],
    narrative: "Disciplined rotation with low drawdowns."
  },
  {
    id: "momentum-surge",
    name: "Momentum Surge",
    style: "Trend following on mega-cap tech",
    monthlyReturn: 0.064,
    risk: "Medium",
    followers: 3210,
    topHoldings: ["NVDA", "AAPL", "AMZN"],
    narrative: "Captures breakouts and rides the trend."
  },
  {
    id: "macro-scout",
    name: "Macro Scout",
    style: "Macro + sector rotation",
    monthlyReturn: 0.042,
    risk: "Medium",
    followers: 2194,
    topHoldings: ["XLE", "JPM", "UNH"],
    narrative: "Shifts exposure with rates and growth signals."
  },
  {
    id: "vol-strike",
    name: "Vol Strike",
    style: "Aggressive catalysts + earnings",
    monthlyReturn: 0.088,
    risk: "High",
    followers: 890,
    topHoldings: ["TSLA", "META", "AMD"],
    narrative: "High-risk, high-reward tactical swings."
  }
];

export const REPLACEMENT_MAP: Record<string, string> = {
  AAPL: "MSFT",
  MSFT: "AAPL",
  NVDA: "AMD",
  AMD: "NVDA",
  GOOGL: "META",
  META: "GOOGL",
  AMZN: "COST",
  TSLA: "GM",
  JPM: "BAC",
  XOM: "CVX"
};

export function replacementFor(symbol: string) {
  return REPLACEMENT_MAP[symbol.toUpperCase()] || "SPY";
}

export function computeCashDrag(cash: number, annualInflation = 0.03) {
  const monthlyInflation = annualInflation / 12;
  const lostToInflation = cash * monthlyInflation;
  const benchmarkMonthly = 0.0075;
  const missedBenchmark = cash * benchmarkMonthly;
  return {
    lostToInflation,
    missedBenchmark,
    benchmarkMonthly
  };
}

export function confidenceLabel(value: number) {
  if (value >= 5) return "High";
  if (value >= 2) return "Moderate";
  return "Low";
}
