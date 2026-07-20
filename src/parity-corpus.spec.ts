/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import Logger, { ContextKey, Level } from "./Logger";

/**
 * Golden-vector parity corpus (ADR-089 pattern, as used by @smooai/audit).
 *
 * Asserts the TypeScript port emits the level wire-shape every other port
 * (Go / Python / Rust / .NET) is also held to. A failure here means either
 * this port drifted or the shared contract moved -- fix the port, not the
 * corpus.
 */

type CorpusLevel = { name: string; LogLevel: string; level: number };
type Corpus = { version: number; levels: CorpusLevel[] };

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

describe("parity corpus: level wire shape", () => {
  test("corpus is non-empty and covers all six levels", () => {
    expect(corpus.levels).toHaveLength(6);
    expect(corpus.levels.map((l) => l.name)).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ]);
  });

  test.each(corpus.levels)(
    "$name emits level=$level and LogLevel=$LogLevel",
    ({ name, level, LogLevel }) => {
      const logger = new CapturingLogger({ context: {}, level: Level.Trace });
      (logger as any)[name]("parity corpus probe");

      expect(logger.captured).toHaveLength(1);
      const record = logger.captured[0];

      // level -> pino-compatible NUMERIC code
      expect(record[ContextKey.Level]).toBe(level);
      expect(typeof record[ContextKey.Level]).toBe("number");

      // LogLevel -> canonical lowercase STRING
      expect(record[ContextKey.LogLevel]).toBe(LogLevel);
      expect(typeof record[ContextKey.LogLevel]).toBe("string");
    },
  );

  test("both fields are present on every record (neither may be dropped)", () => {
    const logger = new CapturingLogger({ context: {}, level: Level.Trace });
    logger.info("parity corpus probe");
    const record = logger.captured[0];
    expect(Object.keys(record)).toEqual(
      expect.arrayContaining([ContextKey.Level, ContextKey.LogLevel]),
    );
  });
});
