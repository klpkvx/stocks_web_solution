import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

export default function SensoryPanel({
  sentiment,
  volatility
}: {
  sentiment: number;
  volatility: number;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  useEffect(() => {
    if (!active || !audioRef.current) return;
    const intensity = Math.min(1, Math.abs(sentiment) + volatility * 2);
    const frequency = 220 + intensity * 220;
    const volume = 0.03 + intensity * 0.08;

    audioRef.current.osc.frequency.value = frequency;
    audioRef.current.gain.gain.value = volume;

    if (haptics && typeof navigator !== "undefined" && navigator.vibrate) {
      if (intensity > 0.6) {
        navigator.vibrate([60, 120, 60]);
      }
    }
  }, [active, sentiment, volatility, haptics]);

  useEffect(() => {
    if (!active && audioRef.current) {
      audioRef.current.gain.gain.value = 0;
    }
  }, [active]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.osc.stop();
        audioRef.current.ctx.close();
        audioRef.current = null;
      }
    };
  }, []);

  const mood =
    sentiment > 0.2
      ? t("sensory.mood.drive")
      : sentiment < -0.2
        ? t("sensory.mood.steady")
        : t("sensory.mood.balance");

  async function ensureAudio() {
    try {
      if (!audioRef.current) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        audioRef.current = { ctx, osc, gain };
      }
      if (audioRef.current.ctx.state === "suspended") {
        await audioRef.current.ctx.resume();
      }
      setAudioReady(audioRef.current.ctx.state === "running");
      setAudioError(null);
    } catch (error: any) {
      setAudioError(t("sensory.audioBlocked"));
      setAudioReady(false);
    }
  }

  return (
    <div className="glass rounded-3xl px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {t("sensory.title")}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {t("sensory.subtitle")}
          </p>
        </div>
        <div className="text-xs text-muted">{t("sensory.mood")}: {mood}</div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
        <div>
          <button
            className="rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-sm font-semibold text-night"
            onClick={async () => {
              if (!active) {
                await ensureAudio();
              }
              setActive((prev) => !prev);
            }}
          >
            {active ? t("sensory.stop") : t("sensory.start")}
          </button>
          {!audioReady && active && (
            <p className="mt-3 text-xs text-muted">
              {t("sensory.audioUnlock")}
            </p>
          )}
          {audioError && (
            <p className="mt-3 text-xs text-ember">{audioError}</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 px-4 py-3">
          <label className="text-xs text-muted">{t("sensory.haptics")}</label>
          <div className="mt-2 flex items-center gap-3">
            <button
              className={`rounded-full px-3 py-1 text-xs ${
                haptics ? "bg-white text-night" : "border border-white/10 text-muted"
              }`}
              onClick={() => setHaptics(true)}
            >
              {t("sensory.on")}
            </button>
            <button
              className={`rounded-full px-3 py-1 text-xs ${
                !haptics ? "bg-white text-night" : "border border-white/10 text-muted"
              }`}
              onClick={() => setHaptics(false)}
            >
              {t("sensory.off")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
