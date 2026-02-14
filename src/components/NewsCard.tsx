import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";

export type NewsCardItem = {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: number;
  imageUrl?: string;
  content?: string;
};

export default function NewsCard({ article }: { article: NewsCardItem }) {
  const { t } = useI18n();
  const sentimentType =
    article.sentiment > 0.2
      ? "bullish"
      : article.sentiment < -0.2
        ? "bearish"
        : "neutral";
  const sentimentLabel =
    sentimentType === "bullish"
      ? t("sentiment.bullish")
      : sentimentType === "bearish"
        ? t("sentiment.bearish")
        : t("sentiment.neutral");

  const sentimentColor =
    sentimentType === "bullish"
      ? "text-neon"
      : sentimentType === "bearish"
        ? "text-ember"
        : "text-muted";

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="glass group block rounded-2xl p-5 transition hover:-translate-y-1 hover:border-white/20"
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{article.source}</span>
        <span>{formatDateTime(article.publishedAt)}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink transition group-hover:text-white">
        {article.title}
      </h3>
      <p className="mt-2 text-sm text-muted">
        {article.description}
      </p>
      <p className={`mt-4 text-xs font-semibold ${sentimentColor}`}>
        {t("news.sentimentLabel", undefined, {
          label: sentimentLabel,
          score: article.sentiment.toFixed(2)
        })}
      </p>
    </a>
  );
}
