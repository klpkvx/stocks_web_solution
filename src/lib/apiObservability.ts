import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { incrementCounter, startTimer } from "@/lib/telemetry";
import { sendProblem, setTraceId } from "@/lib/apiProblem";
import {
  applyRateLimit,
  canBypassRateLimit,
  shouldRateLimit,
  type RateLimitOptions
} from "@/lib/apiRateLimit";
import { clearSessionCookie, readSessionFromRequest } from "@/lib/authSession";
import { getAuthAccountById } from "@/lib/authRepository";

type ObservabilityOptions = {
  rateLimit?: false | (RateLimitOptions & { methods?: string[] });
  auth?: false | { methods?: string[] };
};

function isResponseClosed(res: NextApiResponse) {
  const socket = (res as any).socket;
  return Boolean(res.writableEnded || res.destroyed || socket?.destroyed);
}

function isAbortLikeError(error: unknown) {
  const code = String((error as any)?.code || "").toUpperCase();
  const message = String((error as any)?.message || "").toLowerCase();
  if (code === "ECONNRESET" || code === "EPIPE") return true;
  return (
    message.includes("aborted") ||
    message.includes("socket hang up") ||
    message.includes("write after end")
  );
}

function randomTraceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function shouldCheckAuth(
  req: NextApiRequest,
  auth: ObservabilityOptions["auth"]
) {
  if (auth === false) return false;
  const methods = auth?.methods?.length
    ? auth.methods
    : ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
  const method = String(req.method || "GET").toUpperCase();
  return methods.includes(method);
}

export function withApiObservability(
  routeName: string,
  handler: NextApiHandler,
  options: ObservabilityOptions = {}
): NextApiHandler {
  return async function observed(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    const traceId = randomTraceId();
    const stop = startTimer(`api.${routeName}.latency_ms`);
    setTraceId(req, traceId);
    res.setHeader("x-trace-id", traceId);
    incrementCounter(`api.${routeName}.requests`);

    try {
      if (shouldCheckAuth(req, options.auth)) {
        const session = readSessionFromRequest(req);
        const account = session ? getAuthAccountById(session.userId) : null;
        if (!session || !account || account.login !== session.login) {
          clearSessionCookie(res);
          incrementCounter(`api.${routeName}.status.401`);
          return sendProblem(req, res, {
            type: "https://stockpulse.app/problems/auth-required",
            title: "Unauthorized",
            status: 401,
            detail: "Authentication required"
          });
        }
      }

      if (
        shouldRateLimit() &&
        !canBypassRateLimit(req) &&
        options.rateLimit !== false
      ) {
        const configuredMethods = options.rateLimit?.methods;
        const methods = configuredMethods?.length
          ? configuredMethods
          : ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
        const method = String(req.method || "GET").toUpperCase();

        if (methods.includes(method)) {
          const rate = applyRateLimit(req, routeName, options.rateLimit || {});
          res.setHeader("x-ratelimit-limit", String(rate.limit));
          res.setHeader("x-ratelimit-remaining", String(rate.remaining));
          res.setHeader(
            "x-ratelimit-reset",
            String(Math.ceil(rate.resetAt / 1000))
          );

          if (!rate.allowed) {
            const retryAfter = Math.max(
              1,
              Math.ceil((rate.resetAt - Date.now()) / 1000)
            );
            res.setHeader("Retry-After", String(retryAfter));
            incrementCounter(`api.${routeName}.status.429`);
            return sendProblem(req, res, {
              type: "https://stockpulse.app/problems/rate-limit",
              title: "Too Many Requests",
              status: 429,
              detail: "Rate limit exceeded. Retry later."
            });
          }
        }
      }

      await handler(req, res);
      incrementCounter(`api.${routeName}.status.${res.statusCode}`);
    } catch (error) {
      if (isAbortLikeError(error) || isResponseClosed(res)) {
        incrementCounter(`api.${routeName}.aborted`);
        return;
      }

      incrementCounter(`api.${routeName}.errors`);
      incrementCounter(`api.${routeName}.status.500`);
      if (!res.headersSent && !isResponseClosed(res)) {
        return sendProblem(req, res, {
          type: "https://stockpulse.app/problems/internal-error",
          title: "Internal Server Error",
          status: 500,
          detail: "Unexpected server error",
          traceId
        });
      }
    } finally {
      stop();
    }
  };
}
