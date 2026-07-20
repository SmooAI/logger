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

    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record)

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

    class _SpanPeek(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            seen.append(trace.get_current_span().get_span_context().trace_id)

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
