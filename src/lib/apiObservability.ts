import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { incrementCounter, startTimer } from "@/lib/telemetry";

function randomTraceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withApiObservability(
  routeName: string,
  handler: NextApiHandler
): NextApiHandler {
  return async function observed(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    const traceId = randomTraceId();
    const stop = startTimer(`api.${routeName}.latency_ms`);
    res.setHeader("x-trace-id", traceId);
    incrementCounter(`api.${routeName}.requests`);

    try {
      await handler(req, res);
      incrementCounter(`api.${routeName}.status.${res.statusCode}`);
    } catch (error) {
      incrementCounter(`api.${routeName}.errors`);
      incrementCounter(`api.${routeName}.status.500`);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Internal server error",
          traceId
        });
      }
    } finally {
      stop();
    }
  };
}
