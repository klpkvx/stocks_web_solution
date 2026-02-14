import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { incrementCounter, startTimer } from "@/lib/telemetry";
import { methodNotAllowed, sendProblem, setTraceId } from "@/lib/apiProblem";
import {
  applyRateLimit,
  canBypassRateLimit,
  shouldRateLimit,
  type RateLimitOptions
} from "@/lib/apiRateLimit";
import { clearSessionCookie, readSessionFromRequest } from "@/lib/authSession";
import { getAuthAccountById } from "@/lib/authRepository";
import { getAuthSessionById } from "@/lib/sessionRepository";
import { setRequestAuth } from "@/lib/requestAuth";
import { logEvent } from "@/lib/logger";
import { setActiveSpanAttributes, withSpan } from "@/lib/observability/tracing";

type MethodGuardOptions = {
  methods?: string[];
};

type CsrfOptions = false | (MethodGuardOptions & { allowedOrigins?: string[] });

type ObservabilityOptions = {
  methods?: string[];
  rateLimit?: false | (RateLimitOptions & { methods?: string[] });
  auth?: false | { methods?: string[] };
  csrf?: CsrfOptions;
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

function isAuthInfrastructureError(error: unknown) {
  const code = String((error as { code?: unknown } | null)?.code || "")
    .trim()
    .toUpperCase();
  const message = String((error as { message?: unknown } | null)?.message || "")
    .trim()
    .toLowerCase();

  if (!message && !code) return false;

  if (
    message.includes("auth_database_url must be configured") ||
    message.includes("auth_redis_url must be configured") ||
    message.includes("postgres is temporarily unavailable") ||
    message.includes("redis is temporarily unavailable")
  ) {
    return true;
  }

  if (
    message.includes("connection terminated due to connection timeout") ||
    message.includes("operation not permitted") ||
    message.includes("connect econnrefused") ||
    code === "ECONNREFUSED" ||
    code === "EPERM"
  ) {
    return true;
  }

  return false;
}

function isInfraPermissionDenied(error: unknown) {
  const code = String((error as { code?: unknown } | null)?.code || "")
    .trim()
    .toUpperCase();
  const message = String((error as { message?: unknown } | null)?.message || "")
    .trim()
    .toLowerCase();

  return code === "EPERM" || message.includes("operation not permitted");
}

function randomTraceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readHeader(req: NextApiRequest, name: string) {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function firstCsvToken(value: string) {
  return String(value || "").split(",")[0]?.trim() || "";
}

function normalizeOrigin(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.origin.toLowerCase();
  } catch {
    return "";
  }
}

function envAllowedOrigins() {
  const raw = String(process.env.AUTH_ALLOWED_ORIGINS || "");
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
}

function inferredRequestOrigin(req: NextApiRequest) {
  const forwardedProto = firstCsvToken(readHeader(req, "x-forwarded-proto"));
  const proto = forwardedProto || (((req.socket as any)?.encrypted && "https") || "http");
  const forwardedHost = firstCsvToken(readHeader(req, "x-forwarded-host"));
  const host = forwardedHost || readHeader(req, "host");
  if (!host) return "";
  return normalizeOrigin(`${proto}://${host}`);
}

function allowedOriginsForRequest(
  req: NextApiRequest,
  explicit?: string[]
) {
  const set = new Set<string>();
  for (const item of envAllowedOrigins()) {
    set.add(item);
  }
  for (const item of explicit || []) {
    const normalized = normalizeOrigin(item);
    if (normalized) set.add(normalized);
  }
  const inferred = inferredRequestOrigin(req);
  if (inferred) set.add(inferred);
  return set;
}

function isOriginTrusted(req: NextApiRequest, explicit?: string[]) {
  const origin = normalizeOrigin(readHeader(req, "origin"));
  if (!origin) {
    const fetchSite = readHeader(req, "sec-fetch-site").toLowerCase();
    if (fetchSite === "cross-site") return false;
    return true;
  }
  const allowed = allowedOriginsForRequest(req, explicit);
  return allowed.has(origin);
}

function normalizeMethods(methods?: string[]) {
  if (!methods || methods.length === 0) return [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of methods) {
    const method = String(value || "").trim().toUpperCase();
    if (!method || seen.has(method)) continue;
    seen.add(method);
    normalized.push(method);
  }
  return normalized;
}

function shouldCheckCsrf(req: NextApiRequest, csrf: ObservabilityOptions["csrf"]) {
  if (csrf === false) return false;
  const methods = normalizeMethods(csrf?.methods?.length ? csrf.methods : ["POST", "PUT", "PATCH", "DELETE"]);
  const method = String(req.method || "GET").toUpperCase();
  return methods.includes(method);
}

function shouldCheckAuth(
  req: NextApiRequest,
  auth: ObservabilityOptions["auth"]
) {
  if (auth === false) return false;
  const methods = normalizeMethods(
    auth?.methods?.length
      ? auth.methods
      : ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]
  );
  const method = String(req.method || "GET").toUpperCase();
  return methods.includes(method);
}

function setSecurityHeaders(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("cross-origin-opener-policy", "same-origin");
  res.setHeader("cross-origin-resource-policy", "same-origin");
  res.setHeader("origin-agent-cluster", "?1");
  res.setHeader("x-permitted-cross-domain-policies", "none");
  res.setHeader("x-dns-prefetch-control", "off");

  const forwardedProto = firstCsvToken(readHeader(req, "x-forwarded-proto")).toLowerCase();
  const encryptedSocket = Boolean((req.socket as any)?.encrypted);
  const isHttps = forwardedProto === "https" || (!forwardedProto && encryptedSocket);
  if (isHttps) {
    res.setHeader(
      "strict-transport-security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
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
    const method = String(req.method || "GET").toUpperCase();
    const allowedMethods = normalizeMethods(options.methods);

    const stop = startTimer(`api.${routeName}.latency_ms`);
    const fallbackTraceId = randomTraceId();
    return withSpan(
      `api.${routeName}`,
      {
        "http.request.method": method,
        "stockpulse.route": routeName
      },
      async (span) => {
        const traceId = span.spanContext().traceId || fallbackTraceId;

        setRequestAuth(req, null);
        setTraceId(req, traceId);
        res.setHeader("x-trace-id", traceId);
        setSecurityHeaders(req, res);
        incrementCounter(`api.${routeName}.requests`);

        try {
          if (allowedMethods.length > 0 && !allowedMethods.includes(method)) {
            incrementCounter(`api.${routeName}.status.405`);
            setActiveSpanAttributes({ "http.response.status_code": 405 });
            logEvent("warn", "api.method_not_allowed", {
              route: routeName,
              method,
              allowed: allowedMethods,
              traceId
            });
            return methodNotAllowed(req, res, allowedMethods);
          }

          const csrfConfig = options.csrf === false ? undefined : options.csrf;
          if (
            shouldCheckCsrf(req, options.csrf) &&
            !isOriginTrusted(req, csrfConfig?.allowedOrigins)
          ) {
            incrementCounter(`api.${routeName}.status.403`);
            setActiveSpanAttributes({ "http.response.status_code": 403 });
            logEvent("warn", "api.csrf_rejected", {
              route: routeName,
              method,
              traceId
            });
            return sendProblem(req, res, {
              type: "https://stockpulse.app/problems/csrf-rejected",
              title: "Forbidden",
              status: 403,
              detail: "Request origin is not allowed"
            });
          }

          if (shouldCheckAuth(req, options.auth)) {
            const session = readSessionFromRequest(req);
            let activeSession: Awaited<ReturnType<typeof getAuthSessionById>> = null;
            let account: Awaited<ReturnType<typeof getAuthAccountById>> = null;
            if (session) {
              try {
                activeSession = await getAuthSessionById(session.sessionId);
                account = await getAuthAccountById(session.userId);
              } catch (error) {
                clearSessionCookie(res);
                logEvent("warn", "api.auth_check_failed", {
                  route: routeName,
                  method,
                  traceId,
                  message: String((error as { message?: unknown })?.message || "")
                });
              }
            }
            if (
              !session ||
              !activeSession ||
              !account ||
              account.login !== session.login ||
              activeSession.userId !== account.id ||
              activeSession.login !== account.login
            ) {
              clearSessionCookie(res);
              incrementCounter(`api.${routeName}.status.401`);
              setActiveSpanAttributes({ "http.response.status_code": 401 });
              logEvent("warn", "api.auth_rejected", {
                route: routeName,
                method,
                traceId
              });
              return sendProblem(req, res, {
                type: "https://stockpulse.app/problems/auth-required",
                title: "Unauthorized",
                status: 401,
                detail: "Authentication required"
              });
            }
            setRequestAuth(req, {
              userId: account.id,
              login: account.login,
              role: account.role
            });
          }

          if (
            shouldRateLimit() &&
            !canBypassRateLimit(req) &&
            options.rateLimit !== false
          ) {
            const configuredMethods = options.rateLimit?.methods;
            const methods = normalizeMethods(
              configuredMethods?.length
                ? configuredMethods
                : ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]
            );

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
                setActiveSpanAttributes({ "http.response.status_code": 429 });
                logEvent("warn", "api.rate_limited", {
                  route: routeName,
                  method,
                  traceId,
                  retryAfter
                });
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
          setActiveSpanAttributes({
            "http.response.status_code": Number(res.statusCode || 200)
          });
        } catch (error) {
          if (isAbortLikeError(error) || isResponseClosed(res)) {
            incrementCounter(`api.${routeName}.aborted`);
            logEvent("warn", "api.aborted", {
              route: routeName,
              method,
              traceId
            });
            return;
          }

          if (isAuthInfrastructureError(error)) {
            incrementCounter(`api.${routeName}.status.503`);
            setActiveSpanAttributes({ "http.response.status_code": 503 });
            const message = String((error as { message?: unknown })?.message || "");
            const code = String((error as { code?: unknown })?.code || "");
            logEvent("warn", "api.auth_infra_unavailable", {
              route: routeName,
              method,
              traceId,
              code,
              message
            });
            if (!res.headersSent && !isResponseClosed(res)) {
              const detail = isInfraPermissionDenied(error)
                ? "Authentication datastore is unreachable from this runtime due to network permissions"
                : "Authentication datastore is temporarily unavailable; verify AUTH_DATABASE_URL, AUTH_REDIS_URL, and runtime network access";
              return sendProblem(req, res, {
                type: "https://stockpulse.app/problems/auth-infra-unavailable",
                title: "Service Unavailable",
                status: 503,
                detail,
                traceId
              });
            }
            return;
          }

          incrementCounter(`api.${routeName}.errors`);
          incrementCounter(`api.${routeName}.status.500`);
          setActiveSpanAttributes({ "http.response.status_code": 500 });
          logEvent("error", "api.unhandled_error", {
            route: routeName,
            method,
            traceId,
            message: String((error as { message?: unknown })?.message || "")
          });
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
          setRequestAuth(req, null);
        }
      }
    );
  };
}
