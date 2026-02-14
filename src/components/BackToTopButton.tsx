import { useEffect, useState } from "react";
import { IconArrowUp } from "@/components/Icons";
import { useI18n } from "@/components/I18nProvider";

const SHOW_AT = 320;

export default function BackToTopButton() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AT);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("backToTop")}
      className={`fixed bottom-6 right-6 z-[210] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-night/80 text-ink shadow-card backdrop-blur transition ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <IconArrowUp size={18} />
    </button>
  );
}
