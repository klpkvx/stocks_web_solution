import { useMemo } from "react";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useI18n } from "@/components/I18nProvider";
import type { HeatmapPayload, HeatmapPeriod, HeatmapTicker } from "@/types/heatmap";

const PERIODS: HeatmapPeriod[] = ["day", "week", "month", "year"];

function formatPercentValue(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatCap(capB: number) {
  if (!Number.isFinite(capB)) return "--";
  if (capB >= 1000) return `$${(capB / 1000).toFixed(2)}T`;
  return `$${capB.toFixed(0)}B`;
}

function tileSpan(capB: number, maxCapB: number) {
  if (!Number.isFinite(capB) || capB <= 0) return 2;
  const normalized = Math.sqrt(capB) / Math.sqrt(Math.max(1, maxCapB));
  return Math.max(2, Math.min(12, Math.round(normalized * 12)));
}

function tileTone(change: number | null) {
  if (change === null || Number.isNaN(change)) {
    return {
      backgroundColor: "rgba(71, 85, 105, 0.18)",
      borderColor: "rgba(148, 163, 184, 0.26)",
      changeClass: "text-muted"
    };
  }

  const intensity = Math.min(1, Math.abs(change) / 12);
  if (change >= 0) {
    return {
      backgroundColor: `rgba(22, 163, 74, ${0.16 + intensity * 0.45})`,
      borderColor: `rgba(22, 163, 74, ${0.30 + intensity * 0.50})`,
      changeClass: "text-neon"
    };
  }

  return {
    backgroundColor: `rgba(239, 68, 68, ${0.16 + intensity * 0.45})`,
    borderColor: `rgba(239, 68, 68, ${0.30 + intensity * 0.50})`,
    changeClass: "text-ember"
  };
}

function groupBySector(tickers: HeatmapTicker[]) {
  const map = new Map<string, HeatmapTicker[]>();
  tickers.forEach((ticker) => {
    const current = map.get(ticker.sector) || [];
    current.push(ticker);
    map.set(ticker.sector, current);
  });
  map.forEach((items, sector) => {
    map.set(
      sector,
      [...items].sort((a, b) => b.marketCapB - a.marketCapB)
    );
  });
  return map;
}

export default function StockHeatmap({
  data,
  period,
  onPeriodChange,
  loading,
  error,
  onOpenTicker
}: {
  data: HeatmapPayload | null;
  period: HeatmapPeriod;
  onPeriodChange: (period: HeatmapPeriod) => void;
  loading: boolean;
  error: string | null;
  onOpenTicker: (symbol: string) => void;
}) {
  const { t } = useI18n();

  const grouped = useMemo(() => groupBySector(data?.tickers || []), [data?.tickers]);
  const maxCap = useMemo(() => {
    const caps = (data?.tickers || []).map((ticker) => ticker.marketCapB);
    return caps.length ? Math.max(...caps) : 1;
  }, [data?.tickers]);

  const sectors = data?.sectors || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((item) => (
            <button
              key={`heatmap-period-${item}`}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                item === period
                  ? "border-glow/40 bg-glow/10 text-ink"
                  : "border-white/10 text-muted hover:border-white/30 hover:text-ink"
              }`}
              onClick={() => onPeriodChange(item)}
            >
              {t(`home.heatmap.period.${item}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {t("home.heatmap.source")} {data?.source || "--"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span>{t("home.heatmap.legendUp")}</span>
        <span>{t("home.heatmap.legendDown")}</span>
        {data?.updatedAt && (
          <span>
            {t("home.heatmap.updated")}{" "}
            {new Date(data.updatedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC"
            })}
            {" UTC"}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          <LoadingDots label={t("home.heatmap.loading")} />
          <LoadingSkeleton className="h-48 w-full rounded-2xl" />
          <LoadingSkeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}
      {error && <p className="text-sm text-ember">{error}</p>}

      {!loading && !error && sectors.length === 0 && (
        <p className="text-sm text-muted">{t("home.heatmap.empty")}</p>
      )}

      {!loading &&
        !error &&
        sectors.map((sector) => {
          const items = grouped.get(sector.sector) || [];
          const sectorChange = sector.changes[period];
          const sectorClass =
            sectorChange === null
              ? "text-muted"
              : sectorChange >= 0
                ? "text-neon"
                : "text-ember";

          return (
            <div key={`sector-${sector.sector}`} className="rounded-2xl border border-white/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{sector.sector}</p>
                  <p className="text-[11px] text-muted">
                    {sector.count} {t("home.heatmap.tickers")} - {formatCap(sector.marketCapB)}
                  </p>
                </div>
                <p className={`text-sm font-semibold ${sectorClass}`}>
                  {formatPercentValue(sectorChange)}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-12 gap-2 auto-rows-[70px]">
                {items.map((ticker) => {
                  const change = ticker.changes[period];
                  const style = tileTone(change);
                  return (
                    <button
                      key={`${sector.sector}-${ticker.symbol}`}
                      type="button"
                      className="relative overflow-hidden rounded-xl border p-2 text-left transition hover:-translate-y-0.5"
                      style={{
                        gridColumn: `span ${tileSpan(ticker.marketCapB, maxCap)} / span ${tileSpan(
                          ticker.marketCapB,
                          maxCap
                        )}`,
                        backgroundColor: style.backgroundColor,
                        borderColor: style.borderColor
                      }}
                      title={`${ticker.symbol} - ${ticker.name}`}
                      onClick={() => onOpenTicker(ticker.symbol)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-ink">{ticker.symbol}</p>
                        <p className={`text-xs font-semibold ${style.changeClass}`}>
                          {formatPercentValue(change)}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[10px] text-muted">{ticker.name}</p>
                      <p className="absolute bottom-1.5 right-2 text-[10px] text-muted">
                        {formatCap(ticker.marketCapB)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
