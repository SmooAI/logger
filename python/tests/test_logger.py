import json
import os
from io import StringIO
from typing import Any, cast
from unittest.mock import patch

from smooai_logger import (
    Context,
    HttpRequestContext,
    HttpResponseContext,
    Level,
    Logger,
    is_local,
    is_log_level_enabled,
    level_to_code,
    reset_global_context,
)


class TestEnvironmentUtilities:
    """Test environment utility functions."""

    @patch.dict(os.environ, {"SST_DEV": "true"}, clear=True)
    def test_is_local_true(self):
        assert is_local() is True

    def test_level_to_code(self):
        assert level_to_code(Level.TRACE) == 10
        assert level_to_code(Level.DEBUG) == 20
        assert level_to_code(Level.INFO) == 30
        assert level_to_code(Level.WARN) == 40
        assert level_to_code(Level.ERROR) == 50
        assert level_to_code(Level.FATAL) == 60

    @patch.dict(os.environ, {"LOG_LEVEL": "INFO"}, clear=True)
    def test_is_log_level_enabled_info(self):
        assert is_log_level_enabled(Level.INFO) is True
        assert is_log_level_enabled(Level.WARN) is True
        assert is_log_level_enabled(Level.DEBUG) is False

    @patch.dict(os.environ, {"LOG_LEVEL": "DEBUG"}, clear=True)
    def test_is_log_level_enabled_debug(self):
        assert is_log_level_enabled(Level.DEBUG) is True
        assert is_log_level_enabled(Level.TRACE) is False

    @patch.dict(os.environ, {"LOG_LEVEL": "INVALID"}, clear=True)
    def test_is_log_level_enabled_invalid_defaults_to_info(self):
        assert is_log_level_enabled(Level.INFO) is True
        assert is_log_level_enabled(Level.DEBUG) is False


class TestLogger:
    """Test Logger class functionality."""

    def setup_method(self):
        """Reset global context before each test."""
        reset_global_context()

    def test_logger_initialization_defaults(self):
        logger = Logger()
        assert logger.name == "Logger"
        assert logger.level == Level.INFO
        assert "correlationId" in logger.context
        assert "requestId" in logger.context
        assert "traceId" in logger.context

    def test_logger_initialization_with_params(self):
        context = cast(Context, cast(object, {"custom": "value"}))
        logger = Logger(name="TestLogger", level=Level.DEBUG, context=context, pretty_print=True)
        assert logger.name == "TestLogger"
        assert logger.level == Level.DEBUG
        assert cast(dict[str, Any], cast(object, logger.context))["custom"] == "value"
        assert logger.pretty_print is True

    @patch.dict(os.environ, {"LOG_LEVEL": "ERROR"}, clear=True)
    def test_logger_initialization_with_env_level(self):
        logger = Logger()
        assert logger.level == Level.ERROR

    def test_logger_properties(self):
        logger = Logger()

        # Test name property
        logger.name = "NewName"
        assert logger.name == "NewName"

        # Test level property
        logger.level = Level.DEBUG
        assert logger.level == Level.DEBUG

        # Test context property
        new_context = cast(Context, cast(object, {"test": "value"}))
        logger.context = new_context
        assert cast(dict[str, Any], cast(object, logger.context))["test"] == "value"

    def test_logger_level_parsing(self):
        logger = Logger()

        # Test valid levels
        assert logger._parse_level("trace") == Level.TRACE
        assert logger._parse_level("DEBUG") == Level.DEBUG
        assert logger._parse_level("Info") == Level.INFO
        assert logger._parse_level("WARN") == Level.WARN
        assert logger._parse_level("error") == Level.ERROR
        assert logger._parse_level("FATAL") == Level.FATAL

        # Test invalid levels
        assert logger._parse_level("invalid") == Level.INFO
        assert logger._parse_level(None) == Level.INFO

    def test_logger_level_enabled(self):
        logger = Logger(level=Level.INFO)

        assert logger._is_enabled(Level.INFO) is True
        assert logger._is_enabled(Level.WARN) is True
        assert logger._is_enabled(Level.ERROR) is True
        assert logger._is_enabled(Level.DEBUG) is False
        assert logger._is_enabled(Level.TRACE) is False

    def test_logger_remove_none(self):
        logger = Logger()

        # Test dict with None values
        test_dict = {"a": 1, "b": None, "c": "test", "d": None}
        result = logger._remove_none(test_dict)
        assert result == {"a": 1, "c": "test"}

        # Test list with None values
        test_list = [1, None, "test", None, 2]
        result = logger._remove_none(test_list)
        assert result == [1, "test", 2]

        # Test nested structure
        test_nested = {"a": 1, "b": None, "c": [1, None, 2], "d": {"x": None, "y": "test"}}
        result = logger._remove_none(test_nested)
        assert result == {"a": 1, "c": [1, 2], "d": {"y": "test"}}

    def test_logger_add_request_context(self):
        logger = Logger()
        request: HttpRequestContext = {"method": "GET", "path": "/test", "protocol": "HTTP/1.1"}

        logger.add_request_context(request)

        # Access with proper type checking
        http_context = logger.context.get("http")
        assert http_context is not None
        request_context = http_context.get("request")
        assert request_context is not None
        assert request_context.get("method") == "GET"
        assert request_context.get("path") == "/test"
        assert request_context.get("protocol") == "HTTP/1.1"

    def test_logger_add_response_context(self):
        logger = Logger()
        response: HttpResponseContext = {"statusCode": 200, "body": "OK", "headers": {"Content-Type": "application/json"}}

        logger.add_response_context(response)

        # Access with proper type checking
        http_context = logger.context.get("http")
        assert http_context is not None
        response_context = http_context.get("response")
        assert response_context is not None
        assert response_context.get("statusCode") == 200
        assert response_context.get("body") == "OK"
        headers = response_context.get("headers")
        assert headers is not None
        assert headers.get("Content-Type") == "application/json"

    def test_logger_get_callsite(self):
        logger = Logger()
        callsite = logger._get_callsite()

        assert isinstance(callsite, list)
        assert len(callsite) > 0
        # Should contain filename:line in function format
        assert all(":" in line and " in " in line for line in callsite)

    def test_logger_build_record_with_string(self):
        logger = Logger(name="TestLogger")
        record = logger._build_record(Level.INFO, ["Test message"])

        assert record.get("msg") == "Test message"
        assert record.get("level") == "info"
        assert record.get("name") == "TestLogger"
        assert "time" in record
        assert "correlationId" in record
        assert "callerContext" in record

    def test_logger_build_record_with_exception(self):
        logger = Logger(name="TestLogger")
        exception = ValueError("Test error")
        record = logger._build_record(Level.ERROR, [exception])

        assert record.get("error") == "Test error"
        assert record.get("level") == "error"
        error_details = record.get("errorDetails")
        assert error_details is not None
        assert len(error_details) == 1
        assert error_details[0]["type"] == "ValueError"
        assert error_details[0]["message"] == "Test error"
        # Only one error, so 'errors' should not be set
        assert "errors" not in record

    def test_logger_build_record_with_multiple_exceptions(self):
        logger = Logger(name="TestLogger")
        exc1 = ValueError("First error")
        exc2 = RuntimeError("Second error")
        record = logger._build_record(Level.ERROR, [exc1, exc2])

        # 'error' and 'errorDetails' for the first error
        assert record.get("error") == "First error"
        error_details = record.get("errorDetails")
        assert error_details is not None
        assert len(error_details) == 1
        assert error_details[0]["type"] == "ValueError"
        assert error_details[0]["message"] == "First error"
        # 'errors' array for all errors
        errors = record.get("errors")
        assert errors is not None
        assert len(errors) == 2
        assert errors[0]["error"] == "First error"
        assert errors[1]["error"] == "Second error"
        assert errors[0]["errorDetails"][0]["type"] == "ValueError"
        assert errors[1]["errorDetails"][0]["type"] == "RuntimeError"

    def test_logger_build_record_with_nested_exception_in_dict(self):
        logger = Logger(name="TestLogger")
        exc = KeyError("Nested error")
        context_dict = {"foo": {"bar": exc}}
        record = logger._build_record(Level.ERROR, [context_dict])

        assert record.get("error") == "'Nested error'"
        error_details = record.get("errorDetails")
        assert error_details is not None
        assert len(error_details) == 1
        assert error_details[0]["type"] == "KeyError"
        assert error_details[0]["message"] == "'Nested error'"
        # Only one error, so 'errors' should not be set
        assert "errors" not in record

    def test_logger_build_record_with_multiple_nested_exceptions(self):
        logger = Logger(name="TestLogger")
        exc1 = ValueError("First error")
        exc2 = RuntimeError("Second error")
        context_dict = {"foo": exc1, "bar": {"baz": exc2}}
        record = logger._build_record(Level.ERROR, [context_dict])

        assert record.get("error") == "First error"
        error_details = record.get("errorDetails")
        assert error_details is not None
        assert len(error_details) == 1
        assert error_details[0]["type"] == "ValueError"
        assert error_details[0]["message"] == "First error"
        errors = record.get("errors")
        assert errors is not None
        assert len(errors) == 2
        assert errors[0]["error"] == "First error"
        assert errors[1]["error"] == "Second error"
        assert errors[0]["errorDetails"][0]["type"] == "ValueError"
        assert errors[1]["errorDetails"][0]["type"] == "RuntimeError"

    def test_logger_build_record_with_dict(self):
        logger = Logger(name="TestLogger")
        context_dict = {"user_id": 123, "action": "login"}
        record = logger._build_record(Level.INFO, ["User action", context_dict])

        assert record.get("msg") == "User action"
        context = record.get("context")
        assert context is not None
        assert context["user_id"] == 123
        assert context["action"] == "login"

    def test_logger_build_record_with_multiple_args(self):
        logger = Logger(name="TestLogger")
        context_dict = {"key": "value"}
        exception = RuntimeError("Something went wrong")

        record = logger._build_record(Level.WARN, ["Warning message", context_dict, exception])

        assert record.get("msg") == "Warning message"
        context = record.get("context")
        assert context is not None
        assert context["key"] == "value"
        assert record.get("error") == "Something went wrong"
        assert record.get("level") == "warn"

    @patch("sys.stdout", new_callable=StringIO)
    def test_logger_emit_json(self, mock_stdout):
        logger = Logger(pretty_print=False)
        record: Context = {"msg": "Test message", "level": "info", "time": "2023-01-01T00:00:00", "name": "TestLogger"}

        logger._emit(record)

        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())
        assert parsed["msg"] == "Test message"
        assert parsed["level"] == "info"

    @patch("sys.stdout", new_callable=StringIO)
    def test_logger_emit_pretty_print(self, mock_stdout):
        logger = Logger(pretty_print=True)
        record: Context = {"msg": "Test message", "level": "info", "time": "2023-01-01T00:00:00", "name": "TestLogger"}

        logger._emit(record)

        output = mock_stdout.getvalue()
        # Should contain the separator lines and formatted output
        assert "---" in output
        assert "Test message" in output

    @patch("sys.stdout", new_callable=StringIO)
    def test_logger_info_method(self, mock_stdout):
        logger = Logger(level=Level.INFO, pretty_print=False)
        logger.info("Test info message")

        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())
        assert parsed["msg"] == "Test info message"
        assert parsed["level"] == "info"

    @patch("sys.stdout", new_callable=StringIO)
    def test_logger_debug_method_enabled(self, mock_stdout):
        logger = Logger(level=Level.DEBUG, pretty_print=False)
        logger.debug("Test debug message")

        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())
        assert parsed["msg"] == "Test debug message"
        assert parsed["level"] == "debug"

    @patch("sys.stdout", new_callable=StringIO)
    def test_logger_debug_method_disabled(self, mock_stdout):
        logger = Logger(level=Level.INFO, pretty_print=False)
        logger.debug("Test debug message")

        output = mock_stdout.getvalue()
        assert output == ""  # Should not log when level is too high

    @patch("sys.stdout", new_callable=StringIO)
    def test_logger_all_level_methods(self, mock_stdout):
        logger = Logger(level=Level.TRACE, pretty_print=False)

        logger.trace("Trace message")
        logger.debug("Debug message")
        logger.info("Info message")
        logger.warn("Warn message")
        logger.error("Error message")
        logger.fatal("Fatal message")

        output = mock_stdout.getvalue()
        lines = output.strip().split("\n")

        assert len(lines) == 6
        for i, level in enumerate(["trace", "debug", "info", "warn", "error", "fatal"]):
            parsed = json.loads(lines[i])
            assert parsed["level"] == level

    def test_logger_context_merging(self):
        initial_context = cast(Context, cast(object, {"correlationId": "initial", "custom": "value"}))
        logger = Logger(context=initial_context)

        # Add more context using the proper method
        logger.add_context({"new_key": "new_value"})

        assert logger.context.get("correlationId") == "initial"
        assert cast(dict[str, Any], cast(object, logger.context))["custom"] == "value"
        context_data = logger.context.get("context")
        assert context_data is not None
        assert context_data["new_key"] == "new_value"

    def test_logger_clone_method(self):
        logger = Logger()
        original = {"nested": {"value": 123}}
        cloned = logger._clone(original)

        # Should be a deep copy
        assert cloned == original
        assert cloned is not original
        assert cloned["nested"] is not original["nested"]

    def test_logger_context_config_stub(self):
        logger = Logger()
        test_context = cast(Context, cast(object, {"test": "value"}))
        result = logger._apply_context_config(test_context)

        # Should return the same context (stub implementation)
        assert result == test_context

    def test_singleton_context_across_loggers(self):
        """Test that context is shared across logger instances."""
        # Create first logger and add context
        logger1 = Logger("Logger1")
        logger1.add_context({"shared_key": "shared_value"})
        logger1.add_base_context({"service": "test-service"})

        # Create second logger - should have the same context
        logger2 = Logger("Logger2")

        # Both loggers should have the same context
        context1 = logger1.context.get("context", {})
        context2 = logger2.context.get("context", {})
        assert context1 is not None
        assert context2 is not None
        assert context1.get("shared_key") == "shared_value"
        assert context2.get("shared_key") == "shared_value"
        assert logger1.context.get("service") == "test-service"
        assert logger2.context.get("service") == "test-service"

        # Modify context through second logger
        logger2.add_context({"another_key": "another_value"})

        # First logger should see the changes
        context1_updated = logger1.context.get("context", {})
        assert context1_updated is not None
        assert context1_updated.get("another_key") == "another_value"


class TestLoggerIntegration:
    """Integration tests for Logger."""

    def setup_method(self):
        """Reset global context before each test."""
        reset_global_context()

    @patch("sys.stdout", new_callable=StringIO)
    def test_logger_full_workflow(self, mock_stdout):
        # Create logger with custom context
        context = cast(Context, cast(object, {"service": "test-service", "version": "1.0.0"}))
        logger = Logger(name="IntegrationTest", level=Level.INFO, context=context, pretty_print=False)

        # Add HTTP context
        request: HttpRequestContext = {"method": "POST", "path": "/api/test"}
        logger.add_request_context(request)

        # Log with exception and context
        try:
            raise ValueError("Integration test error")
        except ValueError as e:
            logger.error("Integration test failed", {"user_id": 456}, e)

        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())

        # Verify all components are present
        assert parsed["msg"] == "Integration test failed"
        assert parsed["level"] == "error"
        assert parsed["name"] == "IntegrationTest"
        assert parsed["service"] == "test-service"
        assert parsed["version"] == "1.0.0"
        assert parsed["error"] == "Integration test error"
        context_data = parsed.get("context")
        assert context_data is not None
        assert context_data["user_id"] == 456
        http_context = parsed.get("http")
        assert http_context is not None
        request_context = http_context.get("request")
        assert request_context is not None
        assert request_context["method"] == "POST"
        assert request_context["path"] == "/api/test"
        assert "errorDetails" in parsed
        assert "callerContext" in parsed
        assert "time" in parsed
