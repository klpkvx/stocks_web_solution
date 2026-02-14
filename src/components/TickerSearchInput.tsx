import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { StockTicker } from "@/lib/twelveData";
import StockIcon from "@/components/StockIcon";
import { useI18n } from "@/components/I18nProvider";
import { normalizeTickerInput, POPULAR_TICKERS } from "@/lib/tickers";
import { resolveWithClientCache, primeClientCache } from "@/lib/queryCacheBridge";
import { readFreshCache, readStaleCache } from "@/stores/apiCacheStore";
import { fetchJson } from "@/lib/apiClient";
import { tickersPayloadSchema } from "@/contracts/apiContracts";
import { errorMessage } from "@/lib/errorMessage";

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_API_QUERY_LENGTH = 3;
const REMOTE_QUERY_PREFIX_LEN = 4;
const REMOTE_LIMIT = 40;
const RESULT_LIMIT = 12;
const LOCAL_STORAGE_PREFIX = "ticker-search-cache:v2:";

type TickerResponse = {
  tickers: StockTicker[];
  expiresIn?: number;
};

type PersistentCacheValue = {
  expiresAt: number;
  value: TickerResponse;
};

function asTicker(symbol: string): StockTicker {
  return {
    symbol,
    name: symbol,
    exchange: "US",
    country: "US",
    type: "Common Stock"
  };
}

function localTickerMatches(query: string, limit: number) {
  if (!query) return [];
  const normalized = normalizeTickerInput(query);
  if (!normalized) return [];
  return POPULAR_TICKERS
    .filter((symbol) => symbol.includes(normalized))
    .slice(0, limit)
    .map(asTicker);
}

function mergeUnique(items: StockTicker[]) {
  const map = new Map<string, StockTicker>();
  items.forEach((item) => {
    const symbol = normalizeTickerInput(item.symbol || "");
    if (!symbol) return;
    if (map.has(symbol)) return;
    map.set(symbol, { ...item, symbol, name: item.name || symbol });
  });
  return Array.from(map.values());
}

function filterByQuery(items: StockTicker[], query: string) {
  const normalized = normalizeTickerInput(query);
  if (!normalized) return [];
  return items.filter((item) => {
    const symbol = normalizeTickerInput(item.symbol || "");
    const name = String(item.name || "").toUpperCase();
    return symbol.includes(normalized) || name.includes(normalized);
  });
}

function readPersistentCache(key: string): TickerResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistentCacheValue;
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() > Number(parsed.expiresAt || 0)) {
      window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writePersistentCache(key: string, value: TickerResponse, ttlMs: number) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistentCacheValue = {
      expiresAt: Date.now() + Math.max(0, ttlMs),
      value
    };
    window.localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX}${key}`,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage quota / private mode errors.
  }
}

export default function TickerSearchInput({
  placeholder,
  buttonLabel,
  className = "",
  compact = false,
  inputAriaLabel,
  onSubmit
}: {
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
  compact?: boolean;
  inputAriaLabel?: string;
  onSubmit: (ticker: string) => void;
}) {
  const [value, setValue] = useState("");
  const [items, setItems] = useState<StockTicker[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const lastRemoteRef = useRef<{ query: string; tickers: StockTicker[] } | null>(
    null
  );
  const listId = useId();
  const { t } = useI18n();

  const query = useMemo(() => normalizeTickerInput(value), [value]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!query) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    const local = localTickerMatches(query, 12);
    if (local.length) {
      setItems(local);
      setActive(0);
    }

    if (query.length < MIN_API_QUERY_LENGTH) {
      setLoading(false);
      setError(null);
      return;
    }

    const remoteQuery = query.slice(0, REMOTE_QUERY_PREFIX_LEN);
    const cacheKey = `ticker-search:${remoteQuery}:${REMOTE_LIMIT}`;
    const fromLastRemote = lastRemoteRef.current;
    if (fromLastRemote && query.startsWith(fromLastRemote.query)) {
      const narrowed = filterByQuery(fromLastRemote.tickers, query);
      if (narrowed.length) {
        setItems(mergeUnique([...narrowed, ...local]).slice(0, RESULT_LIMIT));
        setActive(0);
        setLoading(false);
        setError(null);
        if (query.length > fromLastRemote.query.length) {
          return;
        }
      }
    }

    const fresh = readFreshCache<TickerResponse>(cacheKey);
    const persisted = fresh ? null : readPersistentCache(cacheKey);
    if (!fresh && persisted?.tickers?.length) {
      const ttlMs =
        Number(persisted.expiresIn || 0) > 0
          ? Number(persisted.expiresIn) * 1000
          : DEFAULT_TTL_MS;
      primeClientCache(cacheKey, persisted, ttlMs);
    }

    const immediate = fresh?.value || persisted;
    if (immediate?.tickers?.length) {
      const filtered = filterByQuery(immediate.tickers, query);
      const merged = mergeUnique([...filtered, ...local]).slice(0, RESULT_LIMIT);
      setItems(merged);
      lastRemoteRef.current = { query: remoteQuery, tickers: immediate.tickers };
      setLoading(false);
      setError(null);
      if (merged.length || query.length > remoteQuery.length) {
        return;
      }
    }

    const stale = readStaleCache<TickerResponse>(cacheKey);
    if (stale?.value?.tickers?.length) {
      const filtered = filterByQuery(stale.value.tickers, query);
      setItems(mergeUnique([...filtered, ...local]).slice(0, RESULT_LIMIT));
      setActive(0);
      lastRemoteRef.current = { query: remoteQuery, tickers: stale.value.tickers };
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      try {
        if (!cancelled && requestIdRef.current === requestId) {
          setLoading(true);
          setError(null);
        }

        const payload = await resolveWithClientCache<TickerResponse>({
          key: cacheKey,
          ttlMs: (value) =>
            Number(value.expiresIn || 0) > 0
              ? Number(value.expiresIn) * 1000
              : DEFAULT_TTL_MS,
          staleIfError: true,
          fetcher: async () => {
            return fetchJson<TickerResponse>(
              `/api/tickers?q=${encodeURIComponent(remoteQuery)}&limit=${REMOTE_LIMIT}`,
              2200,
              tickersPayloadSchema
            );
          }
        });

        if (cancelled || requestIdRef.current !== requestId) return;

        const apiTickers = Array.isArray(payload.tickers) ? payload.tickers : [];
        lastRemoteRef.current = { query: remoteQuery, tickers: apiTickers };
        const ttlMs =
          Number(payload.expiresIn || 0) > 0
            ? Number(payload.expiresIn) * 1000
            : DEFAULT_TTL_MS;
        writePersistentCache(cacheKey, payload, ttlMs);

        const filtered = filterByQuery(apiTickers, query);
        const merged = mergeUnique([...filtered, ...local]).slice(0, RESULT_LIMIT);
        setItems(merged);
        if (merged.length) {
          setActive(0);
        }
      } catch (err: unknown) {
        if (!cancelled && requestIdRef.current === requestId) {
          if (err instanceof Error && err.name === "AbortError") return;
          setError(errorMessage(err, t("search.errorLoadTickers")));
        }
      } finally {
        if (!cancelled && requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, t]);

  function submit(ticker?: string) {
    const symbol = normalizeTickerInput(ticker || query);
    if (!symbol) return;
    onSubmit(symbol);
    setOpen(false);
  }

  const inputClass = compact
    ? "w-28 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-ink placeholder:text-muted outline-none transition focus:border-glow/60 sm:w-32"
    : "flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-ink placeholder:text-muted outline-none transition focus:border-glow/60";

  const buttonClass = compact
    ? "rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted transition hover:border-white/30 hover:text-ink"
    : "rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-3 text-sm font-semibold text-night shadow-glow transition hover:opacity-90";

  return (
    <div
      ref={rootRef}
      className={`relative z-[130] flex w-full flex-wrap items-center gap-3 ${className}`}
    >
      <input
        className={inputClass}
        placeholder={placeholder || t("layout.searchTicker")}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={inputAriaLabel || t("layout.searchTicker")}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setValue(normalizeTickerInput(event.target.value));
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!open || items.length === 0) {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((prev) => Math.min(prev + 1, items.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((prev) => Math.max(prev - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            submit(items[active]?.symbol || query);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className={buttonClass}
        onClick={() => submit()}
        aria-label={buttonLabel || t("search.go")}
      >
        {buttonLabel || t("search.go")}
      </button>

      {open && (query.length > 0 || loading || error) && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-[150] mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-white/10 bg-night/95 p-2 shadow-card backdrop-blur-xl"
        >
          {query.length > 0 && query.length < MIN_API_QUERY_LENGTH && (
            <p className="px-3 py-2 text-xs text-muted">
              {t("search.minChars", undefined, { n: MIN_API_QUERY_LENGTH })}
            </p>
          )}
          {loading && (
            <p className="px-3 py-2 text-xs text-muted">{t("search.loadingTickers")}</p>
          )}
          {error && <p className="px-3 py-2 text-xs text-ember">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">
              {t("search.noMatches", undefined, { query })}
            </p>
          )}
          {!loading &&
            !error &&
            items.map((item, idx) => {
              const description = `${item.name}${item.exchange ? ` - ${item.exchange}` : ""}${item.type ? ` - ${item.type}` : ""}`;
              return (
                <button
                  key={`${item.symbol}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  title={description}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${
                    idx === active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => {
                    setValue(item.symbol);
                    submit(item.symbol);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <StockIcon symbol={item.symbol} size="sm" />
                    <div>
                      <p className="text-xs font-semibold text-ink">{item.symbol}</p>
                      <p className="text-[11px] text-muted">{item.name}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted">{item.exchange || item.country}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
