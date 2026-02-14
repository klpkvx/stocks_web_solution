import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow
} from "pg";
import { withSpan } from "@/lib/observability/tracing";

const DEFAULT_POOL_MAX = 20;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONN_TIMEOUT_MS = 5_000;
const AUTH_SCHEMA_LOCK_KEY = 734_221;

let pool: Pool | null = null;
let authSchemaReadyPromise: Promise<void> | null = null;

function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function databaseUrl() {
  return readEnv("AUTH_DATABASE_URL") || readEnv("DATABASE_URL") || readEnv("POSTGRES_URL");
}

export function isPostgresConfigured() {
  return Boolean(databaseUrl());
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

function isPostgresConnectivityError(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error);
  if (code.startsWith("08")) return true;
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EPERM") return true;
  if (code === "57P01" || code === "57P02" || code === "57P03") return true;
  return (
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("connect econnrefused") ||
    message.includes("operation not permitted") ||
    message.includes("timeout exceeded")
  );
}

function resetPool() {
  const current = pool;
  pool = null;
  authSchemaReadyPromise = null;
  if (current) {
    void current.end().catch(() => undefined);
  }
}

function createPool() {
  const connectionString = databaseUrl();
  if (!connectionString) {
    return null;
  }

  const sslMode = readEnv("POSTGRES_SSL_MODE").toLowerCase();
  const ssl =
    sslMode === "require" || sslMode === "on"
      ? { rejectUnauthorized: false }
      : undefined;

  return new Pool({
    connectionString,
    max: parsePositiveInt(readEnv("POSTGRES_POOL_MAX"), DEFAULT_POOL_MAX),
    idleTimeoutMillis: parsePositiveInt(
      readEnv("POSTGRES_IDLE_TIMEOUT_MS"),
      DEFAULT_IDLE_TIMEOUT_MS
    ),
    connectionTimeoutMillis: parsePositiveInt(
      readEnv("POSTGRES_CONNECTION_TIMEOUT_MS"),
      DEFAULT_CONN_TIMEOUT_MS
    ),
    ssl
  });
}

function getPool() {
  if (pool) return pool;
  pool = createPool();
  if (pool) {
    pool.on("error", (error) => {
      if (isPostgresConnectivityError(error)) {
        resetPool();
      }
    });
  }
  return pool;
}

export async function withPgClient<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  return withSpan("db.postgres.client", {}, async () => {
    let activePool = getPool();
    if (!activePool) {
      throw new Error("Postgres is not configured");
    }

    const connect = async () => {
      return activePool!.connect().catch((error) => {
        if (isPostgresConnectivityError(error)) {
          resetPool();
        }
        throw error;
      });
    };

    let client: PoolClient;
    try {
      client = await connect();
    } catch (error) {
      if (!isPostgresConnectivityError(error)) throw error;
      activePool = getPool();
      if (!activePool) {
        throw error;
      }
      client = await connect();
    }

    try {
      return await callback(client);
    } finally {
      client.release();
    }
  });
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return withSpan("db.postgres.query", {
    "db.system": "postgresql",
    "db.statement": text
  }, async () => {
    const execute = async () => {
      const activePool = getPool();
      if (!activePool) {
        throw new Error("Postgres is not configured");
      }
      return activePool.query<T>(text, values);
    };

    try {
      return await execute();
    } catch (error) {
      if (isPostgresConnectivityError(error)) {
        resetPool();
        return execute().catch((retryError) => {
          if (isPostgresConnectivityError(retryError)) {
            resetPool();
          }
          throw retryError;
        });
      }
      throw error;
    }
  });
}

async function ensureAuthSchemaWithClient(client: PoolClient) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock($1)", [AUTH_SCHEMA_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_accounts (
        id TEXT PRIMARY KEY,
        login TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_login
      ON auth_accounts (login)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_single_admin
      ON auth_accounts ((role))
      WHERE role = 'admin'
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_not_null
      ON users (email)
      WHERE email IS NOT NULL
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function ensureAuthSchema() {
  if (!isPostgresConfigured()) return;
  if (!authSchemaReadyPromise) {
    authSchemaReadyPromise = withPgClient(async (client) => {
      await ensureAuthSchemaWithClient(client);
    }).catch((error) => {
      if (isPostgresConnectivityError(error)) {
        resetPool();
      }
      authSchemaReadyPromise = null;
      throw error;
    });
  }
  await authSchemaReadyPromise;
}
