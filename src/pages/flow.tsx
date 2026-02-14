import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useI18n } from "@/components/I18nProvider";
import ModuleCard from "@/components/ModuleCard";
import StockIcon from "@/components/StockIcon";
import { useStoredState } from "@/lib/useStoredState";
import { useVisibility } from "@/lib/useVisibility";
import { formatCurrency, formatDateTime, formatPercent, formatTime } from "@/lib/format";
import type { Holding } from "@/lib/portfolio";
import { COPY_TRADERS, confidenceLabel, computeCashDrag, replacementFor } from "@/lib/flow";
import { createActivityEvent, countRecentActivity, ActivityEvent } from "@/lib/activity";
import { useQuotes } from "@/lib/useQuotes";
import { useCachedApiQuery } from "@/lib/queries/useCachedApiQuery";
import { fetchJson } from "@/lib/apiClient";

type DipAlertRule = {
  id: string;
  symbol: string;
  anchorPrice?: number | null;
  dropPercent: number;
  maxSpend: number;
  autoBuy: boolean;
  notify: boolean;
  createdAt: string;
  triggeredAt?: string;
};

type CopyAllocation = {
  id: string;
  traderId: string;
  amount: number;
  createdAt: string;
};

type RoundUpTxn = {
  id: string;
  label: string;
  amount: number;
  roundUp: number;
  multiplier: number;
  invested: number;
  timestamp: string;
  symbol: string;
};

type DreamContest = {
  id: string;
  name: string;
  targets: { symbol: string; shares: number }[];
  deposits: number;
  startedAt: string;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
};

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "GOOGL"];

const DEFAULT_DREAM: DreamContest = {
  id: "dream-1",
  name: "Dream Tech Trio",
  targets: [
    { symbol: "AAPL", shares: 1 },
    { symbol: "NVDA", shares: 1 },
    { symbol: "TSLA", shares: 1 }
  ],
  deposits: 0,
  startedAt: "2024-06-01T00:00:00.000Z"
};

export default function FlowLabPage() {
  const { t } = useI18n();
  const [watchlist] = useStoredState<string[]>("watchlist", DEFAULT_WATCHLIST);
  const [holdings, setHoldings] = useStoredState<Holding[]>("portfolio", []);
  const [cashBalance, setCashBalance] = useStoredState<number>("cash-balance", 5000);
  const [activity, setActivity] = useStoredState<ActivityEvent[]>("activity-log", []);
  const [dipAlerts, setDipAlerts] = useStoredState<DipAlertRule[]>("dip-alerts", []);
  const [copyAllocations, setCopyAllocations] = useStoredState<CopyAllocation[]>("copy-allocations", []);
  const [roundUps, setRoundUps] = useStoredState<RoundUpTxn[]>("roundups", []);
  const [dreamContest, setDreamContest] = useStoredState<DreamContest>("dream-contest", DEFAULT_DREAM);
  const [notifications, setNotifications] = useStoredState<NotificationItem[]>("flow-notifications", []);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const isVisible = useVisibility();

  const [cashInput, setCashInput] = useState("");
  const [dipSymbol, setDipSymbol] = useState(DEFAULT_WATCHLIST[0]);
  const [dipDrop, setDipDrop] = useState(2);
  const [dipSpend, setDipSpend] = useState("");
  const [dipAuto, setDipAuto] = useState(true);
  const [dipNotify, setDipNotify] = useState(true);

  const [copyAmount, setCopyAmount] = useState("");

  const [roundLabel, setRoundLabel] = useState("");
  const [roundAmount, setRoundAmount] = useState("");
  const [roundBase, setRoundBase] = useState(1);
  const [roundTarget, setRoundTarget] = useState(DEFAULT_WATCHLIST[0]);
  const [happyHour, setHappyHour] = useState(true);

  const [harvestSelection, setHarvestSelection] = useState<string[]>([]);

  const [depositAmount, setDepositAmount] = useState("");

  const effectiveWatchlist = watchlist.length ? watchlist : DEFAULT_WATCHLIST;

  const symbols = useMemo(() => {
    const set = new Set<string>();
    effectiveWatchlist.forEach((symbol) => set.add(symbol));
    holdings.forEach((holding) => set.add(holding.symbol));
    set.add("SPY");
    return Array.from(set).slice(0, 12);
  }, [effectiveWatchlist, holdings]);

  const { quotes, error: quoteError } = useQuotes(symbols, { enabled: isVisible });
  const quoteMap = useMemo(
    () => new Map(quotes.map((quote) => [quote.symbol, quote])),
    [quotes]
  );

  const insiderSymbols = useMemo(() => symbols.slice(0, 10).join(","), [symbols]);
  const insiderFlowQuery = useCachedApiQuery<any>({
    queryKey: ["insider-flow", insiderSymbols || "default"],
    enabled: isVisible,
    fallbackTtlMs: 30 * 60 * 1000,
    gcTimeMs: 6 * 60 * 60 * 1000,
    refetchIntervalMs: isVisible ? 15 * 60 * 1000 : false,
    fetcher: () =>
      fetchJson<any>(
        insiderSymbols
          ? `/api/insider-flow?symbols=${encodeURIComponent(insiderSymbols)}`
          : "/api/insider-flow",
        10000
      )
  });
  const insiderFlow = insiderFlowQuery.data || null;
  const insiderError = insiderFlowQuery.error?.message || null;
  const insiderLoading = insiderFlowQuery.isFetching && !insiderFlowQuery.data;

  const dipSpendValue = Number(dipSpend) || 0;

  const dipSignals = useMemo(
    () =>
      dipAlerts.map((alert) => {
        const quote = quoteMap.get(alert.symbol);
        const current = quote?.price ?? null;
        const anchorPrice =
          alert.anchorPrice ?? quote?.previousClose ?? quote?.open ?? current;
        const triggerPrice =
          anchorPrice !== null && anchorPrice !== undefined
            ? anchorPrice * (1 - alert.dropPercent / 100)
            : null;
        const budget =
          alert.maxSpend > 0 ? Math.min(alert.maxSpend, cashBalance) : cashBalance;
        const shares = triggerPrice ? Math.floor(budget / triggerPrice) : 0;
        const ready =
          current !== null && triggerPrice !== null && current <= triggerPrice;
        return { alert, quote, triggerPrice, shares, ready, anchorPrice };
      }),
    [dipAlerts, quoteMap, cashBalance]
  );

  const cashDrag = computeCashDrag(cashBalance);
  const recentTradeCount = countRecentActivity(
    activity.filter((event) =>
      ["trade", "copy", "roundup", "harvest"].includes(event.type)
    ),
    24 * 60 * 60 * 1000
  );

  const [currentHour, setCurrentHour] = useState(0);

  useEffect(() => {
    setCurrentHour(new Date().getHours());
  }, []);

  const roundUpMultiplier = (() => {
    if (!happyHour) return 1;
    return currentHour >= 13 && currentHour < 15 ? 2 : 1;
  })();

  const dreamProgress = useMemo(() => {
    const total = dreamContest.targets.length;
    if (!total) return 0;
    const progress = dreamContest.targets.reduce((acc, target) => {
      const holding = holdings.find((item) => item.symbol === target.symbol);
      const owned = holding?.shares || 0;
      const pct = Math.min(owned / target.shares, 1);
      return acc + pct;
    }, 0);
    return progress / total;
  }, [dreamContest, holdings]);
  const dreamContestName =
    dreamContest.name === DEFAULT_DREAM.name
      ? t("flow.dream.defaultName")
      : dreamContest.name;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (effectiveWatchlist.length && !effectiveWatchlist.includes(dipSymbol)) {
      setDipSymbol(effectiveWatchlist[0]);
    }
    if (
      effectiveWatchlist.length &&
      !effectiveWatchlist.includes(roundTarget)
    ) {
      setRoundTarget(effectiveWatchlist[0]);
    }
  }, [effectiveWatchlist, dipSymbol, roundTarget]);

  useEffect(() => {
    if (!dipAlerts.length || !quotes.length) return;
    const now = Date.now();
    let updated = false;
    const next = dipAlerts.map((alert) => {
      if (!alert.notify) return alert;
      const quote = quoteMap.get(alert.symbol);
      if (!quote?.price) return alert;
      const anchorPrice =
        alert.anchorPrice ?? quote.previousClose ?? quote.open ?? quote.price;
      const trigger = anchorPrice * (1 - alert.dropPercent / 100);
      const ready = quote.price <= trigger;
      if (!ready) return alert;
      const last = alert.triggeredAt ? Date.parse(alert.triggeredAt) : 0;
      if (now - last < 60 * 60 * 1000) return alert;

      const title = t("flow.notification.dipTitle", undefined, {
        symbol: alert.symbol
      });
      const body = t("flow.notification.dipBody", undefined, {
        symbol: alert.symbol,
        drop: alert.dropPercent
      });
      pushNotification(title, body);
      addActivity("alert", t("flow.activity.dipTriggered", undefined, { symbol: alert.symbol }), {
        symbol: alert.symbol
      });
      updated = true;
      return { ...alert, triggeredAt: new Date().toISOString() };
    });

    if (updated) setDipAlerts(next);
  }, [dipAlerts, quoteMap, quotes]);

  function addActivity(type: string, message: string, meta?: Record<string, any>) {
    setLastAction(message);
    setActivity((prev) => {
      const next = [createActivityEvent(type, message, meta), ...prev];
      return next.slice(0, 200);
    });
  }

  function pushNotification(title: string, body: string) {
    const item = {
      id: `${title}-${Date.now()}`,
      title,
      body,
      timestamp: new Date().toISOString()
    };
    setNotifications((prev) => [item, ...prev].slice(0, 40));

    if (permission === "granted") {
      new Notification(title, { body });
    }
  }

  function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    Notification.requestPermission().then((result) => {
      setPermission(result);
      if (result === "granted") {
        pushNotification(t("flow.notification.enabledTitle"), t("flow.notification.enabledBody"));
      }
    });
  }

  function adjustCash(delta: number) {
    setCashBalance((prev) => Math.max(0, prev + delta));
  }

  function upsertHolding(symbol: string, shares: number, price: number) {
    if (shares <= 0) return;
    setHoldings((prev) => {
      const existing = prev.find((item) => item.symbol === symbol);
      if (!existing) {
        return [
          ...prev,
          {
            id: `${symbol}-${Date.now()}`,
            symbol,
            shares,
            costBasis: price
          }
        ];
      }
      const totalShares = existing.shares + shares;
      const weighted =
        (existing.costBasis * existing.shares + price * shares) / totalShares;
      return prev.map((item) =>
        item.symbol === symbol
          ? { ...item, shares: totalShares, costBasis: weighted }
          : item
      );
    });
  }

  function removeHolding(symbol: string) {
    setHoldings((prev) => prev.filter((item) => item.symbol !== symbol));
  }

  function handleCashDeposit() {
    const value = Number(cashInput);
    if (!value) return;
    adjustCash(value);
    addActivity("deposit", t("flow.activity.deposit", undefined, { value: formatCurrency(value) }));
    setCashInput("");
  }

  function createDipAlert() {
    const symbol = dipSymbol.trim().toUpperCase();
    if (!symbol || dipDrop <= 0) return;
    const anchorPrice = quoteMap.get(symbol)?.price ?? null;
    setDipAlerts((prev) => [
      ...prev,
      {
        id: `${symbol}-${Date.now()}`,
        symbol,
        anchorPrice,
        dropPercent: dipDrop,
        maxSpend: dipSpendValue,
        autoBuy: dipAuto,
        notify: dipNotify,
        createdAt: new Date().toISOString()
      }
    ]);
    addActivity("alert", t("flow.activity.createDip", undefined, { symbol }));
  }

  function executeDip(alert: DipAlertRule) {
    const quote = quoteMap.get(alert.symbol);
    if (!quote?.price) return;
    const anchorPrice =
      alert.anchorPrice ?? quote.previousClose ?? quote.open ?? quote.price;
    const trigger = anchorPrice * (1 - alert.dropPercent / 100);
    const budget = alert.maxSpend > 0 ? Math.min(alert.maxSpend, cashBalance) : cashBalance;
    const shares = Math.floor(budget / trigger);
    if (!shares) return;
    const cost = shares * trigger;
    if (cost > cashBalance) return;
    adjustCash(-cost);
    upsertHolding(alert.symbol, shares, trigger);
    addActivity(
      "trade",
      t("flow.activity.autoBuy", undefined, {
        shares,
        symbol: alert.symbol,
        price: formatCurrency(trigger)
      })
    );
  }

  function followTrader(traderId: string) {
    const amount = Number(copyAmount);
    if (!amount || amount > cashBalance) return;
    setCopyAllocations((prev) => [
      ...prev,
      {
        id: `${traderId}-${Date.now()}`,
        traderId,
        amount,
        createdAt: new Date().toISOString()
      }
    ]);
    adjustCash(-amount);
    addActivity("copy", t("flow.activity.copyAllocate", undefined, { amount: formatCurrency(amount), traderId }));
    setCopyAmount("");
  }

  function stopFollowing(allocationId: string) {
    const allocation = copyAllocations.find((item) => item.id === allocationId);
    if (!allocation) return;
    adjustCash(allocation.amount);
    setCopyAllocations((prev) => prev.filter((item) => item.id !== allocationId));
    addActivity("copy", t("flow.activity.copyStop", undefined, { traderId: allocation.traderId }));
  }

  function addRoundUp() {
    const amount = Number(roundAmount);
    if (!amount) return;
    const base = roundBase || 1;
    const rounded = Math.ceil(amount / base) * base;
    const roundUp = Math.max(0, rounded - amount);
    const invested = roundUp * roundUpMultiplier;
    setRoundUps((prev) => [
      {
        id: `round-${Date.now()}`,
        label: roundLabel,
        amount,
        roundUp,
        multiplier: roundUpMultiplier,
        invested,
        timestamp: new Date().toISOString(),
        symbol: roundTarget
      },
      ...prev
    ]);

    const quote = quoteMap.get(roundTarget);
    const price = quote?.price ?? 0;
    if (price) {
      const shares = invested / price;
      upsertHolding(roundTarget, shares, price);
      addActivity(
        "roundup",
        t("flow.activity.roundInvested", undefined, {
          value: formatCurrency(invested),
          symbol: roundTarget
        })
      );
    } else {
      addActivity(
        "roundup",
        t("flow.activity.roundSaved", undefined, {
          value: formatCurrency(invested),
          symbol: roundTarget
        })
      );
    }
    setRoundAmount("");
  }

  function harvestLosses() {
    const losers = holdings.filter((holding) => {
      const quote = quoteMap.get(holding.symbol);
      const price = quote?.price ?? holding.costBasis;
      return price < holding.costBasis;
    });

    const selected = harvestSelection.length
      ? losers.filter((holding) => harvestSelection.includes(holding.symbol))
      : losers;

    if (!selected.length) return;

    selected.forEach((holding) => {
      const quote = quoteMap.get(holding.symbol);
      const price = quote?.price ?? holding.costBasis;
      const value = price * holding.shares;
      removeHolding(holding.symbol);
      const replacement = replacementFor(holding.symbol);
      const replacementPrice = quoteMap.get(replacement)?.price ?? price;
      const replacementShares = replacementPrice ? value / replacementPrice : 0;
      if (replacementShares) {
        upsertHolding(replacement, replacementShares, replacementPrice);
      }
    });

    addActivity("harvest", t("flow.activity.harvest"));
    setHarvestSelection([]);
  }

  function addDreamDeposit() {
    const value = Number(depositAmount);
    if (!value) return;
    setDreamContest((prev) => ({
      ...prev,
      deposits: prev.deposits + value
    }));
    adjustCash(value);
    addActivity("deposit", t("flow.activity.dreamDeposit", undefined, { value: formatCurrency(value) }));
    setDepositAmount("");
  }

  return (
    <Layout>
      <div className="space-y-10">
        <section className="glass rounded-3xl px-8 py-8">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            {t("flow.hero.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">
            {t("flow.hero.title")}
          </h2>
          <p className="mt-3 text-sm text-muted">
            {t("flow.hero.subtitle")}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-2xl border border-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {t("flow.cash.label")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {formatCurrency(cashBalance)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  className="w-32 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                  placeholder={t("flow.cash.deposit")}
                  type="number"
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                />
                <button
                  className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
                  onClick={handleCashDeposit}
                >
                  {t("flow.cash.add")}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {t("flow.circuit.title")}
              </p>
              <p className="mt-2 text-sm text-muted">
                {recentTradeCount > 6
                  ? t("flow.circuit.high")
                  : t("flow.circuit.healthy")}
              </p>
              <p className="mt-3 text-xs text-muted">
                {t("flow.circuit.count", undefined, { count: recentTradeCount })}
              </p>
              {lastAction && (
                <p className="mt-3 text-xs text-muted">
                  {t("flow.circuit.lastAction", undefined, { action: lastAction })}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <ModuleCard
            title={t("flow.dip.title")}
            subtitle={t("flow.dip.subtitle")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
                value={dipSymbol}
                onChange={(event) => setDipSymbol(event.target.value)}
              >
                {effectiveWatchlist.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
              <input
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
                type="number"
                value={dipDrop}
                onChange={(event) => setDipDrop(Number(event.target.value))}
                placeholder={t("flow.dip.dropPercent")}
              />
              <input
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
                type="number"
                value={dipSpend}
                onChange={(event) => setDipSpend(event.target.value)}
                placeholder={t("flow.dip.maxSpend")}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dipAuto}
                    onChange={(event) => setDipAuto(event.target.checked)}
                  />
                  {t("flow.dip.autoBuy")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dipNotify}
                    onChange={(event) => setDipNotify(event.target.checked)}
                  />
                  {t("flow.dip.notify")}
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
                onClick={createDipAlert}
              >
                {t("flow.dip.save")}
              </button>
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-xs text-muted"
                onClick={enableNotifications}
                disabled={permission === "granted"}
              >
                {permission === "granted"
                  ? t("flow.dip.notificationsOn")
                  : t("flow.dip.enablePush")}
              </button>
            </div>
            {quoteError && <p className="mt-3 text-xs text-ember">{quoteError}</p>}
            <div className="mt-5 space-y-3 text-sm text-muted">
              {dipSignals.length === 0 && <p>{t("flow.dip.empty")}</p>}
              {dipSignals.map(({ alert, quote, triggerPrice, shares, ready, anchorPrice }) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-white/10 px-4 py-3"
                  title={quote?.name ? `${alert.symbol} - ${quote.name}` : alert.symbol}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StockIcon symbol={alert.symbol} size="sm" />
                      <p className="text-sm font-semibold text-ink">{alert.symbol}</p>
                    </div>
                    <span className="text-xs text-muted">
                      {t("flow.dip.dropValue", undefined, { drop: alert.dropPercent })}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {t("flow.dip.triggerValue", undefined, {
                      trigger: triggerPrice ? formatCurrency(triggerPrice) : "--",
                      cash: formatCurrency(alert.maxSpend || cashBalance)
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t("flow.dip.anchorValue", undefined, {
                      anchor: anchorPrice ? formatCurrency(anchorPrice) : "--"
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t("flow.dip.buyingPower", undefined, { shares })}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        ready ? "text-neon" : "text-muted"
                      }`}
                    >
                      {ready ? t("flow.dip.ready") : t("flow.dip.watching")}
                    </span>
                    {alert.autoBuy && ready && (
                      <button
                        className="rounded-full bg-white/10 px-3 py-1 text-xs text-ink"
                        onClick={() => executeDip(alert)}
                      >
                        {t("flow.dip.simulateBuy")}
                      </button>
                    )}
                    <button
                      className="text-xs text-muted"
                      onClick={() =>
                        setDipAlerts((prev) =>
                          prev.filter((item) => item.id !== alert.id)
                        )
                      }
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                  {quote?.price && (
                    <p className="mt-2 text-xs text-muted">
                      {t("flow.dip.live", undefined, {
                        price: formatCurrency(quote.price),
                        change: formatPercent(quote.percentChange)
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ModuleCard>

          <ModuleCard
            title={t("flow.copy.title")}
            subtitle={t("flow.copy.subtitle")}
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="w-32 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                placeholder={t("flow.copy.amount")}
                type="number"
                value={copyAmount}
                onChange={(event) => setCopyAmount(event.target.value)}
              />
              <span className="text-xs text-muted">
                {t("flow.copy.availableCash", undefined, {
                  cash: formatCurrency(cashBalance)
                })}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {COPY_TRADERS.map((trader) => {
                const allocation = copyAllocations.filter(
                  (item) => item.traderId === trader.id
                );
                const allocated = allocation.reduce((acc, item) => acc + item.amount, 0);
                const projected = allocated * (1 + trader.monthlyReturn);
                return (
                  <div
                    key={trader.id}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-muted"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">{trader.name}</p>
                        <p className="text-xs text-muted">{trader.style}</p>
                      </div>
                      <p className="text-xs text-neon">
                        +{(trader.monthlyReturn * 100).toFixed(1)}% / mo
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-muted">{trader.narrative}</p>
                    <p className="mt-2 text-xs text-muted">
                      {t("flow.copy.topHoldings", undefined, {
                        holdings: trader.topHoldings.join(", ")
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-full bg-gradient-to-r from-glow to-lavender px-3 py-1 text-xs font-semibold text-night"
                        onClick={() => followTrader(trader.id)}
                      >
                        {t("flow.copy.mirror")}
                      </button>
                      <span className="text-xs text-muted">
                        {t("flow.copy.allocatedProjected", undefined, {
                          allocated: formatCurrency(allocated),
                          projected: formatCurrency(projected)
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {copyAllocations.length > 0 && (
              <div className="mt-4 space-y-2 text-xs text-muted">
                {copyAllocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
                  >
                    <span>
                      {allocation.traderId} - {formatCurrency(allocation.amount)}
                    </span>
                    <button
                      className="text-xs text-muted"
                      onClick={() => stopFollowing(allocation.id)}
                    >
                      {t("flow.copy.stop")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ModuleCard>

          <ModuleCard
            title={t("flow.cashDrag.title")}
            subtitle={t("flow.cashDrag.subtitle")}
          >
            <div className="space-y-3 text-sm text-muted">
              <div className="flex items-center justify-between">
                <span>{t("flow.cashDrag.inflation")}</span>
                <span className="text-ember">
                  {formatCurrency(cashDrag.lostToInflation)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("flow.cashDrag.benchmark")}</span>
                <span className="text-ember">
                  {formatCurrency(cashDrag.missedBenchmark)}
                </span>
              </div>
              <p className="text-xs text-muted">
                {t("flow.cashDrag.assumption", undefined, {
                  value: ((cashDrag.benchmarkMonthly || 0) * 100).toFixed(2)
                })}
              </p>
            </div>
            <div className="mt-4">
              <button
                className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
                onClick={() => {
                  const deploy = Math.min(cashBalance, 500);
                  if (!deploy) return;
                  const symbol = "SPY";
                  const price = quoteMap.get(symbol)?.price || 0;
                  if (!price) return;
                  const shares = deploy / price;
                  adjustCash(-deploy);
                  upsertHolding(symbol, shares, price);
                  addActivity(
                    "trade",
                    t("flow.activity.deploySpy", undefined, {
                      value: formatCurrency(deploy),
                      symbol
                    })
                  );
                }}
              >
                {t("flow.cashDrag.deploySpy")}
              </button>
            </div>
          </ModuleCard>

          <ModuleCard
            title={t("flow.round.title")}
            subtitle={t("flow.round.subtitle")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
                value={roundLabel}
                onChange={(event) => setRoundLabel(event.target.value)}
                placeholder={t("flow.round.label")}
              />
              <input
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
                value={roundAmount}
                onChange={(event) => setRoundAmount(event.target.value)}
                placeholder={t("flow.round.amount")}
                type="number"
              />
              <select
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
                value={roundBase}
                onChange={(event) => setRoundBase(Number(event.target.value))}
              >
                <option value={1}>{t("flow.round.roundTo1")}</option>
                <option value={5}>{t("flow.round.roundTo5")}</option>
              </select>
              <select
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
                value={roundTarget}
                onChange={(event) => setRoundTarget(event.target.value)}
              >
                {effectiveWatchlist.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={happyHour}
                  onChange={(event) => setHappyHour(event.target.checked)}
                />
                {t("flow.round.happyHour")}
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
                onClick={addRoundUp}
              >
                {t("flow.round.log")}
              </button>
              {roundUpMultiplier > 1 && (
                <span className="text-xs text-neon">
                  {t("flow.round.multiplier", undefined, { value: roundUpMultiplier })}
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 text-xs text-muted">
              {roundUps.slice(0, 4).map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
                  title={`${txn.symbol} - ${txn.label}`}
                >
                  <span className="flex items-center gap-2">
                    <StockIcon symbol={txn.symbol} size="sm" />
                    <span>
                      {t("flow.round.entry", undefined, {
                        label: txn.label || t("flow.round.defaultLabel"),
                        value: formatCurrency(txn.invested),
                        symbol: txn.symbol
                      })}
                    </span>
                  </span>
                  <span>{formatTime(txn.timestamp)}</span>
                </div>
              ))}
              {roundUps.length === 0 && <p>{t("flow.round.empty")}</p>}
            </div>
          </ModuleCard>

          <ModuleCard
            title={t("flow.harvest.title")}
            subtitle={t("flow.harvest.subtitle")}
          >
            <div className="space-y-3 text-sm text-muted">
              {holdings.length === 0 && <p>{t("flow.harvest.emptyHoldings")}</p>}
              {holdings.map((holding) => {
                const quote = quoteMap.get(holding.symbol);
                const price = quote?.price ?? holding.costBasis;
                const pnl = (price - holding.costBasis) * holding.shares;
                const replacement = replacementFor(holding.symbol);
                const isLoser = pnl < 0;
                return (
                  <div
                    key={holding.id}
                    className="rounded-2xl border border-white/10 px-4 py-3"
                    title={quote?.name ? `${holding.symbol} - ${quote.name}` : holding.symbol}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={harvestSelection.includes(holding.symbol)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setHarvestSelection((prev) =>
                              checked
                                ? [...prev, holding.symbol]
                                : prev.filter((symbol) => symbol !== holding.symbol)
                            );
                          }}
                        />
                        <StockIcon symbol={holding.symbol} size="sm" />
                        <span className="text-sm text-ink">{holding.symbol}</span>
                      </label>
                      <span className={pnl < 0 ? "text-ember" : "text-neon"}>
                        {formatCurrency(pnl)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {t("flow.harvest.replacement", undefined, { symbol: replacement })}
                    </p>
                    {!isLoser && (
                      <p className="mt-1 text-xs text-muted">
                        {t("flow.harvest.notLoser")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              className="mt-4 rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
              onClick={harvestLosses}
            >
              {t("flow.harvest.run")}
            </button>
          </ModuleCard>

          <ModuleCard
            title={t("flow.dream.title")}
            subtitle={t("flow.dream.subtitle")}
          >
            <div className="space-y-3 text-sm text-muted">
              <div className="flex items-center justify-between">
                <span>{dreamContestName}</span>
                <span>{Math.round(dreamProgress * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-glow to-lavender"
                  style={{ width: `${Math.round(dreamProgress * 100)}%` }}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {dreamContest.targets.map((target) => {
                  const holding = holdings.find((item) => item.symbol === target.symbol);
                  const owned = holding?.shares || 0;
                  return (
                    <div
                      key={target.symbol}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-xs"
                      title={`${target.symbol} target - ${target.shares} shares`}
                    >
                      <div className="flex items-center gap-2">
                        <StockIcon symbol={target.symbol} size="sm" />
                        <p className="text-ink">{target.symbol}</p>
                      </div>
                      <p className="text-muted">
                        {t("flow.dream.shares", undefined, {
                          owned: owned.toFixed(2),
                          target: target.shares
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                className="w-32 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                placeholder={t("flow.cash.deposit")}
                type="number"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
              />
              <button
                className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
                onClick={addDreamDeposit}
              >
                {t("flow.dream.boost")}
              </button>
              <span className="text-xs text-muted">
                {t("flow.dream.deposits", undefined, {
                  value: formatCurrency(dreamContest.deposits)
                })}
              </span>
            </div>
          </ModuleCard>

          <ModuleCard
            title={t("flow.insider.title")}
            subtitle={t("flow.insider.subtitle")}
          >
            {insiderLoading && (
              <p className="text-sm text-muted">{t("flow.insider.loading")}</p>
            )}
            {insiderError && <p className="text-sm text-ember">{insiderError}</p>}
            {!insiderLoading && insiderFlow && (
              <div className="space-y-3 text-sm text-muted">
                <p className="text-xs text-muted">{insiderFlow.note}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(insiderFlow.sectors || {}).map(([sector, count]) => (
                    <div
                      key={sector}
                      className="rounded-2xl border border-white/10 px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-ink">{sector}</span>
                        <span className="text-xs text-muted">
                          {t("flow.insider.confidence", undefined, {
                            value: confidenceLabel(count as number)
                          })}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {t("flow.insider.filings", undefined, {
                          count: Number(count) || 0
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ModuleCard>

          <ModuleCard
            title={t("flow.notifications.title")}
            subtitle={t("flow.notifications.subtitle")}
          >
            <div className="space-y-2 text-sm text-muted">
              {notifications.length === 0 && <p>{t("flow.notifications.empty")}</p>}
              {notifications.slice(0, 6).map((note) => (
                <div
                  key={note.id}
                  className="rounded-2xl border border-white/10 px-4 py-3"
                >
                  <p className="text-sm text-ink">{note.title}</p>
                  <p className="text-xs text-muted">{note.body}</p>
                </div>
              ))}
            </div>
          </ModuleCard>

          <ModuleCard title={t("flow.activity.title")} subtitle={t("flow.activity.subtitle")}>
            <div className="space-y-2 text-sm text-muted">
              {activity.length === 0 && <p>{t("flow.activity.empty")}</p>}
              {activity.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 px-4 py-3"
                >
                  <p className="text-sm text-ink">{event.message}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(event.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          </ModuleCard>
        </section>
      </div>
    </Layout>
  );
}
