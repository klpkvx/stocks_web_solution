type LogEnvelope = Record<string, unknown>;

type SinkState = {
  queue: LogEnvelope[];
  flushing: boolean;
  timer: NodeJS.Timeout | null;
};

const MAX_QUEUE_SIZE = 5_000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 2_000;

const globalState = (
  globalThis as { __STOCK_PULSE_LOG_SINK__?: SinkState }
).__STOCK_PULSE_LOG_SINK__ || {
  queue: [],
  flushing: false,
  timer: null
};

(
  globalThis as { __STOCK_PULSE_LOG_SINK__?: SinkState }
).__STOCK_PULSE_LOG_SINK__ = globalState;

function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function sinkUrl() {
  return readEnv("LOG_INGEST_URL");
}

function sinkToken() {
  return readEnv("LOG_INGEST_TOKEN");
}

function batchSize() {
  return parsePositiveInt(readEnv("LOG_INGEST_BATCH_SIZE"), DEFAULT_BATCH_SIZE);
}

function flushIntervalMs() {
  return parsePositiveInt(
    readEnv("LOG_INGEST_FLUSH_INTERVAL_MS"),
    DEFAULT_FLUSH_INTERVAL_MS
  );
}

function requestTimeoutMs() {
  return parsePositiveInt(readEnv("LOG_INGEST_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS);
}

function isServerRuntime() {
  return typeof window === "undefined";
}

function sinkEnabled() {
  return isServerRuntime() && Boolean(sinkUrl());
}

function scheduleFlush() {
  if (!sinkEnabled()) return;
  if (globalState.timer) return;
  globalState.timer = setTimeout(() => {
    globalState.timer = null;
    void flushLogs();
  }, flushIntervalMs());
}

async function sendBatch(batch: LogEnvelope[]) {
  const url = sinkUrl();
  if (!url || batch.length === 0) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs());
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    const token = sinkToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "stockpulse",
        logs: batch
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export function enqueueCentralLog(entry: LogEnvelope) {
  if (!sinkEnabled()) return;
  if (globalState.queue.length >= MAX_QUEUE_SIZE) {
    globalState.queue.shift();
  }
  globalState.queue.push(entry);
  if (globalState.queue.length >= batchSize()) {
    void flushLogs();
    return;
  }
  scheduleFlush();
}

export async function flushLogs() {
  if (!sinkEnabled()) return;
  if (globalState.flushing) return;
  if (globalState.queue.length === 0) return;

  globalState.flushing = true;
  const size = batchSize();
  try {
    while (globalState.queue.length > 0) {
      const batch = globalState.queue.splice(0, size);
      try {
        await sendBatch(batch);
      } catch {
        // Re-queue dropped batch head-first and stop retry loop.
        globalState.queue = [...batch, ...globalState.queue].slice(-MAX_QUEUE_SIZE);
        break;
      }
    }
  } finally {
    globalState.flushing = false;
    if (globalState.queue.length > 0) {
      scheduleFlush();
    }
  }
}

