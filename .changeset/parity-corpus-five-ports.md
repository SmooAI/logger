---
"@smooai/logger": patch
---

Make the parity corpus real: all five ports now replay the same committed file, and fix a Python correlation-id drift it caught.

`parity-corpus.json` called itself "the contract" for "five hand-written ports", but only
TypeScript and Python loaded it, and it held six level-code rows — nothing about the wire shape
a structured logger actually has to agree on. A corpus nobody loads is worse than none, because
it reads as a guarantee.

The corpus now covers level mapping, canonical wire field names, message shape (a bare string
must not leak into `context`), correlation-id propagation, and the default redaction key list —
and **all five** ports load it: `src/parity-corpus.spec.ts`, `python/tests/test_parity_corpus.py`,
`rust/logger/tests/parity_corpus.rs`, `go/parity_corpus_test.go`, and
`dotnet/tests/SmooAI.Logger.Tests/ParityCorpusTests.cs`. Editing one corpus value turns all five
suites red — verified by hand-breaking the redaction placeholder.

**Python behavior fix, found by the new corpus:** setting `Logger.correlation_id` updated only
`correlationId`, while TypeScript, Go, Rust and .NET all also overwrite `requestId` and `traceId`
with the same value. A Python service that adopted an inbound correlation id therefore kept
emitting a locally-generated `requestId`/`traceId` and fell out of the correlated view. Python
now mirrors all three, matching the other four ports.

The 15-entry default redaction key list (SMOODEV-942) was hand-copied into five languages; the
corpus is now its single source and each port asserts its own list equals it, in order.
