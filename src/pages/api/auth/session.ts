import type { NextApiRequest, NextApiResponse } from "next";
import { parseQuery } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { emptyQuerySchema } from "@/contracts/requestContracts";
import { clearSessionCookie, readSessionFromRequest } from "@/lib/authSession";
import { getAuthAccountById } from "@/lib/authRepository";
import { getAuthSessionById } from "@/lib/sessionRepository";
import { getOrCreateUser } from "@/lib/userRepository";

async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  let activeSession: Awaited<ReturnType<typeof getAuthSessionById>> = null;
  let account: Awaited<ReturnType<typeof getAuthAccountById>> = null;
  try {
    activeSession = await getAuthSessionById(session.sessionId);
    account = await getAuthAccountById(session.userId);
  } catch {
    clearSessionCookie(res);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      authenticated: false,
      user: null
    });
  }
  if (
    !activeSession ||
    !account ||
    activeSession.userId !== account.id ||
    activeSession.login !== account.login
  ) {
    clearSessionCookie(res);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      authenticated: false,
      user: null
    });
  }

  const profile = await getOrCreateUser(account.id).catch(() => ({
    id: account.id,
    name: account.login,
    email: undefined as string | undefined,
    updatedAt: new Date().toISOString()
  }));
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    authenticated: true,
    user: {
      id: account.id,
      login: account.login,
      role: account.role,
      name: profile.name,
      email: profile.email
    }
  });
}

export default withApiObservability("auth.session", handler, {
  methods: ["GET"],
  auth: false,
  rateLimit: {
    max: 240,
    windowMs: 60 * 1000,
    methods: ["GET"]
  }
});
