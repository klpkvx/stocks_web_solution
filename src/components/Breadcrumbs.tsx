import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

const LABEL_KEYS: Record<string, string> = {
  stock: "nav.stock",
  portfolio: "nav.portfolio",
  strategy: "nav.strategy",
  compare: "nav.compare",
  experience: "nav.experience",
  alerts: "nav.alerts",
  flow: "nav.flow",
  news: "nav.news"
};

function toLabel(segment: string, t: (key: string, fallback?: string) => string) {
  const clean = decodeURIComponent(segment);
  if (LABEL_KEYS[clean]) return t(LABEL_KEYS[clean], clean);
  if (/^[A-Z.]{1,8}$/.test(clean.toUpperCase())) return clean.toUpperCase();
  return clean.replace(/[-_]/g, " ");
}

export default function Breadcrumbs() {
  const router = useRouter();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const crumbs = useMemo(() => {
    const path = router.asPath.split("?")[0] || "/";
    const segments = path.split("/").filter(Boolean);
    if (!segments.length) return [];
    return segments.map((segment, index) => {
      const href = `/${segments.slice(0, index + 1).join("/")}`;
      return {
        href,
        label: toLabel(segment, t)
      };
    });
  }, [router.asPath, t]);

  if (!mounted || !router.isReady || !crumbs.length) return null;

  return (
    <nav aria-label={t("breadcrumbs.aria")} className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <li>
          <Link href="/" className="transition hover:text-ink">
            {t("breadcrumbs.home")}
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-2">
              <span aria-hidden>/</span>
              {last ? (
                <span className="font-semibold text-ink">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="transition hover:text-ink">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
