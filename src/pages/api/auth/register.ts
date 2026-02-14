import type { NextApiRequest, NextApiResponse } from "next";
import { methodNotAllowed, sendProblem } from "@/lib/apiProblem";
import { parseBody } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { authRegisterBodySchema } from "@/contracts/requestContracts";
import { createAuthAccount } from "@/lib/authRepository";
import { createSessionToken, setSessionCookie } from "@/lib/authSession";
import { getOrCreateUser, updateUserRecord } from "@/lib/userRepository";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const body = parseBody(req, res, authRegisterBodySchema);
  if (!body) return;

  const account = createAuthAccount({
    login: body.login,
    password: body.password
  });

  if (!account) {
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/auth-login-exists",
      title: "Conflict",
      status: 409,
      detail: "Login is already registered"
    });
  }

  if (body.name) {
    updateUserRecord(account.id, { name: body.name });
  }
  const profile = getOrCreateUser(account.id);

  const token = createSessionToken(account.id, account.login);
  setSessionCookie(res, token);
  res.setHeader("Cache-Control", "private, no-store");

  return res.status(201).json({
    user: {
      id: account.id,
      login: account.login,
      name: profile.name,
      email: profile.email
    }
  });
}

export default withApiObservability("auth.register", handler, {
  auth: false,
  rateLimit: {
    max: 30,
    windowMs: 60 * 1000,
    methods: ["POST"]
  }
});
