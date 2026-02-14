import type { NextApiRequest, NextApiResponse } from "next";
import { getTelemetrySnapshot } from "@/lib/telemetry";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { emptyQuerySchema } from "@/contracts/requestContracts";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const query = parseQuery(req, res, emptyQuerySchema);
  if (!query) return;

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    ...getTelemetrySnapshot()
  });
}

export default withApiObservability("system.telemetry", handler);
