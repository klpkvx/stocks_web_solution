import {
  IconBell,
  IconChart,
  IconPulse,
  IconRadar,
  IconSpark,
  IconStack
} from "@/components/Icons";

export const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "GOOGL"];
export const DASHBOARD_POLL_MS = 60 * 1000;
export const WORKSPACE_PRESET_KEY_PREFIX = "workspace-preset:v1:";

export type ModuleConfig = {
  id: string;
  label: string;
  enabled: boolean;
};

export const MODULES: Array<Omit<ModuleConfig, "enabled">> = [
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

export const ROLE_PRESETS: Record<"beginner" | "trader" | "research", string[]> = {
  beginner: ["brief", "watchlist", "news", "portfolio", "alerts"],
  trader: ["watchlist", "heatmap", "alerts", "strategy", "news", "insights"],
  research: ["brief", "news", "heatmap", "insights", "strategy", "inventory"]
};

export const SLIDE_KEYS = [
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

export const FEATURE_CARDS = [
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

export const TRUST_BADGES = [
  "home.trust.ssl",
  "home.trust.price",
  "home.trust.fees",
  "home.trust.free"
];

export const PARTNER_KEYS = [
  "home.partner.twelveData",
  "home.partner.secEdgar",
  "home.partner.newsApi",
  "home.partner.tbank"
];

export const TESTIMONIALS = [
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
