---
"@smooai/logger": minor
---

Fix Python log-level wire parity with the TS/Go/Rust/.NET ports, and add a golden-vector parity corpus.

**BREAKING for Python consumers that read the `level` field.** The Python port
was the sole outlier across the five implementations: it emitted a lowercase
string in `level` (`"info"`) and never emitted `LogLevel` at all. Every other
port emits both fields. Python now matches:

| field      | value                                  |
| ---------- | -------------------------------------- |
| `level`    | pino-compatible **numeric** (info = 30) |
| `LogLevel` | canonical lowercase **string** (`"info"`) |

Migration for Python consumers: anything asserting `record["level"] == "info"`
should read `record["LogLevel"] == "info"` instead. The numeric codes were
already defined in `level_to_code()` (trace=10 … fatal=60) and are unchanged;
they were simply never written to the record.

Also adds `parity-corpus.json` — a committed golden-vector corpus pinning the
exact `level`/`LogLevel` pair every port must emit for all six levels, asserted
by the TypeScript (`src/parity-corpus.spec.ts`) and Python
(`python/tests/test_parity_corpus.py`) suites so drift fails the build.
Follows the ADR-089 pattern used by `@smooai/audit`.
