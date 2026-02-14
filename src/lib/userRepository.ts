type UserRecord = {
  id: string;
  name: string;
  email?: string;
  updatedAt: string;
};

const DEFAULT_NAME_PREFIX = "User";

const globalUsers =
  (globalThis as any).__STOCK_PULSE_USERS__ || new Map<string, UserRecord>();

(globalThis as any).__STOCK_PULSE_USERS__ = globalUsers;

function nowIso() {
  return new Date().toISOString();
}

export function getOrCreateUser(id: string): UserRecord {
  const key = String(id || "").trim();
  const existing = globalUsers.get(key);
  if (existing) return existing;

  const next: UserRecord = {
    id: key,
    name: `${DEFAULT_NAME_PREFIX} ${key}`,
    updatedAt: nowIso()
  };
  globalUsers.set(key, next);
  return next;
}

export function updateUserRecord(
  id: string,
  updates: { name?: string; email?: string }
): UserRecord {
  const base = getOrCreateUser(id);
  const next: UserRecord = {
    ...base,
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.email !== undefined ? { email: updates.email } : {}),
    updatedAt: nowIso()
  };
  if (updates.email === undefined && base.email !== undefined) {
    next.email = base.email;
  }
  globalUsers.set(id, next);
  return next;
}
