import { runWithResilience } from "@/lib/resilience";

const SEC_BASE = "https://data.sec.gov";
const SEC_TICKER_MAP = "https://www.sec.gov/files/company_tickers.json";
const SEC_TIMEOUT_MS = 2500;

const SEC_CACHE: {
  mapping?: Record<string, string>;
  mappingFetchedAt?: number;
  filings?: Record<string, { fetchedAt: number; data: any }>;
} = {};

const DAY_MS = 24 * 60 * 60 * 1000;

function getUserAgent() {
  return (
    process.env.SEC_USER_AGENT ||
    "AuroraMarkets/1.0 (support@example.com)"
  );
}

async function fetchSec(url: string) {
  const payload = await runWithResilience(
    "sec:fetch",
    async ({ signal }) => {
      const response = await fetch(url, {
        signal,
        headers: {
          "User-Agent": getUserAgent(),
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`SEC request failed: ${response.status}`);
      }
      return response.json();
    },
    {
      timeoutMs: SEC_TIMEOUT_MS,
      retries: 1,
      openAfterFailures: 4,
      openWindowMs: 60 * 1000
    }
  );

  return payload;
}

async function loadTickerMap() {
  if (SEC_CACHE.mapping && SEC_CACHE.mappingFetchedAt) {
    if (Date.now() - SEC_CACHE.mappingFetchedAt < DAY_MS) {
      return SEC_CACHE.mapping;
    }
  }

  const data = await fetchSec(SEC_TICKER_MAP);
  const mapping: Record<string, string> = {};
  Object.values<any>(data).forEach((entry) => {
    if (entry.ticker && entry.cik_str) {
      const cik = String(entry.cik_str).padStart(10, "0");
      mapping[String(entry.ticker).toUpperCase()] = cik;
    }
  });

  SEC_CACHE.mapping = mapping;
  SEC_CACHE.mappingFetchedAt = Date.now();
  return mapping;
}

export async function getCikForTicker(symbol: string) {
  const mapping = await loadTickerMap();
  return mapping[symbol.toUpperCase()] || null;
}

export async function getRecentFilings(symbol: string) {
  if (!SEC_CACHE.filings) {
    SEC_CACHE.filings = {};
  }
  const cached = SEC_CACHE.filings[symbol];
  if (cached && Date.now() - cached.fetchedAt < DAY_MS / 4) {
    return cached.data;
  }

  const cik = await getCikForTicker(symbol);
  if (!cik) {
    throw new Error("CIK not found for symbol");
  }

  const payload = await fetchSec(`${SEC_BASE}/submissions/CIK${cik}.json`);
  const recent = payload?.filings?.recent;
  if (!recent) {
    return { symbol, cik, filings: [] as any[] };
  }

  const filings = (recent.form || []).map((form: string, index: number) => ({
    form,
    filingDate: recent.filingDate?.[index],
    accessionNumber: recent.accessionNumber?.[index],
    description: recent.primaryDocDescription?.[index]
  }));

  const result = { symbol, cik, filings };
  SEC_CACHE.filings[symbol] = { fetchedAt: Date.now(), data: result };
  return result;
}

export function buildWhisperSummary(filings: any[]) {
  if (!filings.length) {
    return {
      headline: "No recent public filings",
      message:
        "Nothing new has hit EDGAR recently. The filing radar looks calm."
    };
  }

  const recentFilings = filings.slice(0, 12);
  const latest = recentFilings[0];
  const formCounts: Record<string, number> = {};
  recentFilings.forEach((filing) => {
    const form = filing.form || "";
    formCounts[form] = (formCounts[form] || 0) + 1;
  });

  const hasForm4 = formCounts["4"] || formCounts["4/A"];
  const has10k = formCounts["10-K"] || formCounts["10-K/A"];
  const has10q = formCounts["10-Q"] || formCounts["10-Q/A"];
  const has8k = formCounts["8-K"] || formCounts["8-K/A"];

  let headline = `Latest filing: ${latest.form}`;
  let message = `Public filing posted on ${latest.filingDate}.`;

  if (hasForm4) {
    headline = "Insider activity spotted";
    message =
      "Form 4 filings were published recently. Public insider transactions are worth a closer look.";
  } else if (has10k) {
    headline = "Fresh annual report";
    message =
      "A 10-K is in the mix. This is the deepest annual snapshot of performance and risk.";
  } else if (has10q) {
    headline = "Quarterly update filed";
    message =
      "A 10-Q landed recently. This is the most current view of quarterly momentum.";
  } else if (has8k) {
    headline = "Event-driven filing";
    message =
      "An 8-K was filed recently. These often contain material corporate updates.";
  }

  return { headline, message };
}
