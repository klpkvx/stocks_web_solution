import { IconMoon, IconSun } from "@/components/Icons";
import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { theme, ready, toggleTheme } = useTheme();
  const { t } = useI18n();
  const isDark = theme === "dark";
  const baseClass = isDark
    ? "border-white/10 bg-white/5 text-muted hover:border-white/30 hover:text-ink"
    : "border-slate-300 bg-white/75 text-slate-700 hover:border-slate-400 hover:text-slate-900";

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${baseClass}`}
      onClick={toggleTheme}
      aria-label={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
      title={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
      disabled={!ready}
    >
      {isDark ? <IconSun size={14} /> : <IconMoon size={14} />}
      <span>{isDark ? t("theme.light") : t("theme.dark")}</span>
    </button>
  );
}
