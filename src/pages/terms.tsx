import { useI18n } from "@/components/I18nProvider";
import Layout from "@/components/Layout";

export default function TermsPage() {
  const { t } = useI18n();
  return (
    <Layout>
      <section className="glass rounded-3xl px-8 py-8">
        <h2 className="text-2xl font-semibold text-ink">{t("legal.termsTitle")}</h2>
        <p className="mt-4 text-sm text-muted">
          {t("legal.termsBody")}
        </p>
      </section>
    </Layout>
  );
}
