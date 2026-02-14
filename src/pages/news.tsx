import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import ModuleCard from "@/components/ModuleCard";
import NewsCard from "@/components/NewsCard";
import StoriesFeed from "@/components/StoriesFeed";
import SentimentBadge from "@/components/SentimentBadge";
import type { NewsCardItem } from "@/components/NewsCard";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useStoredState } from "@/lib/useStoredState";
import { fetchJson } from "@/lib/apiClient";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";

type NewsResponse = {
  symbol: string;
  articles: NewsCardItem[];
  sentiment: {
    label: "bullish" | "bearish" | "neutral";
    score: number;
    confidence: number;
  } | null;
  warning: string | null;
  expiresIn?: number;
};

const NEWS_TTL_MS = 5 * 60 * 1000;

export default function NewsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const symbol = router.query.symbol
    ? String(router.query.symbol).toUpperCase()
    : "";
  const [watchlist] = useStoredState<string[]>("watchlist", [
    "AAPL",
    "MSFT",
    "GOOGL"
  ]);
  const storyTickers = useMemo(() => {
    const base = symbol ? [symbol, ...watchlist] : [...watchlist];
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const item of base) {
      const clean = String(item || "").trim().toUpperCase();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      deduped.push(clean);
      if (deduped.length >= 8) break;
    }
    return deduped;
  }, [symbol, watchlist]);
  const [storySymbol, setStorySymbol] = useState(symbol || watchlist[0] || "AAPL");

  useEffect(() => {
    if (symbol && storyTickers.includes(symbol) && symbol !== storySymbol) {
      setStorySymbol(symbol);
      return;
    }
    if (!storyTickers.length) return;
    if (!storySymbol || !storyTickers.includes(storySymbol)) {
      setStorySymbol(storyTickers[0]);
    }
  }, [symbol, storyTickers, storySymbol]);

  const mainNewsQuery = useCachedApiQuery<NewsResponse>({
    queryKey: ["news", symbol || "market"],
    enabled: true,
    fallbackTtlMs: NEWS_TTL_MS,
    gcTimeMs: 20 * 60 * 1000,
    fetcher: () =>
      fetchJson<NewsResponse>(symbol ? `/api/news?symbol=${symbol}` : "/api/news", 9000)
  });

  const storyNewsQuery = useCachedApiQuery<NewsResponse>({
    queryKey: ["news", "stories", storySymbol],
    enabled: Boolean(storySymbol) && storySymbol !== symbol,
    fallbackTtlMs: NEWS_TTL_MS,
    gcTimeMs: 20 * 60 * 1000,
    fetcher: () =>
      fetchJson<NewsResponse>(`/api/news?symbol=${encodeURIComponent(storySymbol)}`, 9000)
  });

  const articles = mainNewsQuery.data?.articles || [];
  const sentiment = mainNewsQuery.data?.sentiment || null;
  const warning = mainNewsQuery.data?.warning || null;
  const loading = mainNewsQuery.isLoading;
  const error = mainNewsQuery.error?.message || null;

  const storyArticles =
    storySymbol === symbol
      ? articles.slice(0, 10)
      : (storyNewsQuery.data?.articles || []).slice(0, 10);
  const storyLoading =
    storySymbol === symbol ? false : storyNewsQuery.isLoading;
  const storyError =
    storySymbol === symbol ? null : storyNewsQuery.error?.message || null;

  return (
    <Layout>
      <section className="glass rounded-3xl px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              {t("news.feed")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-ink">
              {symbol ? `${symbol} ${t("news.headlines")}` : t("news.marketHeadlines")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("news.subtitle")}</p>
          </div>
          {sentiment && (
            <SentimentBadge label={sentiment.label} score={sentiment.score} />
          )}
        </div>
      </section>

      <section className="mt-6">
        <ModuleCard
          title={t("news.stories.title")}
          subtitle={t("news.stories.subtitle")}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {storyTickers.map((ticker) => {
              const active = ticker === storySymbol;
              return (
                <button
                  key={`story-${ticker}`}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-glow/40 bg-glow/10 text-ink"
                      : "border-white/10 text-muted hover:border-white/30 hover:text-ink"
                  }`}
                  onClick={() => setStorySymbol(ticker)}
                >
                  {ticker}
                </button>
              );
            })}
          </div>

          {storyLoading && (
            <div className="space-y-3">
              <LoadingDots label={t("news.stories.loading")} />
              <LoadingSkeleton className="h-56 w-full rounded-2xl" />
            </div>
          )}
          {storyError && <p className="text-sm text-ember">{storyError}</p>}
          {!storyLoading && !storyError && storyArticles.length > 0 && (
            <StoriesFeed articles={storyArticles} symbol={storySymbol} />
          )}
          {!storyLoading && !storyError && storyArticles.length === 0 && (
            <p className="text-sm text-muted">{t("news.stories.empty")}</p>
          )}
        </ModuleCard>
      </section>

      <section className="mt-8 space-y-6">
        {warning && (
          <div className="glass rounded-2xl px-5 py-4 text-sm text-ember">
            {warning}
          </div>
        )}
        {loading && (
          <div className="space-y-3">
            <LoadingDots label={t("news.loading")} />
            <LoadingSkeleton className="h-28 w-full rounded-2xl" />
            <LoadingSkeleton className="h-28 w-full rounded-2xl" />
          </div>
        )}
        {error && <p className="text-sm text-ember">{error}</p>}
        {!loading && !error && articles.length === 0 && (
          <div className="glass rounded-2xl px-6 py-6 text-sm text-muted">
            {t("news.empty")}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <NewsCard key={article.url} article={article} />
          ))}
        </div>
      </section>
    </Layout>
  );
}

