import type { NextApiRequest, NextApiResponse } from "next";
import { getRecentFilings } from "@/lib/sec";
import { SECTOR_MAP } from "@/lib/sectors";
import { cached } from "@/lib/serverStore";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { insiderFlowQuerySchema } from "@/contracts/requestContracts";

const DEFAULT_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "JPM",
  "XOM",
  "UNH"
];

const WINDOW_DAYS = 7;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;
const INSIDER_REFRESH_MS = 30 * 60 * 1000;
const INSIDER_STALE_MS = 6 * 60 * 60 * 1000;
const INSIDER_EXPIRES_IN = Math.max(60, Math.floor(INSIDER_REFRESH_MS / 1000));

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = parseQuery(req, res, insiderFlowQuerySchema);
  if (!query) return;
  const symbols = query.symbols?.length ? query.symbols : DEFAULT_SYMBOLS;

  try {
    const payload = await cached(
      `insider-flow:${symbols.join(",")}`,
      async () => {
        const now = Date.now();
        const filingsList = await Promise.all(
          symbols.map(async (symbol) => {
            const { filings } = await getRecentFilings(symbol);
            const recentForm4 = (
              filings as Array<{ filingDate?: string; form?: string }>
            ).filter((filing) => {
              if (!filing?.filingDate) return false;
              const when = Date.parse(filing.filingDate);
              if (!Number.isFinite(when)) return false;
              const isForm4 = String(filing.form || "").startsWith("4");
              return isForm4 && now - when <= WINDOW_MS;
            });
            return {
              symbol,
              sector: SECTOR_MAP[symbol] || "Other",
              form4Count: recentForm4.length
            };
          })
        );

        const sectorTotals = filingsList.reduce<Record<string, number>>(
          (acc, item) => {
            acc[item.sector] = (acc[item.sector] || 0) + item.form4Count;
            return acc;
          },
          {}
        );

        const totalForm4 = filingsList.reduce(
          (acc, item) => acc + item.form4Count,
          0
        );

        return {
          windowDays: WINDOW_DAYS,
          totalForm4,
          symbols: filingsList,
          sectors: sectorTotals,
          note: "Form 4 filing volume only. Not directional buy/sell data.",
          expiresIn: INSIDER_EXPIRES_IN
        };
      },
      {
        ttlMs: INSIDER_REFRESH_MS,
        staleTtlMs: INSIDER_STALE_MS,
        staleIfError: true,
        backgroundRevalidate: true,
        l2: true
      }
    );

    res.setHeader(
      "Cache-Control",
      `s-maxage=${INSIDER_EXPIRES_IN}, stale-while-revalidate=${INSIDER_EXPIRES_IN}`
    );
    return res.status(200).json(payload);
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to load insider flow" });
  }
}

export default withApiObservability("insider_flow", handler);
