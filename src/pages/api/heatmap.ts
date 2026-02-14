import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { heatmapQuerySchema } from "@/contracts/requestContracts";
import { errorMessage } from "@/lib/errorMessage";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = parseQuery(req, res, heatmapQuerySchema);
  if (!query) return;
  const forceRefresh = query.refresh;

  try {
    const payload = await dataAccess.heatmap({ forceRefresh });
    res.setHeader(
      "Cache-Control",
      `s-maxage=${payload.expiresIn}, stale-while-revalidate=${payload.expiresIn}`
    );
    return res.status(200).json(payload);
  } catch (error: unknown) {
    return res.status(500).json({
      error: errorMessage(error, "Failed to build heatmap")
    });
  }
}

export default withApiObservability("heatmap", handler, {
  methods: ["GET"]
});
