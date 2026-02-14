import type {
  HeatmapPayload,
  HeatmapPeriod,
  HeatmapSector,
  HeatmapTicker
} from "@/types/heatmap";

export type HeatmapSortMode = "cap" | "change_desc" | "change_asc";

export type HeatmapTickerView = HeatmapTicker & {
  change: number | null;
  zScore: number | null;
  relativeToSector: number | null;
  intensity: number;
};

export type HeatmapSectorView = HeatmapSector & {
  change: number | null;
  weightedChange: number | null;
  medianChange: number | null;
  dispersion: number | null;
  breadth: {
    advancers: number;
    decliners: number;
    flat: number;
  };
  tickers: HeatmapTickerView[];
};

export type HeatmapMarketSummary = {
  weightedChange: number | null;
  medianChange: number | null;
  dispersion: number | null;
  breadth: {
    advancers: number;
    decliners: number;
    flat: number;
  };
  breadthRatio: number;
};

export type HeatmapViewModel = {
  colorDomain: number;
  sectors: HeatmapSectorView[];
  leaders: HeatmapTickerView[];
  laggards: HeatmapTickerView[];
  market: HeatmapMarketSummary;
};

const FLAT_BAND = 0.05;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function stdDev(values: number[]) {
  if (values.length < 2) return null;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance =
    values.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = clamp(p, 0, 1) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const ratio = rank - low;
  return sorted[low] * (1 - ratio) + sorted[high] * ratio;
}

function computeBreadth(values: Array<number | null>) {
  let advancers = 0;
  let decliners = 0;
  let flat = 0;

  values.forEach((value) => {
    if (!isFiniteNumber(value)) {
      flat += 1;
      return;
    }
    if (value > FLAT_BAND) {
      advancers += 1;
      return;
    }
    if (value < -FLAT_BAND) {
      decliners += 1;
      return;
    }
    flat += 1;
  });

  return { advancers, decliners, flat };
}

function computeWeightedChange(
  tickers: Array<{ change: number | null; marketCapB: number }>
) {
  let weightedSum = 0;
  let totalCap = 0;

  tickers.forEach((ticker) => {
    if (!isFiniteNumber(ticker.change)) return;
    if (!isFiniteNumber(ticker.marketCapB) || ticker.marketCapB <= 0) return;
    weightedSum += ticker.change * ticker.marketCapB;
    totalCap += ticker.marketCapB;
  });

  if (totalCap <= 0) return null;
  return weightedSum / totalCap;
}

function sortTickers(tickers: HeatmapTickerView[], mode: HeatmapSortMode) {
  const sorted = [...tickers];

  if (mode === "cap") {
    return sorted.sort((a, b) => b.marketCapB - a.marketCapB);
  }

  if (mode === "change_desc") {
    return sorted.sort((a, b) => {
      const left = isFiniteNumber(a.change) ? a.change : -Number.POSITIVE_INFINITY;
      const right = isFiniteNumber(b.change) ? b.change : -Number.POSITIVE_INFINITY;
      if (right !== left) return right - left;
      return b.marketCapB - a.marketCapB;
    });
  }

  return sorted.sort((a, b) => {
    const left = isFiniteNumber(a.change) ? a.change : Number.POSITIVE_INFINITY;
    const right = isFiniteNumber(b.change) ? b.change : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return b.marketCapB - a.marketCapB;
  });
}

export function buildHeatmapViewModel(
  data: HeatmapPayload | null,
  period: HeatmapPeriod,
  sortMode: HeatmapSortMode
): HeatmapViewModel {
  const tickers = data?.tickers || [];
  const sectors = data?.sectors || [];

  const validChanges = tickers
    .map((ticker) => ticker.changes[period])
    .filter((value): value is number => isFiniteNumber(value));

  const absValues = validChanges.map((value) => Math.abs(value));
  const p85 = percentile(absValues, 0.85);
  const colorDomain = clamp(p85 || 4.5, 1.25, 14);

  const mean =
    validChanges.length > 0
      ? validChanges.reduce((acc, value) => acc + value, 0) / validChanges.length
      : 0;
  const sigma = stdDev(validChanges) || 0;

  const bySector = new Map<string, HeatmapTickerView[]>();

  tickers.forEach((ticker) => {
    const change = ticker.changes[period];
    const normalized = isFiniteNumber(change) ? change : null;
    const intensity = normalized === null ? 0 : clamp(Math.abs(normalized) / colorDomain, 0, 1);
    const zScore =
      normalized === null || sigma === 0 ? null : (normalized - mean) / sigma;

    const next: HeatmapTickerView = {
      ...ticker,
      change: normalized,
      zScore,
      relativeToSector: null,
      intensity
    };

    const current = bySector.get(ticker.sector) || [];
    current.push(next);
    bySector.set(ticker.sector, current);
  });

  const sectorList: HeatmapSectorView[] = sectors.map((sector) => {
    const sectorTickers = sortTickers(bySector.get(sector.sector) || [], sortMode);
    const sectorChanges = sectorTickers
      .map((ticker) => ticker.change)
      .filter((value): value is number => isFiniteNumber(value));

    const weightedChange = computeWeightedChange(sectorTickers);
    const sectorChange = isFiniteNumber(sector.changes[period])
      ? sector.changes[period]
      : weightedChange;

    const withRelative = sectorTickers.map((ticker) => ({
      ...ticker,
      relativeToSector:
        isFiniteNumber(ticker.change) && isFiniteNumber(sectorChange)
          ? ticker.change - sectorChange
          : null
    }));

    return {
      ...sector,
      change: sectorChange,
      weightedChange,
      medianChange: median(sectorChanges),
      dispersion: stdDev(sectorChanges),
      breadth: computeBreadth(withRelative.map((ticker) => ticker.change)),
      tickers: withRelative
    };
  });

  const knownSectors = new Set(sectorList.map((sector) => sector.sector));
  bySector.forEach((sectorTickers, sectorName) => {
    if (knownSectors.has(sectorName)) return;
    const sorted = sortTickers(sectorTickers, sortMode);
    const values = sorted
      .map((ticker) => ticker.change)
      .filter((value): value is number => isFiniteNumber(value));
    const weightedChange = computeWeightedChange(sorted);

    sectorList.push({
      sector: sectorName,
      marketCapB: sorted.reduce((acc, ticker) => acc + ticker.marketCapB, 0),
      count: sorted.length,
      changes: {
        day: null,
        week: null,
        month: null,
        year: null
      },
      change: weightedChange,
      weightedChange,
      medianChange: median(values),
      dispersion: stdDev(values),
      breadth: computeBreadth(sorted.map((ticker) => ticker.change)),
      tickers: sorted.map((ticker) => ({
        ...ticker,
        relativeToSector:
          isFiniteNumber(ticker.change) && isFiniteNumber(weightedChange)
            ? ticker.change - weightedChange
            : null
      }))
    });
  });

  sectorList.sort((a, b) => b.marketCapB - a.marketCapB);

  const flattened = sectorList.flatMap((sector) => sector.tickers);
  const movers = flattened.filter((ticker) => isFiniteNumber(ticker.change));
  const leaders = [...movers]
    .sort((a, b) => (b.change as number) - (a.change as number))
    .slice(0, 8);
  const laggards = [...movers]
    .sort((a, b) => (a.change as number) - (b.change as number))
    .slice(0, 8);

  const marketWeighted = computeWeightedChange(flattened);
  const marketMedian = median(validChanges);
  const marketDispersion = stdDev(validChanges);
  const marketBreadth = computeBreadth(flattened.map((ticker) => ticker.change));
  const breadthRatio =
    marketBreadth.decliners > 0
      ? marketBreadth.advancers / marketBreadth.decliners
      : marketBreadth.advancers;

  return {
    colorDomain,
    sectors: sectorList,
    leaders,
    laggards,
    market: {
      weightedChange: marketWeighted,
      medianChange: marketMedian,
      dispersion: marketDispersion,
      breadth: marketBreadth,
      breadthRatio
    }
  };
}
