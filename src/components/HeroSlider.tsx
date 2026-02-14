import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

type Slide = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  cta: { label: string; href: string };
  stats: { label: string; value: string }[];
};

function HeroSlider({ slides }: { slides: Slide[] }) {
  const { t } = useI18n();
  const safeSlides = useMemo(
    () =>
      slides.length
        ? slides
        : [
            {
              id: "fallback",
              kicker: t("hero.fallback.kicker"),
              title: t("hero.fallback.title"),
              description: t("hero.fallback.description"),
              cta: { label: t("hero.fallback.cta"), href: "/" },
              stats: [
                { label: t("hero.fallback.statWatchlist"), value: t("hero.fallback.statLive") },
                { label: t("hero.fallback.statLatency"), value: "< 1m" }
              ]
            }
          ],
    [slides, t]
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (safeSlides.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % safeSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [safeSlides.length, paused]);

  useEffect(() => {
    if (index >= safeSlides.length) {
      setIndex(0);
    }
  }, [index, safeSlides.length]);

  const translate = `translateX(-${index * 100}%)`;

  return (
    <div
      className="glass hero-glow fade-in-up relative overflow-hidden rounded-3xl px-0 py-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: translate }}
      >
        {safeSlides.map((slide) => (
          <div
            key={slide.id}
            className="min-w-full px-8 py-10"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              {slide.kicker}
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">
              {slide.title}
            </h3>
            <p className="mt-3 text-sm text-muted">{slide.description}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {slide.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-xs text-muted"
                >
                  <p className="text-ink text-sm">{stat.value}</p>
                  <p className="mt-1 uppercase tracking-[0.2em]">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link
              className="mt-6 inline-flex rounded-full bg-gradient-to-r from-glow to-lavender px-5 py-2 text-xs font-semibold text-night"
              href={slide.cta.href}
            >
              {slide.cta.label}
            </Link>
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 right-6 flex items-center gap-2">
        {safeSlides.map((slide, i) => (
          <button
            key={slide.id}
            className={`h-2 w-2 rounded-full transition ${
              i === index ? "bg-white" : "bg-white/30"
            }`}
            aria-label={t("hero.goToSlide", undefined, { title: slide.title })}
            type="button"
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
      <div className="absolute top-4 right-6 flex gap-2 text-xs text-muted">
        <button
          className="rounded-full border border-white/10 px-2 py-1"
          type="button"
          aria-label={t("hero.prev")}
          onClick={() =>
            setIndex((prev) =>
              prev === 0 ? safeSlides.length - 1 : prev - 1
            )
          }
        >
          {t("hero.prev")}
        </button>
        <button
          className="rounded-full border border-white/10 px-2 py-1"
          type="button"
          aria-label={t("hero.next")}
          onClick={() => setIndex((prev) => (prev + 1) % safeSlides.length)}
        >
          {t("hero.next")}
        </button>
      </div>
    </div>
  );
}

export default memo(HeroSlider);
