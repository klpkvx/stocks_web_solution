import { useEffect, useState } from "react";
import type { ToastTone } from "@/lib/toast";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastEventDetail = {
  message: string;
  tone?: ToastTone;
};

const DISPLAY_MS = 3200;

export default function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const custom = event as CustomEvent<ToastEventDetail>;
      if (!custom.detail?.message) return;

      const item: ToastItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        message: custom.detail.message,
        tone: custom.detail.tone || "info"
      };
      setToasts((prev) => [...prev, item].slice(-4));

      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== item.id));
      }, DISPLAY_MS);
    }

    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-20 z-[220] flex w-[min(92vw,360px)] flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => {
        const toneClass =
          toast.tone === "success"
            ? "border-neon/40"
            : toast.tone === "error"
              ? "border-ember/50"
              : "border-glow/40";
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border ${toneClass} bg-night/90 px-4 py-3 text-sm text-ink shadow-card backdrop-blur`}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
