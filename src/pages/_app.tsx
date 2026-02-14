import { useEffect, useState } from "react";
import type { AppProps, NextWebVitalsMetric } from "next/app";
import { QueryClientProvider } from "@tanstack/react-query";
import { ModeProvider } from "@/components/ModeProvider";
import { I18nProvider } from "@/components/I18nProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PerformanceProvider } from "@/components/PerformanceProvider";
import { getQueryClient } from "@/lib/queryClient";
import "@/styles/globals.css";

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (process.env.NODE_ENV !== "production") return;

  const body = JSON.stringify(metric);
  if (process.env.NEXT_PUBLIC_DEBUG_WEB_VITALS === "1") {
    // Keep optional debug logging off by default.
    // eslint-disable-next-line no-console
    console.log("[web-vitals]", metric.name, metric.value);
  }

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/web-vitals", body);
  } else {
    fetch("/api/web-vitals", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true
    }).catch(() => undefined);
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (process.env.NEXT_PUBLIC_ENABLE_SW !== "1") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PerformanceProvider>
        <ThemeProvider>
          <I18nProvider>
            <ModeProvider>
              <div className="font-sans">
                <Component {...pageProps} />
              </div>
            </ModeProvider>
          </I18nProvider>
        </ThemeProvider>
      </PerformanceProvider>
    </QueryClientProvider>
  );
}
