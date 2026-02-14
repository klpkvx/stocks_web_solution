import { memo, useMemo } from "react";
import { formatDateTime } from "@/lib/format";
import type { NewsCardItem } from "@/components/NewsCard";
import { useI18n } from "@/components/I18nProvider";

function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function fallbackImageUrl(article: NewsCardItem, symbol: string) {
  const seed = hashSeed(`${symbol}:${article.url}:${article.title}`);
  return `https://picsum.photos/seed/${seed}/720/420`;
}

function StoriesFeed({
  articles,
  symbol
}: {
  articles: NewsCardItem[];
  symbol: string;
}) {
  const { t } = useI18n();
  const stories = useMemo(
    () =>
      articles.slice(0, 10).map((article) => ({
        ...article,
        image: article.imageUrl || fallbackImageUrl(article, symbol)
      })),
    [articles, symbol]
  );

  return (
    <div className="relative">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {stories.map((article) => (
          <a
            key={`${symbol}-${article.url}`}
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="group glass min-w-[280px] max-w-[320px] flex-1 snap-start overflow-hidden rounded-2xl border border-white/10 transition hover:-translate-y-0.5 hover:border-white/25"
            title={`${symbol} - ${article.source}`}
          >
            <div className="h-36 w-full overflow-hidden bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image}
                alt={article.title}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span className="truncate">{article.source}</span>
                <span>{formatDateTime(article.publishedAt)}</span>
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-ink">
                {article.title}
              </p>
              <p className="line-clamp-3 text-xs text-muted">
                {article.description || article.content || article.title}
              </p>
              <p className="text-[11px] uppercase tracking-[0.15em] text-neon">
                {t("news.stories.read")}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default memo(StoriesFeed);
