import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed } from "@/lib/apiProblem";
import { parseQuery } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { emptyQuerySchema } from "@/contracts/requestContracts";
import { clearSessionCookie, readSessionFromRequest } from "@/lib/authSession";
import { getAuthAccountById } from "@/lib/authRepository";
import { getOrCreateUser } from "@/lib/userRepository";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const query = parseQuery(req, res, emptyQuerySchema);
  if (!query) return;

  const session = readSessionFromRequest(req);
  if (!session) {
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      authenticated: false,
      user: null
    });
  }

  const account = getAuthAccountById(session.userId);
  if (!account) {
    clearSessionCookie(res);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      authenticated: false,
      user: null
    });
  }

  const profile = getOrCreateUser(account.id);
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    authenticated: true,
    user: {
      id: account.id,
      login: account.login,
      name: profile.name,
      email: profile.email
    }
  });
}

export default withApiObservability("auth.session", handler, {
  auth: false,
  rateLimit: {
    max: 240,
    windowMs: 60 * 1000,
    methods: ["GET"]
  }
});
