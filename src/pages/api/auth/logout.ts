import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed } from "@/lib/apiProblem";
import { withApiObservability } from "@/lib/apiObservability";
import { clearSessionCookie } from "@/lib/authSession";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  clearSessionCookie(res);
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ ok: true });
}

export default withApiObservability("auth.logout", handler, {
  auth: false,
  rateLimit: {
    max: 120,
    windowMs: 60 * 1000,
    methods: ["POST"]
  }
});
