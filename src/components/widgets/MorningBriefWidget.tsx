import type { Quote } from "@/lib/twelveData";
import type { DashboardNews } from "@/types/dashboard";
import { formatPercent } from "@/lib/format";

function topMover(quotes: Quote[], dir: "up" | "down") {
  const filtered = quotes.filter((quote) => quote.percentChange !== null);
  if (!filtered.length) return null;
  const sorted = [...filtered].sort((a, b) =>
    dir === "up"
      ? (b.percentChange || 0) - (a.percentChange || 0)
      : (a.percentChange || 0) - (b.percentChange || 0)
  );
  return sorted[0] || null;
}

export default function MorningBriefWidget({
  t,
  watchlist,
  quotes,
  news
}: {
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
  watchlist: string[];
  quotes: Quote[];
  news: DashboardNews | null;
}) {
  const up = topMover(quotes, "up");
  const down = topMover(quotes, "down");
  const topHeadline = news?.articles?.[0];

  return (
    <div className="space-y-3 text-sm text-muted">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">
        Morning Brief
      </p>
      <p>
        Tracking {watchlist.length} symbols.{" "}
        {up ? `${up.symbol} leads at ${formatPercent(up.percentChange)}.` : "No top gainer yet."}
      </p>
      <p>
        {down
          ? `${down.symbol} is weakest at ${formatPercent(down.percentChange)}.`
          : "No top loser yet."}
      </p>
      <p>
        {news?.sentiment
          ? `Market tone: ${news.sentiment.label} (${news.sentiment.score.toFixed(2)}).`
          : "Sentiment feed unavailable."}
      </p>
      {topHeadline && (
        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-xs text-muted">Top headline</p>
          <p className="mt-1 text-ink">{topHeadline.title}</p>
        </div>
      )}
      {!topHeadline && <p>{t("home.news.empty", "No major headlines right now.")}</p>}
    </div>
  );
}
