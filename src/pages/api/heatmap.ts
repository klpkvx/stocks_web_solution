import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { heatmapQuerySchema } from "@/contracts/requestContracts";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Failed to build heatmap"
    });
  }
}

export default withApiObservability("heatmap", handler);
