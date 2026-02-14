import { describe, expect, it } from "vitest";
import { pgQuery } from "@/lib/persistence/postgres";
import {
  authenticateAuthAccount,
  createAuthAccount,
  getAuthAccountById
} from "@/lib/authRepository";

const hasPostgres = Boolean(process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL);
const maybeDescribe = hasPostgres ? describe : describe.skip;

function uniqueLogin() {
  return `trader_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

maybeDescribe("authRepository (postgres)", () => {
  it("creates, authenticates, and fetches account by id", async () => {
    const login = uniqueLogin();
    const password = "StrongPass123!";

    const created = await createAuthAccount({ login, password });
    expect(created?.login).toBe(login.toLowerCase());

    const auth = await authenticateAuthAccount({ login, password });
    expect(auth?.id).toBe(created?.id);

    const fetched = await getAuthAccountById(String(created?.id));
    expect(fetched?.login).toBe(login.toLowerCase());

    if (created?.id) {
      await pgQuery("DELETE FROM auth_accounts WHERE id = $1", [created.id]);
    }
  });
});

