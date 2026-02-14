import type { NextApiRequest, NextApiResponse } from "next";
import { sendProblem } from "@/lib/apiProblem";
import { parseBody } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { authRegisterBodySchema } from "@/contracts/requestContracts";
import { createAuthAccount } from "@/lib/authRepository";
import {
  createSessionToken,
  getSessionTtlSecondsValue,
  setSessionCookie
} from "@/lib/authSession";
import { getOrCreateUser, updateUserRecord } from "@/lib/userRepository";
import { createAuthSession } from "@/lib/sessionRepository";
import { requestClientIp, requestUserAgent } from "@/lib/requestMeta";
import { logEvent } from "@/lib/logger";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = parseBody(req, res, authRegisterBodySchema);
  if (!body) return;

  const account = await createAuthAccount({
    login: body.login,
    password: body.password
  });

  if (!account) {
    logEvent("warn", "auth.register_conflict", {
      login: body.login,
      ip: requestClientIp(req)
    });
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/auth-login-exists",
      title: "Conflict",
      status: 409,
      detail: "Login is already registered"
    });
  }

  if (body.name) {
    await updateUserRecord(account.id, { name: body.name });
  }
  const profile = await getOrCreateUser(account.id);

  const session = await createAuthSession({
    userId: account.id,
    login: account.login,
    role: account.role,
    ttlSeconds: getSessionTtlSecondsValue(),
    ip: requestClientIp(req),
    userAgent: requestUserAgent(req)
  });
  const token = createSessionToken(account.id, account.login, session.id);
  setSessionCookie(res, token);
  res.setHeader("Cache-Control", "private, no-store");
  logEvent("info", "auth.register_success", {
    userId: account.id,
    login: account.login,
    role: account.role,
    sessionId: session.id,
    ip: session.ip || requestClientIp(req)
  });

  return res.status(201).json({
    user: {
      id: account.id,
      login: account.login,
      role: account.role,
      name: profile.name,
      email: profile.email
    }
  });
}

export default withApiObservability("auth.register", handler, {
  methods: ["POST"],
  auth: false,
  rateLimit: {
    max: 30,
    windowMs: 60 * 1000,
    methods: ["POST"]
  }
});
