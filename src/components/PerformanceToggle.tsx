import { usePerformance } from "@/components/PerformanceProvider";
import { useI18n } from "@/components/I18nProvider";

export default function PerformanceToggle() {
  const { mode, setMode } = usePerformance();
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-[11px] text-muted">
      {(["auto", "quality", "performance"] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={`rounded-full px-2 py-1 transition ${
            mode === value
              ? "bg-white text-night"
              : "text-muted hover:text-ink"
          }`}
          onClick={() => setMode(value)}
          aria-pressed={mode === value}
        >
          {t(`home.performance.${value}`, value)}
        </button>
      ))}
    </div>
  );
}
