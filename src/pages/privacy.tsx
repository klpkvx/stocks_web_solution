import { useI18n } from "@/components/I18nProvider";
import Layout from "@/components/Layout";

export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <Layout>
      <section className="glass rounded-3xl px-8 py-8">
        <h2 className="text-2xl font-semibold text-ink">{t("legal.privacyTitle")}</h2>
        <p className="mt-4 text-sm text-muted">
          {t("legal.privacyBody")}
        </p>
      </section>
    </Layout>
  );
}
