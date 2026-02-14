import type { Quote } from "@/lib/twelveData";
import { useI18n } from "@/components/I18nProvider";
import StockIcon from "@/components/StockIcon";

export default function CityBuilder({
  quotes
}: {
  quotes: Quote[];
}) {
  const { t } = useI18n();
  const districts = quotes.map((quote) => {
    const change = quote.percentChange ?? 0;
    const height = Math.min(140, 60 + Math.abs(change) * 4);
    return {
      symbol: quote.symbol,
      name: quote.name,
      change,
      height
    };
  });

  const cityHealth =
    districts.length === 0
      ? 0
      :
          districts.reduce((acc, item) => acc + item.change, 0) /
          districts.length;

  return (
    <div className="glass rounded-3xl px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{t("city.title")}</h3>
          <p className="mt-2 text-sm text-muted">
            {t("city.subtitle")}
          </p>
        </div>
        <div className="text-xs text-muted">
          {t("city.health")} {cityHealth.toFixed(2)}%
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {districts.map((district) => (
          <div
            key={district.symbol}
            className="rounded-2xl border border-white/10 px-3 py-4"
            title={`${district.symbol} - ${district.name}`}
          >
            <div className="flex items-center gap-2">
              <StockIcon symbol={district.symbol} size="sm" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {district.symbol}
              </p>
            </div>
            <div
              className={`mt-3 w-full rounded-xl ${
                district.change >= 0 ? "bg-neon/20" : "bg-ember/20"
              }`}
              style={{ height: district.height }}
            />
            <p
              className={`mt-3 text-sm font-semibold ${
                district.change >= 0 ? "text-neon" : "text-ember"
              }`}
            >
              {district.change.toFixed(2)}%
            </p>
            <p className="text-xs text-muted">{district.name}</p>
          </div>
        ))}
        {districts.length === 0 && (
          <p className="text-sm text-muted">
            {t("city.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
