import type { NextApiRequest, NextApiResponse } from "next";
import { cached } from "@/lib/serverStore";
import { withApiObservability } from "@/lib/apiObservability";
import { dataAccess } from "@/lib/dataAccess/service";
import { parseQuery } from "@/lib/apiValidation";
import { compareQuerySchema } from "@/contracts/requestContracts";
import { errorMessage } from "@/lib/errorMessage";

const COMPARE_REFRESH_MS = 10 * 60 * 1000;
const COMPARE_STALE_MS = 2 * 60 * 60 * 1000;
const COMPARE_EXPIRES_IN = Math.max(60, Math.floor(COMPARE_REFRESH_MS / 1000));

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = parseQuery(req, res, compareQuerySchema);
  if (!query) return;
  const symbols = query.symbols;

  try {
    const payload = await cached(
      `compare:${symbols.join(",")}`,
      async () => {
        const seriesList = await Promise.all(
          symbols.map((symbol) => dataAccess.timeSeries(symbol, "1day"))
        );

        const filtered = seriesList
          .map((series, index) => ({ symbol: symbols[index], series }))
          .filter((item) => item.series.length > 0);

        if (!filtered.length) {
          throw new Error("No data available");
        }

        const baseSeries = filtered[0].series;
        const times = baseSeries.map((point) => point.time);
        const timeSet = new Set(times);

        const normalized = filtered.map((item) => {
          const base = item.series[0]?.close || 1;
          const data = item.series
            .filter((point) => timeSet.has(point.time))
            .map((point) => ({
              time: point.time,
              value: (point.close / base) * 100
            }));

          return {
            symbol: item.symbol,
            data
          };
        });

        return { series: normalized, expiresIn: COMPARE_EXPIRES_IN };
      },
      {
        ttlMs: COMPARE_REFRESH_MS,
        staleTtlMs: COMPARE_STALE_MS,
        staleIfError: true,
        backgroundRevalidate: true,
        l2: true
      }
    );

    res.setHeader(
      "Cache-Control",
      `s-maxage=${COMPARE_EXPIRES_IN}, stale-while-revalidate=${COMPARE_EXPIRES_IN}`
    );
    return res.status(200).json(payload);
  } catch (error: unknown) {
    const message = errorMessage(error, "Failed to compare");
    if (message.includes("No data available")) {
      return res.status(404).json({ error: "No data available" });
    }
    return res
      .status(500)
      .json({ error: message });
  }
}

export default withApiObservability("compare", handler, {
  methods: ["GET"]
});
