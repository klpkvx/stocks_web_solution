import type { NextApiRequest, NextApiResponse } from "next";
import { getTimeSeries } from "@/lib/twelveData";
import { cached } from "@/lib/serverStore";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { timeSeriesQuerySchema } from "@/contracts/requestContracts";
import { errorMessage } from "@/lib/errorMessage";

const REFRESH_MS = (() => {
  const raw = Number(process.env.SERIES_REFRESH_MS || 5 * 60 * 1000);
  if (!Number.isFinite(raw)) return 5 * 60 * 1000;
  return Math.max(60_000, raw);
})();

const STALE_MS = (() => {
  const raw = Number(process.env.SERIES_STALE_MS || 60 * 60 * 1000);
  if (!Number.isFinite(raw)) return 60 * 60 * 1000;
  return Math.max(REFRESH_MS, raw);
})();

const EXPIRES_IN = Math.max(30, Math.floor(REFRESH_MS / 1000));

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const query = parseQuery(req, res, timeSeriesQuerySchema);
  if (!query) return;
  const symbol = query.symbol;
  const interval = query.interval;
  const forceRefresh = query.refresh;

  try {
    const series = await cached(
      `series:${symbol}:${interval}`,
      () => getTimeSeries(symbol, interval),
      {
        ttlMs: REFRESH_MS,
        staleTtlMs: STALE_MS,
        staleIfError: true,
        forceRefresh,
        backgroundRevalidate: true,
        l2: true
      }
    );

    res.setHeader(
      "Cache-Control",
      `s-maxage=${EXPIRES_IN}, stale-while-revalidate=${EXPIRES_IN}`
    );
    return res.status(200).json({ series, expiresIn: EXPIRES_IN });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ error: errorMessage(error, "Failed to load time series") });
  }
}

export default withApiObservability("time_series", handler, {
  methods: ["GET"]
});
