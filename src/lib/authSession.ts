import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

const SESSION_COOKIE = "stockpulse_session";
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_SESSION_SECRET = "stockpulse-dev-session-secret";

type SessionPayload = {
  sub: string;
  login: string;
  role?: "user" | "admin";
  jti: string;
  iat: number;
  exp: number;
};

export type AuthSession = {
  userId: string;
  login: string;
  sessionId: string;
  expiresAt: number;
};

function getSessionSecret() {
  const secret = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET must be set in production");
  }
  return DEFAULT_SESSION_SECRET;
}

function getSessionTtlSeconds() {
  const raw = Number(process.env.AUTH_SESSION_TTL_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_SESSION_TTL_SECONDS;
  return Math.max(60, Math.floor(raw));
}

export function getSessionTtlSecondsValue() {
  return getSessionTtlSeconds();
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function secureCompare(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

function parseCookieHeader(raw: string | undefined | null) {
  if (!raw) return new Map<string, string>();
  return new Map(
    raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return [part, ""];
        return [part.slice(0, index), part.slice(index + 1)];
      })
  );
}

function appendSetCookie(res: NextApiResponse, cookieValue: string) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current.map(String), cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", [String(current), cookieValue]);
}

function buildCookie(value: string, maxAgeSeconds: number) {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Priority=High",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function createSessionToken(
  userId: string,
  login: string,
  sessionId?: string
) {
  const now = Math.floor(Date.now() / 1000);
  let jti = "";
  const providedId = String(sessionId || "").trim();
  if (providedId) {
    jti = providedId;
  } else {
    try {
      jti = randomUUID();
    } catch {
      jti = `s_${now}_${Math.random().toString(36).slice(2, 10)}`;
    }
  }
  const payload: SessionPayload = {
    sub: String(userId || "").trim(),
    login: String(login || "").trim().toLowerCase(),
    jti,
    iat: now,
    exp: now + getSessionTtlSeconds()
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parseSessionToken(token: string): AuthSession | null {
  const raw = String(token || "").trim();
  if (!raw) return null;
  const [payloadPart, signaturePart, extraPart] = raw.split(".");
  if (!payloadPart || !signaturePart || extraPart) return null;
  const expectedSignature = sign(payloadPart);
  if (!secureCompare(signaturePart, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadPart)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.sub || !parsed.login) return null;
    if (!parsed.jti || typeof parsed.jti !== "string") return null;
    if (!Number.isFinite(parsed.exp) || parsed.exp <= now) return null;

    return {
      userId: String(parsed.sub),
      login: String(parsed.login),
      sessionId: String(parsed.jti),
      expiresAt: Number(parsed.exp)
    };
  } catch {
    return null;
  }
}

export function readSessionFromRequest(req: NextApiRequest): AuthSession | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies.get(SESSION_COOKIE) || "";
  if (!token) return null;
  return parseSessionToken(token);
}

export function setSessionCookie(res: NextApiResponse, token: string) {
  appendSetCookie(res, buildCookie(token, getSessionTtlSeconds()));
}

export function clearSessionCookie(res: NextApiResponse) {
  appendSetCookie(res, buildCookie("", 0));
}
