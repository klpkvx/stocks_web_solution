import { useI18n } from "@/components/I18nProvider";

export default function SentimentBadge({
  label,
  score
}: {
  label: string;
  score: number;
}) {
  const { t } = useI18n();
  const palette =
    label === "bullish"
      ? "bg-neon/15 text-neon"
      : label === "bearish"
        ? "bg-ember/20 text-ember"
        : "bg-white/10 text-muted";
  const localizedLabel =
    label === "bullish"
      ? t("sentiment.bullish")
      : label === "bearish"
        ? t("sentiment.bearish")
        : label === "neutral"
          ? t("sentiment.neutral")
          : label;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${palette}`}
    >
      {localizedLabel}
      <span className="text-[10px] opacity-70">{score.toFixed(2)}</span>
    </span>
  );
}
