import type { NextApiRequest, NextApiResponse } from "next";
import { withApiObservability } from "@/lib/apiObservability";
import { clearSessionCookie, readSessionFromRequest } from "@/lib/authSession";
import { revokeAuthSession } from "@/lib/sessionRepository";
import { logEvent } from "@/lib/logger";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = readSessionFromRequest(req);
  const revoked = session?.sessionId
    ? await revokeAuthSession(session.sessionId)
    : false;
  if (session) {
    logEvent("info", "auth.logout", {
      userId: session.userId,
      login: session.login,
      sessionId: session.sessionId,
      revoked
    });
  }
  clearSessionCookie(res);
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ ok: true });
}

export default withApiObservability("auth.logout", handler, {
  methods: ["POST"],
  auth: false,
  rateLimit: {
    max: 120,
    windowMs: 60 * 1000,
    methods: ["POST"]
  }
});
