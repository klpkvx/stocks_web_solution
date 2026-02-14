type CounterMap = Record<string, number>;
type DurationStat = {
  count: number;
  sumMs: number;
  minMs: number;
  maxMs: number;
};
type DurationMap = Record<string, DurationStat>;

type TelemetryState = {
  counters: CounterMap;
  durations: DurationMap;
};

const globalTelemetry =
  (globalThis as any).__STOCK_PULSE_TELEMETRY__ ||
  ({
    counters: {},
    durations: {}
  } satisfies TelemetryState);

(globalThis as any).__STOCK_PULSE_TELEMETRY__ = globalTelemetry;

export function incrementCounter(name: string, by = 1) {
  globalTelemetry.counters[name] = (globalTelemetry.counters[name] || 0) + by;
}

export function recordDuration(name: string, ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return;
  const current = globalTelemetry.durations[name] || {
    count: 0,
    sumMs: 0,
    minMs: Number.POSITIVE_INFINITY,
    maxMs: 0
  };
  current.count += 1;
  current.sumMs += ms;
  current.minMs = Math.min(current.minMs, ms);
  current.maxMs = Math.max(current.maxMs, ms);
  globalTelemetry.durations[name] = current;
}

export function startTimer(name: string) {
  const startedAt = Date.now();
  return () => {
    recordDuration(name, Date.now() - startedAt);
  };
}

export function getTelemetrySnapshot() {
  const durations = Object.fromEntries(
    Object.entries(globalTelemetry.durations as DurationMap).map(
      ([key, value]) => [
        key,
        {
          ...value,
          avgMs: value.count > 0 ? value.sumMs / value.count : 0
        }
      ]
    )
  );

  return {
    counters: { ...globalTelemetry.counters },
    durations
  };
}
