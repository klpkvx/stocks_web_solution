export type HeatmapPeriod = "day" | "week" | "month" | "year";

export type HeatmapChangeSet = Record<HeatmapPeriod, number | null>;

export type HeatmapTicker = {
  symbol: string;
  name: string;
  sector: string;
  marketCapB: number;
  currency: string;
  price: number | null;
  changes: HeatmapChangeSet;
};

export type HeatmapSector = {
  sector: string;
  marketCapB: number;
  count: number;
  changes: HeatmapChangeSet;
};

export type HeatmapPayload = {
  updatedAt: string;
  source: string;
  tickers: HeatmapTicker[];
  sectors: HeatmapSector[];
};
