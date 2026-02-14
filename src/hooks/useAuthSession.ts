import { useCallback, useEffect, useState } from "react";
import type { AuthSessionResponse } from "@/types/auth";
import { readApiErrorMessage } from "@/lib/httpError";

const EMPTY_SESSION: AuthSessionResponse = {
  authenticated: false,
  user: null
};
const SESSION_CACHE_TTL_MS = 10_000;
const SESSION_REQUEST_TIMEOUT_MS = 7_000;

let cachedSession: AuthSessionResponse | null = null;
let cachedSessionAt = 0;
let inFlightSessionRequest: Promise<AuthSessionResponse> | null = null;

function normalizeSession(payload: unknown): AuthSessionResponse {
  if (!payload || typeof payload !== "object") {
    return EMPTY_SESSION;
  }

  const source = payload as {
    authenticated?: unknown;
    user?: {
      id?: unknown;
      login?: unknown;
      role?: unknown;
      name?: unknown;
      email?: unknown;
    } | null;
  };

  if (!source.authenticated || !source.user) {
    return EMPTY_SESSION;
  }

  const user = source.user;
  const role = user.role === "admin" ? "admin" : "user";
  if (!user.id || !user.login || !user.name) {
    return EMPTY_SESSION;
  }

  return {
    authenticated: true,
    user: {
      id: String(user.id),
      login: String(user.login),
      role,
      name: String(user.name),
      ...(user.email ? { email: String(user.email) } : {})
    }
  };
}

async function fetchAuthSession(): Promise<AuthSessionResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, SESSION_REQUEST_TIMEOUT_MS);
  const response = await fetch("/api/auth/session", {
    signal: controller.signal,
    cache: "no-store"
  }).finally(() => {
    clearTimeout(timeout);
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readApiErrorMessage(payload, "Failed to load session"));
  }
  return normalizeSession(payload);
}

async function fetchAuthSessionCached(force = false): Promise<AuthSessionResponse> {
  const now = Date.now();
  if (!force && cachedSession && now - cachedSessionAt < SESSION_CACHE_TTL_MS) {
    return cachedSession;
  }

  if (!force && inFlightSessionRequest) {
    return inFlightSessionRequest;
  }

  inFlightSessionRequest = fetchAuthSession()
    .then((session) => {
      cachedSession = session;
      cachedSessionAt = Date.now();
      return session;
    })
    .finally(() => {
      inFlightSessionRequest = null;
    });

  return inFlightSessionRequest;
}

async function executeLogout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readApiErrorMessage(payload, "Failed to logout"));
  }
}

export function useAuthSession() {
  const [session, setSession] = useState<AuthSessionResponse>(
    cachedSession || EMPTY_SESSION
  );
  const [loading, setLoading] = useState(!cachedSession);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAuthSessionCached(true);
      setSession(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load session";
      setError(message);
      cachedSession = EMPTY_SESSION;
      cachedSessionAt = Date.now();
      setSession(EMPTY_SESSION);
      return EMPTY_SESSION;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await executeLogout();
      cachedSession = EMPTY_SESSION;
      cachedSessionAt = Date.now();
      setSession(EMPTY_SESSION);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to logout";
      setError(message);
      throw new Error(message);
    }
  }, []);

  useEffect(() => {
    if (cachedSession) return;
    let active = true;
    void (async () => {
      const next = await fetchAuthSessionCached().catch(() => {
        cachedSession = EMPTY_SESSION;
        cachedSessionAt = Date.now();
        return EMPTY_SESSION;
      });
      if (!active) return;
      setSession(next);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return {
    ...session,
    loading,
    error,
    refresh,
    logout
  };
}
