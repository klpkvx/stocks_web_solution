import type { NextApiRequest, NextApiResponse } from "next";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { emptyQuerySchema } from "@/contracts/requestContracts";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = parseQuery(req, res, emptyQuerySchema);
  if (!query) return;

  return res.status(200).json({
    ok: true,
    service: "stock-pulse-api",
    time: new Date().toISOString()
  });
}

export default withApiObservability("api.index", handler, {
  methods: ["GET"],
  rateLimit: { max: 600, windowMs: 60 * 1000 }
});
