/* eslint-disable @typescript-eslint/no-explicit-any */
import { context, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import Logger, { ContextKey, Level } from "./Logger";

// Real-SDK proof of the correlation fix (th-de3805): a log emitted inside an
// active span must carry that span's real W3C trace_id/span_id — both in the
// stdout JSON object AND in the OTLP log record bridged through
// @opentelemetry/api-logs. No stubbing of getActiveSpan / getLogger: a real
// tracer, a real active context, and a real LoggerProvider.
describe("Logger OTel correlation", () => {
  const memoryExporter = new InMemoryLogRecordExporter();
  const loggerProvider = new LoggerProvider();
  const tracerProvider = new BasicTracerProvider();
  const contextManager = new AsyncHooksContextManager();

  beforeAll(() => {
    loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(memoryExporter));
    logs.setGlobalLoggerProvider(loggerProvider);
    context.setGlobalContextManager(contextManager.enable());
  });

  afterEach(() => {
    memoryExporter.getFinishedLogRecords().length = 0;
    vi.resetAllMocks();
  });

  afterAll(() => {
    contextManager.disable();
  });

  test("stamps the active span trace_id + span_id and bridges an OTLP record", () => {
    const logger = new Logger({ context: {}, level: Level.Info });
    const logSpy = vi.spyOn(logger as any, "logFunc") as any;

    const span = tracerProvider.getTracer("test").startSpan("work");
    const expected = span.spanContext();

    context.with(trace.setSpan(context.active(), span), () => {
      logger.info("hello from a span");
    });
    span.end();

    // stdout JSON object carries the real span ids, not the uuid fallback.
    const built = logSpy.mock.calls[0][0][0] as any;
    expect(built[ContextKey.TraceId]).toBe(expected.traceId);
    expect(built[ContextKey.SpanId]).toBe(expected.spanId);
    expect(built[ContextKey.TraceId]).toMatch(/^[0-9a-f]{32}$/);

    // The bridged OTLP log record carries body + the same correlation.
    const records = memoryExporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]!.body).toBe("hello from a span");
    expect(records[0]!.spanContext?.traceId).toBe(expected.traceId);
    expect(records[0]!.spanContext?.spanId).toBe(expected.spanId);
    expect(records[0]!.severityText).toBe(Level.Info);
  });

  test("falls back to the uuid traceId and no spanId when no span is active", () => {
    const logger = new Logger({ context: {}, level: Level.Info });
    const logSpy = vi.spyOn(logger as any, "logFunc") as any;

    logger.info("no span here");

    const built = logSpy.mock.calls[0][0][0] as any;
    // Prior behavior: traceId is the context correlation uuid, no spanId.
    expect(built[ContextKey.TraceId]).toBe(logger.correlationId());
    expect(built[ContextKey.TraceId]).not.toMatch(/^[0-9a-f]{32}$/);
    expect(built[ContextKey.SpanId]).toBeUndefined();

    // A record is still bridged (uncorrelated) so obs sees the line.
    const records = memoryExporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]!.spanContext).toBeUndefined();
  });
});
