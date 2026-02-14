type Task = () => Promise<void>;

const globalQueue =
  (globalThis as any).__STOCK_PULSE_TASK_QUEUE__ ||
  ({
    running: 0,
    limit: Math.max(1, Number(process.env.WORKER_CONCURRENCY || 2)),
    queue: [] as Array<{ key: string; task: Task }>,
    inFlight: new Set<string>()
  });

(globalThis as any).__STOCK_PULSE_TASK_QUEUE__ = globalQueue;

function runNext() {
  if (globalQueue.running >= globalQueue.limit) return;
  const next = globalQueue.queue.shift();
  if (!next) return;
  globalQueue.running += 1;
  globalQueue.inFlight.add(next.key);

  next
    .task()
    .catch(() => undefined)
    .finally(() => {
      globalQueue.running -= 1;
      globalQueue.inFlight.delete(next.key);
      runNext();
    });
}

export function enqueueTask(key: string, task: Task) {
  if (globalQueue.inFlight.has(key)) return;
  if (globalQueue.queue.some((item: { key: string }) => item.key === key)) return;
  globalQueue.queue.push({ key, task });
  runNext();
}
