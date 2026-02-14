import { useEffect, useMemo, useState } from "react";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";
import { useI18n } from "@/components/I18nProvider";
import {
  buildHeatmapViewModel,
  type HeatmapSortMode,
  type HeatmapTickerView
} from "@/lib/heatmapInsights";
import type { HeatmapPayload, HeatmapPeriod } from "@/types/heatmap";

const PERIODS: HeatmapPeriod[] = ["day", "week", "month", "year"];
const ALL_SECTOR = "__all__";

const SORT_OPTIONS: Array<{ id: HeatmapSortMode; label: string }> = [
  { id: "cap", label: "Market Cap" },
  { id: "change_desc", label: "Top Gainers" },
  { id: "change_asc", label: "Top Losers" }
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatPercentValue(value: number | null) {
  if (!isFiniteNumber(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatCap(capB: number) {
  if (!isFiniteNumber(capB)) return "--";
  if (capB >= 1000) return `$${(capB / 1000).toFixed(2)}T`;
  return `$${capB.toFixed(0)}B`;
}

function formatRatio(value: number) {
  if (!isFiniteNumber(value)) return "--";
  return `${value.toFixed(2)}x`;
}

function formatDispersion(value: number | null) {
  if (!isFiniteNumber(value)) return "--";
  return value.toFixed(2);
}

function tileSpan(capB: number, maxCapB: number) {
  if (!isFiniteNumber(capB) || capB <= 0) return 2;
  const normalized = Math.log1p(capB) / Math.log1p(Math.max(1, maxCapB));
  return clamp(Math.round(normalized * 12), 2, 12);
}

function toneForChange(change: number | null, intensity: number) {
  if (!isFiniteNumber(change)) {
    return {
      backgroundColor: "rgba(71, 85, 105, 0.14)",
      borderColor: "rgba(148, 163, 184, 0.22)",
      toneClass: "text-muted"
    };
  }

  const alpha = 0.14 + clamp(intensity, 0, 1) * 0.55;
  if (change >= 0) {
    return {
      backgroundColor: `rgba(22, 163, 74, ${alpha})`,
      borderColor: `rgba(22, 163, 74, ${0.30 + intensity * 0.4})`,
      toneClass: "text-neon"
    };
  }

  return {
    backgroundColor: `rgba(239, 68, 68, ${alpha})`,
    borderColor: `rgba(239, 68, 68, ${0.30 + intensity * 0.4})`,
    toneClass: "text-ember"
  };
}

function sectorToneClass(value: number | null) {
  if (!isFiniteNumber(value)) return "text-muted";
  return value >= 0 ? "text-neon" : "text-ember";
}

function leaderRow(
  ticker: HeatmapTickerView,
  onOpenTicker: (symbol: string) => void
) {
  const tone = sectorToneClass(ticker.change);

  return (
    <button
      key={`leader-${ticker.symbol}`}
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-left transition hover:border-white/30"
      onClick={() => onOpenTicker(ticker.symbol)}
      title={`${ticker.symbol} - ${ticker.name}`}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-ink">{ticker.symbol}</p>
        <p className="truncate text-[11px] text-muted">{ticker.sector}</p>
      </div>
      <p className={`text-xs font-semibold ${tone}`}>{formatPercentValue(ticker.change)}</p>
    </button>
  );
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
  const [sortMode, setSortMode] = useState<HeatmapSortMode>("cap");
  const [sectorFilter, setSectorFilter] = useState<string>(ALL_SECTOR);

  const view = useMemo(
    () => buildHeatmapViewModel(data, period, sortMode),
    [data, period, sortMode]
  );

  useEffect(() => {
    if (sectorFilter === ALL_SECTOR) return;
    const exists = view.sectors.some((sector) => sector.sector === sectorFilter);
    if (!exists) {
      setSectorFilter(ALL_SECTOR);
    }
  }, [sectorFilter, view.sectors]);

  const visibleSectors = useMemo(() => {
    if (sectorFilter === ALL_SECTOR) return view.sectors;
    return view.sectors.filter((sector) => sector.sector === sectorFilter);
  }, [sectorFilter, view.sectors]);

  const maxCap = useMemo(() => {
    const values = visibleSectors.flatMap((sector) =>
      sector.tickers.map((ticker) => ticker.marketCapB)
    );
    return values.length ? Math.max(...values) : 1;
  }, [visibleSectors]);

  return (
    <div className="space-y-5">
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
              {t(`home.heatmap.period.${item}`, item)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {t("home.heatmap.source", "Source:")} {data?.source || "--"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SORT_OPTIONS.map((option) => (
          <button
            key={`heatmap-sort-${option.id}`}
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              option.id === sortMode
                ? "border-white/40 bg-white/10 text-ink"
                : "border-white/10 text-muted hover:border-white/30 hover:text-ink"
            }`}
            onClick={() => setSortMode(option.id)}
          >
            {t(`home.heatmap.sort.${option.id}`, option.label)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {t("home.heatmap.metric.weighted", "Cap Weighted Move")}
          </p>
          <p className={`mt-2 text-base font-semibold ${sectorToneClass(view.market.weightedChange)}`}>
            {formatPercentValue(view.market.weightedChange)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {t("home.heatmap.metric.breadth", "Breadth (A/D)")}
          </p>
          <p className="mt-2 text-base font-semibold text-ink">
            {view.market.breadth.advancers}/{view.market.breadth.decliners}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {t("home.heatmap.metric.ratio", "Ratio")} {formatRatio(view.market.breadthRatio)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {t("home.heatmap.metric.median", "Median Move")}
          </p>
          <p className={`mt-2 text-base font-semibold ${sectorToneClass(view.market.medianChange)}`}>
            {formatPercentValue(view.market.medianChange)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
            {t("home.heatmap.metric.dispersion", "Dispersion")}
          </p>
          <p className="mt-2 text-base font-semibold text-ink">
            {formatDispersion(view.market.dispersion)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {t("home.heatmap.metric.sigma", "Cross-sectional stdev")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1 text-[11px] transition ${
            sectorFilter === ALL_SECTOR
              ? "border-glow/40 bg-glow/10 text-ink"
              : "border-white/10 text-muted hover:border-white/30 hover:text-ink"
          }`}
          onClick={() => setSectorFilter(ALL_SECTOR)}
        >
          {t("home.heatmap.sector.all", "All Sectors")}
        </button>
        {view.sectors.map((sector) => (
          <button
            key={`sector-filter-${sector.sector}`}
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              sectorFilter === sector.sector
                ? "border-glow/40 bg-glow/10 text-ink"
                : "border-white/10 text-muted hover:border-white/30 hover:text-ink"
            }`}
            onClick={() => setSectorFilter(sector.sector)}
          >
            {sector.sector} ({sector.count})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span>
          {t("home.heatmap.legend.scale", "Color scale")} +/-{view.colorDomain.toFixed(1)}%
        </span>
        <span>{t("home.heatmap.legendUp", "Green = gain")}</span>
        <span>{t("home.heatmap.legendDown", "Red = loss")}</span>
        {data?.updatedAt && (
          <span>
            {t("home.heatmap.updated", "Updated")}{" "}
            {new Date(data.updatedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC"
            })}{" "}
            UTC
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          <LoadingDots label={t("home.heatmap.loading", "Loading heatmap")} />
          <LoadingSkeleton className="h-48 w-full rounded-2xl" />
          <LoadingSkeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}
      {error && <p className="text-sm text-ember">{error}</p>}

      {!loading && !error && visibleSectors.length === 0 && (
        <p className="text-sm text-muted">{t("home.heatmap.empty", "No heatmap data")}</p>
      )}

      {!loading && !error && visibleSectors.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[1.45fr,0.55fr]">
          <div className="space-y-4">
            {visibleSectors.map((sector) => {
              const sectorClass = sectorToneClass(sector.change);
              const breadthTotal =
                sector.breadth.advancers +
                sector.breadth.decliners +
                sector.breadth.flat;
              const advancerPct =
                breadthTotal > 0
                  ? (sector.breadth.advancers / breadthTotal) * 100
                  : 0;
              const declinerPct =
                breadthTotal > 0
                  ? (sector.breadth.decliners / breadthTotal) * 100
                  : 0;

              return (
                <div
                  key={`sector-${sector.sector}`}
                  className="rounded-2xl border border-white/10 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{sector.sector}</p>
                      <p className="text-[11px] text-muted">
                        {sector.count} {t("home.heatmap.tickers", "tickers")} -{" "}
                        {formatCap(sector.marketCapB)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${sectorClass}`}>
                        {formatPercentValue(sector.change)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {t("home.heatmap.metric.median", "Median")}{" "}
                        {formatPercentValue(sector.medianChange)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 p-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                      {t("home.heatmap.breadth", "Breadth")}
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="flex h-full w-full">
                        <div
                          className="bg-neon/70"
                          style={{ width: `${advancerPct}%` }}
                        />
                        <div
                          className="bg-ember/70"
                          style={{ width: `${declinerPct}%` }}
                        />
                        <div className="bg-slate-400/40" style={{ flex: 1 }} />
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {sector.breadth.advancers}↑ / {sector.breadth.decliners}↓ /{" "}
                      {sector.breadth.flat} {t("home.heatmap.flat", "flat")}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-12 gap-2 auto-rows-[72px] sm:auto-rows-[78px]">
                    {sector.tickers.map((ticker) => {
                      const style = toneForChange(ticker.change, ticker.intensity);
                      const span = tileSpan(ticker.marketCapB, maxCap);

                      return (
                        <button
                          key={`${sector.sector}-${ticker.symbol}`}
                          type="button"
                          className="relative overflow-hidden rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:border-white/35"
                          style={{
                            gridColumn: `span ${span} / span ${span}`,
                            backgroundColor: style.backgroundColor,
                            borderColor: style.borderColor
                          }}
                          title={`${ticker.symbol} - ${ticker.name}`}
                          onClick={() => onOpenTicker(ticker.symbol)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-ink">
                              {ticker.symbol}
                            </p>
                            <p className={`text-xs font-semibold ${style.toneClass}`}>
                              {formatPercentValue(ticker.change)}
                            </p>
                          </div>
                          <p className="mt-1 truncate text-[10px] text-muted">{ticker.name}</p>
                          <p className="absolute bottom-1.5 left-2 text-[10px] text-muted">
                            {isFiniteNumber(ticker.relativeToSector)
                              ? `${ticker.relativeToSector > 0 ? "+" : ""}${ticker.relativeToSector.toFixed(2)}% vs sector`
                              : "--"}
                          </p>
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

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-2xl border border-white/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                {t("home.heatmap.leaders", "Leaders")}
              </p>
              <div className="mt-3 space-y-2">
                {view.leaders.length > 0 ? (
                  view.leaders.map((ticker) => leaderRow(ticker, onOpenTicker))
                ) : (
                  <p className="text-xs text-muted">{t("home.heatmap.empty", "No data")}</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                {t("home.heatmap.laggards", "Laggards")}
              </p>
              <div className="mt-3 space-y-2">
                {view.laggards.length > 0 ? (
                  view.laggards.map((ticker) => leaderRow(ticker, onOpenTicker))
                ) : (
                  <p className="text-xs text-muted">{t("home.heatmap.empty", "No data")}</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                {t("home.heatmap.sectorPulse", "Sector Pulse")}
              </p>
              <div className="mt-3 space-y-2">
                {view.sectors.slice(0, 8).map((sector) => (
                  <div
                    key={`sector-pulse-${sector.sector}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
                  >
                    <p className="truncate text-xs text-ink">{sector.sector}</p>
                    <p className={`text-xs font-semibold ${sectorToneClass(sector.change)}`}>
                      {formatPercentValue(sector.change)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
