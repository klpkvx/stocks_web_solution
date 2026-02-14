import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import Layout from "@/components/Layout";

export default function Custom404() {
  const { t } = useI18n();
  return (
    <Layout>
      <section className="glass mx-auto max-w-2xl rounded-3xl px-8 py-12 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-muted">404</p>
        <h2 className="mt-4 text-3xl font-semibold text-ink">{t("notfound.title")}</h2>
        <p className="mt-3 text-sm text-muted">
          {t("notfound.description")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night"
          >
            {t("notfound.backDashboard")}
          </Link>
          <Link
            href="/news"
            className="rounded-full border border-white/10 px-5 py-2 text-sm text-muted transition hover:border-white/30 hover:text-ink"
          >
            {t("notfound.openNews")}
          </Link>
        </div>
      </section>
    </Layout>
  );
}
