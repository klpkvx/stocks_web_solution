import type { NextApiRequest } from "next";
import type { AuthRole } from "@/lib/authRepository";

const REQUEST_AUTH_KEY = "__stock_pulse_request_auth__";

export type RequestAuthContext = {
  userId: string;
  login: string;
  role: AuthRole;
};

export function setRequestAuth(
  req: NextApiRequest,
  auth: RequestAuthContext | null
) {
  (req as any)[REQUEST_AUTH_KEY] = auth;
}

export function getRequestAuth(req: NextApiRequest): RequestAuthContext | null {
  const value = (req as any)[REQUEST_AUTH_KEY];
  if (!value || typeof value !== "object") return null;

  const userId = String(value.userId || "").trim();
  const login = String(value.login || "").trim().toLowerCase();
  const role = value.role === "admin" ? "admin" : "user";
  if (!userId || !login) return null;

  return { userId, login, role };
}
