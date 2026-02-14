import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { methodNotAllowed } from "@/lib/apiProblem";
import { parseBody, parseQuery } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { getOrCreateUser, updateUserRecord } from "@/lib/userRepository";

const userIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid user id format");

const userQuerySchema = z.object({
  id: userIdSchema
});

const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(160).optional()
  })
  .refine((value) => value.name !== undefined || value.email !== undefined, {
    message: "At least one field must be provided"
  });

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = parseQuery(req, res, userQuerySchema);
  if (!query) return;

  const userId = query.id;

  if (req.method === "GET") {
    const user = getOrCreateUser(userId);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(user);
  }

  if (req.method === "PATCH") {
    const body = parseBody(req, res, updateUserBodySchema);
    if (!body) return;

    const user = updateUserRecord(userId, body);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(user);
  }

  return methodNotAllowed(req, res, ["GET", "PATCH"]);
}

export default withApiObservability("users.id", handler, {
  rateLimit: {
    max: 180,
    windowMs: 60 * 1000,
    methods: ["GET", "PATCH"]
  }
});
