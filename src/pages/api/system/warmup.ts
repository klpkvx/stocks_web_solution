import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { warmupQuerySchema } from "@/contracts/requestContracts";

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "AMZN"];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
    if (token !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const query = parseQuery(req, res, warmupQuerySchema);
  if (!query) return;
  const target = query.symbols?.length ? query.symbols : DEFAULT_SYMBOLS;
  const forceRefresh = query.refresh;

  const startedAt = Date.now();
  const warmResults = await Promise.allSettled([
    dataAccess.dashboard(target, {
      includeNews: true,
      includeHeatmap: true,
      newsSymbol: target[0] || "AAPL",
      forceRefresh
    }),
    ...target.slice(0, 4).map((symbol) => dataAccess.sec(symbol, { forceRefresh })),
    dataAccess.warmTickers(target)
  ]);

  const settled = {
    fulfilled: warmResults.filter((result) => result.status === "fulfilled").length,
    rejected: warmResults.filter((result) => result.status === "rejected").length
  };

  return res.status(200).json({
    warmed: target.length,
    symbols: target,
    forceRefresh,
    durationMs: Date.now() - startedAt,
    tasks: settled
  });
}

export default withApiObservability("system.warmup", handler);
