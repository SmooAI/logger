package logger

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"go.opentelemetry.io/otel/trace"
)

// OTel correlation (SMOODEV / th-de3805).
//
// Historically every log line's traceId was a fabricated uuid (equal to the
// correlationId), so logs could not be joined to their trace. When the caller
// threads a context.Context that carries an active OTel span (the *Context log
// methods), we instead stamp the span's real W3C trace_id + span_id onto the
// line, matching whatever /v1/traces recorded. With no active span we fall back
// to the prior uuid behavior untouched.
//
// This package depends ONLY on the OTel trace API (go.opentelemetry.io/otel/
// trace) — never on @smooai/observability — to avoid a circular dependency.
// The observability SDK's otelslog bridge is wired in by the application via
// SetSlogHandler, so a logger line becomes an OTLP log record when obs is active.

// correlationFromContext returns the active span's trace_id and span_id when
// ctx carries a valid span context, else ("", "", false).
func correlationFromContext(ctx context.Context) (traceID, spanID string, ok bool) {
	if ctx == nil {
		return "", "", false
	}
	sc := trace.SpanContextFromContext(ctx)
	if !sc.IsValid() {
		return "", "", false
	}
	return sc.TraceID().String(), sc.SpanID().String(), true
}

var (
	slogHandlerMu sync.RWMutex
	slogHandler   slog.Handler
)

// SetSlogHandler installs an slog.Handler that every subsequent log line is
// additionally forwarded to, carrying the call's context.Context. A handler
// that reads the active span from ctx — e.g. the @smooai/observability otelslog
// bridge (observability.SlogHandler(...)) — turns each line into an OTLP log
// record correlated to the enclosing trace and ships it to /v1/logs.
//
// The logger's own stdout/file JSON output is unaffected. Pass nil to detach.
// Wiring is done by the application (not this package) to keep the dependency
// on @smooai/observability out of the logger and avoid a cycle.
func SetSlogHandler(h slog.Handler) {
	slogHandlerMu.Lock()
	defer slogHandlerMu.Unlock()
	slogHandler = h
}

func getSlogHandler() slog.Handler {
	slogHandlerMu.RLock()
	defer slogHandlerMu.RUnlock()
	return slogHandler
}

// forwardToSlog mirrors a log line into the installed slog.Handler (if any),
// passing ctx so a span-aware handler can correlate the record. No-op when no
// handler is set or the handler is not enabled for the level.
func forwardToSlog(ctx context.Context, level Level, msg string, payload Map) {
	h := getSlogHandler()
	if h == nil {
		return
	}
	sl := toSlogLevel(level)
	if !h.Enabled(ctx, sl) {
		return
	}
	rec := slog.NewRecord(time.Now(), sl, msg, 0)
	// Carry the correlation-relevant scalars as attributes → parsed_fields.
	for _, k := range []string{KeyCorrelationID, KeyRequestID, KeyName, KeyNamespace} {
		if v, ok := payload[k]; ok {
			if s, isStr := v.(string); isStr && s != "" {
				rec.AddAttrs(slog.String(k, s))
			}
		}
	}
	_ = h.Handle(ctx, rec)
}

// toSlogLevel maps the logger's severity onto slog's numeric levels.
func toSlogLevel(level Level) slog.Level {
	switch level {
	case LevelTrace:
		return slog.LevelDebug - 4
	case LevelDebug:
		return slog.LevelDebug
	case LevelInfo:
		return slog.LevelInfo
	case LevelWarn:
		return slog.LevelWarn
	case LevelError:
		return slog.LevelError
	case LevelFatal:
		return slog.LevelError + 4
	default:
		return slog.LevelInfo
	}
}
