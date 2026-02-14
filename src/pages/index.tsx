import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import CommandBar from "@/components/CommandBar";
import ModuleCard from "@/components/ModuleCard";
import HeroSlider from "@/components/HeroSlider";
import LazyViewport from "@/components/LazyViewport";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";
import {
  IconBell,
  IconChart,
  IconPulse,
  IconRadar,
  IconSBP,
  IconSpark,
  IconStack
} from "@/components/Icons";
import StockIcon from "@/components/StockIcon";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useStoredState } from "@/lib/useStoredState";
import { useVisibility } from "@/lib/useVisibility";
import { calculatePortfolio, Holding } from "@/lib/portfolio";
import { evaluateAlert, AlertRule } from "@/lib/alerts";
import { parseCommand } from "@/lib/nlp";
import { useMode } from "@/components/ModeProvider";
import { useI18n, useI18nNamespace } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useDashboardQuery } from "@/lib/queries/useDashboardQuery";
import { pushToast } from "@/lib/toast";
import type { HeatmapPeriod } from "@/types/heatmap";
import type { DashboardPayload } from "@/types/dashboard";
import { useFeatureFlags } from "@/lib/useFeatureFlags";
import { useQuoteStream } from "@/lib/useQuoteStream";
import { navigateToTicker } from "@/lib/stockNavigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  DEFAULT_INVENTORY,
  InventoryAlert,
  InventoryEvent,
  InventoryItem,
  computeAlertConversionRate,
  computeAverageRecoveryHours,
  countThresholdAdjustments,
  pendingAlerts
} from "@/lib/inventory";

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "GOOGL"];
const DASHBOARD_POLL_MS = 60 * 1000;
const WORKSPACE_PRESET_KEY_PREFIX = "workspace-preset:v1:";

const MODULES = [
  { id: "brief", label: "Morning Brief" },
  { id: "watchlist", label: "Watchlist" },
  { id: "heatmap", label: "Heatmap" },
  { id: "portfolio", label: "Portfolio" },
  { id: "alerts", label: "Alerts" },
  { id: "inventory", label: "Smart Stock Alerts" },
  { id: "license", label: "License Payment" },
  { id: "news", label: "News" },
  { id: "insights", label: "AI Insights" },
  { id: "strategy", label: "Strategy Lab" }
];

const ROLE_PRESETS: Record<"beginner" | "trader" | "research", string[]> = {
  beginner: ["brief", "watchlist", "news", "portfolio", "alerts"],
  trader: ["watchlist", "heatmap", "alerts", "strategy", "news", "insights"],
  research: ["brief", "news", "heatmap", "insights", "strategy", "inventory"]
};

const SLIDE_KEYS = [
  {
    id: "slide-pulse",
    kicker: "home.slide.pulse.kicker",
    title: "home.slide.pulse.title",
    description: "home.slide.pulse.description",
    ctaLabel: "home.slide.pulse.cta",
    href: "/",
    stats: [
      { label: "home.slide.pulse.statLatency", value: "< 90s" },
      { label: "home.slide.pulse.statCoverage", value: "home.slide.pulse.statCoverageValue" }
    ]
  },
  {
    id: "slide-flow",
    kicker: "home.slide.flow.kicker",
    title: "home.slide.flow.title",
    description: "home.slide.flow.description",
    ctaLabel: "home.slide.flow.cta",
    href: "/flow",
    stats: [
      { label: "home.slide.flow.statSignals", value: "home.slide.flow.statSignalsValue" },
      { label: "home.slide.flow.statGuardrails", value: "home.slide.flow.statGuardrailsValue" }
    ]
  },
  {
    id: "slide-strategy",
    kicker: "home.slide.strategy.kicker",
    title: "home.slide.strategy.title",
    description: "home.slide.strategy.description",
    ctaLabel: "home.slide.strategy.cta",
    href: "/strategy",
    stats: [
      { label: "home.slide.strategy.statTimeframe", value: "home.slide.strategy.statTimeframeValue" },
      { label: "home.slide.strategy.statInsight", value: "home.slide.strategy.statInsightValue" }
    ]
  }
];

const FEATURE_CARDS = [
  {
    id: "feature-dashboard",
    label: "home.feature.dashboard.label",
    description: "home.feature.dashboard.desc",
    href: "/",
    icon: IconPulse
  },
  {
    id: "feature-flow",
    label: "home.feature.flow.label",
    description: "home.feature.flow.desc",
    href: "/flow",
    icon: IconRadar
  },
  {
    id: "feature-strategy",
    label: "home.feature.strategy.label",
    description: "home.feature.strategy.desc",
    href: "/strategy",
    icon: IconChart
  },
  {
    id: "feature-portfolio",
    label: "home.feature.portfolio.label",
    description: "home.feature.portfolio.desc",
    href: "/portfolio",
    icon: IconStack
  },
  {
    id: "feature-alerts",
    label: "home.feature.alerts.label",
    description: "home.feature.alerts.desc",
    href: "/alerts",
    icon: IconBell
  },
  {
    id: "feature-experience",
    label: "home.feature.experience.label",
    description: "home.feature.experience.desc",
    href: "/experience",
    icon: IconSpark
  }
];

const TRUST_BADGES = [
  "home.trust.ssl",
  "home.trust.price",
  "home.trust.fees",
  "home.trust.free"
];

const PARTNER_KEYS = [
  "home.partner.twelveData",
  "home.partner.secEdgar",
  "home.partner.newsApi",
  "home.partner.tbank"
];

const TESTIMONIALS = [
  {
    quoteKey: "home.testimonial.retail.quote",
    authorKey: "home.testimonial.retail.author"
  },
  {
    quoteKey: "home.testimonial.trader.quote",
    authorKey: "home.testimonial.trader.author"
  },
  {
    quoteKey: "home.testimonial.operations.quote",
    authorKey: "home.testimonial.operations.author"
  }
];

type ModuleConfig = {
  id: string;
  label: string;
  enabled: boolean;
};

function sanitizeNextPath(input: unknown) {
  const value = typeof input === "string" ? input : "";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

const WatchlistWidget = dynamic(
  () => import("@/components/widgets/WatchlistWidget"),
  {
    ssr: false,
    loading: () => <LoadingSkeleton className="h-[280px] w-full rounded-2xl" />
  }
);

const HeatmapWidget = dynamic(
  () => import("@/components/widgets/HeatmapWidget"),
  {
    loading: () => <LoadingSkeleton className="h-[360px] w-full rounded-2xl" />
  }
);

const NewsWidget = dynamic(
  () => import("@/components/widgets/NewsWidget"),
  {
    loading: () => <LoadingSkeleton className="h-[220px] w-full rounded-2xl" />
  }
);

const MorningBriefWidget = dynamic(
  () => import("@/components/widgets/MorningBriefWidget"),
  {
    loading: () => <LoadingSkeleton className="h-[180px] w-full rounded-2xl" />
  }
);

export default function HomePage() {
  const router = useRouter();
  const { mode } = useMode();
  const { t, locale } = useI18n();
  useI18nNamespace("home");
  const { theme } = useTheme();
  const { authenticated, loading: authLoading } = useAuthSession();
  const [watchlist, setWatchlist] = useStoredState<string[]>(
    "watchlist",
    DEFAULT_WATCHLIST
  );
  const [holdings, setHoldings] = useStoredState<Holding[]>("portfolio", []);
  const [alerts, setAlerts] = useStoredState<AlertRule[]>("alerts", []);
  const [inventoryItems, setInventoryItems] = useStoredState<InventoryItem[]>(
    "inventory-items",
    DEFAULT_INVENTORY
  );
  const [inventoryAlerts, setInventoryAlerts] = useStoredState<InventoryAlert[]>(
    "inventory-alerts",
    []
  );
  const [inventoryEvents, setInventoryEvents] = useStoredState<InventoryEvent[]>(
    "inventory-events",
    []
  );
  const [licensePayment, setLicensePayment] = useStoredState<{
    status: "unpaid" | "pending" | "paid";
    id?: string;
  }>("license-payment", { status: "unpaid" });
  const [sbpForm, setSbpForm] = useState({
    extCompanyId: "",
    extShopId: "",
    bankName: "",
    bik: "",
    corrAccount: "",
    currentAccount: "",
    serialNumber: "",
    apiType: "sbp"
  });
  const [sbpStatus, setSbpStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [sbpError, setSbpError] = useState<string | null>(null);
  const [modules, setModules] = useStoredState<ModuleConfig[]>(
    "dashboard-modules",
    MODULES.map((module) => ({ ...module, enabled: true }))
  );
  const [heatmapPeriod, setHeatmapPeriod] = useStoredState<HeatmapPeriod>(
    "heatmap-period",
    "day"
  );
  const [editMode, setEditMode] = useState(false);
  const isVisible = useVisibility();
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>({});
  const [hiddenWidgetTickers, setHiddenWidgetTickers] = useStoredState<string[]>(
    "tv-hidden-tickers",
    []
  );
  const [devicePreset, setDevicePreset] = useState<"mobile" | "desktop">("desktop");
  const flags = useFeatureFlags();

  useEffect(() => {
    const routes = [
      "/flow",
      "/strategy",
      "/portfolio",
      "/alerts",
      "/experience",
      "/news"
    ];

    const prefetch = () => {
      routes.forEach((route) => {
        router.prefetch(route).catch(() => undefined);
      });
    };

    if (typeof window === "undefined") {
      return;
    }

    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(prefetch, { timeout: 2000 })
        : window.setTimeout(prefetch, 1500);

    return () => {
      if (typeof idle === "number") {
        window.clearTimeout(idle);
        return;
      }
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idle);
      }
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncDevice = () => {
      setDevicePreset(window.innerWidth < 768 ? "mobile" : "desktop");
    };
    syncDevice();
    window.addEventListener("resize", syncDevice);
    return () => window.removeEventListener("resize", syncDevice);
  }, []);

  useEffect(() => {
    setModules((prev) => {
      const ids = new Set(prev.map((item) => item.id));
      const missing = MODULES.filter((module) => !ids.has(module.id));
      if (!missing.length) return prev;
      return [...prev, ...missing.map((module) => ({ ...module, enabled: true }))];
    });
  }, [modules, setModules]);

  useEffect(() => {
    if (!flags.workspacePresets || typeof window === "undefined") return;
    const key = `${WORKSPACE_PRESET_KEY_PREFIX}${devicePreset}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ModuleConfig[];
      if (!Array.isArray(parsed) || !parsed.length) return;
      setModules(parsed);
    } catch {
      // Ignore invalid local snapshot.
    }
  }, [devicePreset, flags.workspacePresets, setModules]);

  useEffect(() => {
    setHiddenWidgetTickers((prev) =>
      prev.filter((symbol) => watchlist.includes(symbol))
    );
  }, [watchlist, setHiddenWidgetTickers]);

  const symbols = useMemo(() => {
    const prioritized = [
      ...watchlist.slice(0, 8),
      ...holdings.slice(0, 8).map((holding) => holding.symbol),
      ...alerts.slice(0, 8).map((alert) => alert.symbol)
    ];
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const symbol of prioritized) {
      const clean = String(symbol || "").toUpperCase();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      deduped.push(clean);
      if (deduped.length >= 12) break;
    }
    return deduped;
  }, [watchlist, holdings, alerts]);

  const visibleWidgetTickers = useMemo(
    () =>
      watchlist
        .filter((symbol) => !hiddenWidgetTickers.includes(symbol))
        .slice(0, 12),
    [watchlist, hiddenWidgetTickers]
  );

  const activeModules = modules.filter((module) => module.enabled);
  const newsEnabled = authenticated && modules.some(
    (module) => module.id === "news" && module.enabled
  );
  const heatmapModuleEnabled = modules.some(
    (module) => module.id === "heatmap" && module.enabled
  );
  const heatmapDataEnabled = authenticated && heatmapModuleEnabled;

  const moduleLabel = (id: string, fallback: string) =>
    t(`home.module.${id}`, fallback);

  const newsSymbol = useMemo(
    () => String(watchlist[0] || symbols[0] || "").toUpperCase(),
    [watchlist, symbols]
  );
  const dashboardQuery = useDashboardQuery({
    symbols,
    newsEnabled,
    heatmapEnabled: heatmapDataEnabled,
    newsSymbol,
    enabled: authenticated && isVisible,
    refetchIntervalMs: DASHBOARD_POLL_MS
  });
  const dashboardData = dashboardQuery.data as DashboardPayload | undefined;
  const dashboardWarnings = dashboardData?.warnings || [];
  const quotes = dashboardData?.quotes || [];
  const quoteStream = useQuoteStream(symbols, authenticated && isVisible);
  const news = newsEnabled ? dashboardData?.news || null : null;
  const heatmap = dashboardData?.heatmap || null;
  const loading = dashboardQuery.isLoading;
  const newsLoading =
    newsEnabled && dashboardQuery.isLoading && !dashboardData?.news;
  const heatmapLoading =
    heatmapDataEnabled && dashboardQuery.isLoading && !dashboardData?.heatmap;
  const heatmapError =
    heatmapDataEnabled && !dashboardQuery.isLoading && !heatmap
      ? t("home.heatmap.errorLoad")
      : null;
  const error =
    dashboardQuery.error instanceof Error
      ? dashboardQuery.error.message
      : dashboardWarnings[0] || null;
  const quoteMap = useMemo(() => {
    const map = new Map(quotes.map((quote) => [quote.symbol, quote]));
    quoteStream.quotes.forEach((quote) => {
      map.set(quote.symbol, quote);
    });
    return map;
  }, [quoteStream.quotes, quotes]);

  const portfolioSummary = calculatePortfolio(holdings, quotes);
  const alertStatuses = useMemo(
    () =>
      alerts.map((alert) => {
        const quote = quoteMap.get(alert.symbol);
        return {
          alert,
          status: evaluateAlert(alert, quote)
        };
      }),
    [alerts, quoteMap]
  );

  const inventoryPending = pendingAlerts(inventoryItems);
  const alertConversionRate = computeAlertConversionRate(inventoryItems);
  const avgRecoveryHours = computeAverageRecoveryHours(inventoryItems);
  const thresholdAdjustments = countThresholdAdjustments(
    inventoryEvents,
    30 * 24 * 60 * 60 * 1000
  );

  useEffect(() => {
    const now = new Date().toISOString();
    let updated = false;
    const triggeredItems: InventoryItem[] = [];
    const nextItems = inventoryItems.map((item) => {
      if (item.stock > item.threshold) return item;
      const lastAlert = item.lastAlert ? Date.parse(item.lastAlert) : 0;
      const lastRestock = item.lastRestock ? Date.parse(item.lastRestock) : 0;
      if (lastAlert > lastRestock) return item;

      updated = true;
      triggeredItems.push(item);
      return { ...item, lastAlert: now };
    });

    if (updated) {
      const newAlerts: InventoryAlert[] = triggeredItems.map((item) => ({
        id: `${item.id}-${Date.now()}`,
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        stock: item.stock,
        threshold: item.threshold,
        timestamp: now,
        status: "pending"
      }));
      if (newAlerts.length) {
        setInventoryAlerts((prev) => [...newAlerts, ...prev].slice(0, 40));
        setInventoryEvents((prev) => [
          ...newAlerts.map((alert) => ({
            id: `evt-${alert.id}`,
            itemId: alert.itemId,
            type: "alert" as const,
            value: alert.stock,
            timestamp: alert.timestamp
          })),
          ...prev
        ].slice(0, 200));
      }
      setInventoryItems(nextItems);
    }
  }, [inventoryItems, setInventoryAlerts, setInventoryEvents, setInventoryItems]);

  function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates, lastUpdated: new Date().toISOString() } : item
      )
    );
  }

  function consumeItem(id: string) {
    const item = inventoryItems.find((entry) => entry.id === id);
    if (!item) return;
    updateInventoryItem(id, { stock: Math.max(0, item.stock - 1) });
    setInventoryEvents((prev) => [
      {
        id: `evt-consume-${Date.now()}`,
        itemId: id,
        type: "consume" as const,
        value: -1,
        timestamp: new Date().toISOString()
      },
      ...prev
    ].slice(0, 200));
  }

  function restockItem(id: string, amount = 12) {
    const item = inventoryItems.find((entry) => entry.id === id);
    if (!item) return;
    updateInventoryItem(id, {
      stock: item.stock + amount,
      lastRestock: new Date().toISOString()
    });
    setInventoryAlerts((prev) =>
      prev.map((alert) =>
        alert.itemId === id && alert.status === "pending"
          ? { ...alert, status: "resolved", resolvedAt: new Date().toISOString() }
          : alert
      )
    );
    setInventoryEvents((prev) => [
      {
        id: `evt-restock-${Date.now()}`,
        itemId: id,
        type: "restock" as const,
        value: amount,
        timestamp: new Date().toISOString()
      },
      ...prev
    ].slice(0, 200));
  }

  function updateThreshold(id: string) {
    const draft = thresholdDrafts[id];
    const nextValue = Number(draft);
    if (!nextValue || nextValue < 1) {
      pushToast(t("home.inventory.errorThreshold"), "error");
      return;
    }
    updateInventoryItem(id, { threshold: nextValue });
    setThresholdDrafts((prev) => ({ ...prev, [id]: "" }));
    pushToast(t("home.inventory.thresholdUpdated"), "success");
    setInventoryEvents((prev) => [
      {
        id: `evt-threshold-${Date.now()}`,
        itemId: id,
        type: "threshold" as const,
        value: nextValue,
        timestamp: new Date().toISOString()
      },
      ...prev
    ].slice(0, 200));
  }

  function payWithTbank() {
    const paymentId = `SBP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setLicensePayment({ status: "pending", id: paymentId });
    if (typeof window === "undefined") return;
    const url = process.env.NEXT_PUBLIC_TBANK_PAYMENT_URL || "";
    if (!url) {
      pushToast(t("home.license.errorUrl"), "error");
      return;
    }
    pushToast(t("home.license.redirecting"), "info");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function markLicensePaid() {
    setLicensePayment((prev) => ({ ...prev, status: "paid" }));
    pushToast(t("home.license.markedPaid"), "success");
  }

  function resetLicense() {
    setLicensePayment({ status: "unpaid" });
    pushToast(t("home.license.resetDone"), "info");
  }

  async function registerSbp() {
    try {
      const missing = [
        [t("home.sbp.companyId"), sbpForm.extCompanyId],
        [t("home.sbp.shopId"), sbpForm.extShopId],
        [t("home.sbp.bankName"), sbpForm.bankName],
        [t("home.sbp.bik"), sbpForm.bik],
        [t("home.sbp.corrAccount"), sbpForm.corrAccount],
        [t("home.sbp.currentAccount"), sbpForm.currentAccount]
      ].find(([, value]) => !String(value || "").trim());
      if (missing) {
        const message = t("home.sbp.requiredField", undefined, {
          field: String(missing[0])
        });
        setSbpStatus("error");
        setSbpError(message);
        pushToast(message, "error");
        return;
      }

      setSbpStatus("loading");
      setSbpError(null);
      const response = await fetch("/api/tbank/sbp-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sbpForm)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.error || t("home.sbp.errorRegister"));
      }
      setSbpStatus("success");
      pushToast(t("home.sbp.submittedToast"), "success");
    } catch (err: any) {
      setSbpStatus("error");
      const message = err.message || t("home.sbp.errorRegister");
      setSbpError(message);
      pushToast(message, "error");
    }
  }

  const marketPulse = [...quoteMap.values()]
    .filter((quote) => quote.percentChange !== null)
    .sort((a, b) => (b.percentChange || 0) - (a.percentChange || 0));

  function handleCommand(action: ReturnType<typeof parseCommand>) {
    if (action.type === "open" && action.symbols[0]) {
      void navigateToTicker(router, action.symbols[0]);
      return;
    }
    if (action.type === "compare" && action.symbols.length >= 2) {
      const symbols = encodeURIComponent(action.symbols.join(","));
      void router.push(`/compare?symbols=${symbols}`);
      return;
    }
    if (action.type === "news") {
      const symbol = action.symbols[0];
      void router.push(symbol ? `/news?symbol=${encodeURIComponent(symbol)}` : "/news");
      return;
    }
    if (action.type === "strategy") {
      const symbol = action.symbols[0];
      void router.push(symbol ? `/strategy?symbol=${encodeURIComponent(symbol)}` : "/strategy");
      return;
    }
    if (action.type === "alerts") {
      void router.push("/alerts");
      return;
    }
    if (action.type === "search") {
      void navigateToTicker(router, action.query);
    }
  }

  function updateModule(id: string, updates: Partial<ModuleConfig>) {
    setModules((prev) =>
      prev.map((module) =>
        module.id === id ? { ...module, ...updates } : module
      )
    );
  }

  function moveModule(id: string, direction: -1 | 1) {
    setModules((prev) => {
      const index = prev.findIndex((module) => module.id === id);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  function toggleWidgetTicker(symbol: string) {
    setHiddenWidgetTickers((prev) =>
      prev.includes(symbol)
        ? prev.filter((item) => item !== symbol)
        : [...prev, symbol]
    );
  }

  function saveWorkspacePreset() {
    if (!flags.workspacePresets || typeof window === "undefined") return;
    const key = `${WORKSPACE_PRESET_KEY_PREFIX}${devicePreset}`;
    window.localStorage.setItem(key, JSON.stringify(modules));
    pushToast(`Workspace preset saved for ${devicePreset}`, "success");
  }

  function resetWorkspacePreset() {
    if (!flags.workspacePresets || typeof window === "undefined") return;
    const key = `${WORKSPACE_PRESET_KEY_PREFIX}${devicePreset}`;
    window.localStorage.removeItem(key);
    setModules(MODULES.map((module) => ({ ...module, enabled: true })));
    pushToast(`Workspace preset reset for ${devicePreset}`, "info");
  }

  function applyRolePreset(role: "beginner" | "trader" | "research") {
    const target = ROLE_PRESETS[role];
    const enabledSet = new Set(target);
    const ordered = [
      ...target
        .map((id) => MODULES.find((module) => module.id === id))
        .filter((item): item is (typeof MODULES)[number] => Boolean(item)),
      ...MODULES.filter((module) => !enabledSet.has(module.id))
    ];

    const next = ordered.map((module) => ({
      ...module,
      enabled: enabledSet.has(module.id)
    }));
    setModules(next);
    pushToast(`Applied ${role} workspace preset`, "success");
  }

  const slides = useMemo(
    () =>
      SLIDE_KEYS.map((slide) => ({
        id: slide.id,
        kicker: t(slide.kicker),
        title: t(slide.title),
        description: t(slide.description),
        cta: { label: t(slide.ctaLabel), href: slide.href },
        stats: slide.stats.map((stat) => ({
          label: t(stat.label),
          value: t(stat.value)
        }))
      })),
    [t]
  );

  const nextPath = useMemo(
    () => sanitizeNextPath(router.query.next),
    [router.query.next]
  );

  const loginHref =
    nextPath !== "/" ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  const registerHref =
    nextPath !== "/"
      ? `/register?next=${encodeURIComponent(nextPath)}`
      : "/register";

  if (authLoading) {
    return (
      <Layout>
        <section className="mx-auto max-w-2xl">
          <ModuleCard
            title={t("auth.loadingTitle", "Preparing workspace")}
            subtitle={t("auth.loadingSubtitle", "Checking your session")}
          >
            <div className="space-y-3">
              <LoadingDots label={t("auth.loading", "Auth...")} />
              <LoadingSkeleton className="h-16 w-full rounded-2xl" />
              <LoadingSkeleton className="h-16 w-full rounded-2xl" />
            </div>
          </ModuleCard>
        </section>
      </Layout>
    );
  }

  if (!authenticated) {
    return (
      <Layout>
        <section className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="glass rounded-3xl px-8 py-10">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">
              {t("auth.landing.kicker", "Private Workspace")}
            </p>
            <h2 className="mt-4 font-serif text-4xl text-ink sm:text-5xl">
              {t("auth.landing.title", "Login to open live market data")}
            </h2>
            <p className="mt-4 max-w-xl text-sm text-muted">
              {t(
                "auth.landing.body",
                "Guest mode keeps this page read-only with preview widgets. Sign in to unlock real-time data and API-powered modules."
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={loginHref}
                className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night transition hover:opacity-90"
              >
                {t("auth.login", "Login")}
              </Link>
              <Link
                href={registerHref}
                className="rounded-full border border-white/10 px-5 py-2 text-sm text-muted transition hover:border-white/30 hover:text-ink"
              >
                {t("auth.register", "Register")}
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              {t(
                "auth.landing.note",
                "Preview mode: no market API requests, no portfolio data, no alerts."
              )}
            </p>
          </div>

          <ModuleCard
            title={t("auth.landing.previewTitle", "Read-only preview")}
            subtitle={t(
              "auth.landing.previewSubtitle",
              "Static sample components shown before authentication"
            )}
          >
            <div className="space-y-3">
              {[
                { symbol: "AAPL", move: "+1.42%" },
                { symbol: "MSFT", move: "+0.58%" },
                { symbol: "TSLA", move: "-0.91%" }
              ].map((item) => (
                <div
                  key={`guest-preview-${item.symbol}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <StockIcon symbol={item.symbol} size="sm" />
                    <p className="text-sm font-semibold text-ink">{item.symbol}</p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      item.move.startsWith("-") ? "text-ember" : "text-neon"
                    }`}
                  >
                    {item.move}
                  </p>
                </div>
              ))}
            </div>
          </ModuleCard>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <div className="glass rounded-3xl px-8 py-10">
            <p className="text-xs uppercase tracking-[0.4em] text-muted">
              {t("home.hero.kicker")}
            </p>
            <h2 className="mt-4 font-serif text-4xl text-ink sm:text-5xl">
              {t("home.heroTitle")}
            </h2>
            <p className="mt-4 max-w-xl text-sm text-muted">
              {mode === "pro"
                ? t("home.heroPro")
                : t("home.heroBeginner")}
            </p>
            <div className="mt-6">
              <SearchBar
                placeholder={t("home.searchPlaceholder")}
                onSubmit={(value) => {
                  void navigateToTicker(router, value);
                }}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night"
                onClick={() => {
                  void navigateToTicker(router, watchlist[0] || "AAPL");
                }}
              >
                {t("home.cta.start")}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-5 py-2 text-sm text-muted transition hover:border-white/30 hover:text-ink"
                onClick={() => router.push("/strategy")}
              >
                {t("home.cta.strategy")}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-muted"
                >
                  {t(badge)}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass rounded-2xl px-4 py-4 text-xs text-muted">
              <p className="text-ink text-sm">
                {t("home.count.symbols", undefined, { count: watchlist.length })}
              </p>
              <p className="mt-1 uppercase tracking-[0.2em]">
                {t("home.module.watchlist")}
              </p>
            </div>
            <div className="glass rounded-2xl px-4 py-4 text-xs text-muted">
              <p className="text-ink text-sm">
                {t("home.count.alerts", undefined, { count: alerts.length })}
              </p>
              <p className="mt-1 uppercase tracking-[0.2em]">
                {t("home.stats.signals")}
              </p>
            </div>
          </div>
        </div>

        <HeroSlider slides={slides} />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_CARDS.map((feature) => (
          <Link
            key={feature.id}
            href={feature.href}
            className="glass group rounded-3xl px-5 py-5 transition hover:border-white/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-ink transition group-hover:border-white/30">
                <feature.icon size={20} />
              </div>
              <span className="text-xs text-muted">{t("home.feature.open")}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-ink">
              {t(feature.label)}
            </h3>
            <p className="mt-2 text-sm text-muted">{t(feature.description)}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <ModuleCard title={t("home.trustedStack.title")} subtitle={t("home.trustedStack.subtitle")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {PARTNER_KEYS.map((partner) => (
              <div
                key={partner}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink"
              >
                {t(partner)}
              </div>
            ))}
          </div>
        </ModuleCard>
        <ModuleCard title={t("home.testimonials.title")} subtitle={t("home.testimonials.subtitle")}>
          <div className="space-y-3">
            {TESTIMONIALS.slice(0, 2).map((item) => (
              <blockquote
                key={item.authorKey}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-muted"
              >
                <p className="text-ink">"{t(item.quoteKey)}"</p>
                <footer className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                  {t(item.authorKey)}
                </footer>
              </blockquote>
            ))}
          </div>
        </ModuleCard>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-6">
          <CommandBar onCommand={handleCommand} />
        </div>

        <aside className="space-y-6">
          <ModuleCard
            title={t("home.layout.title")}
            subtitle={t("home.modules.customize")}
            actions={
              <div className="flex items-center gap-2">
                {flags.workspacePresets && (
                  <>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30"
                      onClick={() => applyRolePreset("beginner")}
                    >
                      Beginner
                    </button>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30"
                      onClick={() => applyRolePreset("trader")}
                    >
                      Trader
                    </button>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30"
                      onClick={() => applyRolePreset("research")}
                    >
                      Research
                    </button>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30"
                      onClick={saveWorkspacePreset}
                    >
                      Save
                    </button>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30"
                      onClick={resetWorkspacePreset}
                    >
                      Reset
                    </button>
                  </>
                )}
                <button
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30"
                  onClick={() => setEditMode((prev) => !prev)}
                >
                  {editMode ? t("home.modules.done") : t("home.modules.edit")}
                </button>
              </div>
            }
          >
            <div className="space-y-3 text-sm text-muted">
              {modules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2"
                >
                  <div>
                    <p className="text-ink">
                      {moduleLabel(module.id, module.label)}
                    </p>
                  </div>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-full border border-white/10 px-2 py-1 text-xs"
                        onClick={() => moveModule(module.id, -1)}
                      >
                        {t("home.modules.up")}
                      </button>
                      <button
                        className="rounded-full border border-white/10 px-2 py-1 text-xs"
                        onClick={() => moveModule(module.id, 1)}
                      >
                        {t("home.modules.down")}
                      </button>
                      <button
                        className="rounded-full border border-white/10 px-2 py-1 text-xs"
                        onClick={() =>
                          updateModule(module.id, { enabled: !module.enabled })
                        }
                      >
                        {module.enabled
                          ? t("home.modules.hide")
                          : t("home.modules.show")}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">
                      {module.enabled
                        ? t("home.modules.visible")
                        : t("home.modules.hidden")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ModuleCard>

          <ModuleCard title={t("home.marketPulse.title")} subtitle={t("home.marketPulse.subtitle")}>
            {loading && (
              <div className="space-y-3">
                <LoadingDots label={t("home.marketPulse.loading")} />
                <LoadingSkeleton className="h-16 w-full rounded-2xl" />
                <LoadingSkeleton className="h-16 w-full rounded-2xl" />
                <LoadingSkeleton className="h-16 w-full rounded-2xl" />
              </div>
            )}
            {error && <p className="text-sm text-ember">{error}</p>}
            {!loading && !error && marketPulse.length === 0 && (
              <p className="text-sm text-muted">{t("home.marketPulse.empty")}</p>
            )}
            <div className="space-y-3">
              {marketPulse.slice(0, 3).map((quote) => (
                <div
                  key={quote.symbol}
                  title={`${quote.symbol} - ${quote.name}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <StockIcon symbol={quote.symbol} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {quote.symbol}
                      </p>
                      <p className="text-xs text-muted">{quote.name}</p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      (quote.percentChange || 0) >= 0 ? "text-neon" : "text-ember"
                    }`}
                  >
                    {formatPercent(quote.percentChange)}
                  </p>
                </div>
              ))}
            </div>
          </ModuleCard>
        </aside>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        {activeModules.map((module) => {
          switch (module.id) {
            case "watchlist":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.module.watchlistTitle")}
                  subtitle={t("home.module.watchlistSubtitle")}
                >
                  <LazyViewport
                    placeholder={<LoadingSkeleton className="h-[340px] w-full rounded-2xl" />}
                  >
                    <WatchlistWidget
                      t={t}
                      watchlist={watchlist}
                      quoteMap={quoteMap}
                      loading={loading}
                      error={error}
                      locale={locale}
                      theme={theme}
                      hiddenWidgetTickers={hiddenWidgetTickers}
                      visibleWidgetTickers={visibleWidgetTickers}
                      streamConnected={quoteStream.connected}
                      streamError={quoteStream.error}
                      onToggleTicker={toggleWidgetTicker}
                      onShowAll={() => setHiddenWidgetTickers([])}
                      onAddTicker={(symbol) => {
                        if (watchlist.includes(symbol)) {
                          pushToast(
                            t("home.toast.watchlistExists", undefined, { symbol }),
                            "info"
                          );
                          return;
                        }
                        setWatchlist([...watchlist, symbol]);
                        pushToast(
                          t("home.toast.watchlistAdded", undefined, { symbol }),
                          "success"
                        );
                      }}
                    />
                  </LazyViewport>
                </ModuleCard>
              );
            case "heatmap":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.module.heatmapTitle")}
                  subtitle={t("home.module.heatmapSubtitle")}
                  actions={
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                      onClick={() => router.push("/compare")}
                    >
                      {t("common.explore")}
                    </button>
                  }
                >
                  <LazyViewport
                    placeholder={<LoadingSkeleton className="h-[360px] w-full rounded-2xl" />}
                  >
                    <HeatmapWidget
                      data={heatmap}
                      period={heatmapPeriod}
                      onPeriodChange={setHeatmapPeriod}
                      loading={heatmapLoading}
                      error={heatmapError}
                      onOpenTicker={(symbol) => {
                        void navigateToTicker(router, symbol);
                      }}
                    />
                  </LazyViewport>
                </ModuleCard>
              );
            case "portfolio":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.module.portfolioTitle")}
                  subtitle={t("home.module.portfolioSubtitle")}
                  actions={
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                      onClick={() => router.push("/portfolio")}
                    >
                      {t("common.manage")}
                    </button>
                  }
                >
                  <div className="space-y-3 text-sm text-muted">
                    <div className="flex items-center justify-between">
                      <span>{t("portfolio.totalValue")}</span>
                      <span className="text-ink">
                        {formatCurrency(portfolioSummary.totalValue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("portfolio.totalPnL")}</span>
                      <span
                        className={`${
                          portfolioSummary.totalPnL >= 0
                            ? "text-neon"
                            : "text-ember"
                        }`}
                      >
                        {formatCurrency(portfolioSummary.totalPnL)} (
                        {portfolioSummary.totalPnLPercent.toFixed(2)}%)
                      </span>
                    </div>
                    {holdings.length === 0 && (
                      <p className="text-xs text-muted">
                        {t("home.portfolio.empty")}
                      </p>
                    )}
                  </div>
                </ModuleCard>
              );
            case "alerts":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.module.alertsTitle")}
                  subtitle={t("home.module.alertsSubtitle")}
                  actions={
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                      onClick={() => router.push("/alerts")}
                    >
                      {t("common.manage")}
                    </button>
                  }
                >
                  <div className="space-y-3 text-sm text-muted">
                    {alertStatuses.length === 0 && (
                      <p className="text-xs text-muted">
                        {t("home.alerts.empty")}
                      </p>
                    )}
                    {alertStatuses.slice(0, 4).map(({ alert, status }) => (
                      <div
                        key={alert.id}
                        title={alert.symbol}
                        className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <StockIcon symbol={alert.symbol} size="sm" />
                          <p className="text-sm font-semibold text-ink">
                            {alert.symbol}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">
                            {alert.condition} {alert.value}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            status.triggered ? "text-neon" : "text-muted"
                          }`}
                        >
                          {status.triggered ? t("alerts.triggered") : t("alerts.watching")}
                        </span>
                      </div>
                    ))}
                  </div>
                </ModuleCard>
              );
            case "news":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.module.newsTitle")}
                  subtitle={t("home.module.newsSubtitle")}
                  actions={
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                      onClick={() => router.push("/news")}
                    >
                      {t("home.news.openFeed")}
                    </button>
                  }
                >
                  <LazyViewport
                    placeholder={<LoadingSkeleton className="h-[240px] w-full rounded-2xl" />}
                  >
                    <NewsWidget t={t} news={news} loading={newsLoading} />
                  </LazyViewport>
                </ModuleCard>
              );
            case "brief":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.brief.title", "Morning Brief")}
                  subtitle={t(
                    "home.brief.subtitle",
                    "Personalized open snapshot from portfolio and market tone"
                  )}
                >
                  <LazyViewport
                    placeholder={<LoadingSkeleton className="h-[200px] w-full rounded-2xl" />}
                  >
                    <MorningBriefWidget
                      t={t}
                      watchlist={watchlist}
                      quotes={[...quoteMap.values()]}
                      news={news}
                    />
                  </LazyViewport>
                </ModuleCard>
              );
            case "insights":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.module.insightsTitle")}
                  subtitle={t("home.module.insightsSubtitle")}
                  actions={
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                      onClick={() => {
                        void navigateToTicker(router, watchlist[0] || "AAPL");
                      }}
                    >
                      {t("common.explore")}
                    </button>
                  }
                >
                  <p className="text-sm text-muted">
                    {t("home.insights.body")}
                  </p>
                </ModuleCard>
              );
            case "strategy":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.module.strategyTitle")}
                  subtitle={t("home.module.strategySubtitle")}
                  actions={
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                      onClick={() => router.push("/strategy")}
                    >
                      {t("home.feature.open")}
                    </button>
                  }
                >
                  <p className="text-sm text-muted">
                    {t("home.strategy.body")}
                  </p>
                </ModuleCard>
              );
            case "inventory":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.inventory.title")}
                  subtitle={t("home.inventory.subtitle")}
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-muted">
                      <p className="text-ink text-lg font-semibold">
                        {Math.round(alertConversionRate * 100)}%
                      </p>
                      <p className="mt-1 uppercase tracking-[0.2em]">
                        {t("home.inventory.alertConversion")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-muted">
                      <p className="text-ink text-lg font-semibold">
                        {avgRecoveryHours ? `${avgRecoveryHours.toFixed(1)}h` : "--"}
                      </p>
                      <p className="mt-1 uppercase tracking-[0.2em]">
                        {t("home.inventory.stockoutRecovery")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-muted">
                      <p className="text-ink text-lg font-semibold">
                        {thresholdAdjustments}
                      </p>
                      <p className="mt-1 uppercase tracking-[0.2em]">
                        {t("home.inventory.thresholdEdits")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {inventoryItems.map((item) => {
                      const low = item.stock <= item.threshold;
                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm text-muted"
                        >
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {item.name}
                            </p>
                            <p className="text-xs text-muted">
                              {t("home.inventory.itemMeta", undefined, {
                                sku: item.sku,
                                stock: item.stock,
                                unit: item.unit,
                                threshold: item.threshold
                              })}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                low ? "text-ember" : "text-neon"
                              }`}
                            >
                              {low ? t("home.inventory.belowThreshold") : t("home.inventory.healthy")}
                            </span>
                            <button
                              className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                              onClick={() => consumeItem(item.id)}
                            >
                              {t("home.inventory.consume")}
                            </button>
                            <button
                              className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                              onClick={() => restockItem(item.id)}
                            >
                              {t("home.inventory.restock")}
                            </button>
                          </div>
                          <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted">
                            <input
                              className="w-20 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-ink"
                              placeholder={`${item.threshold}`}
                              value={thresholdDrafts[item.id] || ""}
                              onChange={(event) =>
                                setThresholdDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value
                                }))
                              }
                            />
                            <button
                              className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted"
                              onClick={() => updateThreshold(item.id)}
                            >
                              {t("home.inventory.setThreshold")}
                            </button>
                            <span>
                              {t("home.inventory.lastRestock")}{" "}
                              {item.lastRestock
                                ? new Date(item.lastRestock).toLocaleDateString(
                                    "en-US",
                                    { timeZone: "UTC" }
                                  )
                                : "--"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {t("home.inventory.pendingAlerts")}
                    </p>
                    {inventoryPending.length === 0 && (
                      <p className="mt-2 text-sm text-muted">{t("home.inventory.noPending")}</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {inventoryAlerts.slice(0, 3).map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs text-muted"
                        >
                          <span>
                            {t("home.inventory.alertItem", undefined, {
                              name: alert.name,
                              stock: alert.stock
                            })}
                          </span>
                          <span className="text-ember">
                            {alert.status === "pending"
                              ? t("home.inventory.notifyAdmin")
                              : t("home.inventory.resolved")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ModuleCard>
              );
            case "license":
              return (
                <ModuleCard
                  key={module.id}
                  title={t("home.license.title")}
                  subtitle={t("home.license.subtitle")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-ink">
                        <IconSBP size={22} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {t("home.license.plan")}
                        </p>
                        <p className="text-xs text-muted">
                          {t("home.license.price")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {licensePayment.status === "unpaid" && (
                          <button
                            className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
                            onClick={payWithTbank}
                          >
                            {t("home.license.payWithTbank")}
                          </button>
                      )}
                      {licensePayment.status === "pending" && (
                        <>
                          <button
                            className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted"
                            onClick={markLicensePaid}
                          >
                            {t("home.license.markPaid")}
                          </button>
                          <button
                            className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted"
                            onClick={resetLicense}
                          >
                            {t("common.cancel")}
                          </button>
                        </>
                      )}
                      {licensePayment.status === "paid" && (
                        <button
                          className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted"
                          onClick={resetLicense}
                        >
                          {t("common.reset")}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3 text-xs text-muted">
                    {licensePayment.status === "unpaid" && (
                      <div className="space-y-2">
                        <p>{t("home.license.redirectHint")}</p>
                        {!process.env.NEXT_PUBLIC_TBANK_PAYMENT_URL && (
                          <p className="text-ember">
                            {t("home.license.missingPaymentUrl")}
                          </p>
                        )}
                      </div>
                    )}
                    {licensePayment.status === "pending" && (
                      <div className="space-y-2">
                        <p>
                          {t("home.license.pending")}
                        </p>
                        <p className="text-ink">
                          {t("home.license.paymentId", undefined, {
                            id: licensePayment.id || "--"
                          })}
                        </p>
                      </div>
                    )}
                    {licensePayment.status === "paid" && (
                      <p className="text-neon">
                        {t("home.license.paid")}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 px-4 py-4 text-xs text-muted">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {t("home.sbp.title")}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {t("home.sbp.subtitle")}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.companyId")}
                        value={sbpForm.extCompanyId}
                        onChange={(event) =>
                          setSbpForm((prev) => ({
                            ...prev,
                            extCompanyId: event.target.value
                          }))
                        }
                      />
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.shopId")}
                        value={sbpForm.extShopId}
                        onChange={(event) =>
                          setSbpForm((prev) => ({
                            ...prev,
                            extShopId: event.target.value
                          }))
                        }
                      />
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.bankName")}
                        value={sbpForm.bankName}
                        onChange={(event) =>
                          setSbpForm((prev) => ({
                            ...prev,
                            bankName: event.target.value
                          }))
                        }
                      />
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.bik")}
                        value={sbpForm.bik}
                        onChange={(event) =>
                          setSbpForm((prev) => ({ ...prev, bik: event.target.value }))
                        }
                      />
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.corrAccount")}
                        value={sbpForm.corrAccount}
                        onChange={(event) =>
                          setSbpForm((prev) => ({
                            ...prev,
                            corrAccount: event.target.value
                          }))
                        }
                      />
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.currentAccount")}
                        value={sbpForm.currentAccount}
                        onChange={(event) =>
                          setSbpForm((prev) => ({
                            ...prev,
                            currentAccount: event.target.value
                          }))
                        }
                      />
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.terminalSerial")}
                        value={sbpForm.serialNumber}
                        onChange={(event) =>
                          setSbpForm((prev) => ({
                            ...prev,
                            serialNumber: event.target.value
                          }))
                        }
                      />
                      <input
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink"
                        placeholder={t("home.sbp.apiType")}
                        value={sbpForm.apiType}
                        onChange={(event) =>
                          setSbpForm((prev) => ({
                            ...prev,
                            apiType: event.target.value
                          }))
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
                        onClick={registerSbp}
                        disabled={sbpStatus === "loading"}
                      >
                        {sbpStatus === "loading"
                          ? t("home.sbp.submitting")
                          : t("home.sbp.register")}
                      </button>
                      {sbpStatus === "success" && (
                        <span className="text-neon">{t("home.sbp.submitted")}</span>
                      )}
                      {sbpStatus === "error" && (
                        <span className="text-ember">{sbpError}</span>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      {t("home.sbp.requirements")}
                    </p>
                  </div>
                </ModuleCard>
              );
            default:
              return null;
          }
        })}
      </section>
    </Layout>
  );
}
