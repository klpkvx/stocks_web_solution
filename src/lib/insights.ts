import type { Quote, TimeSeriesPoint } from "@/lib/twelveData";

export type MarketInsights = {
  trend: number;
  momentum: number;
  volatility: number;
  volumeSpike: number | null;
  anomaly: boolean;
  support: number | null;
  resistance: number | null;
};

export type Thesis = {
  summary: string;
  bullCase: string[];
  bearCase: string[];
  risks: string[];
  catalysts: string[];
};

function average(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance =
    values.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function linearRegressionSlope(values: number[]) {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = average(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((y, i) => {
    numerator += (i - xMean) * (y - yMean);
    denominator += (i - xMean) ** 2;
  });
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeInsights(
  series: TimeSeriesPoint[],
  quote?: Quote
): MarketInsights {
  if (!series.length) {
    return {
      trend: 0,
      momentum: 0,
      volatility: 0,
      volumeSpike: null,
      anomaly: false,
      support: null,
      resistance: null
    };
  }

  const closes = series.map((point) => point.close);
  const volumes = series.map((point) => point.volume || 0);
  const latestClose = closes[closes.length - 1];
  const previousClose = closes[closes.length - 2] || latestClose;

  const window = closes.slice(-20);
  const windowVolumes = volumes.slice(-20);

  const returns: number[] = [];
  for (let i = 1; i < window.length; i += 1) {
    const base = window[i - 1];
    returns.push(base ? (window[i] - base) / base : 0);
  }

  const volatility = stdDev(returns) * Math.sqrt(252);
  const momentum = window.length > 1 ? (latestClose - window[0]) / window[0] : 0;
  const trend = linearRegressionSlope(window) / (window[0] || 1);

  const avgVolume = windowVolumes.length ? average(windowVolumes) : 0;
  const volumeSpike = avgVolume ? windowVolumes[windowVolumes.length - 1] / avgVolume : null;

  const latestReturn = previousClose ? (latestClose - previousClose) / previousClose : 0;
  const anomaly = Math.abs(latestReturn) > stdDev(returns) * 2;

  const support = Math.min(...window);
  const resistance = Math.max(...window);

  return {
    trend,
    momentum,
    volatility,
    volumeSpike,
    anomaly,
    support,
    resistance
  };
}

export function buildThesis(
  symbol: string,
  quote: Quote,
  sentimentScore: number,
  insights: MarketInsights
): Thesis {
  const summaryTone =
    sentimentScore > 0.2 && insights.trend > 0
      ? "bullish"
      : sentimentScore < -0.2 && insights.trend < 0
        ? "bearish"
        : "neutral";

  const summary =
    summaryTone === "bullish"
      ? `${symbol} shows constructive momentum with positive sentiment.`
      : summaryTone === "bearish"
        ? `${symbol} is under pressure with weakening momentum and sentiment.`
        : `${symbol} is trading in a mixed regime with neutral signals.`;

  const bullCase = [
    insights.momentum > 0
      ? "Recent price action is trending higher over the last 20 sessions."
      : "Momentum is stabilizing after recent volatility.",
    sentimentScore > 0.2
      ? "News sentiment skewed positive, indicating supportive catalysts."
      : "Sentiment is not yet a strong tailwind.",
    insights.volumeSpike && insights.volumeSpike > 1.3
      ? "Volume acceleration suggests renewed participation."
      : "Volume profile remains healthy and steady."
  ];

  const bearCase = [
    insights.volatility > 0.4
      ? "Volatility is elevated, increasing downside risk."
      : "Volatility is contained, but a breakout could amplify moves.",
    sentimentScore < -0.2
      ? "Negative headlines are weighing on short-term outlook."
      : "Headline sentiment does not provide a clear bullish edge.",
    insights.anomaly ? "Recent price move shows anomaly risk." : "Price action remains orderly."
  ];

  const risks = [
    "Macro policy surprises or earnings misses could reverse the trend.",
    "Liquidity shifts may amplify intraday swings.",
    "Sector rotation can pressure near-term performance."
  ];

  const catalysts = [
    "Upcoming earnings or guidance updates.",
    "Sector momentum shifts driven by rates or macro data.",
    "Analyst upgrades or institutional flows."
  ];

  return { summary, bullCase, bearCase, risks, catalysts };
}
