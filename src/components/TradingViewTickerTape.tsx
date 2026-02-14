import { memo, useEffect, useMemo, useRef } from "react";

type TradingViewTickerTapeProps = {
  symbols: string[];
  locale: "en" | "ru";
  theme: "dark" | "light";
  className?: string;
};

const NYSE_SYMBOLS = new Set(["BRK.B", "JPM", "V", "MA", "UNH", "XOM", "KO"]);

function toTradingViewSymbol(symbol: string) {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return null;
  const prefix = NYSE_SYMBOLS.has(clean) ? "NYSE" : "NASDAQ";
  return {
    proName: `${prefix}:${clean}`,
    title: clean
  };
}

function TradingViewTickerTape({
  symbols,
  locale,
  theme,
  className = ""
}: TradingViewTickerTapeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(
    () =>
      symbols
        .map(toTradingViewSymbol)
        .filter((item): item is { proName: string; title: string } => Boolean(item))
        .slice(0, 12),
    [symbols]
  );
  const symbolKey = useMemo(() => items.map((item) => item.title).join(","), [items]);

  useEffect(() => {
    if (!containerRef.current) return;
    const host = containerRef.current;
    host.innerHTML = "";

    if (!items.length) return;

    const widgetWrap = document.createElement("div");
    widgetWrap.className = "tradingview-widget-container h-full w-full";

    const widgetBody = document.createElement("div");
    widgetBody.className = "tradingview-widget-container__widget h-full w-full";
    widgetWrap.appendChild(widgetBody);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.text = JSON.stringify({
      symbols: items,
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: theme === "light" ? "light" : "dark",
      locale: locale === "ru" ? "ru" : "en"
    });

    widgetWrap.appendChild(script);
    host.appendChild(widgetWrap);

    return () => {
      host.innerHTML = "";
    };
  }, [symbolKey, locale, theme, items]);

  return (
    <div
      className={`relative h-[88px] w-full overflow-hidden rounded-2xl border border-white/10 ${className}`}
    >
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden [contain:layout_paint] [&_*]:max-w-full"
      />
    </div>
  );
}

export default memo(TradingViewTickerTape);
