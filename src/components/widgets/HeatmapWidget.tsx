import StockHeatmap from "@/components/StockHeatmap";
import type { HeatmapPayload, HeatmapPeriod } from "@/types/heatmap";

export default function HeatmapWidget({
  data,
  period,
  loading,
  error,
  onPeriodChange,
  onOpenTicker
}: {
  data: HeatmapPayload | null;
  period: HeatmapPeriod;
  loading: boolean;
  error: string | null;
  onPeriodChange: (period: HeatmapPeriod) => void;
  onOpenTicker: (symbol: string) => void;
}) {
  return (
    <StockHeatmap
      data={data}
      period={period}
      onPeriodChange={onPeriodChange}
      loading={loading}
      error={error}
      onOpenTicker={onOpenTicker}
    />
  );
}
