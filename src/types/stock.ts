import type { NewsCardItem } from "@/components/NewsCard";
import type { MarketInsights, Thesis } from "@/lib/insights";
import type { Quote, TimeSeriesPoint } from "@/lib/twelveData";

export type StockAnalytics = {
  aiScore: number;
  superStackScore: number;
  earnings: {
    direction: "bullish" | "bearish" | "neutral";
    probabilityUp: number;
    probabilityDown: number;
    confidence: number;
    rationale: string[];
  };
  components: {
    sentimentScore: number;
    momentumScore: number;
    volatilityScore: number;
    volumeScore: number;
    secSignal: number;
  };
};

export type StockPayload = {
  quote: Quote;
  series: TimeSeriesPoint[];
  news: NewsCardItem[];
  sentiment: {
    score: number;
    label: "bullish" | "bearish" | "neutral";
    confidence: number;
  };
  insights: MarketInsights;
  thesis: Thesis;
  analytics?: StockAnalytics;
  secSummary?: { headline: string; message: string } | null;
  warning?: string | null;
  secWarning?: string | null;
  expiresIn?: number;
};
