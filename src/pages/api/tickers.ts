import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { tickersQuerySchema } from "@/contracts/requestContracts";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = parseQuery(req, res, tickersQuerySchema);
  if (!query) return;
  const q = query.q;
  const safeLimit = query.limit;
  const forceRefresh = query.refresh;

  try {
    const payload = await dataAccess.tickerSearch(q, safeLimit, { forceRefresh });
    res.setHeader(
      "Cache-Control",
      `public, max-age=${payload.expiresIn}, stale-while-revalidate=${payload.expiresIn}`
    );
    return res.status(200).json(payload);
  } catch (error: any) {
    return res.status(200).json({
      tickers: [],
      expiresIn: 60,
      error: error?.message || "Ticker search unavailable"
    });
  }
}

export default withApiObservability("tickers", handler);
