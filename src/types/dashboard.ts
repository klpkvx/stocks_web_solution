import type { Quote } from "@/lib/twelveData";
import type { HeatmapPayload } from "@/types/heatmap";

export type DashboardNews = {
  symbol: string;
  articles: Array<{
    title: string;
    description: string;
    url: string;
    source: string;
    publishedAt: string;
    sentiment: number;
    imageUrl?: string;
    content?: string;
  }>;
  sentiment: {
    score: number;
    label: "bullish" | "bearish" | "neutral";
    confidence: number;
  };
  warning: string | null;
  expiresIn: number;
};

export type DashboardPayload = {
  quotes: Quote[];
  news: DashboardNews | null;
  heatmap: (HeatmapPayload & { expiresIn?: number }) | null;
  warnings?: string[];
  expiresIn?: number;
  updatedAt?: string;
};

