import type { NextApiRequest } from "next";

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function requestClientIp(req: NextApiRequest) {
  const forwarded = firstHeaderValue(req.headers["x-forwarded-for"]);
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = firstHeaderValue(req.headers["x-real-ip"]).trim();
  if (realIp) return realIp;

  return req.socket.remoteAddress || req.socket.localAddress || "unknown-ip";
}

export function requestUserAgent(req: NextApiRequest) {
  return firstHeaderValue(req.headers["user-agent"]).trim().slice(0, 240);
}
