import { getNews } from "@/lib/twelveData";
import { analyzeSentiment, summarizeSentiment } from "@/lib/sentiment";
import { cached } from "@/lib/serverStore";

export type NewsPayload = {
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

const REFRESH_MS = (() => {
  const raw = Number(process.env.NEWS_REFRESH_MS || 5 * 60 * 1000);
  if (!Number.isFinite(raw)) return 5 * 60 * 1000;
  return Math.max(60_000, raw);
})();

const STALE_MS = (() => {
  const raw = Number(process.env.NEWS_STALE_MS || 30 * 60 * 1000);
  if (!Number.isFinite(raw)) return 30 * 60 * 1000;
  return Math.max(REFRESH_MS, raw);
})();

const EXPIRES_IN = Math.max(30, Math.floor(REFRESH_MS / 1000));

function queryKey(symbol: string, from?: string, to?: string) {
  return `news:${symbol || "market"}:${from || ""}:${to || ""}`;
}

export async function getCachedNewsPayload(
  symbol: string,
  options: { from?: string; to?: string; forceRefresh?: boolean } = {}
) {
  const upper = String(symbol || "").toUpperCase();
  const key = queryKey(upper, options.from, options.to);
  const baseWarning = process.env.NEWS_API_KEY ? null : "NEWS_API_KEY not set";

  try {
    return await cached(
      key,
      async () => {
        const articles = await getNews(upper, { from: options.from, to: options.to });
        const enriched = articles.map((article) => {
          const text = `${article.title}. ${article.description}`;
          const sentiment = analyzeSentiment(text);
          return {
            ...article,
            sentiment: sentiment.normalized
          };
        });
        const summary = summarizeSentiment(
          enriched.map((article) => article.sentiment)
        );

        return {
          symbol: upper || "market",
          articles: enriched,
          sentiment: summary,
          warning: baseWarning,
          expiresIn: EXPIRES_IN
        } satisfies NewsPayload;
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
  } catch (error: any) {
    return {
      symbol: upper || "market",
      articles: [],
      sentiment: {
        score: 0,
        label: "neutral",
        confidence: 0
      },
      warning:
        baseWarning ||
        error?.message ||
        "News data temporarily unavailable",
      expiresIn: EXPIRES_IN
    } satisfies NewsPayload;
  }
}
