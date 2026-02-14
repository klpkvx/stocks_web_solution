import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import DebateArena from "@/components/DebateArena";
import SensoryPanel from "@/components/SensoryPanel";
import TimeMachine from "@/components/TimeMachine";
import SecWhisper from "@/components/SecWhisper";
import StockIcon from "@/components/StockIcon";
import { useStoredState } from "@/lib/useStoredState";
import { useQuotes } from "@/lib/useQuotes";
import { useVisibility } from "@/lib/useVisibility";
import { useStockQuery } from "@/lib/queries/useStockQuery";

const CityBuilder = dynamic(() => import("@/components/CityBuilder"), {
  ssr: false
});
const MarketMap = dynamic(() => import("@/components/MarketMap"), {
  ssr: false
});

const FALLBACK_WATCHLIST = ["AAPL", "MSFT", "NVDA"];

export default function ExperiencePage() {
  const { t } = useI18n();
  const [watchlist] = useStoredState<string[]>("watchlist", ["AAPL", "MSFT"]);
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const isVisible = useVisibility();

  const effectiveWatchlist = watchlist.length ? watchlist : FALLBACK_WATCHLIST;
  const symbolList = useMemo(
    () => [...effectiveWatchlist].sort(),
    [effectiveWatchlist]
  );

  useEffect(() => {
    if (
      effectiveWatchlist.length &&
      !effectiveWatchlist.includes(selectedSymbol)
    ) {
      setSelectedSymbol(effectiveWatchlist[0]);
    }
  }, [effectiveWatchlist, selectedSymbol]);

  const { quotes, error: quotesError } = useQuotes(symbolList, {
    enabled: isVisible
  });

  const stockQuery = useStockQuery({
    symbol: selectedSymbol,
    enabled: Boolean(selectedSymbol) && isVisible,
    refetchIntervalMs: isVisible ? 90 * 1000 : false
  });

  const stockData = stockQuery.data || null;
  const stockError = stockQuery.error?.message || null;

  const sentimentScore = stockData?.sentiment?.score ?? 0;
  const volatility = stockData?.insights?.volatility ?? 0.2;

  return (
    <Layout>
      <div className="space-y-10">
        <section className="glass rounded-3xl px-8 py-8">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            {t("experience.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">
            {t("experience.title")}
          </h2>
          <p className="mt-3 text-sm text-muted">
            {t("experience.subtitle")}
          </p>
          {!watchlist.length && (
            <p className="mt-3 text-xs text-muted">
              {t("experience.watchlistFallback")}
            </p>
          )}
          {quotesError && (
            <p className="mt-3 text-xs text-ember">{quotesError}</p>
          )}
          {stockError && (
            <p className="mt-3 text-xs text-ember">{stockError}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted">{t("experience.focusSymbol")}</label>
            <div
              className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-muted"
              title={selectedSymbol}
            >
              <StockIcon symbol={selectedSymbol} size="sm" />
              {selectedSymbol}
            </div>
            <select
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink"
              value={selectedSymbol}
              onChange={(event) => setSelectedSymbol(event.target.value)}
            >
              {effectiveWatchlist.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>
        </section>

        <DebateArena
          symbol={selectedSymbol}
          quote={stockData?.quote}
          sentimentScore={sentimentScore}
          insights={stockData?.insights}
        />

        <SensoryPanel sentiment={sentimentScore} volatility={volatility} />

        <CityBuilder quotes={quotes} />

        <MarketMap quotes={quotes} />

        <TimeMachine />

        <SecWhisper />
      </div>
    </Layout>
  );
}
