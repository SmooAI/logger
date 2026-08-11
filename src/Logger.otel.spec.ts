/* eslint-disable @typescript-eslint/no-explicit-any */
import { INVALID_SPAN_CONTEXT, context, trace } from "@opentelemetry/api";
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

  // The regression the guard exists for. An app that imports the OTel API but
  // registers no TracerProvider gets a NonRecordingSpan carrying
  // INVALID_SPAN_CONTEXT (all-zero ids) — as does a context propagated from a
  // sampled-out parent. Stamping those would not merely fail to correlate, it
  // would OVERWRITE the correlation uuid with zeroes and silently break the
  // existing correlationId join. Remove `isSpanContextValid` from
  // `applyOtelCorrelation` and this test fails.
  test("an invalid span context leaves the correlation uuid intact", () => {
    const logger = new Logger();
    logger.setCorrelationId("11111111-2222-3333-4444-555555555555");

    const built = context.with(
      trace.setSpanContext(context.active(), INVALID_SPAN_CONTEXT),
      () => (logger as any).buildLogObject(Level.Info, ["hello"])[0],
    );

    expect(built[ContextKey.TraceId]).toBe("11111111-2222-3333-4444-555555555555");
    expect(built[ContextKey.TraceId]).not.toBe("00000000000000000000000000000000");
    expect(built[ContextKey.SpanId]).toBeUndefined();
  });

  // Negative control: proves the assertion above is not vacuous. The SAME call
  // shape with a VALID context must stamp — otherwise the test would pass even
  // if correlation were removed entirely.
  test("...but a valid span context still stamps", () => {
    const logger = new Logger();
    logger.setCorrelationId("11111111-2222-3333-4444-555555555555");
    const span = tracerProvider.getTracer("test").startSpan("valid");

    const built = context.with(trace.setSpan(context.active(), span), () =>
      (logger as any).buildLogObject(Level.Info, ["hello"])[0],
    );
    span.end();

    expect(built[ContextKey.TraceId]).toBe(span.spanContext().traceId);
    expect(built[ContextKey.SpanId]).toBe(span.spanContext().spanId);
  });
});
