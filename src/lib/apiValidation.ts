import type { NextApiRequest, NextApiResponse } from "next";
import type { z } from "zod";

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length <= 1) return value[0];
    return value;
  }
  return value;
}

function normalizeObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      normalizeValue(value)
    ])
  );
}

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message
  }));
}

function sendValidationError(
  res: NextApiResponse,
  label: string,
  error: z.ZodError
): null {
  res.status(400).json({
    error: `Invalid ${label}`,
    issues: formatIssues(error)
  });
  return null;
}

export function parseQuery<T extends z.ZodTypeAny>(
  req: NextApiRequest,
  res: NextApiResponse,
  schema: T
): z.infer<T> | null {
  const payload = normalizeObject(req.query);
  const result = schema.safeParse(payload);
  if (!result.success) {
    return sendValidationError(res, "query parameters", result.error);
  }
  return result.data;
}

export function parseBody<T extends z.ZodTypeAny>(
  req: NextApiRequest,
  res: NextApiResponse,
  schema: T
): z.infer<T> | null {
  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: "Invalid request body", issues: [{ path: "root", message: "Body must be valid JSON" }] });
      return null;
    }
  }

  const payload = normalizeObject(body);
  const result = schema.safeParse(payload);
  if (!result.success) {
    return sendValidationError(res, "request body", result.error);
  }
  return result.data;
}
