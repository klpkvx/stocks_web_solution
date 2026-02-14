import type { NextApiRequest, NextApiResponse } from "next";
import { dataAccess } from "@/lib/dataAccess/service";
import { cached } from "@/lib/serverStore";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { secQuerySchema } from "@/contracts/requestContracts";

const SEC_REFRESH_MS = 30 * 60 * 1000;
const SEC_STALE_MS = 12 * 60 * 60 * 1000;
const SEC_EXPIRES_IN = Math.max(60, Math.floor(SEC_REFRESH_MS / 1000));

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = parseQuery(req, res, secQuerySchema);
  if (!query) return;
  const symbol = query.symbol;
  const forceRefresh = query.refresh;

  try {
    const payload = await cached(
      `sec:${symbol}`,
      () =>
        dataAccess.sec(symbol, { forceRefresh }).then((data) => ({
          ...data,
          expiresIn: SEC_EXPIRES_IN
        })),
      {
        ttlMs: SEC_REFRESH_MS,
        staleTtlMs: SEC_STALE_MS,
        staleIfError: true,
        backgroundRevalidate: true,
        l2: true
      }
    );

    res.setHeader(
      "Cache-Control",
      `s-maxage=${SEC_EXPIRES_IN}, stale-while-revalidate=${SEC_EXPIRES_IN}`
    );
    return res.status(200).json(payload);
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to load filings" });
  }
}

export default withApiObservability("sec", handler);
