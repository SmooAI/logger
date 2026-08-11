---
'@smooai/logger': patch
---

Rust: log lines now carry the active OTel span's real W3C `traceId`/`spanId`
(guarded on `span_context.is_valid()`), falling back to the correlation uuid,
and are teed into `tracing` so a single subscriber sees both.

`ContextKey` is now `#[non_exhaustive]`. It gains a variant whenever the family
learns a new correlation field — `SpanId` is this release's — and without that
attribute each addition is a source-breaking change for any downstream crate
matching on it exhaustively.
