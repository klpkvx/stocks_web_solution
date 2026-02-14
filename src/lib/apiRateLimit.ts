import type { NextApiRequest } from "next";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  max?: number;
  windowMs?: number;
  keyPrefix?: string;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS = 240;
const MAX_BUCKETS = 5000;

const globalRateStore =
  (globalThis as any).__STOCK_PULSE_RATE_LIMIT__ ||
  new Map<string, RateLimitEntry>();

(globalThis as any).__STOCK_PULSE_RATE_LIMIT__ = globalRateStore;

function getClientIp(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function getEnvNumber(name: string, fallback: number, min = 1) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.floor(raw));
}

function pruneExpired(now: number) {
  if (globalRateStore.size <= MAX_BUCKETS) return;
  const keys = globalRateStore.keys();
  let next = keys.next();
  while (!next.done && globalRateStore.size > MAX_BUCKETS) {
    const key = next.value;
    const entry = globalRateStore.get(key);
    if (!entry || entry.resetAt <= now) {
      globalRateStore.delete(key);
    }
    next = keys.next();
  }
}

export function shouldRateLimit() {
  const value = String(process.env.API_RATE_LIMIT_ENABLED || "1").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function canBypassRateLimit(req: NextApiRequest) {
  const token = process.env.API_RATE_LIMIT_BYPASS_KEY;
  if (!token) return false;
  const header = req.headers["x-rate-limit-bypass"];
  if (typeof header === "string") return header === token;
  if (Array.isArray(header) && header.length > 0) return header[0] === token;
  return false;
}

export function applyRateLimit(
  req: NextApiRequest,
  routeName: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const now = Date.now();
  const limit = options.max ?? getEnvNumber("API_RATE_LIMIT_MAX", DEFAULT_MAX_REQUESTS);
  const windowMs =
    options.windowMs ?? getEnvNumber("API_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
  const keyPrefix = options.keyPrefix || "api";
  const method = String(req.method || "GET").toUpperCase();
  const clientIp = getClientIp(req);
  const bucket = `${keyPrefix}:${routeName}:${method}:${clientIp}`;

  const existing = globalRateStore.get(bucket);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    globalRateStore.set(bucket, { count: 1, resetAt });
    pruneExpired(now);
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt
    };
  }

  existing.count += 1;
  globalRateStore.set(bucket, existing);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt
  };
}
