import { describe, expect, it, beforeEach } from "vitest";
import { createSessionToken, parseSessionToken } from "./authSession";

describe("authSession", () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = "test-auth-secret";
  });

  it("creates and parses a valid session token", () => {
    const token = createSessionToken("user-1", "TraderOne", "session-1");
    const parsed = parseSessionToken(token);

    expect(parsed).toEqual({
      userId: "user-1",
      login: "traderone",
      sessionId: "session-1",
      expiresAt: expect.any(Number)
    });
  });

  it("rejects a tampered token signature", () => {
    const token = createSessionToken("user-1", "TraderOne", "session-1");
    const tampered = `${token}broken`;
    expect(parseSessionToken(tampered)).toBeNull();
  });
});
