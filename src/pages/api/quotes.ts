import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { quotesQuerySchema } from "@/contracts/requestContracts";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = parseQuery(req, res, quotesQuerySchema);
  if (!query) return;
  const symbols = query.symbols;
  const forceRefresh = query.refresh;

  const payload = await dataAccess.quotes(symbols, { forceRefresh });

  res.setHeader(
    "Cache-Control",
    `s-maxage=${payload.expiresIn}, stale-while-revalidate=${payload.expiresIn}`
  );
  return res.status(200).json(payload);
}

export default withApiObservability("quotes", handler, {
  methods: ["GET"]
});
