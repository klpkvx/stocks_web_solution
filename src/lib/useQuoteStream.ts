import { useEffect, useMemo, useState } from "react";
import type { Quote } from "@/lib/twelveData";
import { useVisibility } from "@/lib/useVisibility";

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(symbols.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean))
  ).sort();
}

type StreamState = {
  quotes: Quote[];
  connected: boolean;
  error: string | null;
};

export function useQuoteStream(symbols: string[], enabled = true): StreamState {
  const visible = useVisibility();
  const normalized = useMemo(() => normalizeSymbols(symbols), [symbols]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !visible || normalized.length === 0) {
      setConnected(false);
      return;
    }
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const url = `/api/stream/quotes?symbols=${encodeURIComponent(normalized.join(","))}`;
    const es = new EventSource(url);

    es.addEventListener("ready", () => {
      setConnected(true);
      setError(null);
    });

    es.addEventListener("quotes", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data || "{}");
        const incoming = Array.isArray(parsed?.quotes) ? parsed.quotes : [];
        setQuotes(incoming);
      } catch {
        // Ignore malformed payload.
      }
    });

    es.addEventListener("error", () => {
      setConnected(false);
      setError("Streaming unavailable");
    });

    return () => {
      es.close();
      setConnected(false);
    };
  }, [enabled, normalized, visible]);

  return { quotes, connected, error };
}
