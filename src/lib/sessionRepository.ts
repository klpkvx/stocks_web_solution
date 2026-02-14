import { randomUUID } from "crypto";
import type { AuthRole } from "@/lib/authRepository";
import { isRedisConfigured, withRedis } from "@/lib/persistence/redis";
import { withSpan } from "@/lib/observability/tracing";

type SessionRecord = {
  id: string;
  userId: string;
  login: string;
  role: AuthRole;
  createdAt: string;
  expiresAt: number;
  revokedAt?: string;
  ip?: string;
  userAgent?: string;
};

const MAX_SESSIONS_PER_USER = 30;
const SESSION_KEY_PREFIX = "stockpulse:auth:session:";
const USER_SESSIONS_KEY_PREFIX = "stockpulse:auth:user_sessions:";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function nowMs() {
  return Date.now();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeLogin(login: string) {
  return String(login || "").trim().toLowerCase();
}

function normalizeRole(role: unknown): AuthRole {
  return role === "admin" ? "admin" : "user";
}

function buildSessionId() {
  try {
    return randomUUID();
  } catch {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isActiveSession(session: SessionRecord) {
  return !session.revokedAt && session.expiresAt > nowSeconds();
}

function sessionKey(sessionId: string) {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

function userSessionsKey(userId: string) {
  return `${USER_SESSIONS_KEY_PREFIX}${userId}`;
}

function parseSession(raw: string): SessionRecord | null {
  try {
    const value = JSON.parse(raw) as SessionRecord;
    if (!value?.id || !value.userId || !value.login) return null;
    return {
      id: String(value.id),
      userId: String(value.userId),
      login: normalizeLogin(value.login),
      role: normalizeRole(value.role),
      createdAt: String(value.createdAt || nowIso()),
      expiresAt: Number(value.expiresAt || 0),
      ...(value.revokedAt ? { revokedAt: String(value.revokedAt) } : {}),
      ...(value.ip ? { ip: String(value.ip) } : {}),
      ...(value.userAgent ? { userAgent: String(value.userAgent) } : {})
    };
  } catch {
    return null;
  }
}

async function requireRedisSessionStore() {
  if (!isRedisConfigured()) {
    throw new Error("AUTH_REDIS_URL must be configured");
  }
}

async function enforcePerUserSessionLimit(userId: string) {
  const key = userSessionsKey(userId);
  await withRedis(async (redis) => {
    const sessionIds = await redis.zrange(key, 0, -1);
    if (sessionIds.length <= MAX_SESSIONS_PER_USER) return;

    const overflow = sessionIds.length - MAX_SESSIONS_PER_USER;
    const toRemove = sessionIds.slice(0, overflow);
    if (toRemove.length === 0) return;

    const multi = redis.multi();
    for (const sessionId of toRemove) {
      multi.del(sessionKey(sessionId));
      multi.zrem(key, sessionId);
    }
    await multi.exec();
  });
}

export async function createAuthSession(input: {
  userId: string;
  login: string;
  role: AuthRole;
  ttlSeconds: number;
  ip?: string;
  userAgent?: string;
}) {
  return withSpan("session_repository.create", {}, async () => {
    await requireRedisSessionStore();

    const ttlSeconds = Math.max(60, Math.floor(Number(input.ttlSeconds) || 0));
    const createdAt = nowIso();
    const session: SessionRecord = {
      id: buildSessionId(),
      userId: String(input.userId || "").trim(),
      login: normalizeLogin(input.login),
      role: normalizeRole(input.role),
      createdAt,
      expiresAt: nowSeconds() + ttlSeconds,
      ...(input.ip ? { ip: String(input.ip).slice(0, 80) } : {}),
      ...(input.userAgent ? { userAgent: String(input.userAgent).slice(0, 240) } : {})
    };

    await withRedis(async (redis) => {
      const multi = redis.multi();
      multi.set(sessionKey(session.id), JSON.stringify(session), "EX", ttlSeconds);
      multi.zadd(userSessionsKey(session.userId), nowMs(), session.id);
      multi.expire(userSessionsKey(session.userId), Math.max(ttlSeconds, 86_400));
      await multi.exec();
    });

    await enforcePerUserSessionLimit(session.userId);
    return session;
  });
}

export async function getAuthSessionById(sessionId: string) {
  return withSpan("session_repository.get_by_id", {}, async () => {
    await requireRedisSessionStore();
    const id = String(sessionId || "").trim();
    if (!id) return null;

    const raw = await withRedis(async (redis) => redis.get(sessionKey(id)));
    if (!raw) return null;

    const session = parseSession(raw);
    if (!session) {
      await withRedis(async (redis) => {
        await redis.del(sessionKey(id));
      });
      return null;
    }

    if (!isActiveSession(session)) {
      await revokeAuthSession(id);
      return null;
    }

    return session;
  });
}

export async function revokeAuthSession(sessionId: string) {
  return withSpan("session_repository.revoke", {}, async () => {
    await requireRedisSessionStore();
    const id = String(sessionId || "").trim();
    if (!id) return false;

    const existing = await withRedis(async (redis) => redis.get(sessionKey(id)));
    if (!existing) return false;
    const session = parseSession(existing);
    const userId = session?.userId || "";

    await withRedis(async (redis) => {
      const multi = redis.multi();
      multi.del(sessionKey(id));
      if (userId) {
        multi.zrem(userSessionsKey(userId), id);
      }
      await multi.exec();
    });

    return true;
  });
}

