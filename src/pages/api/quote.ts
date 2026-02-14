import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { quoteQuerySchema } from "@/contracts/requestContracts";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = parseQuery(req, res, quoteQuerySchema);
  if (!query) return;
  const symbol = query.symbol;
  const forceRefresh = query.refresh;
  const payload = await dataAccess.quotes([symbol], { forceRefresh });
  const quote = payload.quotes.find((item) => item.symbol === symbol) || null;

  if (!quote) {
    return res.status(404).json({ error: "Quote not found" });
  }

  res.setHeader(
    "Cache-Control",
    `s-maxage=${payload.expiresIn}, stale-while-revalidate=${payload.expiresIn}`
  );
  return res.status(200).json({
    quote,
    warning: payload.warning || null,
    stale: payload.stale || false,
    expiresIn: payload.expiresIn
  });
}

export default withApiObservability("quote", handler);
