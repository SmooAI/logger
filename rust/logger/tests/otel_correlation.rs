//! Log↔trace correlation + tracing-tee tests (th-de3805).
//!
//! Proves the two halves of the correlation fix:
//!   1. A log built while an OpenTelemetry span is active carries that span's
//!      real W3C `traceId`/`spanId` (not a fabricated uuid); with no span active
//!      it falls back to the seeded uuid and emits no `spanId`.
//!   2. With the OTel bridge enabled, each emitted line is teed to the `tracing`
//!      facade (which `@smooai/observability`'s appender hooks) at the matching
//!      level with the message as the body; disabled, nothing is teed.

use std::sync::{Arc, Mutex};

use opentelemetry::trace::{TraceContextExt, Tracer, TracerProvider};
use opentelemetry::Context;
use opentelemetry_sdk::trace::SdkTracerProvider;
use smooai_logger::{Level, LogArgs, Logger, LoggerOptions};
use tracing::field::{Field, Visit};
use tracing_subscriber::layer::{Context as LayerContext, Layer};
use tracing_subscriber::prelude::*;

fn test_logger(otel_bridge: bool) -> Logger {
    Logger::new(LoggerOptions {
        name: Some("test".into()),
        log_to_file: Some(false),
        otel_bridge: Some(otel_bridge),
        ..Default::default()
    })
}

#[test]
fn log_within_active_span_carries_real_trace_and_span_id() {
    let logger = test_logger(false);

    let provider = SdkTracerProvider::builder().build();
    let tracer = provider.tracer("correlation-test");
    let cx = Context::current().with_span(tracer.start("unit-of-work"));
    let span_context = cx.span().span_context().clone();
    assert!(span_context.is_valid(), "test span must be valid/sampled");

    let payload = {
        let _guard = cx.clone().attach();
        logger.build_log_object(Level::Info, &LogArgs::from("hello within span"))
    };

    assert_eq!(
        payload.get("traceId").and_then(|v| v.as_str()),
        Some(span_context.trace_id().to_string().as_str()),
        "traceId must be the active span's real W3C trace_id, not a uuid"
    );
    assert_eq!(
        payload.get("spanId").and_then(|v| v.as_str()),
        Some(span_context.span_id().to_string().as_str()),
        "spanId must be the active span's real W3C span_id"
    );
}

#[test]
fn log_without_active_span_falls_back_to_uuid() {
    let logger = test_logger(false);

    // No span attached on this thread → the seeded uuid traceId, no spanId.
    let payload = logger.build_log_object(Level::Info, &LogArgs::from("hello no span"));

    let trace_id = payload.get("traceId").and_then(|v| v.as_str()).expect("traceId present");
    // A uuid is 36 chars with hyphens; a W3C trace_id is 32 hex chars, no hyphens.
    assert!(trace_id.contains('-'), "fallback traceId should be the fabricated uuid, got {trace_id}");
    assert!(payload.get("spanId").is_none(), "no active span → no spanId");
}

// ---- Tee-to-tracing capture ------------------------------------------------

#[derive(Default, Clone)]
struct Captured {
    level: Option<tracing::Level>,
    message: Option<String>,
}

struct MessageVisitor<'a>(&'a mut Captured);
impl Visit for MessageVisitor<'_> {
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.0.message = Some(format!("{value:?}"));
        }
    }
}

struct CaptureLayer(Arc<Mutex<Vec<Captured>>>);
impl<S: tracing::Subscriber> Layer<S> for CaptureLayer {
    fn on_event(&self, event: &tracing::Event<'_>, _ctx: LayerContext<'_, S>) {
        let mut cap = Captured {
            level: Some(*event.metadata().level()),
            ..Default::default()
        };
        event.record(&mut MessageVisitor(&mut cap));
        self.0.lock().unwrap().push(cap);
    }
}

#[test]
fn enabled_bridge_tees_line_to_tracing() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let subscriber = tracing_subscriber::registry().with(CaptureLayer(events.clone()));

    let logger = test_logger(true);
    tracing::subscriber::with_default(subscriber, || {
        logger.warn(LogArgs::from("teed message")).unwrap();
    });

    let captured = events.lock().unwrap();
    assert_eq!(captured.len(), 1, "one line should tee to exactly one tracing event");
    assert_eq!(captured[0].level, Some(tracing::Level::WARN), "warn() must map to tracing WARN");
    assert_eq!(
        captured[0].message.as_deref(),
        Some("teed message"),
        "the tracing event body must be the log message"
    );
}

#[test]
fn disabled_bridge_does_not_tee() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let subscriber = tracing_subscriber::registry().with(CaptureLayer(events.clone()));

    let logger = test_logger(false);
    tracing::subscriber::with_default(subscriber, || {
        logger.info(LogArgs::from("not teed")).unwrap();
    });

    assert!(events.lock().unwrap().is_empty(), "disabled bridge must emit no tracing events");
}
