import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import StockIcon from "@/components/StockIcon";
import TickerSearchInput from "@/components/TickerSearchInput";
import { normalizeTickerInput } from "@/lib/tickers";
import { fetchJson } from "@/lib/apiClient";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";

type SecWhisperPayload = {
  symbol: string;
  filings: Array<{
    form?: string;
    filingDate?: string;
    accessionNumber?: string;
    description?: string;
  }>;
  summary: {
    headline: string;
    message: string;
  };
  expiresIn?: number;
};

export default function SecWhisper() {
  const { t } = useI18n();
  const [symbol, setSymbol] = useState("AAPL");

  const whisperQuery = useCachedApiQuery<SecWhisperPayload>({
    queryKey: ["sec-whisper", symbol],
    enabled: Boolean(symbol),
    fallbackTtlMs: 30 * 60 * 1000,
    gcTimeMs: 6 * 60 * 60 * 1000,
    fetcher: () =>
      fetchJson<SecWhisperPayload>(`/api/sec?symbol=${encodeURIComponent(symbol)}`, 8000)
  });

  useEffect(() => {
    if (!symbol) return;
    void whisperQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass rounded-3xl px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{t("sec.title")}</h3>
          <p className="mt-2 text-sm text-muted">{t("sec.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div title={symbol}>
            <StockIcon symbol={symbol} size="sm" />
          </div>
          <div className="w-[200px]">
            <TickerSearchInput
              compact
              placeholder={t("sec.symbolPlaceholder")}
              buttonLabel={t("sec.pick")}
              onSubmit={(ticker) => setSymbol(normalizeTickerInput(ticker))}
            />
          </div>
          <button
            className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
            onClick={() => whisperQuery.refetch()}
          >
            {t("sec.whisper")}
          </button>
        </div>
      </div>

      {whisperQuery.isLoading && (
        <p className="mt-4 text-sm text-muted">{t("sec.loading")}</p>
      )}
      {whisperQuery.error && (
        <p className="mt-4 text-sm text-ember">
          {whisperQuery.error.message || t("sec.error.load")}
        </p>
      )}
      {whisperQuery.data && (
        <div className="mt-4 rounded-2xl border border-white/10 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            {whisperQuery.data.summary.headline}
          </p>
          <p className="mt-2 text-sm text-ink">{whisperQuery.data.summary.message}</p>
          <p className="mt-3 text-xs text-muted">{t("sec.source")}</p>
        </div>
      )}
    </div>
  );
}

