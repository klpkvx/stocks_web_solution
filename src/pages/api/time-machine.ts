import type { NextApiRequest, NextApiResponse } from "next";
import { cached } from "@/lib/serverStore";
import { withApiObservability } from "@/lib/apiObservability";
import { dataAccess } from "@/lib/dataAccess/service";
import { parseQuery } from "@/lib/apiValidation";
import { timeMachineQuerySchema } from "@/contracts/requestContracts";

const TIME_MACHINE_REFRESH_MS = 15 * 60 * 1000;
const TIME_MACHINE_STALE_MS = 4 * 60 * 60 * 1000;
const TIME_MACHINE_EXPIRES_IN = Math.max(60, Math.floor(TIME_MACHINE_REFRESH_MS / 1000));

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = parseQuery(req, res, timeMachineQuerySchema);
  if (!query) return;
  const symbols = query.symbols;

  try {
    const payload = await cached(
      `time-machine:${symbols.join(",")}`,
      async () => {
        const seriesList = await Promise.all(
          symbols.map((symbol) => dataAccess.timeSeries(symbol, "1day"))
        );

        return {
          series: symbols.map((item, index) => ({
            symbol: item,
            series: seriesList[index].map((point) => ({
              time: point.time,
              close: point.close
            }))
          })),
          expiresIn: TIME_MACHINE_EXPIRES_IN
        };
      },
      {
        ttlMs: TIME_MACHINE_REFRESH_MS,
        staleTtlMs: TIME_MACHINE_STALE_MS,
        staleIfError: true,
        backgroundRevalidate: true,
        l2: true
      }
    );

    res.setHeader(
      "Cache-Control",
      `s-maxage=${TIME_MACHINE_EXPIRES_IN}, stale-while-revalidate=${TIME_MACHINE_EXPIRES_IN}`
    );
    return res.status(200).json(payload);
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to load time machine" });
  }
}

export default withApiObservability("time_machine", handler);
