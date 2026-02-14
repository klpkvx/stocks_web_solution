import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { NodeSDK } from "@opentelemetry/sdk-node";

type ObservabilityState = {
  sdk: NodeSDK | null;
  started: boolean;
};

const globalState = (
  globalThis as { __STOCK_PULSE_OTEL__?: ObservabilityState }
).__STOCK_PULSE_OTEL__ || {
  sdk: null,
  started: false
};

(
  globalThis as { __STOCK_PULSE_OTEL__?: ObservabilityState }
).__STOCK_PULSE_OTEL__ = globalState;

function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function parseHeaders(raw: string) {
  const headers: Record<string, string> = {};
  for (const token of raw.split(",")) {
    const pair = token.trim();
    if (!pair) continue;
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key || !value) continue;
    headers[key] = value;
  }
  return headers;
}

function otelEnabled() {
  const flag = readEnv("OTEL_ENABLED").toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  return Boolean(
    readEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") ||
      readEnv("OTEL_EXPORTER_OTLP_ENDPOINT")
  );
}

function traceEndpoint() {
  const tracesEndpoint = readEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT");
  if (tracesEndpoint) return tracesEndpoint;
  const base = readEnv("OTEL_EXPORTER_OTLP_ENDPOINT");
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/v1/traces`;
}

function buildExporter() {
  const url = traceEndpoint();
  if (!url) return null;
  const headers = parseHeaders(readEnv("OTEL_EXPORTER_OTLP_HEADERS"));
  return new OTLPTraceExporter({
    url,
    headers
  });
}

function serviceName() {
  return readEnv("OTEL_SERVICE_NAME") || "stockpulse-web";
}

function serviceVersion() {
  return readEnv("OTEL_SERVICE_VERSION") || readEnv("npm_package_version") || "0.0.0";
}

function diagEnabled() {
  const raw = readEnv("OTEL_DIAGNOSTIC_LOG_LEVEL").toLowerCase();
  return raw === "debug" || raw === "info";
}

export function initObservability() {
  if (globalState.started) return;
  if (!otelEnabled()) return;

  const traceExporter = buildExporter();
  if (!traceExporter) return;

  if (diagEnabled()) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const sdk = new NodeSDK({
    traceExporter,
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName(),
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion(),
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        readEnv("NODE_ENV") || "development"
    })
  });

  void sdk.start();
  globalState.sdk = sdk;
  globalState.started = true;

  const shutdown = async () => {
    if (!globalState.started || !globalState.sdk) return;
    try {
      await globalState.sdk.shutdown();
    } catch {
      // Ignore shutdown telemetry errors.
    } finally {
      globalState.started = false;
      globalState.sdk = null;
    }
  };

  process.once("SIGTERM", () => {
    void shutdown();
  });
  process.once("SIGINT", () => {
    void shutdown();
  });
}

