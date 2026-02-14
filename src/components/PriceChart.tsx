import { useEffect, useRef } from "react";
import type { TimeSeriesPoint } from "@/lib/twelveData";
import { useFeatureFlags } from "@/lib/useFeatureFlags";

const MAX_RENDER_POINTS = 260;

function decimate(points: TimeSeriesPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const output: TimeSeriesPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    output.push(points[i]);
  }
  const last = points[points.length - 1];
  if (output[output.length - 1]?.time !== last.time) {
    output.push(last);
  }
  return output;
}

export default function PriceChart({
  data,
  type = "candlestick"
}: {
  data: TimeSeriesPoint[];
  type?: "candlestick" | "line";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const resizeRef = useRef<ResizeObserver | null>(null);
  const typeRef = useRef<"candlestick" | "line">(type);
  const flags = useFeatureFlags();

  useEffect(() => {
    async function init() {
      if (!containerRef.current || data.length === 0) return;
      const { createChart } = await import("lightweight-charts");
      if (!chartRef.current) {
        chartRef.current = createChart(containerRef.current, {
          layout: {
            background: { color: "#0b0f1a" },
            textColor: "#e2e8f0"
          },
          grid: {
            vertLines: { color: "rgba(148, 163, 184, 0.12)" },
            horzLines: { color: "rgba(148, 163, 184, 0.12)" }
          },
          width: containerRef.current.clientWidth,
          height: 320,
          timeScale: {
            borderColor: "rgba(148, 163, 184, 0.2)",
            timeVisible: true,
            secondsVisible: false
          }
        });
      }

      if (!seriesRef.current || typeRef.current !== type) {
        if (seriesRef.current && chartRef.current) {
          chartRef.current.removeSeries(seriesRef.current);
        }
        typeRef.current = type;
        seriesRef.current =
          type === "line"
            ? chartRef.current.addLineSeries({
                color: "#38bdf8",
                lineWidth: 2
              })
            : chartRef.current.addCandlestickSeries({
                upColor: "#4ade80",
                downColor: "#f97316",
                wickUpColor: "#4ade80",
                wickDownColor: "#f97316",
                borderVisible: false
              });
      }

      const optimized = flags.progressiveCharts
        ? decimate(data, MAX_RENDER_POINTS)
        : data;

      if (type === "line") {
        seriesRef.current.setData(
          optimized.map((point) => ({
            time: point.time,
            value: point.close
          }))
        );
      } else {
        seriesRef.current.setData(
          optimized.map((point) => ({
            time: point.time,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close
          }))
        );
      }

      if (!resizeRef.current && containerRef.current) {
        resizeRef.current = new ResizeObserver(() => {
          if (!containerRef.current || !chartRef.current) return;
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        });
        resizeRef.current.observe(containerRef.current);
      }
    }

    init();
  }, [data, flags.progressiveCharts, type]);

  useEffect(() => {
    return () => {
      if (resizeRef.current && containerRef.current) {
        resizeRef.current.unobserve(containerRef.current);
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
      resizeRef.current = null;
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  return (
    <div className="glass rounded-2xl p-4">
      <div ref={containerRef} className="h-[320px] w-full" />
    </div>
  );
}
