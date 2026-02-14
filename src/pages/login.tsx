import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import ModuleCard from "@/components/ModuleCard";
import { useI18n } from "@/components/I18nProvider";
import { useAuthSession } from "@/hooks/useAuthSession";

function readErrorMessage(payload: any, fallback: string) {
  return (
    payload?.detail ||
    payload?.error ||
    payload?.message ||
    (Array.isArray(payload?.errors) ? payload.errors[0]?.message : null) ||
    fallback
  );
}

function sanitizeNext(input: unknown) {
  const value = typeof input === "string" ? input : "";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { authenticated, loading: authLoading, refresh } = useAuthSession();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(
    () => sanitizeNext(router.query.next),
    [router.query.next]
  );
  const registerHref =
    nextPath !== "/"
      ? `/register?next=${encodeURIComponent(nextPath)}`
      : "/register";

  useEffect(() => {
    if (authLoading || !authenticated) return;
    void router.replace(nextPath);
  }, [authLoading, authenticated, nextPath, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ login, password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Login failed"));
      }

      await refresh();
      await router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-xl">
        <ModuleCard
          title={t("auth.login.title", "Login")}
          subtitle={t(
            "auth.login.subtitle",
            "Sign in with your login and password"
          )}
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm text-muted">
              {t("auth.login.field.login", "Login")}
              <input
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink outline-none transition focus:border-glow/60"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                autoComplete="username"
                placeholder="trader_01"
                required
              />
            </label>

            <label className="block text-sm text-muted">
              {t("auth.login.field.password", "Password")}
              <input
                type="password"
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink outline-none transition focus:border-glow/60"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="********"
                required
              />
            </label>

            {error && <p className="text-sm text-ember">{error}</p>}

            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night transition hover:opacity-90 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting
                ? t("auth.login.submitting", "Signing in...")
                : t("auth.login.submit", "Login")}
            </button>
          </form>

          <p className="mt-4 text-sm text-muted">
            {t("auth.login.registerPrompt", "No account yet?")}{" "}
            <Link href={registerHref} className="text-ink underline">
              {t("auth.login.registerLink", "Create account")}
            </Link>
          </p>
        </ModuleCard>
      </div>
    </Layout>
  );
}
