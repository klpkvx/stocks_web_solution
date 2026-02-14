import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed, sendProblem } from "@/lib/apiProblem";
import { parseBody } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { authLoginBodySchema } from "@/contracts/requestContracts";
import { authenticateAuthAccount } from "@/lib/authRepository";
import { createSessionToken, setSessionCookie } from "@/lib/authSession";
import { getOrCreateUser } from "@/lib/userRepository";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const body = parseBody(req, res, authLoginBodySchema);
  if (!body) return;

  const account = authenticateAuthAccount({
    login: body.login,
    password: body.password
  });

  if (!account) {
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/auth-invalid-credentials",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid login or password"
    });
  }

  const profile = getOrCreateUser(account.id);
  const token = createSessionToken(account.id, account.login);
  setSessionCookie(res, token);
  res.setHeader("Cache-Control", "private, no-store");

  return res.status(200).json({
    user: {
      id: account.id,
      login: account.login,
      name: profile.name,
      email: profile.email
    }
  });
}

export default withApiObservability("auth.login", handler, {
  auth: false,
  rateLimit: {
    max: 60,
    windowMs: 60 * 1000,
    methods: ["POST"]
  }
});
