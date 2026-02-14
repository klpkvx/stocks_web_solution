import type { MarketInsights } from "@/lib/insights";
import type { Quote } from "@/lib/twelveData";

export type EarningsPrediction = {
  direction: "bullish" | "bearish" | "neutral";
  probabilityUp: number;
  probabilityDown: number;
  confidence: number;
  rationale: string[];
};

export type AnalyticsBundle = {
  aiScore: number;
  superStackScore: number;
  earnings: EarningsPrediction;
  components: {
    sentimentScore: number;
    momentumScore: number;
    volatilityScore: number;
    volumeScore: number;
    secSignal: number;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scoreFromSentiment(sentimentScore: number) {
  const normalized = clamp((sentimentScore + 1) / 2, 0, 1);
  return normalized * 100;
}

function scoreFromMomentum(momentum: number) {
  const scaled = clamp(0.5 + momentum * 2.5, 0, 1);
  return scaled * 100;
}

function scoreFromVolatility(volatility: number) {
  const scaled = clamp(1 - volatility / 0.8, 0, 1);
  return scaled * 100;
}

function scoreFromVolume(volumeSpike: number | null) {
  if (!volumeSpike) return 50;
  const scaled = clamp(0.4 + (volumeSpike - 1) * 0.3, 0, 1);
  return scaled * 100;
}

function scoreFromSec(headline?: string | null) {
  if (!headline) return 40;
  const text = headline.toLowerCase();
  if (text.includes("insider")) return 70;
  if (text.includes("annual")) return 60;
  if (text.includes("quarter")) return 55;
  if (text.includes("event")) return 50;
  return 45;
}

function proxyAiScore(
  sentimentScore: number,
  insights: MarketInsights,
  quote?: Quote
) {
  const pct = quote?.percentChange ?? 0;
  const dailyBoost = clamp(pct / 5, -1, 1) * 0.6;
  const raw =
    5 +
    sentimentScore * 2.2 +
    insights.momentum * 7 +
    dailyBoost +
    (insights.volumeSpike ? (insights.volumeSpike - 1) * 0.8 : 0) -
    insights.volatility * 1.2;
  return clamp(Math.round(raw * 10) / 10, 1, 10);
}

export function buildAnalytics(
  sentimentScore: number,
  insights: MarketInsights,
  quote?: Quote,
  secHeadline?: string | null
): AnalyticsBundle {
  const aiScore = proxyAiScore(sentimentScore, insights, quote);

  const sentimentScore100 = scoreFromSentiment(sentimentScore);
  const momentumScore100 = scoreFromMomentum(insights.momentum);
  const volatilityScore100 = scoreFromVolatility(insights.volatility);
  const volumeScore100 = scoreFromVolume(insights.volumeSpike);
  const secSignal = scoreFromSec(secHeadline);

  const superStackScore = Math.round(
      aiScore * 10 * 0.4 +
      sentimentScore100 * 0.2 +
      momentumScore100 * 0.2 +
      volumeScore100 * 0.1 +
      secSignal * 0.1
  );

  const base =
    0.5 +
    (aiScore - 5) * 0.03 +
    sentimentScore * 0.12 +
    insights.momentum * 0.35 -
    insights.volatility * 0.08;
  const probabilityUp = clamp(base, 0.1, 0.9);
  const probabilityDown = clamp(1 - probabilityUp, 0.1, 0.9);
  const confidence = clamp(Math.abs(probabilityUp - 0.5) * 2, 0, 1);
  const direction =
    probabilityUp > 0.56 ? "bullish" : probabilityUp < 0.44 ? "bearish" : "neutral";

  const earnings: EarningsPrediction = {
    direction,
    probabilityUp,
    probabilityDown,
    confidence,
    rationale: [
      "AI score blends sentiment, momentum, and volatility.",
      insights.momentum > 0
        ? "Momentum is positive over the last 20 sessions."
        : "Momentum is soft or negative over the last 20 sessions.",
      sentimentScore > 0.2
        ? "News sentiment is supportive."
        : sentimentScore < -0.2
          ? "News sentiment is negative."
          : "News sentiment is mixed."
    ]
  };

  return {
    aiScore,
    superStackScore: clamp(superStackScore, 0, 100),
    earnings,
    components: {
      sentimentScore: sentimentScore100,
      momentumScore: momentumScore100,
      volatilityScore: volatilityScore100,
      volumeScore: volumeScore100,
      secSignal
    }
  };
}
