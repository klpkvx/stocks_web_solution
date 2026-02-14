import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function RouteLoader() {
  const router = useRouter();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function start() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setActive(true), 120);
    }

    function done() {
      if (timer) clearTimeout(timer);
      setActive(false);
    }

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", done);
    router.events.on("routeChangeError", done);

    return () => {
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", done);
      router.events.off("routeChangeError", done);
      if (timer) clearTimeout(timer);
    };
  }, [router.events]);

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-50 h-0.5 w-full overflow-hidden">
      <div
        className={`h-full w-full origin-left bg-gradient-to-r from-glow via-lavender to-ember transition-transform duration-700 ${
          active ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </div>
  );
}
