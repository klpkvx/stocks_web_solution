import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { pushToast } from "@/lib/toast";

type ConsentState = "accepted" | "essential" | "unset";

const STORAGE_KEY = "cookie-consent-v1";

export default function CookieConsentBanner() {
  const { t } = useI18n();
  const [consent, setConsent] = useState<ConsentState>("unset");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "accepted" || value === "essential") {
      setConsent(value);
    }
    setReady(true);
  }, []);

  function choose(value: Exclude<ConsentState, "unset">) {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
    pushToast(
      value === "accepted"
        ? t("toast.cookieAll")
        : t("toast.cookieEssential"),
      "success"
    );
  }

  if (!ready || consent !== "unset") return null;

  return (
    <aside className="fixed inset-x-0 bottom-0 z-[230] border-t border-white/10 bg-night/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {t("cookie.message")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-muted transition hover:border-white/30 hover:text-ink"
            onClick={() => choose("essential")}
          >
            {t("cookie.essential")}
          </button>
          <button
            type="button"
            className="rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-xs font-semibold text-night"
            onClick={() => choose("accepted")}
          >
            {t("cookie.acceptAll")}
          </button>
        </div>
      </div>
    </aside>
  );
}
