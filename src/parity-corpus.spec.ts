/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import Logger, { ContextKey, DEFAULT_REDACT_KEYS, Level, REDACTED_VALUE } from "./Logger";

/**
 * Golden-vector parity corpus (ADR-089 pattern, as used by @smooai/audit).
 *
 * Asserts the TypeScript port satisfies the same contract every other port
 * (Python / Rust / Go / .NET) is held to, from the same committed file. A
 * failure here means either this port drifted or the shared contract moved --
 * fix the port, not the corpus.
 */

type CorpusLevel = { name: string; LogLevel: string; level: number };
type CorpusCase = {
  name: string;
  message?: string;
  context?: Record<string, unknown> | null;
  expectMsg?: string;
  expectContext?: Record<string, unknown>;
  redacted?: string[];
  preserved?: Record<string, unknown>;
};
type Corpus = {
  version: number;
  levels: { rows: CorpusLevel[] };
  fieldNames: Record<string, string>;
  record: { message: string; requiredFields: string[] };
  messageShape: { cases: CorpusCase[] };
  correlationId: { field: string; alsoSets: string[]; value: string };
  redaction: { placeholder: string; defaultKeys: string[]; cases: CorpusCase[] };
};

const corpus: Corpus = JSON.parse(
  readFileSync(join(__dirname, "..", "parity-corpus.json"), "utf8"),
);

/** Captures the built log object instead of writing it to stdout. */
class CapturingLogger extends Logger {
  public captured: any[] = [];
  protected override logFunc = (args: any[]) => {
    this.captured.push(...args);
  };
}

function emit(level: string, message: string, context?: Record<string, unknown> | null): any {
  const logger = new CapturingLogger({ context: {}, level: Level.Trace });
  const args = context == null ? [message] : [message, context];
  (logger as any)[level](...args);
  expect(logger.captured).toHaveLength(1);
  return logger.captured[0];
}

/** Bump alongside the corpus's own `version` when its shape changes. */
const CORPUS_VERSION = 2;

describe("parity corpus: levels", () => {
  test("corpus is the shape this loader understands", () => {
    expect(corpus.version).toBe(CORPUS_VERSION);
  });

  test("corpus covers all six levels in order", () => {
    expect(corpus.levels.rows.map((l) => l.name)).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ]);
  });

  test.each(corpus.levels.rows)(
    "$name emits level=$level and LogLevel=$LogLevel",
    ({ name, level, LogLevel }) => {
      const record = emit(name, corpus.record.message);

      // level -> pino-compatible NUMERIC code
      expect(record[ContextKey.Level]).toBe(level);
      expect(typeof record[ContextKey.Level]).toBe("number");

      // LogLevel -> canonical lowercase STRING
      expect(record[ContextKey.LogLevel]).toBe(LogLevel);
      expect(typeof record[ContextKey.LogLevel]).toBe("string");
    },
  );
});

describe("parity corpus: record shape", () => {
  test.each(corpus.levels.rows.map((l) => l.name))("%s carries every required field", (name) => {
    const record = emit(name, corpus.record.message);
    for (const field of corpus.record.requiredFields) {
      expect(record).toHaveProperty(field);
      expect(record[field]).not.toBeUndefined();
    }
  });

  test("wire field names match the corpus", () => {
    expect(ContextKey.Level).toBe(corpus.fieldNames.level);
    expect(ContextKey.LogLevel).toBe(corpus.fieldNames.logLevel);
    expect(ContextKey.Time).toBe(corpus.fieldNames.time);
    expect(ContextKey.Message).toBe(corpus.fieldNames.message);
    expect(ContextKey.Name).toBe(corpus.fieldNames.name);
    expect(ContextKey.Context).toBe(corpus.fieldNames.context);
    expect(ContextKey.CorrelationId).toBe(corpus.fieldNames.correlationId);
    expect(ContextKey.RequestId).toBe(corpus.fieldNames.requestId);
    expect(ContextKey.TraceId).toBe(corpus.fieldNames.traceId);
    expect(ContextKey.SpanId).toBe(corpus.fieldNames.spanId);
    expect(ContextKey.Namespace).toBe(corpus.fieldNames.namespace);
    expect(ContextKey.Service).toBe(corpus.fieldNames.service);
    expect(ContextKey.Duration).toBe(corpus.fieldNames.duration);
    expect(ContextKey.Error).toBe(corpus.fieldNames.error);
    expect(ContextKey.ErrorDetails).toBe(corpus.fieldNames.errorDetails);
    expect(ContextKey.User).toBe(corpus.fieldNames.user);
    expect(ContextKey.Http).toBe(corpus.fieldNames.http);
  });
});

describe("parity corpus: message shape", () => {
  test.each(corpus.messageShape.cases)("$name", (testCase) => {
    const record = emit("info", testCase.message!, testCase.context);
    expect(record[corpus.fieldNames.message]).toBe(testCase.expectMsg);

    if (testCase.expectContext) {
      expect(record[corpus.fieldNames.context]).toMatchObject(testCase.expectContext);
    } else {
      // A bare string message must not leak into `context`.
      expect(record[corpus.fieldNames.context]).toBeUndefined();
    }
  });
});

describe("parity corpus: correlation id", () => {
  test("surfaces verbatim and mirrors into requestId and traceId", () => {
    const logger = new CapturingLogger({ context: {}, level: Level.Trace });
    logger.setCorrelationId(corpus.correlationId.value);
    logger.info(corpus.record.message);
    const record = logger.captured[0];

    expect(record[corpus.correlationId.field]).toBe(corpus.correlationId.value);
    for (const mirrored of corpus.correlationId.alsoSets) {
      expect(record[mirrored]).toBe(corpus.correlationId.value);
    }
  });
});

describe("parity corpus: redaction", () => {
  test("default redact keys match the corpus, in order", () => {
    expect(DEFAULT_REDACT_KEYS).toEqual(corpus.redaction.defaultKeys);
  });

  test("placeholder matches the corpus", () => {
    expect(REDACTED_VALUE).toBe(corpus.redaction.placeholder);
  });

  test.each(corpus.redaction.cases)("$name", (testCase) => {
    const record = emit("info", corpus.record.message, testCase.context);
    const context = record[corpus.fieldNames.context];

    for (const key of testCase.redacted!) {
      expect(context[key]).toBe(corpus.redaction.placeholder);
    }
    for (const [key, value] of Object.entries(testCase.preserved!)) {
      expect(context[key]).toBe(value);
    }
  });
});
