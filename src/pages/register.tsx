import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import ModuleCard from "@/components/ModuleCard";
import { useI18n } from "@/components/I18nProvider";
import { useAuthSession } from "@/hooks/useAuthSession";
import { readApiErrorMessage, readApiFieldErrors } from "@/lib/httpError";
import {
  type AuthFieldErrors,
  evaluateStrongPassword,
  validateRegisterInput
} from "@/lib/authValidation";
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

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { authenticated, loading: authLoading, refresh } = useAuthSession();

  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const nextPath = useMemo(
    () => sanitizeRelativePath(router.query.next),
    [router.query.next]
  );
  const passwordRules = useMemo(
    () => evaluateStrongPassword(password),
    [password]
  );
  const loginHref =
    nextPath !== "/" ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  useEffect(() => {
    if (authLoading || !authenticated) return;
    void router.replace("/");
  }, [authLoading, authenticated, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateRegisterInput({
      login,
      password,
      name
    });
    if (hasFieldErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      setError("Please fix validation errors and try again");
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login: login.trim(),
          password,
          name: name.trim() || undefined
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const apiErrors = fromApiFieldErrors(payload);
        if (hasFieldErrors(apiErrors)) {
          setFieldErrors(apiErrors);
        }
        throw new Error(readApiErrorMessage(payload, "Registration failed"));
      }

      await refresh();
      await router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-xl">
        <ModuleCard
          title={t("auth.register.title", "Register")}
          subtitle={t(
            "auth.register.subtitle",
            "Create account with login and password"
          )}
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm text-muted">
              {t("auth.register.field.login", "Login")}
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
              {t("auth.register.field.name", "Display Name (optional)")}
              <input
                className={`mt-1.5 w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm text-ink outline-none transition focus:border-glow/60 ${
                  fieldErrors.name ? "border-ember/70" : "border-white/10"
                }`}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                autoComplete="name"
                placeholder="Alex Trader"
              />
              {fieldErrors.name && (
                <p className="mt-1.5 text-xs text-ember">{fieldErrors.name}</p>
              )}
            </label>

            <label className="block text-sm text-muted">
              {t("auth.register.field.password", "Password")}
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
                  autoComplete="new-password"
                  placeholder="At least 12 chars, upper/lower, number, symbol"
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
              <div className="mt-2 grid gap-1 text-xs">
                <p className={passwordRules.length ? "text-neon" : "text-muted"}>
                  {passwordRules.length ? "[x]" : "[ ]"} 12+ characters
                </p>
                <p className={passwordRules.uppercase ? "text-neon" : "text-muted"}>
                  {passwordRules.uppercase ? "[x]" : "[ ]"} uppercase letter
                </p>
                <p className={passwordRules.lowercase ? "text-neon" : "text-muted"}>
                  {passwordRules.lowercase ? "[x]" : "[ ]"} lowercase letter
                </p>
                <p className={passwordRules.number ? "text-neon" : "text-muted"}>
                  {passwordRules.number ? "[x]" : "[ ]"} number
                </p>
                <p className={passwordRules.symbol ? "text-neon" : "text-muted"}>
                  {passwordRules.symbol ? "[x]" : "[ ]"} symbol
                </p>
              </div>
            </label>

            {error && <p className="text-sm text-ember">{error}</p>}

            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night transition hover:opacity-90 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting
                ? t("auth.register.submitting", "Creating account...")
                : t("auth.register.submit", "Register")}
            </button>
          </form>

          <p className="mt-4 text-sm text-muted">
            {t("auth.register.loginPrompt", "Already have an account?")}{" "}
            <Link href={loginHref} className="text-ink underline">
              {t("auth.register.loginLink", "Login")}
            </Link>
          </p>
        </ModuleCard>
      </div>
    </Layout>
  );
}
