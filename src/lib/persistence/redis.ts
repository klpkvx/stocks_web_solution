import Redis from "ioredis";
import { withSpan } from "@/lib/observability/tracing";

let redis: Redis | null = null;

function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function redisUrl() {
  return readEnv("AUTH_REDIS_URL") || readEnv("REDIS_URL");
}

export function isRedisConfigured() {
  return Boolean(redisUrl());
}

function errorCode(error: unknown) {
  return String((error as { code?: unknown } | null)?.code || "")
    .trim()
    .toUpperCase();
}

function errorMessage(error: unknown) {
  return String((error as { message?: unknown } | null)?.message || "")
    .trim()
    .toLowerCase();
}

function isRedisConnectivityError(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error);
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EPERM") return true;
  return (
    message.includes("connect econnrefused") ||
    message.includes("connection timeout") ||
    message.includes("connection is closed") ||
    message.includes("operation not permitted") ||
    message.includes("socket closed unexpectedly")
  );
}

function resetRedisClient() {
  const current = redis;
  redis = null;
  if (!current) return;
  current.removeAllListeners("error");
  current.disconnect();
}

function getRedis() {
  if (redis) return redis;
  const connection = redisUrl();
  if (!connection) {
    return null;
  }

  redis = new Redis(connection, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null
  });
  redis.on("error", () => {
    // Prevent unhandled emitter errors; operation-level handlers decide retries.
  });
  return redis;
}

async function ensureConnected(client: Redis) {
  if (client.status === "ready") return;
  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const alreadyConnecting =
      message.includes("already connecting") || message.includes("already connected");
    if (!alreadyConnecting) {
      throw error;
    }
  }
}

export async function withRedis<T>(
  callback: (client: Redis) => Promise<T>
): Promise<T> {
  return withSpan("db.redis.client", {}, async () => {
    const run = async () => {
      const client = getRedis();
      if (!client) {
        throw new Error("Redis is not configured");
      }
      await ensureConnected(client);
      return callback(client);
    };

    try {
      return await run();
    } catch (error) {
      if (isRedisConnectivityError(error)) {
        resetRedisClient();
        return run().catch((retryError) => {
          if (isRedisConnectivityError(retryError)) {
            resetRedisClient();
          }
          throw retryError;
        });
      }
      throw error;
    }
  });
}
