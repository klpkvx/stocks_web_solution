import { useEffect, useRef } from "react";

export type LineSeries = {
  name: string;
  color: string;
  data: { time: string; value: number }[];
};

export default function MultiLineChart({
  series
}: {
  series: LineSeries[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let chart: any;
    let resizeObserver: ResizeObserver | null = null;

    async function init() {
      if (!containerRef.current || series.length === 0) return;
      const { createChart } = await import("lightweight-charts");

      chart = createChart(containerRef.current, {
        layout: {
          background: { color: "#0b0f1a" },
          textColor: "#e2e8f0"
        },
        grid: {
          vertLines: { color: "rgba(148, 163, 184, 0.12)" },
          horzLines: { color: "rgba(148, 163, 184, 0.12)" }
        },
        width: containerRef.current.clientWidth,
        height: 300
      });

      series.forEach((lineSeries) => {
        const line = chart.addLineSeries({
          color: lineSeries.color,
          lineWidth: 2
        });
        line.setData(lineSeries.data);
      });

      resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current || !chart) return;
        chart.applyOptions({ width: containerRef.current.clientWidth });
      });
      resizeObserver.observe(containerRef.current);
    }

    init();

    return () => {
      if (resizeObserver && containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      if (chart) {
        chart.remove();
      }
    };
  }, [series]);

  return (
    <div className="glass rounded-2xl p-4">
      <div ref={containerRef} className="h-[300px] w-full" />
    </div>
  );
}
