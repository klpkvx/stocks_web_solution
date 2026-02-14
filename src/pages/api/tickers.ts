import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { tickersQuerySchema } from "@/contracts/requestContracts";
import { errorMessage } from "@/lib/errorMessage";

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
  } catch (error: unknown) {
    return res.status(200).json({
      tickers: [],
      expiresIn: 60,
      error: errorMessage(error, "Ticker search unavailable")
    });
  }
}

export default withApiObservability("tickers", handler, {
  methods: ["GET"]
});
