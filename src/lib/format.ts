const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();
let runtimeLocale = "en";

export function setFormatLocale(locale: string) {
  runtimeLocale = locale;
}

function resolveLocale(locale?: string) {
  // Keep SSR and first client render deterministic to avoid hydration mismatches.
  const normalized = locale || runtimeLocale || "en";
  return normalized.toLowerCase().startsWith("ru") ? "ru-RU" : "en-US";
}

function getCurrencyFormatter(locale: string, currency: string) {
  const cacheKey = `${locale}:${currency}`;
  if (currencyFormatterCache.has(cacheKey)) {
    return currencyFormatterCache.get(cacheKey)!;
  }
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  });
  currencyFormatterCache.set(cacheKey, formatter);
  return formatter;
}

function getNumberFormatter(locale: string) {
  if (numberFormatterCache.has(locale)) {
    return numberFormatterCache.get(locale)!;
  }
  const formatter = new Intl.NumberFormat(locale);
  numberFormatterCache.set(locale, formatter);
  return formatter;
}

function getDateTimeFormatter(locale: string) {
  if (dateTimeFormatterCache.has(locale)) {
    return dateTimeFormatterCache.get(locale)!;
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  dateTimeFormatterCache.set(locale, formatter);
  return formatter;
}

function getTimeFormatter(locale: string) {
  if (timeFormatterCache.has(locale)) {
    return timeFormatterCache.get(locale)!;
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit"
  });
  timeFormatterCache.set(locale, formatter);
  return formatter;
}

export function formatCurrency(
  value: number | null,
  currency = "USD",
  locale?: string
) {
  if (value === null || Number.isNaN(value)) return "--";
  const resolved = resolveLocale(locale);
  return getCurrencyFormatter(resolved, currency).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${value.toFixed(2)}%`;
}

export function formatNumber(value: number | null, locale?: string) {
  if (value === null || Number.isNaN(value)) return "--";
  const resolved = resolveLocale(locale);
  return getNumberFormatter(resolved).format(value);
}

export function formatDateTime(value: string, locale?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const resolved = resolveLocale(locale);
  return getDateTimeFormatter(resolved).format(date);
}

export function formatTime(value: string, locale?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const resolved = resolveLocale(locale);
  return getTimeFormatter(resolved).format(date);
}
