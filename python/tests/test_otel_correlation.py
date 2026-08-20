"""OTel trace correlation + stdlib logging bridge (th-de3805).

A log emitted inside an active OTel span must carry that span's real W3C
trace_id/span_id (so logs line up with traces), and every line must flow through
the stdlib ``logging`` facade so @smooai/observability's root LoggingHandler can
turn it into an OTLP log record. Uses ``opentelemetry-api`` only — a
``NonRecordingSpan`` with an explicit valid context, no SDK.
"""

from __future__ import annotations

import json
import logging
from io import StringIO
from unittest.mock import patch

from opentelemetry import trace
from opentelemetry.trace import NonRecordingSpan, SpanContext, TraceFlags

from smooai_logger import Logger, reset_global_context

_TRACE_ID = 0x0AF7651916CD43DD8448EB211C80319C
_SPAN_ID = 0x00F067AA0BA902B7


def _span():
    ctx = SpanContext(trace_id=_TRACE_ID, span_id=_SPAN_ID, is_remote=False, trace_flags=TraceFlags(0x01))
    return NonRecordingSpan(ctx)


def _emit_capture(**logger_kwargs) -> dict:
    """Emit one info log and return the parsed JSON record from stdout."""
    logger = Logger(pretty_print=False, log_to_file=False, **logger_kwargs)
    buf = StringIO()
    with patch("smooai_logger.logger.sys.stdout", buf):
        logger.info("hello")
    return json.loads(buf.getvalue().strip().splitlines()[-1])


def test_traceid_from_active_span():
    reset_global_context()
    with trace.use_span(_span(), end_on_exit=False):
        rec = _emit_capture()
    assert rec["traceId"] == "0af7651916cd43dd8448eb211c80319c"
    assert rec["spanId"] == "00f067aa0ba902b7"


def test_traceid_falls_back_to_uuid_without_span():
    reset_global_context()
    rec = _emit_capture()
    # No active span → fabricated uuid correlation id, no spanId.
    assert rec["traceId"] == rec["correlationId"]
    assert "-" in rec["traceId"]  # uuid, not a 32-hex trace id
    assert "spanId" not in rec


def test_bridge_forwards_to_stdlib_root_logger():
    reset_global_context()
    captured: list[logging.LogRecord] = []

    # Must LOOK like observability's handler: the bridge is capability-gated on a
    # real OTel consumer being attached, precisely so an app's own root handler
    # (logging.basicConfig) does not double-print every line.
    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record)

    _Capture.__name__ = "LoggingHandler"
    _Capture.__module__ = "opentelemetry.sdk._logs"

    handler = _Capture()
    root = logging.getLogger()
    root.addHandler(handler)
    try:
        logger = Logger(pretty_print=False, log_to_file=False)
        with patch("smooai_logger.logger.sys.stdout", StringIO()):
            logger.info("bridged line")
    finally:
        root.removeHandler(handler)

    assert any(r.getMessage() == "bridged line" for r in captured), "line did not reach the stdlib root logger"


def test_bridge_line_carries_span_context_for_obs():
    """The bridged stdlib record is emitted inside the span, so an obs
    LoggingHandler (which reads get_current_span) correlates it. We assert the
    active span is visible at emit time via a handler."""
    reset_global_context()
    seen: list[int] = []

    # Same reason as the test above: shaped like observability's handler so the
    # capability gate lets the record through.
    class _SpanPeek(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            seen.append(trace.get_current_span().get_span_context().trace_id)

    _SpanPeek.__name__ = "LoggingHandler"
    _SpanPeek.__module__ = "opentelemetry.sdk._logs"

    handler = _SpanPeek()
    root = logging.getLogger()
    root.addHandler(handler)
    try:
        logger = Logger(pretty_print=False, log_to_file=False)
        with trace.use_span(_span(), end_on_exit=False), patch("smooai_logger.logger.sys.stdout", StringIO()):
            logger.info("in span")
    finally:
        root.removeHandler(handler)

    assert _TRACE_ID in seen


class _FakeOtelLoggingHandler(logging.Handler):
    """Stands in for opentelemetry.sdk._logs.LoggingHandler.

    The gate identifies a real consumer by module+class name, so the test has to
    match on the same thing rather than on an isinstance the test controls.
    """

    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


_FakeOtelLoggingHandler.__name__ = "LoggingHandler"
_FakeOtelLoggingHandler.__module__ = "opentelemetry.sdk._logs"


class _PlainAppHandler(logging.Handler):
    """A vanilla root handler, as `logging.basicConfig()` installs."""

    def __init__(self) -> None:
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


def _with_root_handler(handler: logging.Handler):
    root = logging.getLogger()
    root.addHandler(handler)
    return root


def test_no_otel_consumer_means_no_bridged_record(monkeypatch):
    """The double-emission regression.

    Without the gate, every smooai line propagates to root and an app that called
    logging.basicConfig() prints it a second time — on top of our own stdout
    writer. Nothing about that helps a consumer who has not installed
    observability.
    """
    monkeypatch.delenv("SMOOAI_OBSERVABILITY_DISABLED", raising=False)
    app_handler = _PlainAppHandler()
    root = _with_root_handler(app_handler)
    try:
        Logger().info("hello")
        assert app_handler.records == [], (
            "a plain root handler received a bridged record, so every consumer with logging.basicConfig() double-prints every line"
        )
    finally:
        root.removeHandler(app_handler)


def test_an_otel_consumer_does_receive_the_record(monkeypatch):
    """Negative control for the test above.

    If this fails, the gate is simply off and the first test proves nothing.
    """
    monkeypatch.delenv("SMOOAI_OBSERVABILITY_DISABLED", raising=False)
    otel_handler = _FakeOtelLoggingHandler()
    root = _with_root_handler(otel_handler)
    try:
        Logger().info("hello")
        assert len(otel_handler.records) == 1
        assert otel_handler.records[0].getMessage() == "hello"
    finally:
        root.removeHandler(otel_handler)


def test_kill_switch_wins_over_a_present_consumer(monkeypatch):
    monkeypatch.setenv("SMOOAI_OBSERVABILITY_DISABLED", "1")
    otel_handler = _FakeOtelLoggingHandler()
    root = _with_root_handler(otel_handler)
    try:
        Logger().info("hello")
        assert otel_handler.records == []
    finally:
        root.removeHandler(otel_handler)


def test_correlation_id_is_camel_case_on_the_wire(monkeypatch):
    monkeypatch.delenv("SMOOAI_OBSERVABILITY_DISABLED", raising=False)
    otel_handler = _FakeOtelLoggingHandler()
    root = _with_root_handler(otel_handler)
    try:
        log = Logger()
        log.correlation_id = "11111111-2222-3333-4444-555555555555"
        log.info("hello")
        rec = otel_handler.records[0]
        assert getattr(rec, "correlationId", None) == "11111111-2222-3333-4444-555555555555"
        assert not hasattr(rec, "correlation_id"), "snake_case leaked onto the wire"
    finally:
        root.removeHandler(otel_handler)
