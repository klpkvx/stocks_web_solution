import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/twelveData";
import { SECTOR_COLORS, SECTOR_MAP } from "@/lib/sectors";
import { useI18n } from "@/components/I18nProvider";

export default function MarketMap({ quotes }: { quotes: Quote[] }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const hasQuotes = quotes.length > 0;

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sectors = quotes.reduce<Record<string, number>>((acc, quote) => {
      const sector = SECTOR_MAP[quote.symbol] || "Other";
      const change = quote.percentChange ?? 0;
      acc[sector] = (acc[sector] || 0) + change;
      return acc;
    }, {});

    const nodes = Object.keys(sectors).map((sector, index) => ({
      sector,
      value: sectors[sector],
      x: 120 + (index % 3) * 160,
      y: 120 + Math.floor(index / 3) * 140,
      radius: 38 + Math.min(20, Math.abs(sectors[sector]) * 2)
    }));

    let frame = 0;
    let animationId = 0;

    const draw = () => {
      frame += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(9, 13, 22, 0.8)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      nodes.forEach((node) => {
        const pulse = 1 + Math.sin(frame / 20) * 0.04;
        const radius = node.radius * pulse;
        const color = SECTOR_COLORS[node.sector] || "#94a3b8";
        ctx.beginPath();
        ctx.fillStyle = color + "55";
        ctx.strokeStyle = color;
        ctx.lineWidth = selectedRef.current === node.sector ? 3 : 1.5;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "12px sans-serif";
        ctx.fillText(node.sector, node.x - 30, node.y + 4);
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = nodes.find(
        (node) => Math.hypot(node.x - x, node.y - y) < node.radius
      );
      setSelected(hit ? hit.sector : null);
    };

    canvas.addEventListener("click", handleClick);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("click", handleClick);
    };
  }, [quotes]);

  return (
    <div className="glass rounded-3xl px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {t("marketMap.title")}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {t("marketMap.subtitle")}
          </p>
        </div>
        {selected && (
          <div className="text-xs text-muted">
            {t("marketMap.focus", undefined, { sector: selected })}
          </div>
        )}
      </div>
      {!hasQuotes && (
        <p className="mt-4 text-sm text-muted">
          {t("marketMap.empty")}
        </p>
      )}
      <div className="mt-6">
        <canvas
          ref={canvasRef}
          width={560}
          height={360}
          className="w-full rounded-2xl border border-white/10"
        />
      </div>
    </div>
  );
}
