import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { MarketInsights } from "@/lib/insights";
import type { Quote } from "@/lib/twelveData";
import { buildDebate, PERSONAS } from "@/lib/personas";
import StockIcon from "@/components/StockIcon";

export default function DebateArena({
  symbol,
  quote,
  sentimentScore,
  insights
}: {
  symbol: string;
  quote?: Quote | null;
  sentimentScore?: number;
  insights?: MarketInsights | null;
}) {
  const { t } = useI18n();
  const [action, setAction] = useState<"buy" | "sell" | "hold">("buy");
  const [size, setSize] = useState(10);
  const [horizon, setHorizon] = useState<"short" | "long">("short");
  const [stress, setStress] = useState(35);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = useMemo(
    () =>
      buildDebate(
        PERSONAS,
        { symbol, action, size, horizon },
        { quote, sentimentScore, insights }
      ),
    [symbol, action, size, horizon, quote, sentimentScore, insights]
  );

  function startCooldown() {
    setCooldown(60);
    const start = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setCooldown(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    timerRef.current = timer;
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function onSimulate() {
    if (stress >= 70) {
      startCooldown();
      setFeedback(t("debate.stressHigh"));
    } else {
      setFeedback(t("debate.stressLow"));
    }
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
    }, 3200);
  }

  return (
    <div className="glass rounded-3xl px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {t("debate.title")}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {t("debate.subtitle")}
          </p>
        </div>
        <div
          className="flex items-center gap-2 text-sm text-muted"
          title={quote?.name ? `${symbol} - ${quote.name}` : symbol}
        >
          <StockIcon symbol={symbol} size="sm" />
          {quote?.price ? `${symbol} ${quote.price.toFixed(2)}` : symbol}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-xs text-muted">{t("debate.actionLabel")}</label>
          <div className="mt-2 flex gap-2">
            {(["buy", "sell", "hold"] as const).map((value) => (
              <button
                key={value}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  action === value
                    ? "bg-white text-night"
                    : "border border-white/10 text-muted"
                }`}
                onClick={() => setAction(value)}
              >
                {t(`debate.action.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted">{t("debate.size")}</label>
          <input
            className="mt-2 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink"
            type="number"
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </div>
        <div>
          <label className="text-xs text-muted">{t("debate.horizon")}</label>
          <select
            className="mt-2 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink"
            value={horizon}
            onChange={(event) =>
              setHorizon(event.target.value as "short" | "long")
            }
          >
            <option value="short">{t("debate.horizon.short")}</option>
            <option value="long">{t("debate.horizon.long")}</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr,0.6fr]">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.persona.id}
              className="rounded-2xl border border-white/10 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {message.persona.name}
              </p>
              <p className="mt-2 text-sm text-ink">{message.text}</p>
              <p className="mt-2 text-xs text-muted">{message.persona.vibe}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            {t("debate.biometric")}
          </p>
          <p className="mt-2 text-sm text-muted">
            {t("debate.biometricHint")}
          </p>
          <div className="mt-4">
            <input
              className="w-full"
              type="range"
              min={0}
              max={100}
              value={stress}
              onChange={(event) => setStress(Number(event.target.value))}
            />
            <p className="mt-2 text-sm text-ink">{t("debate.stress")} {stress}</p>
          </div>
          <button
            className="mt-4 w-full rounded-full bg-gradient-to-r from-glow to-lavender px-4 py-2 text-sm font-semibold text-night"
            onClick={onSimulate}
            disabled={cooldown > 0}
          >
            {cooldown > 0
              ? `${t("debate.cooldown")} ${cooldown}s`
              : t("debate.simulate")}
          </button>
          {feedback && (
            <p className="mt-3 text-xs text-muted">{feedback}</p>
          )}
          {cooldown > 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 px-3 py-3 text-xs text-muted">
              {t("debate.breathing")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
