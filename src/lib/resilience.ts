type CircuitState = {
  failures: number;
  openedAt: number | null;
};

type ResilienceOptions = {
  timeoutMs: number;
  retries?: number;
  openAfterFailures?: number;
  openWindowMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

const CIRCUITS = new Map<string, CircuitState>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getState(key: string) {
  const current = CIRCUITS.get(key);
  if (current) return current;
  const next: CircuitState = { failures: 0, openedAt: null };
  CIRCUITS.set(key, next);
  return next;
}

function isAbortError(error: unknown) {
  const name = (error as any)?.name;
  const message = String((error as any)?.message || "");
  return name === "AbortError" || /aborted|timeout/i.test(message);
}

async function runAttempt<T>(
  task: (ctx: { signal: AbortSignal }) => Promise<T>,
  ms: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await task({ signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function runWithResilience<T>(
  key: string,
  task: (ctx: { signal: AbortSignal }) => Promise<T>,
  options: ResilienceOptions
) {
  const retries = Math.max(0, options.retries ?? 1);
  const openAfterFailures = Math.max(1, options.openAfterFailures ?? 4);
  const openWindowMs = Math.max(1000, options.openWindowMs ?? 45_000);
  const now = Date.now();
  const state = getState(key);

  if (state.openedAt && now - state.openedAt < openWindowMs) {
    throw new Error(`Circuit open for ${key}`);
  }
  if (state.openedAt && now - state.openedAt >= openWindowMs) {
    state.openedAt = null;
    state.failures = 0;
  }

  let attempt = 0;
  while (attempt <= retries) {
    attempt += 1;
    try {
      const result = await runAttempt(task, options.timeoutMs);
      state.failures = 0;
      state.openedAt = null;
      return result;
    } catch (error) {
      state.failures += 1;
      if (state.failures >= openAfterFailures) {
        state.openedAt = Date.now();
      }
      const retryable = options.shouldRetry
        ? options.shouldRetry(error)
        : !isAbortError(error);
      if (!retryable || attempt > retries) {
        throw error;
      }
      await sleep(Math.min(600, 120 * 2 ** (attempt - 1)));
    }
  }

  throw new Error(`Unexpected resilience state for ${key}`);
}
