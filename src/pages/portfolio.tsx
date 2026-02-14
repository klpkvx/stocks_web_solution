import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import ModuleCard from "@/components/ModuleCard";
import StockIcon from "@/components/StockIcon";
import TickerSearchInput from "@/components/TickerSearchInput";
import { useStoredState } from "@/lib/useStoredState";
import { calculatePortfolio, Holding } from "@/lib/portfolio";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useVisibility } from "@/lib/useVisibility";
import { useQuotes } from "@/lib/useQuotes";
import { normalizeTickerInput } from "@/lib/tickers";

export default function PortfolioPage() {
  const { t } = useI18n();
  const [holdings, setHoldings] = useStoredState<Holding[]>("portfolio", []);
  const [cashBalance] = useStoredState<number>("cash-balance", 5000);
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [shock, setShock] = useState(0);
  const isVisible = useVisibility();

  const symbols = useMemo(
    () => holdings.map((holding) => holding.symbol).sort(),
    [holdings]
  );

  const { quotes } = useQuotes(symbols, { enabled: isVisible });

  const summary = calculatePortfolio(holdings, quotes);
  const shockValue = summary.totalValue * (1 + shock / 100);

  function addHolding() {
    const cleanSymbol = normalizeTickerInput(symbol);
    const sharesValue = Number(shares);
    const costValue = Number(costBasis);
    if (!cleanSymbol || !sharesValue || !costValue) return;

    setHoldings((prev) => [
      ...prev,
      {
        id: `${cleanSymbol}-${Date.now()}`,
        symbol: cleanSymbol,
        shares: sharesValue,
        costBasis: costValue
      }
    ]);
    setSymbol("");
    setShares("");
    setCostBasis("");
  }

  return (
    <Layout>
      <div className="space-y-8">
        <ModuleCard
          title={t("portfolio.title")}
          subtitle={t("portfolio.subtitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TickerSearchInput
                placeholder={t("portfolio.searchSymbol")}
                buttonLabel={t("common.pick")}
                onSubmit={(ticker) => setSymbol(ticker)}
              />
              <p className="mt-2 text-xs text-muted">
                {t("common.selectedSymbol")} {symbol || "--"}
              </p>
            </div>
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              placeholder={t("portfolio.shares")}
              type="number"
              value={shares}
              onChange={(event) => setShares(event.target.value)}
            />
            <input
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              placeholder={t("portfolio.costBasis")}
              type="number"
              value={costBasis}
              onChange={(event) => setCostBasis(event.target.value)}
            />
          </div>
          <button
            className="mt-4 rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night"
            onClick={addHolding}
          >
            {t("portfolio.addHolding")}
          </button>
        </ModuleCard>

        <section className="grid gap-6 lg:grid-cols-[1.4fr,0.6fr]">
          <ModuleCard title={t("portfolio.holdings")} subtitle={t("portfolio.liveValue")}>
            {holdings.length === 0 && (
              <p className="text-sm text-muted">{t("portfolio.noHoldings")}</p>
            )}
            <div className="space-y-3">
              {holdings.map((holding) => {
                const quote = quotes.find(
                  (item) => item.symbol === holding.symbol
                );
                const tooltip = quote?.name
                  ? `${holding.symbol} - ${quote.name}`
                  : holding.symbol;
                const price = quote?.price ?? holding.costBasis;
                const value = price * holding.shares;
                const cost = holding.costBasis * holding.shares;
                const pnl = value - cost;
                return (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                    title={tooltip}
                  >
                    <div className="flex items-center gap-3">
                      <StockIcon symbol={holding.symbol} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {holding.symbol}
                        </p>
                        <p className="text-xs text-muted">
                          {formatNumber(holding.shares)} {t("portfolio.shares")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-ink">
                        {formatCurrency(value)}
                      </p>
                      <p
                        className={`text-xs ${
                          pnl >= 0 ? "text-neon" : "text-ember"
                        }`}
                      >
                        {formatCurrency(pnl)}
                      </p>
                    </div>
                    <button
                      className="text-xs text-muted"
                      onClick={() =>
                        setHoldings((prev) =>
                          prev.filter((item) => item.id !== holding.id)
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

          <ModuleCard title={t("portfolio.riskSimulator")} subtitle={t("portfolio.portfolioShock")}>
            <p className="text-sm text-muted">
              {t("portfolio.riskHint")}
            </p>
            <div className="mt-4">
              <input
                className="w-full"
                type="range"
                min={-20}
                max={20}
                step={1}
                value={shock}
                onChange={(event) => setShock(Number(event.target.value))}
              />
              <div className="mt-3 flex items-center justify-between text-sm text-muted">
                <span>{t("portfolio.shock")} {shock}%</span>
                <span>{t("portfolio.projectedValue")} {formatCurrency(shockValue)}</span>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted">
              <div className="flex items-center justify-between">
                <span>{t("portfolio.cashBalance")}</span>
                <span>{formatCurrency(cashBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("portfolio.totalValue")}</span>
                <span>{formatCurrency(summary.totalValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("portfolio.totalPnL")}</span>
                <span
                  className={summary.totalPnL >= 0 ? "text-neon" : "text-ember"}
                >
                  {formatCurrency(summary.totalPnL)}
                </span>
              </div>
            </div>
          </ModuleCard>
        </section>
      </div>
    </Layout>
  );
}
