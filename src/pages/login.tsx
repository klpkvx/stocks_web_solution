import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import ModuleCard from "@/components/ModuleCard";
import { useI18n } from "@/components/I18nProvider";
import { useAuthSession } from "@/hooks/useAuthSession";
import { readApiErrorMessage, readApiFieldErrors } from "@/lib/httpError";
import { type AuthFieldErrors, validateLoginInput } from "@/lib/authValidation";
import { sanitizeRelativePath } from "@/lib/safePath";

function hasFieldErrors(errors: AuthFieldErrors) {
  return Object.values(errors).some(Boolean);
}

function fromApiFieldErrors(payload: unknown): AuthFieldErrors {
  const next: AuthFieldErrors = {};
  for (const issue of readApiFieldErrors(payload)) {
    if (issue.path === "login" || issue.path === "password" || issue.path === "name") {
      next[issue.path] = issue.message;
    }
  }
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { authenticated, loading: authLoading, refresh } = useAuthSession();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const nextPath = useMemo(
    () => sanitizeRelativePath(router.query.next),
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
    const validationErrors = validateLoginInput({ login, password });
    if (hasFieldErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      setError("Please fix validation errors and try again");
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ login: login.trim(), password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const apiErrors = fromApiFieldErrors(payload);
        if (hasFieldErrors(apiErrors)) {
          setFieldErrors(apiErrors);
        }
        throw new Error(readApiErrorMessage(payload, "Login failed"));
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
                className={`mt-1.5 w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm text-ink outline-none transition focus:border-glow/60 ${
                  fieldErrors.login ? "border-ember/70" : "border-white/10"
                }`}
                value={login}
                onChange={(event) => {
                  setLogin(event.target.value);
                  if (fieldErrors.login) {
                    setFieldErrors((prev) => ({ ...prev, login: undefined }));
                  }
                }}
                autoComplete="username"
                placeholder="trader_01"
                required
              />
              {fieldErrors.login && (
                <p className="mt-1.5 text-xs text-ember">{fieldErrors.login}</p>
              )}
            </label>

            <label className="block text-sm text-muted">
              {t("auth.login.field.password", "Password")}
              <div className="mt-1.5 flex gap-2">
                <input
                  type={passwordVisible ? "text" : "password"}
                  className={`w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm text-ink outline-none transition focus:border-glow/60 ${
                    fieldErrors.password ? "border-ember/70" : "border-white/10"
                  }`}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  autoComplete="current-password"
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 px-3 text-xs text-muted transition hover:border-white/30 hover:text-ink"
                  onClick={() => setPasswordVisible((prev) => !prev)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-ember">{fieldErrors.password}</p>
              )}
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
