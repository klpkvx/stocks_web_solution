import { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement>(options: {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
} = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    if (options.once && inView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const next = entries.some((entry) => entry.isIntersecting);
        setInView(next || (options.once ? inView : false));
      },
      {
        rootMargin: options.rootMargin || "280px",
        threshold: options.threshold ?? 0.01
      }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [inView, options.once, options.rootMargin, options.threshold]);

  return { ref, inView };
}
