import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/router";
import ModeToggle from "@/components/ModeToggle";
import PerformanceToggle from "@/components/PerformanceToggle";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import RouteLoader from "@/components/RouteLoader";
import TickerQuickSearch from "@/components/TickerQuickSearch";
import AnimatedMarketBackground from "@/components/AnimatedMarketBackground";
import Breadcrumbs from "@/components/Breadcrumbs";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import BackToTopButton from "@/components/BackToTopButton";
import ToastViewport from "@/components/ToastViewport";
import OfflineStatusBar from "@/components/OfflineStatusBar";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import { IconClose, IconMenu } from "@/components/Icons";
import { useI18n } from "@/components/I18nProvider";
import { useAuthSession } from "@/hooks/useAuthSession";

const NAV_ITEMS = [
  { href: "/", labelKey: "nav.dashboard" },
  { href: "/portfolio", labelKey: "nav.portfolio" },
  { href: "/strategy", labelKey: "nav.strategy" },
  { href: "/compare", labelKey: "nav.compare" },
  { href: "/flow", labelKey: "nav.flow" },
  { href: "/experience", labelKey: "nav.experience" },
  { href: "/news", labelKey: "nav.news" },
  { href: "/alerts", labelKey: "nav.alerts" }
] as const;

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const { authenticated, user, loading: authLoading, logout } = useAuthSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuToggleLabel = mobileMenuOpen
    ? t("layout.closeMenu")
    : t("layout.openMenu");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [router.asPath]);

  const activePath = useMemo(() => {
    if (router.pathname === "/") return "/";
    if (router.pathname.startsWith("/stock/")) return "/stock";
    return router.pathname;
  }, [router.pathname]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Keep the user on the current page if logout fails.
      return;
    }
    void router.push("/");
  }

  return (
    <div className="relative isolate min-h-screen bg-night text-ink">
      <OfflineStatusBar />
      <a
        href="#main-content"
        className="skip-link absolute left-2 top-2 z-[240] rounded-full bg-ink px-4 py-2 text-xs font-semibold text-night"
      >
        {t("layout.skip")}
      </a>
      <AnimatedMarketBackground />
      <RouteLoader />
      <ToastViewport />
      <div className="relative z-10 grid-overlay min-h-screen">
        <header className="sticky top-0 z-[160] border-b border-white/10 bg-night/85 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.35em] text-muted">
                  {t("brand.kicker")}
                </p>
                <h1 className="truncate text-xl font-semibold text-gradient sm:text-2xl">
                  {t("brand.name")}
                </h1>
              </div>

              <div className="hidden items-center gap-3 lg:flex">
                {authenticated && <TickerQuickSearch compact />}
                {authLoading ? (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">
                    {t("auth.loading", "Auth...")}
                  </span>
                ) : authenticated && user ? (
                  <>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">
                      {user.login}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30 hover:text-ink"
                      onClick={() => {
                        void handleLogout();
                      }}
                    >
                      {t("auth.logout", "Logout")}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30 hover:text-ink"
                    >
                      {t("auth.login", "Login")}
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30 hover:text-ink"
                    >
                      {t("auth.register", "Register")}
                    </Link>
                  </>
                )}
                <LanguageToggle />
                <ThemeToggle />
                <PerformanceToggle />
                <ModeToggle />
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted transition hover:border-white/30 hover:text-ink lg:hidden"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-panel"
                aria-label={menuToggleLabel}
                title={menuToggleLabel}
              >
                {mobileMenuOpen ? <IconClose size={17} /> : <IconMenu size={17} />}
              </button>
            </div>

            <div className="mt-4 hidden items-center justify-between gap-4 lg:flex">
              <nav
                aria-label={t("layout.primaryNav")}
                className="flex flex-wrap items-center gap-3 text-sm"
              >
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    activePath === item.href ||
                    (item.href !== "/" && activePath.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      className={`rounded-full px-3 py-1.5 transition ${
                        isActive
                          ? "bg-white/10 text-ink"
                          : "text-muted hover:text-ink"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                      href={item.href}
                    >
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {mobileMenuOpen && (
              <div
                id="mobile-nav-panel"
                className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-night/95 p-4 lg:hidden"
              >
                {authenticated && <TickerQuickSearch compact={false} />}
                <div className="flex flex-wrap items-center gap-2">
                  {authLoading ? (
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">
                      {t("auth.loading", "Auth...")}
                    </span>
                  ) : authenticated && user ? (
                    <>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">
                        {user.login}
                      </span>
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30 hover:text-ink"
                        onClick={() => {
                          void handleLogout();
                        }}
                      >
                        {t("auth.logout", "Logout")}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30 hover:text-ink"
                      >
                        {t("auth.login", "Login")}
                      </Link>
                      <Link
                        href="/register"
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted transition hover:border-white/30 hover:text-ink"
                      >
                        {t("auth.register", "Register")}
                      </Link>
                    </>
                  )}
                  <LanguageToggle />
                  <ThemeToggle />
                  <PerformanceToggle />
                  <ModeToggle />
                </div>
                <nav aria-label={t("layout.mobileNav")} className="grid gap-2">
                  {NAV_ITEMS.map((item) => {
                    const isActive =
                      activePath === item.href ||
                      (item.href !== "/" && activePath.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-xl border px-3 py-2 text-sm transition ${
                          isActive
                            ? "border-white/30 bg-white/10 text-ink"
                            : "border-white/10 text-muted hover:border-white/30 hover:text-ink"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {t(item.labelKey)}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </header>

        <main id="main-content" className="px-4 pb-16 pt-5 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <Breadcrumbs />
            {children}
          </div>
        </main>

        <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
          <div className="mx-auto w-full max-w-6xl text-sm text-muted">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted">{t("brand.name")}</p>
                <p className="mt-2 max-w-md">
                  {t("footer.description")}
                </p>
              </div>

              <div className="text-xs">
                <p>{t("footer.ssl")}</p>
                <p className="mt-1">{t("footer.sources")}</p>
                <p className="mt-1">© {new Date().getUTCFullYear()} Stock Pulse</p>
              </div>
            </div>

            <nav
              aria-label={t("layout.footerLinks")}
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4"
            >
              <Link href="/" className="transition hover:text-ink">
                {t("footer.about")}
              </Link>
              <Link href="/news" className="transition hover:text-ink">
                {t("footer.blog")}
              </Link>
              <a
                href="mailto:support@stockpulse.app"
                className="transition hover:text-ink"
              >
                {t("footer.contact")}
              </a>
              <Link href="/privacy" className="transition hover:text-ink">
                {t("footer.privacy")}
              </Link>
              <Link href="/terms" className="transition hover:text-ink">
                {t("footer.terms")}
              </Link>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-ink"
              >
                X
              </a>
            </nav>
          </div>
        </footer>
      </div>

      <BackToTopButton />
      <CookieConsentBanner />
      <GlobalCommandPalette />
    </div>
  );
}
