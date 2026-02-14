import { activeTraceContext } from "@/lib/observability/tracing";
import { enqueueCentralLog } from "@/lib/observability/logSink";

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

function stringify(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      level: payload.level,
      event: payload.event,
      ts: payload.ts,
      message: "log_payload_unserializable"
    });
  }
}

export function logEvent(level: LogLevel, event: string, fields: LogFields = {}) {
  const trace = activeTraceContext();
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...(trace ? { trace_id: trace.traceId, span_id: trace.spanId } : {}),
    ...fields
  };
  const line = stringify(payload);
  enqueueCentralLog(payload);

  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }
  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(line);
}
