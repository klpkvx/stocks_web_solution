import dynamic from "next/dynamic";
import type { Quote } from "@/lib/twelveData";
import WatchlistCard from "@/components/WatchlistCard";
import TickerSearchInput from "@/components/TickerSearchInput";
import StockIcon from "@/components/StockIcon";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";

const TradingViewTickerTape = dynamic(
  () => import("@/components/TradingViewTickerTape"),
  {
    ssr: false,
    loading: () => <LoadingSkeleton className="h-[88px] w-full rounded-2xl" />
  }
);

export default function WatchlistWidget({
  t,
  watchlist,
  quoteMap,
  loading,
  error,
  locale,
  theme,
  hiddenWidgetTickers,
  visibleWidgetTickers,
  streamConnected,
  streamError,
  onToggleTicker,
  onAddTicker,
  onShowAll
}: {
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
  watchlist: string[];
  quoteMap: Map<string, Quote>;
  loading: boolean;
  error: string | null;
  locale: "en" | "ru";
  theme: "dark" | "light";
  hiddenWidgetTickers: string[];
  visibleWidgetTickers: string[];
  streamConnected: boolean;
  streamError: string | null;
  onToggleTicker: (symbol: string) => void;
  onAddTicker: (symbol: string) => void;
  onShowAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-[220px]">
          <TickerSearchInput
            compact
            placeholder={t("search.addTicker")}
            buttonLabel={t("search.go")}
            onSubmit={onAddTicker}
          />
        </div>
        <div className="text-[11px] text-muted">
          {streamConnected ? "Live stream: on" : "Live stream: off"}
          {streamError ? ` (${streamError})` : ""}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            {t("home.tv.title")}
          </p>
          <button
            type="button"
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-muted transition hover:border-white/30 hover:text-ink"
            onClick={onShowAll}
          >
            {t("home.tv.showAll")}
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {watchlist.map((symbol) => {
            const hidden = hiddenWidgetTickers.includes(symbol);
            return (
              <button
                key={`tv-toggle-${symbol}`}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  hidden
                    ? "border-white/10 text-muted hover:border-white/25 hover:text-ink"
                    : "border-glow/40 bg-glow/10 text-ink"
                }`}
                onClick={() => onToggleTicker(symbol)}
                title={
                  hidden
                    ? t("home.tv.showTicker", undefined, { symbol })
                    : t("home.tv.hideTicker", undefined, { symbol })
                }
              >
                {symbol}
              </button>
            );
          })}
        </div>
        {visibleWidgetTickers.length ? (
          <TradingViewTickerTape symbols={visibleWidgetTickers} locale={locale} theme={theme} />
        ) : (
          <p className="text-xs text-muted">{t("home.tv.empty")}</p>
        )}
      </div>

      <div className="grid gap-4">
        {loading && (
          <div className="space-y-3">
            <LoadingDots label={t("home.watchlist.loading")} />
            <LoadingSkeleton className="h-20 w-full rounded-2xl" />
            <LoadingSkeleton className="h-20 w-full rounded-2xl" />
          </div>
        )}
        {error && <p className="text-sm text-ember">{error}</p>}
        {!loading &&
          !error &&
          watchlist.map((symbol) => {
            const quote = quoteMap.get(symbol);
            return quote ? (
              <WatchlistCard key={symbol} quote={quote} />
            ) : (
              <div
                key={symbol}
                title={symbol}
                className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted"
              >
                <StockIcon symbol={symbol} size="sm" />
                {t("home.watchlist.unavailable", undefined, { symbol })}
              </div>
            );
          })}
      </div>
    </div>
  );
}
