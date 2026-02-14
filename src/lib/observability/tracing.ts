import {
  SpanStatusCode,
  context,
  trace,
  type Attributes,
  type Span
} from "@opentelemetry/api";

const tracer = trace.getTracer("stockpulse");

type TraceContext = {
  traceId: string;
  spanId: string;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: String(error.message || ""),
      stack: String(error.stack || "")
    };
  }
  if (typeof error === "string") {
    return { message: error, stack: "" };
  }
  return { message: "unknown_error", stack: "" };
}

function applyAttributes(span: Span, attributes: Attributes = {}) {
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    span.setAttribute(key, value);
  }
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  callback: (span: Span) => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    applyAttributes(span, attributes);
    try {
      const result = await callback(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const serialized = serializeError(error);
      span.recordException(error instanceof Error ? error : new Error(serialized.message));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: serialized.message
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function setActiveSpanAttributes(attributes: Attributes) {
  const span = trace.getSpan(context.active());
  if (!span) return;
  applyAttributes(span, attributes);
}

export function activeTraceContext(): TraceContext | null {
  const span = trace.getSpan(context.active());
  if (!span) return null;
  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId
  };
}

