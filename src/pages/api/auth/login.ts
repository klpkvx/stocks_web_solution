import type { NextApiRequest, NextApiResponse } from "next";
import { sendProblem } from "@/lib/apiProblem";
import { parseBody } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { authLoginBodySchema } from "@/contracts/requestContracts";
import { authenticateAuthAccount } from "@/lib/authRepository";
import {
  buildAuthThrottleKey,
  checkAuthThrottle,
  clearAuthFailures,
  registerAuthFailure
} from "@/lib/authThrottle";
import {
  createSessionToken,
  getSessionTtlSecondsValue,
  setSessionCookie
} from "@/lib/authSession";
import { getOrCreateUser } from "@/lib/userRepository";
import { createAuthSession } from "@/lib/sessionRepository";
import { requestClientIp, requestUserAgent } from "@/lib/requestMeta";
import { logEvent } from "@/lib/logger";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = parseBody(req, res, authLoginBodySchema);
  if (!body) return;

  const throttleKey = buildAuthThrottleKey(req, body.login);
  const throttleState = checkAuthThrottle(throttleKey);
  if (!throttleState.allowed) {
    res.setHeader("Retry-After", String(throttleState.retryAfterSeconds));
    logEvent("warn", "auth.login_throttled", {
      login: body.login,
      ip: requestClientIp(req)
    });
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/auth-throttled",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many failed login attempts. Retry later."
    });
  }

  const account = await authenticateAuthAccount({
    login: body.login,
    password: body.password
  });

  if (!account) {
    const failedState = registerAuthFailure(throttleKey);
    if (!failedState.allowed) {
      res.setHeader("Retry-After", String(failedState.retryAfterSeconds));
      logEvent("warn", "auth.login_locked", {
        login: body.login,
        ip: requestClientIp(req)
      });
      return sendProblem(req, res, {
        type: "https://stockpulse.app/problems/auth-throttled",
        title: "Too Many Requests",
        status: 429,
        detail: "Too many failed login attempts. Retry later."
      });
    }
    logEvent("warn", "auth.login_failed", {
      login: body.login,
      ip: requestClientIp(req)
    });
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/auth-invalid-credentials",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid login or password"
    });
  }
  clearAuthFailures(throttleKey);

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
  logEvent("info", "auth.login_success", {
    userId: account.id,
    login: account.login,
    role: account.role,
    sessionId: session.id,
    ip: session.ip || requestClientIp(req)
  });

  return res.status(200).json({
    user: {
      id: account.id,
      login: account.login,
      role: account.role,
      name: profile.name,
      email: profile.email
    }
  });
}

export default withApiObservability("auth.login", handler, {
  methods: ["POST"],
  auth: false,
  rateLimit: {
    max: 60,
    windowMs: 60 * 1000,
    methods: ["POST"]
  }
});
