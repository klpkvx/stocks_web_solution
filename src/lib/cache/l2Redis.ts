type L2Entry<T> = {
  value: T;
  updatedAt: number;
  expiresAt: number;
};

const DEFAULT_TIMEOUT_MS = 900;

function getConfig() {
  const baseUrl = process.env.REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return {
    baseUrl: baseUrl ? baseUrl.replace(/\/$/, "") : "",
    token: token || ""
  };
}

export function isL2CacheEnabled() {
  const { baseUrl, token } = getConfig();
  return Boolean(baseUrl && token);
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getConfig().token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function readL2Cache<T>(key: string): Promise<L2Entry<T> | null> {
  if (!isL2CacheEnabled()) return null;
  const { baseUrl } = getConfig();
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/get/${encodeURIComponent(key)}`,
      { method: "GET" }
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const rawValue = payload?.result;
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as L2Entry<T>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.expiresAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeL2Cache<T>(key: string, entry: L2Entry<T>, ttlMs: number) {
  if (!isL2CacheEnabled()) return;
  const { baseUrl } = getConfig();
  const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));

  try {
    await fetchWithTimeout(`${baseUrl}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify({
        value: JSON.stringify(entry),
        ex: ttlSeconds
      })
    });
  } catch {
    // Best effort.
  }
}

export async function acquireL2Lock(key: string, ttlSeconds = 8) {
  if (!isL2CacheEnabled()) return true;
  const { baseUrl } = getConfig();
  const safeTtl = Math.max(1, Math.min(60, Math.floor(ttlSeconds)));
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    // Upstash REST-compatible NX lock.
    const url = `${baseUrl}/set/${encodeURIComponent(
      `lock:${key}`
    )}/${encodeURIComponent(token)}?NX=true&EX=${safeTtl}`;
    const response = await fetchWithTimeout(url, { method: "POST" }, 800);
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return payload?.result === "OK";
  } catch {
    return false;
  }
}

export async function releaseL2Lock(key: string) {
  if (!isL2CacheEnabled()) return;
  const { baseUrl } = getConfig();
  try {
    await fetchWithTimeout(`${baseUrl}/del/${encodeURIComponent(`lock:${key}`)}`, {
      method: "POST"
    }, 800);
  } catch {
    // Best effort.
  }
}

export type { L2Entry };
