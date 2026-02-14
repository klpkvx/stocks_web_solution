import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "stockpulse_session";
const DEFAULT_SESSION_SECRET = "stockpulse-dev-session-secret";
const SESSION_HMAC_ALGO = { name: "HMAC", hash: "SHA-256" } as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
let hmacKeyPromise: Promise<CryptoKey> | null = null;

const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/404"
]);
const PUBLIC_API_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/session"
]);

function isPublicApiPath(pathname: string) {
  return PUBLIC_API_PATHS.has(pathname);
}

function isPublicPagePath(pathname: string) {
  return PUBLIC_PAGE_PATHS.has(pathname);
}

function normalizeRoutePath(rawPath: string) {
  const path = String(rawPath || "").replace(/\/{2,}/g, "/");
  if (!path || path === "/") return "/";
  let normalized = path;
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || "/";
}

function resolvePagePathname(pathname: string) {
  if (!pathname.startsWith("/_next/data/")) {
    return normalizeRoutePath(pathname);
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 4) {
    return normalizeRoutePath(pathname);
  }

  const encodedPath = segments.slice(3).join("/");
  if (!encodedPath.endsWith(".json")) {
    return normalizeRoutePath(pathname);
  }

  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(encodedPath.slice(0, -5));
  } catch {
    decodedPath = encodedPath.slice(0, -5);
  }

  const pathWithLeadingSlash = normalizeRoutePath(`/${decodedPath}`);
  if (pathWithLeadingSlash === "/index") return "/";
  if (pathWithLeadingSlash.endsWith("/index")) {
    return normalizeRoutePath(pathWithLeadingSlash.slice(0, -6));
  }
  return pathWithLeadingSlash;
}

function sessionSecret() {
  const secret = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET must be set in production");
  }
  return DEFAULT_SESSION_SECRET;
}

async function getHmacKey() {
  if (!hmacKeyPromise) {
    hmacKeyPromise = crypto.subtle.importKey(
      "raw",
      TEXT_ENCODER.encode(sessionSecret()),
      SESSION_HMAC_ALGO,
      false,
      ["sign"]
    );
  }
  return hmacKeyPromise;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

type SessionCheckResult = {
  valid: boolean;
  cookiePresent: boolean;
};

async function validateSessionToken(rawToken: string): Promise<boolean> {
  const token = String(rawToken || "").trim();
  const [payloadPart, signaturePart, extraPart] = token.split(".");
  if (!payloadPart || !signaturePart || extraPart) return false;

  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    SESSION_HMAC_ALGO.name,
    key,
    TEXT_ENCODER.encode(payloadPart)
  );
  const expectedSignature = toBase64Url(new Uint8Array(signatureBuffer));
  if (!safeEqual(signaturePart, expectedSignature)) return false;

  try {
    const payloadBytes = fromBase64Url(payloadPart);
    const payloadText = TEXT_DECODER.decode(payloadBytes);
    const payload = JSON.parse(payloadText) as {
      sub?: string;
      login?: string;
      jti?: string;
      exp?: number;
    };
    const now = Math.floor(Date.now() / 1000);

    if (!payload || typeof payload !== "object") return false;
    if (!payload.sub || !payload.login) return false;
    if (!payload.jti || typeof payload.jti !== "string") return false;
    if (!Number.isFinite(payload.exp) || Number(payload.exp) <= now) return false;

    return true;
  } catch {
    return false;
  }
}

async function checkSession(request: NextRequest): Promise<SessionCheckResult> {
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value || "";
  if (!cookieValue) {
    return { valid: false, cookiePresent: false };
  }

  const valid = await validateSessionToken(cookieValue);
  return { valid, cookiePresent: true };
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0
  });
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set("cross-origin-resource-policy", "same-origin");
  response.headers.set("origin-agent-cluster", "?1");
  response.headers.set("x-permitted-cross-domain-policies", "none");
  response.headers.set("x-dns-prefetch-control", "off");

  const forwardedProto = (request.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  const isHttps = forwardedProto === "https" || request.nextUrl.protocol === "https:";
  if (isHttps) {
    response.headers.set(
      "strict-transport-security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const pagePathname = resolvePagePathname(pathname);
  const isApiRequest = pathname === "/api" || pathname.startsWith("/api/");
  const isNextDataRequest = pathname.startsWith("/_next/data/");
  const requestedPath = isNextDataRequest
    ? `${pagePathname}${search || ""}`
    : `${pathname}${search || ""}`;
  const session = await checkSession(request);

  if (isApiRequest) {
    if (session.valid || isPublicApiPath(pathname)) {
      if (session.cookiePresent && !session.valid) {
        const response = applySecurityHeaders(NextResponse.next(), request);
        clearSessionCookie(response);
        return response;
      }
      return applySecurityHeaders(NextResponse.next(), request);
    }
    const response = applySecurityHeaders(
      NextResponse.json(
        {
          type: "https://stockpulse.app/problems/auth-required",
          title: "Unauthorized",
          status: 401,
          detail: "Authentication required"
        },
        { status: 401 }
      ),
      request
    );
    if (session.cookiePresent) {
      clearSessionCookie(response);
    }
    return response;
  }

  if (isPublicPagePath(pagePathname)) {
    if (session.valid && (pagePathname === "/login" || pagePathname === "/register")) {
      const target = request.nextUrl.clone();
      target.pathname = "/";
      target.search = "";
      return applySecurityHeaders(NextResponse.redirect(target), request);
    }
    if (session.cookiePresent && !session.valid) {
      const response = applySecurityHeaders(NextResponse.next(), request);
      clearSessionCookie(response);
      return response;
    }
    return applySecurityHeaders(NextResponse.next(), request);
  }

  if (!session.valid) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = `?next=${encodeURIComponent(requestedPath)}`;
    const response = applySecurityHeaders(NextResponse.redirect(target), request);
    if (session.cookiePresent) {
      clearSessionCookie(response);
    }
    return response;
  }

  return applySecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|sw.js).*)"
  ]
};
