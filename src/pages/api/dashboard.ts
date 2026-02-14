import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { withApiObservability } from "@/lib/apiObservability";
import type { DashboardPayload as DashboardData } from "@/types/dashboard";
import { parseQuery } from "@/lib/apiValidation";
import { dashboardQuerySchema } from "@/contracts/requestContracts";
import { canWriteResponse } from "@/lib/responseGuards";
import { errorMessage } from "@/lib/errorMessage";

type DashboardPayload = {
  quotes: DashboardData["quotes"];
  news: DashboardData["news"];
  heatmap: DashboardData["heatmap"];
  warnings: string[];
  expiresIn: number;
  updatedAt: string;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = parseQuery(req, res, dashboardQuerySchema);
  if (!query) return;
  const symbols = query.symbols || [];
  const includeNews = query.news;
  const includeHeatmap = query.heatmap;
  const newsSymbol = query.newsSymbol || "";
  const forceRefresh = query.refresh;
  try {
    const [quotesSettled, newsSettled, heatmapSettled] = await Promise.allSettled(
      [
        dataAccess.quotes(symbols, { forceRefresh }),
        includeNews
          ? dataAccess.news(newsSymbol, { forceRefresh })
          : Promise.resolve(null),
        includeHeatmap
          ? dataAccess.heatmap({ forceRefresh })
          : Promise.resolve(null)
      ]
    );

    const quotesResult =
      quotesSettled.status === "fulfilled"
        ? quotesSettled.value
        : { quotes: [], warning: quotesSettled.reason?.message || "Quotes unavailable", expiresIn: 60 };
    const newsResult =
      newsSettled.status === "fulfilled" ? newsSettled.value : null;
    const heatmapResult =
      heatmapSettled.status === "fulfilled" ? heatmapSettled.value : null;

    const warnings: string[] = [];
    if (quotesResult.warning) warnings.push(quotesResult.warning);
    if (newsResult?.warning) warnings.push(newsResult.warning);
    if (heatmapSettled.status === "rejected") {
      warnings.push(heatmapSettled.reason?.message || "Heatmap unavailable");
    }

    const expiresIn = Math.min(
      quotesResult.expiresIn || 60,
      newsResult?.expiresIn || Number.POSITIVE_INFINITY,
      heatmapResult?.expiresIn || Number.POSITIVE_INFINITY
    );

    const payload: DashboardPayload = {
      quotes: quotesResult.quotes,
      news: newsResult,
      heatmap: heatmapResult,
      warnings,
      expiresIn: Number.isFinite(expiresIn) ? Math.max(20, expiresIn) : 60,
      updatedAt: new Date().toISOString()
    };

    res.setHeader(
      "Cache-Control",
      `s-maxage=${payload.expiresIn}, stale-while-revalidate=${payload.expiresIn}`
    );
    if (!canWriteResponse(res)) return;
    return res.status(200).json(payload);
  } catch (error: unknown) {
    if (!canWriteResponse(res)) return;
    return res.status(200).json({
      quotes: [],
      news: null,
      heatmap: null,
      warnings: [errorMessage(error, "Dashboard data unavailable")],
      expiresIn: 30,
      updatedAt: new Date().toISOString()
    });
  }
}

export default withApiObservability("dashboard", handler, {
  methods: ["GET"]
});
