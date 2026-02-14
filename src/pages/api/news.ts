import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { newsQuerySchema } from "@/contracts/requestContracts";
import { errorMessage } from "@/lib/errorMessage";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = parseQuery(req, res, newsQuerySchema);
  if (!query) return;
  const symbol = query.symbol || "";
  const from = query.from;
  const to = query.to;
  const forceRefresh = query.refresh;

  try {
    const payload = await dataAccess.news(symbol, {
      from,
      to,
      forceRefresh
    });

    res.setHeader(
      "Cache-Control",
      `s-maxage=${payload.expiresIn}, stale-while-revalidate=${payload.expiresIn}`
    );

    return res.status(200).json(payload);
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ error: errorMessage(error, "Failed to load news") });
  }
}

export default withApiObservability("news", handler, {
  methods: ["GET"]
});
