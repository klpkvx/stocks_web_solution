import { describe, expect, it } from "vitest";
import {
  createAuthSession,
  getAuthSessionById,
  revokeAuthSession
} from "@/lib/sessionRepository";

const hasRedis = Boolean(process.env.AUTH_REDIS_URL || process.env.REDIS_URL);
const maybeDescribe = hasRedis ? describe : describe.skip;

maybeDescribe("sessionRepository (redis)", () => {
  it("creates, reads, and revokes sessions", async () => {
    const created = await createAuthSession({
      userId: "user-1",
      login: "TraderOne",
      role: "user",
      ttlSeconds: 3600
    });

    const active = await getAuthSessionById(created.id);
    expect(active?.userId).toBe("user-1");
    expect(active?.login).toBe("traderone");

    expect(await revokeAuthSession(created.id)).toBe(true);
    expect(await getAuthSessionById(created.id)).toBeNull();
  });
});

