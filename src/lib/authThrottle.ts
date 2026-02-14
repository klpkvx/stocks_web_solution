import type { NextApiRequest } from "next";

type AuthFailureState = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
  lastFailedAt: number;
};

export type AuthThrottleStatus = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;
const STALE_ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

const globalThrottleMap =
  (globalThis as any).__STOCK_PULSE_AUTH_THROTTLE__ ||
  new Map<string, AuthFailureState>();

(globalThis as any).__STOCK_PULSE_AUTH_THROTTLE__ = globalThrottleMap;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function maxAttempts() {
  return parsePositiveInteger(process.env.AUTH_MAX_LOGIN_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);
}

function windowMs() {
  return parsePositiveInteger(process.env.AUTH_LOGIN_WINDOW_MS, DEFAULT_WINDOW_MS);
}

function lockMs() {
  return parsePositiveInteger(process.env.AUTH_LOGIN_LOCK_MS, DEFAULT_LOCK_MS);
}

function nowMs() {
  return Date.now();
}

function headerValue(raw: string | string[] | undefined) {
  if (Array.isArray(raw)) return raw[0] || "";
  return raw || "";
}

function normalizeLogin(login: string) {
  return String(login || "").trim().toLowerCase();
}

function extractClientIp(req: NextApiRequest) {
  const forwarded = headerValue(req.headers["x-forwarded-for"]);
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headerValue(req.headers["x-real-ip"]).trim();
  if (real) return real;
  return (
    req.socket.remoteAddress ||
    req.socket.localAddress ||
    "unknown-ip"
  );
}

function purgeStaleEntries() {
  const threshold = nowMs() - STALE_ENTRY_TTL_MS;
  for (const [key, state] of globalThrottleMap.entries()) {
    if (
      state.lastFailedAt < threshold &&
      state.blockedUntil < nowMs() &&
      state.windowStartedAt < threshold
    ) {
      globalThrottleMap.delete(key);
    }
  }
}

export function buildAuthThrottleKey(req: NextApiRequest, login: string) {
  const normalizedLogin = normalizeLogin(login);
  const ip = extractClientIp(req);
  return `${normalizedLogin}::${ip}`;
}

export function checkAuthThrottle(key: string): AuthThrottleStatus {
  purgeStaleEntries();
  const state = globalThrottleMap.get(key);
  if (!state) {
    return {
      allowed: true,
      remaining: maxAttempts(),
      retryAfterSeconds: 0
    };
  }

  const now = nowMs();
  if (state.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((state.blockedUntil - now) / 1000))
    };
  }

  if (now - state.windowStartedAt > windowMs()) {
    globalThrottleMap.delete(key);
    return {
      allowed: true,
      remaining: maxAttempts(),
      retryAfterSeconds: 0
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts() - state.count),
    retryAfterSeconds: 0
  };
}

export function registerAuthFailure(key: string): AuthThrottleStatus {
  purgeStaleEntries();
  const now = nowMs();
  const existing = globalThrottleMap.get(key);
  const withinWindow = existing && now - existing.windowStartedAt <= windowMs();
  const count = withinWindow ? existing.count + 1 : 1;
  const startedAt = withinWindow ? existing.windowStartedAt : now;
  const shouldBlock = count >= maxAttempts();
  const blockedUntil = shouldBlock ? now + lockMs() : 0;

  const nextState: AuthFailureState = {
    count,
    windowStartedAt: startedAt,
    blockedUntil,
    lastFailedAt: now
  };

  globalThrottleMap.set(key, nextState);

  if (shouldBlock) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(lockMs() / 1000))
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts() - count),
    retryAfterSeconds: 0
  };
}

export function clearAuthFailures(key: string) {
  globalThrottleMap.delete(key);
}
