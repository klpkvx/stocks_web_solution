import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "crypto";
import { ensureAuthSchema, isPostgresConfigured, pgQuery, withPgClient } from "@/lib/persistence/postgres";
import { withSpan } from "@/lib/observability/tracing";

export type AuthRole = "user" | "admin";

type AuthAccountRecord = {
  id: string;
  login: string;
  role: AuthRole;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  createdAt: string;
  updatedAt: string;
};

type AuthAccountRow = {
  id: string;
  login: string;
  role: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  created_at: string | Date;
  updated_at: string | Date;
};

export type AuthAccount = {
  id: string;
  login: string;
  role: AuthRole;
  createdAt: string;
  updatedAt: string;
};

const PASSWORD_ITERATIONS = 120_000;
const HASH_LENGTH = 32;
const HASH_ALGO = "sha256";
const DUMMY_PASSWORD_SALT = "stockpulse_dummy_password_salt";
const AUTH_ROLE_LOCK_KEY = 965_331;

function nowIso() {
  return new Date().toISOString();
}

function buildId() {
  try {
    return randomUUID();
  } catch {
    return `usr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizeLogin(login: string) {
  return String(login || "").trim().toLowerCase();
}

function hashPassword(password: string, salt: string, iterations: number) {
  return pbkdf2Sync(password, salt, iterations, HASH_LENGTH, HASH_ALGO).toString(
    "hex"
  );
}

function secureCompareHex(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

function normalizeRole(value: unknown): AuthRole {
  return value === "admin" ? "admin" : "user";
}

function toPublic(account: AuthAccountRecord): AuthAccount {
  return {
    id: account.id,
    login: account.login,
    role: normalizeRole(account.role),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

function fromRow(row: AuthAccountRow): AuthAccountRecord {
  return {
    id: String(row.id),
    login: normalizeLogin(row.login),
    role: normalizeRole(row.role),
    passwordHash: String(row.password_hash),
    passwordSalt: String(row.password_salt),
    passwordIterations: Number(row.password_iterations),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function verifyPassword(account: AuthAccountRecord, password: string) {
  const expected = hashPassword(
    password,
    account.passwordSalt,
    account.passwordIterations
  );
  return secureCompareHex(account.passwordHash, expected);
}

async function requirePostgresAuthStore() {
  if (!isPostgresConfigured()) {
    throw new Error("AUTH_DATABASE_URL must be configured");
  }
  await ensureAuthSchema();
}

export async function createAuthAccount(input: {
  login: string;
  password: string;
}): Promise<AuthAccount | null> {
  return withSpan("auth_repository.create", {}, async () => {
    await requirePostgresAuthStore();
    const login = normalizeLogin(input.login);
    if (!login) return null;

    const salt = randomBytes(16).toString("hex");
    const now = nowIso();
    const passwordHash = hashPassword(input.password, salt, PASSWORD_ITERATIONS);
    const id = buildId();

    return withPgClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query("SELECT pg_advisory_xact_lock($1)", [AUTH_ROLE_LOCK_KEY]);
        const existing = await client.query<{ id: string }>(
          "SELECT id FROM auth_accounts WHERE login = $1 LIMIT 1",
          [login]
        );
        if ((existing.rowCount || 0) > 0) {
          await client.query("ROLLBACK");
          return null;
        }

        const adminCount = await client.query<{ count: number }>(
          "SELECT COUNT(*)::int AS count FROM auth_accounts WHERE role = 'admin'"
        );
        const isFirstAdmin = Number(adminCount.rows[0]?.count || 0) === 0;
        const role: AuthRole = isFirstAdmin ? "admin" : "user";

        const inserted = await client.query<AuthAccountRow>(
          `
            INSERT INTO auth_accounts (
              id,
              login,
              role,
              password_hash,
              password_salt,
              password_iterations,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
              id,
              login,
              role,
              password_hash,
              password_salt,
              password_iterations,
              created_at,
              updated_at
          `,
          [
            id,
            login,
            role,
            passwordHash,
            salt,
            PASSWORD_ITERATIONS,
            now,
            now
          ]
        );
        await client.query("COMMIT");

        const row = inserted.rows[0];
        if (!row) return null;
        return toPublic(fromRow(row));
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  });
}

export async function authenticateAuthAccount(input: {
  login: string;
  password: string;
}): Promise<AuthAccount | null> {
  return withSpan("auth_repository.authenticate", {}, async () => {
    await requirePostgresAuthStore();
    const login = normalizeLogin(input.login);
    if (!login) return null;

    const accountResult = await pgQuery<AuthAccountRow>(
      `
        SELECT
          id,
          login,
          role,
          password_hash,
          password_salt,
          password_iterations,
          created_at,
          updated_at
        FROM auth_accounts
        WHERE login = $1
        LIMIT 1
      `,
      [login]
    );

    const row = accountResult.rows[0];
    if (!row) {
      hashPassword(input.password, DUMMY_PASSWORD_SALT, PASSWORD_ITERATIONS);
      return null;
    }

    const account = fromRow(row);
    if (!verifyPassword(account, input.password)) {
      return null;
    }

    const updatedAt = nowIso();
    await pgQuery(
      "UPDATE auth_accounts SET updated_at = $2 WHERE id = $1",
      [account.id, updatedAt]
    );

    return toPublic({
      ...account,
      updatedAt
    });
  });
}

export async function getAuthAccountById(id: string): Promise<AuthAccount | null> {
  return withSpan("auth_repository.get_by_id", {}, async () => {
    await requirePostgresAuthStore();
    const key = String(id || "").trim();
    if (!key) return null;

    const result = await pgQuery<AuthAccountRow>(
      `
        SELECT
          id,
          login,
          role,
          password_hash,
          password_salt,
          password_iterations,
          created_at,
          updated_at
        FROM auth_accounts
        WHERE id = $1
        LIMIT 1
      `,
      [key]
    );
    const row = result.rows[0];
    if (!row) return null;
    return toPublic(fromRow(row));
  });
}

