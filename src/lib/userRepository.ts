import { ensureAuthSchema, isPostgresConfigured, pgQuery } from "@/lib/persistence/postgres";
import { withSpan } from "@/lib/observability/tracing";

type UserRecord = {
  id: string;
  name: string;
  email?: string;
  updatedAt: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  updated_at: string | Date;
};

const DEFAULT_NAME_PREFIX = "User";

function normalizeUserId(id: string) {
  return String(id || "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function fromRow(row: UserRow): UserRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    ...(row.email ? { email: String(row.email) } : {}),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

async function requirePostgresUserStore() {
  if (!isPostgresConfigured()) {
    throw new Error("AUTH_DATABASE_URL must be configured");
  }
  await ensureAuthSchema();
}

export async function getOrCreateUser(id: string): Promise<UserRecord> {
  return withSpan("user_repository.get_or_create", {}, async () => {
    await requirePostgresUserStore();
    const key = normalizeUserId(id);
    const defaultName = `${DEFAULT_NAME_PREFIX} ${key}`;
    const updatedAt = nowIso();

    await pgQuery(
      `
        INSERT INTO users (id, name, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `,
      [key, defaultName, updatedAt]
    );

    const result = await pgQuery<UserRow>(
      `
        SELECT id, name, email, updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [key]
    );

    const row = result.rows[0];
    if (!row) {
      return {
        id: key,
        name: defaultName,
        updatedAt
      };
    }
    return fromRow(row);
  });
}

export async function updateUserRecord(
  id: string,
  updates: { name?: string; email?: string }
): Promise<UserRecord> {
  return withSpan("user_repository.update", {}, async () => {
    await requirePostgresUserStore();
    const key = normalizeUserId(id);
    const existing = await getOrCreateUser(key);
    const nextName = updates.name !== undefined ? updates.name : existing.name;
    const nextEmail = updates.email !== undefined ? updates.email : existing.email || null;
    const updatedAt = nowIso();

    const result = await pgQuery<UserRow>(
      `
        INSERT INTO users (id, name, email, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          updated_at = EXCLUDED.updated_at
        RETURNING id, name, email, updated_at
      `,
      [key, nextName, nextEmail, updatedAt]
    );

    const row = result.rows[0];
    if (!row) {
      return {
        id: key,
        name: nextName,
        ...(nextEmail ? { email: nextEmail } : {}),
        updatedAt
      };
    }
    return fromRow(row);
  });
}

