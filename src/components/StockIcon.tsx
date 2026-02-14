import { memo } from "react";

function StockIcon({
  symbol,
  size = "md"
}: {
  symbol: string;
  size?: "sm" | "md";
}) {
  const clean = (symbol || "?").toUpperCase();
  const label = clean[0] || "?";
  const hash = clean.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const palette = [
    "from-cyan-400 to-blue-500",
    "from-emerald-400 to-teal-500",
    "from-orange-400 to-amber-500",
    "from-fuchsia-400 to-pink-500",
    "from-sky-400 to-indigo-500",
    "from-lime-400 to-green-500"
  ];
  const color = palette[hash % palette.length];
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <div
      className={`flex ${sizeClass} items-center justify-center rounded-full bg-gradient-to-br ${color} font-semibold text-night shadow-sm`}
      title={`${clean} icon`}
      aria-hidden
    >
      {label}
    </div>
  );
}

export default memo(StockIcon);
