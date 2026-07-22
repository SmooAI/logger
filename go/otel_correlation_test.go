package logger

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"go.opentelemetry.io/otel/trace"
)

// ctxWithSpan builds a context carrying a valid (non-recording) span context
// using only the OTel trace API — no SDK dependency.
func ctxWithSpan(t *testing.T) (context.Context, string, string) {
	t.Helper()
	traceID, err := trace.TraceIDFromHex("0123456789abcdef0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	spanID, err := trace.SpanIDFromHex("0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	sc := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: trace.FlagsSampled,
	})
	ctx := trace.ContextWithSpanContext(context.Background(), sc)
	return ctx, traceID.String(), spanID.String()
}

func logJSON(t *testing.T, buf *bytes.Buffer) map[string]any {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("parse log output: %v (%s)", err, buf.String())
	}
	return payload
}

// With an active span in ctx, the line carries the span's real trace/span id
// instead of the fabricated correlation uuid.
func TestInfoContextUsesActiveSpanIDs(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false

	ctx, wantTrace, wantSpan := ctxWithSpan(t)
	_ = l.InfoContext(ctx, "with span")

	p := logJSON(t, &buf)
	if p[KeyTraceID] != wantTrace {
		t.Errorf("traceId = %v, want %s (active span not read)", p[KeyTraceID], wantTrace)
	}
	if p[KeySpanID] != wantSpan {
		t.Errorf("spanId = %v, want %s", p[KeySpanID], wantSpan)
	}
	// correlationId keeps the fabricated uuid — distinct from the trace id.
	if p[KeyCorrelationID] == wantTrace {
		t.Error("correlationId should remain the fabricated uuid, not the span trace id")
	}
}

// No active span → prior behavior: traceId is the fabricated correlation uuid,
// no spanId is added.
func TestInfoWithoutSpanFallsBack(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false

	_ = l.Info("no span")

	p := logJSON(t, &buf)
	corr, _ := p[KeyCorrelationID].(string)
	if corr == "" {
		t.Fatal("expected a correlationId")
	}
	if p[KeyTraceID] != corr {
		t.Errorf("traceId = %v, want fabricated uuid %s", p[KeyTraceID], corr)
	}
	if _, ok := p[KeySpanID]; ok {
		t.Errorf("spanId should be absent without an active span, got %v", p[KeySpanID])
	}
}

// captureHandler records the ctx + record it was handed.
type captureHandler struct {
	ctx    context.Context
	record slog.Record
	called bool
}

func (h *captureHandler) Enabled(context.Context, slog.Level) bool { return true }
func (h *captureHandler) Handle(ctx context.Context, r slog.Record) error {
	h.ctx, h.record, h.called = ctx, r, true
	return nil
}
func (h *captureHandler) WithAttrs([]slog.Attr) slog.Handler { return h }
func (h *captureHandler) WithGroup(string) slog.Handler      { return h }

// A logger line flows through the installed slog.Handler carrying the call's
// ctx, so a span-aware handler (the obs otelslog bridge) can correlate it —
// proven here by reading the span back out of the forwarded ctx.
func TestSlogForwardCarriesSpanContext(t *testing.T) {
	resetGlobalContext()
	h := &captureHandler{}
	SetSlogHandler(h)
	defer SetSlogHandler(nil)

	l := Default()
	l.output = &bytes.Buffer{}
	l.prettyPrint = false

	ctx, wantTrace, _ := ctxWithSpan(t)
	_ = l.InfoContext(ctx, "bridge me")

	if !h.called {
		t.Fatal("slog handler was not invoked")
	}
	if h.record.Message != "bridge me" {
		t.Errorf("record msg = %q, want %q", h.record.Message, "bridge me")
	}
	if h.record.Level != slog.LevelInfo {
		t.Errorf("record level = %v, want Info", h.record.Level)
	}
	sc := trace.SpanContextFromContext(h.ctx)
	if !sc.IsValid() || sc.TraceID().String() != wantTrace {
		t.Errorf("forwarded ctx lost the active span: valid=%v trace=%s", sc.IsValid(), sc.TraceID())
	}
}

// No handler installed → forwarding is a silent no-op (does not panic).
func TestSlogForwardNoHandlerIsNoOp(t *testing.T) {
	SetSlogHandler(nil)
	l := Default()
	l.output = &bytes.Buffer{}
	l.prettyPrint = false
	if err := l.Info("no handler"); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
