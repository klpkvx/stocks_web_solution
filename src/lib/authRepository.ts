import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "crypto";

type AuthAccountRecord = {
  id: string;
  login: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  createdAt: string;
  updatedAt: string;
};

export type AuthAccount = {
  id: string;
  login: string;
  createdAt: string;
  updatedAt: string;
};

const PASSWORD_ITERATIONS = 120_000;
const HASH_LENGTH = 32;
const HASH_ALGO = "sha256";

const globalAuthByLogin =
  (globalThis as any).__STOCK_PULSE_AUTH_BY_LOGIN__ ||
  new Map<string, AuthAccountRecord>();
const globalAuthById =
  (globalThis as any).__STOCK_PULSE_AUTH_BY_ID__ ||
  new Map<string, AuthAccountRecord>();

(globalThis as any).__STOCK_PULSE_AUTH_BY_LOGIN__ = globalAuthByLogin;
(globalThis as any).__STOCK_PULSE_AUTH_BY_ID__ = globalAuthById;

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

function toPublic(account: AuthAccountRecord): AuthAccount {
  return {
    id: account.id,
    login: account.login,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
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

export function createAuthAccount(input: {
  login: string;
  password: string;
}): AuthAccount | null {
  const login = normalizeLogin(input.login);
  if (!login) return null;
  if (globalAuthByLogin.has(login)) return null;

  const salt = randomBytes(16).toString("hex");
  const now = nowIso();
  const next: AuthAccountRecord = {
    id: buildId(),
    login,
    passwordHash: hashPassword(input.password, salt, PASSWORD_ITERATIONS),
    passwordSalt: salt,
    passwordIterations: PASSWORD_ITERATIONS,
    createdAt: now,
    updatedAt: now
  };

  globalAuthByLogin.set(login, next);
  globalAuthById.set(next.id, next);
  return toPublic(next);
}

export function authenticateAuthAccount(input: {
  login: string;
  password: string;
}): AuthAccount | null {
  const login = normalizeLogin(input.login);
  if (!login) return null;

  const account = globalAuthByLogin.get(login);
  if (!account) return null;
  if (!verifyPassword(account, input.password)) return null;

  const updated: AuthAccountRecord = {
    ...account,
    updatedAt: nowIso()
  };
  globalAuthByLogin.set(login, updated);
  globalAuthById.set(updated.id, updated);
  return toPublic(updated);
}

export function getAuthAccountById(id: string): AuthAccount | null {
  const account = globalAuthById.get(String(id || "").trim());
  if (!account) return null;
  return toPublic(account);
}
