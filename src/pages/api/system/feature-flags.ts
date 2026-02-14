import type { NextApiRequest, NextApiResponse } from "next";
import { getServerFeatureFlags } from "@/lib/featureFlags";
import { withApiObservability } from "@/lib/apiObservability";
import { parseQuery } from "@/lib/apiValidation";
import { emptyQuerySchema } from "@/contracts/requestContracts";

async function handler(req: NextApiRequest, res: NextApiResponse) {  const query = parseQuery(req, res, emptyQuerySchema);
  if (!query) return;

  return res.status(200).json({
    flags: getServerFeatureFlags()
  });
}

export default withApiObservability("system.feature_flags", handler, {
  methods: ["GET"]
});
