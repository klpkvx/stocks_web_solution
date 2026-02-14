import en_alerts from "./en/alerts.json";
import en_brand from "./en/brand.json";
import en_breadcrumbs from "./en/breadcrumbs.json";
import en_city from "./en/city.json";
import en_command from "./en/command.json";
import en_common from "./en/common.json";
import en_compare from "./en/compare.json";
import en_cookie from "./en/cookie.json";
import en_debate from "./en/debate.json";
import en_experience from "./en/experience.json";
import en_flow from "./en/flow.json";
import en_footer from "./en/footer.json";
import en_hero from "./en/hero.json";
import en_home from "./en/home.json";
import en_lang from "./en/lang.json";
import en_layout from "./en/layout.json";
import en_legal from "./en/legal.json";
import en_marketMap from "./en/marketMap.json";
import en_mode from "./en/mode.json";
import en_nav from "./en/nav.json";
import en_news from "./en/news.json";
import en_notfound from "./en/notfound.json";
import en_portfolio from "./en/portfolio.json";
import en_search from "./en/search.json";
import en_sec from "./en/sec.json";
import en_sensory from "./en/sensory.json";
import en_sentiment from "./en/sentiment.json";
import en_stock from "./en/stock.json";
import en_strategy from "./en/strategy.json";
import en_theme from "./en/theme.json";
import en_timeMachine from "./en/timeMachine.json";
import en_toast from "./en/toast.json";
import ru_alerts from "./ru/alerts.json";
import ru_brand from "./ru/brand.json";
import ru_breadcrumbs from "./ru/breadcrumbs.json";
import ru_city from "./ru/city.json";
import ru_command from "./ru/command.json";
import ru_common from "./ru/common.json";
import ru_compare from "./ru/compare.json";
import ru_cookie from "./ru/cookie.json";
import ru_debate from "./ru/debate.json";
import ru_experience from "./ru/experience.json";
import ru_flow from "./ru/flow.json";
import ru_footer from "./ru/footer.json";
import ru_hero from "./ru/hero.json";
import ru_home from "./ru/home.json";
import ru_lang from "./ru/lang.json";
import ru_layout from "./ru/layout.json";
import ru_legal from "./ru/legal.json";
import ru_marketMap from "./ru/marketMap.json";
import ru_mode from "./ru/mode.json";
import ru_nav from "./ru/nav.json";
import ru_news from "./ru/news.json";
import ru_notfound from "./ru/notfound.json";
import ru_portfolio from "./ru/portfolio.json";
import ru_search from "./ru/search.json";
import ru_sec from "./ru/sec.json";
import ru_sensory from "./ru/sensory.json";
import ru_sentiment from "./ru/sentiment.json";
import ru_stock from "./ru/stock.json";
import ru_strategy from "./ru/strategy.json";
import ru_theme from "./ru/theme.json";
import ru_timeMachine from "./ru/timeMachine.json";
import ru_toast from "./ru/toast.json";

export const KNOWN_NAMESPACES = ["alerts","brand","breadcrumbs","city","command","common","compare","cookie","debate","experience","flow","footer","hero","home","lang","layout","legal","marketMap","mode","nav","news","notfound","portfolio","search","sec","sensory","sentiment","stock","strategy","theme","timeMachine","toast"] as const;

export type Namespace = (typeof KNOWN_NAMESPACES)[number];

export const LOCALE_NAMESPACE_MESSAGES: Record<"en" | "ru", Record<Namespace, Record<string, string>>> = {
  en: {
    "alerts": en_alerts,
    "brand": en_brand,
    "breadcrumbs": en_breadcrumbs,
    "city": en_city,
    "command": en_command,
    "common": en_common,
    "compare": en_compare,
    "cookie": en_cookie,
    "debate": en_debate,
    "experience": en_experience,
    "flow": en_flow,
    "footer": en_footer,
    "hero": en_hero,
    "home": en_home,
    "lang": en_lang,
    "layout": en_layout,
    "legal": en_legal,
    "marketMap": en_marketMap,
    "mode": en_mode,
    "nav": en_nav,
    "news": en_news,
    "notfound": en_notfound,
    "portfolio": en_portfolio,
    "search": en_search,
    "sec": en_sec,
    "sensory": en_sensory,
    "sentiment": en_sentiment,
    "stock": en_stock,
    "strategy": en_strategy,
    "theme": en_theme,
    "timeMachine": en_timeMachine,
    "toast": en_toast,
  },
  ru: {
    "alerts": ru_alerts,
    "brand": ru_brand,
    "breadcrumbs": ru_breadcrumbs,
    "city": ru_city,
    "command": ru_command,
    "common": ru_common,
    "compare": ru_compare,
    "cookie": ru_cookie,
    "debate": ru_debate,
    "experience": ru_experience,
    "flow": ru_flow,
    "footer": ru_footer,
    "hero": ru_hero,
    "home": ru_home,
    "lang": ru_lang,
    "layout": ru_layout,
    "legal": ru_legal,
    "marketMap": ru_marketMap,
    "mode": ru_mode,
    "nav": ru_nav,
    "news": ru_news,
    "notfound": ru_notfound,
    "portfolio": ru_portfolio,
    "search": ru_search,
    "sec": ru_sec,
    "sensory": ru_sensory,
    "sentiment": ru_sentiment,
    "stock": ru_stock,
    "strategy": ru_strategy,
    "theme": ru_theme,
    "timeMachine": ru_timeMachine,
    "toast": ru_toast,
  },
};

export const LOCALE_MESSAGES: Record<"en" | "ru", Record<string, string>> = {
  en: {
    ...en_alerts,
    ...en_brand,
    ...en_breadcrumbs,
    ...en_city,
    ...en_command,
    ...en_common,
    ...en_compare,
    ...en_cookie,
    ...en_debate,
    ...en_experience,
    ...en_flow,
    ...en_footer,
    ...en_hero,
    ...en_home,
    ...en_lang,
    ...en_layout,
    ...en_legal,
    ...en_marketMap,
    ...en_mode,
    ...en_nav,
    ...en_news,
    ...en_notfound,
    ...en_portfolio,
    ...en_search,
    ...en_sec,
    ...en_sensory,
    ...en_sentiment,
    ...en_stock,
    ...en_strategy,
    ...en_theme,
    ...en_timeMachine,
    ...en_toast,
  },
  ru: {
    ...ru_alerts,
    ...ru_brand,
    ...ru_breadcrumbs,
    ...ru_city,
    ...ru_command,
    ...ru_common,
    ...ru_compare,
    ...ru_cookie,
    ...ru_debate,
    ...ru_experience,
    ...ru_flow,
    ...ru_footer,
    ...ru_hero,
    ...ru_home,
    ...ru_lang,
    ...ru_layout,
    ...ru_legal,
    ...ru_marketMap,
    ...ru_mode,
    ...ru_nav,
    ...ru_news,
    ...ru_notfound,
    ...ru_portfolio,
    ...ru_search,
    ...ru_sec,
    ...ru_sensory,
    ...ru_sentiment,
    ...ru_stock,
    ...ru_strategy,
    ...ru_theme,
    ...ru_timeMachine,
    ...ru_toast,
  },
};
