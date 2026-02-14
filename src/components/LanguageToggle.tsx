import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";

export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const containerClass = isDark
    ? "border-white/10 bg-white/5"
    : "border-slate-300 bg-white/75";
  const selectedClass = isDark ? "bg-white text-night" : "bg-slate-900 text-white";
  const idleClass = isDark
    ? "text-muted hover:text-ink"
    : "text-slate-600 hover:text-slate-900";

  return (
    <div
      className={`flex items-center gap-1 rounded-full border p-1 text-xs ${containerClass}`}
      role="group"
      aria-label={t("lang.switch")}
    >
      <button
        type="button"
        className={`rounded-full px-2.5 py-1 transition ${
          locale === "en" ? selectedClass : idleClass
        }`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        {t("lang.english")}
      </button>
      <button
        type="button"
        className={`rounded-full px-2.5 py-1 transition ${
          locale === "ru" ? selectedClass : idleClass
        }`}
        onClick={() => setLocale("ru")}
        aria-pressed={locale === "ru"}
      >
        {t("lang.russian")}
      </button>
    </div>
  );
}
