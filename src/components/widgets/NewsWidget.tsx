import SentimentBadge from "@/components/SentimentBadge";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";
import type { DashboardNews } from "@/types/dashboard";

export default function NewsWidget({
  t,
  news,
  loading
}: {
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
  news: DashboardNews | null;
  loading: boolean;
}) {
  return (
    <>
      {loading && (
        <div className="space-y-3">
          <LoadingDots label={t("home.news.loading")} />
          <LoadingSkeleton className="h-14 w-full rounded-2xl" />
          <LoadingSkeleton className="h-14 w-full rounded-2xl" />
          <LoadingSkeleton className="h-14 w-full rounded-2xl" />
        </div>
      )}
      {!loading && news?.sentiment && (
        <div className="mb-4">
          <SentimentBadge label={news.sentiment.label} score={news.sentiment.score} />
        </div>
      )}
      <div className="space-y-3 text-sm text-muted">
        {news?.articles?.slice(0, 3).map((article: any) => (
          <div key={article.url} className="rounded-2xl border border-white/10 px-4 py-3">
            <p className="text-sm text-ink">{article.title}</p>
            <p className="mt-1 text-xs text-muted">{article.source}</p>
          </div>
        ))}
      </div>
    </>
  );
}
