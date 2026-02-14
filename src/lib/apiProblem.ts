import type { NextApiRequest, NextApiResponse } from "next";
import { canWriteResponse } from "@/lib/responseGuards";

const TRACE_ID_KEY = "__stock_pulse_trace_id";

export type ProblemDetail = {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
  traceId?: string;
};

function getTraceId(
  req: NextApiRequest,
  res: NextApiResponse
): string | undefined {
  const fromResponse = res.getHeader("x-trace-id");
  if (typeof fromResponse === "string" && fromResponse.trim()) {
    return fromResponse;
  }

  const fromRequest = (req as any)[TRACE_ID_KEY];
  if (typeof fromRequest === "string" && fromRequest.trim()) {
    return fromRequest;
  }

  return undefined;
}

export function setTraceId(req: NextApiRequest, traceId: string) {
  (req as any)[TRACE_ID_KEY] = traceId;
}

export function sendProblem(
  req: NextApiRequest,
  res: NextApiResponse,
  problem: ProblemDetail
) {
  if (!canWriteResponse(res)) return null;

  const payload: Record<string, unknown> = {
    type: problem.type || "about:blank",
    title: problem.title,
    status: problem.status
  };

  if (problem.detail) payload.detail = problem.detail;
  if (problem.instance) payload.instance = problem.instance;
  if (problem.errors && problem.errors.length > 0) {
    payload.errors = problem.errors;
  }

  const traceId = problem.traceId || getTraceId(req, res);
  if (traceId) payload.traceId = traceId;

  res.setHeader("Cache-Control", "no-store");
  return res.status(problem.status).json(payload);
}

export function methodNotAllowed(
  req: NextApiRequest,
  res: NextApiResponse,
  allowed: string[]
) {
  res.setHeader("Allow", allowed.join(", "));
  return sendProblem(req, res, {
    type: "https://stockpulse.app/problems/method-not-allowed",
    title: "Method Not Allowed",
    status: 405,
    detail: `Expected one of: ${allowed.join(", ")}`
  });
}
