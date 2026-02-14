import { useMode } from "@/components/ModeProvider";
import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";

export default function ModeToggle() {
  const { mode, setMode } = useMode();
  const { t } = useI18n();
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
    <div className={`flex items-center gap-2 rounded-full border p-1 text-xs ${containerClass}`}>
      <button
        type="button"
        className={`rounded-full px-3 py-1 transition ${
          mode === "beginner"
            ? selectedClass
            : idleClass
        }`}
        onClick={() => setMode("beginner")}
        aria-pressed={mode === "beginner"}
        aria-label={t("mode.switchBeginner")}
      >
        {t("mode.beginner")}
      </button>
      <button
        type="button"
        className={`rounded-full px-3 py-1 transition ${
          mode === "pro"
            ? selectedClass
            : idleClass
        }`}
        onClick={() => setMode("pro")}
        aria-pressed={mode === "pro"}
        aria-label={t("mode.switchPro")}
      >
        {t("mode.pro")}
      </button>
    </div>
  );
}
