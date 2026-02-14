import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import ModuleCard from "@/components/ModuleCard";
import StockIcon from "@/components/StockIcon";
import TickerSearchInput from "@/components/TickerSearchInput";
import { useStoredState } from "@/lib/useStoredState";
import { AlertRule, AlertCondition, evaluateAlert } from "@/lib/alerts";
import { useVisibility } from "@/lib/useVisibility";
import { useQuotes } from "@/lib/useQuotes";
import { normalizeTickerInput } from "@/lib/tickers";

type MomentumAlert = {
  symbol: string;
  threshold: number;
  lastScore?: number;
  lastUpdated?: string;
};

const CONDITIONS: { labelKey: string; value: AlertCondition }[] = [
  { labelKey: "alerts.condition.above", value: "above" },
  { labelKey: "alerts.condition.below", value: "below" },
  { labelKey: "alerts.condition.percentAbove", value: "percentAbove" },
  { labelKey: "alerts.condition.percentBelow", value: "percentBelow" }
];

export default function AlertsPage() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useStoredState<AlertRule[]>("alerts", []);
  const [momentumAlerts, setMomentumAlerts] = useStoredState<MomentumAlert[]>(
    "momentum-alerts",
    []
  );
  const [symbol, setSymbol] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [value, setValue] = useState("");
  const isVisible = useVisibility();

  const symbols = useMemo(
    () => alerts.map((alert) => alert.symbol).sort(),
    [alerts]
  );

  const { quotes } = useQuotes(symbols, { enabled: isVisible });

  function addAlert() {
    const cleanSymbol = normalizeTickerInput(symbol);
    const numericValue = Number(value);
    if (!cleanSymbol || !numericValue) return;
    setAlerts((prev) => [
      ...prev,
      {
        id: `${cleanSymbol}-${Date.now()}`,
        symbol: cleanSymbol,
        condition,
        value: numericValue,
        createdAt: new Date().toISOString()
      }
    ]);
    setSymbol("");
    setValue("");
  }

  return (
    <Layout>
      <div className="space-y-8">
        <ModuleCard title={t("alerts.createTitle")} subtitle={t("alerts.createSubtitle")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TickerSearchInput
                placeholder={t("alerts.searchSymbol")}
                buttonLabel={t("common.pick")}
                onSubmit={(ticker) => setSymbol(normalizeTickerInput(ticker))}
              />
              <p className="mt-2 text-xs text-muted">
                {t("common.selectedSymbol")} {symbol || "--"}
              </p>
            </div>
            <select
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              value={condition}
              onChange={(event) =>
                setCondition(event.target.value as AlertCondition)
              }
            >
              {CONDITIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </option>
              ))}
            </select>
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              placeholder={t("alerts.value")}
              type="number"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <button
            className="mt-4 rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night"
            onClick={addAlert}
          >
            {t("alerts.save")}
          </button>
        </ModuleCard>

        <ModuleCard title={t("alerts.activeTitle")} subtitle={t("alerts.activeSubtitle")}>
          {alerts.length === 0 && (
            <p className="text-sm text-muted">{t("alerts.empty")}</p>
          )}
          <div className="space-y-3">
            {alerts.map((alert) => {
              const quote = quotes.find((item) => item.symbol === alert.symbol);
              const status = evaluateAlert(alert, quote);
              const description = quote?.name
                ? `${alert.symbol} - ${quote.name}`
                : alert.symbol;
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                  title={description}
                >
                  <div className="flex items-center gap-3">
                    <StockIcon symbol={alert.symbol} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {alert.symbol}
                      </p>
                      {quote?.name && (
                        <p className="text-xs text-muted">{quote.name}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted">
                      {alert.condition} {alert.value}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xs font-semibold ${
                        status.triggered ? "text-neon" : "text-muted"
                      }`}
                    >
                      {status.triggered ? t("alerts.triggered") : t("alerts.watching")}
                    </p>
                    <p className="text-xs text-muted">{status.message}</p>
                  </div>
                  <button
                    className="text-xs text-muted"
                    onClick={() =>
                      setAlerts((prev) =>
                        prev.filter((item) => item.id !== alert.id)
                      )
                    }
                  >
                    {t("common.remove")}
                  </button>
                </div>
              );
            })}
          </div>
        </ModuleCard>

        <ModuleCard
          title={t("alerts.aiTitle")}
          subtitle={t("alerts.aiSubtitle")}
        >
          {momentumAlerts.length === 0 && (
            <p className="text-sm text-muted">{t("alerts.aiEmpty")}</p>
          )}
          <div className="space-y-3">
            {momentumAlerts.map((alert) => {
              const triggered =
                alert.lastScore !== undefined &&
                alert.lastScore >= alert.threshold;
              return (
                <div
                  key={`${alert.symbol}-${alert.threshold}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                  title={`${alert.symbol} - Momentum threshold ${alert.threshold}`}
                >
                  <div className="flex items-center gap-3">
                    <StockIcon symbol={alert.symbol} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {alert.symbol}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted">
                      {t("alerts.threshold")} {alert.threshold}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xs font-semibold ${
                        triggered ? "text-neon" : "text-muted"
                      }`}
                    >
                      {triggered ? t("alerts.triggered") : t("alerts.watching")}
                    </p>
                    <p className="text-xs text-muted">
                      {t("alerts.score")} {alert.lastScore?.toFixed(1) ?? "--"}
                    </p>
                  </div>
                  <button
                    className="text-xs text-muted"
                    onClick={() =>
                      setMomentumAlerts((prev) =>
                        prev.filter((item) => item.symbol !== alert.symbol)
                      )
                    }
                  >
                    {t("common.remove")}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            {t("alerts.aiHint")}
          </p>
        </ModuleCard>
      </div>
    </Layout>
  );
}
