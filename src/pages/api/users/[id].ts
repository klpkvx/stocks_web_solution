import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { sendProblem } from "@/lib/apiProblem";
import { parseBody, parseQuery } from "@/lib/apiValidation";
import { withApiObservability } from "@/lib/apiObservability";
import { getRequestAuth } from "@/lib/requestAuth";
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
  const auth = getRequestAuth(req);
  if (!auth) {
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/auth-required",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication required"
    });
  }

  if (auth.role !== "admin" && auth.userId !== userId) {
    return sendProblem(req, res, {
      type: "https://stockpulse.app/problems/forbidden",
      title: "Forbidden",
      status: 403,
      detail: "You can only access your own profile"
    });
  }

  if (req.method === "GET") {
    const user = await getOrCreateUser(userId);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(user);
  }

  const body = parseBody(req, res, updateUserBodySchema);
  if (!body) return;

  const user = await updateUserRecord(userId, body);
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json(user);
}

export default withApiObservability("users.id", handler, {
  methods: ["GET", "PATCH"],
  rateLimit: {
    max: 180,
    windowMs: 60 * 1000,
    methods: ["GET", "PATCH"]
  }
});
