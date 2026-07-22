---
'@smooai/logger': minor
---

Correlate logs with OpenTelemetry traces. When a span is active, log records
now carry the span's real W3C `traceId` + `spanId` instead of a fabricated
uuid (falling back to the prior uuid correlation id only when no span is
active). Each log line is also bridged into the standard
`@opentelemetry/api-logs` facade, so it becomes an OTLP log record — correlated
to the active span — whenever an observability LoggerProvider is registered
(e.g. `@smooai/observability`'s logs signal). With no provider registered the
bridge is a no-op and stdout output is unchanged. Depends only on the
`@opentelemetry/api` + `@opentelemetry/api-logs` facades (no SDK, no circular
dep on `@smooai/observability`).
