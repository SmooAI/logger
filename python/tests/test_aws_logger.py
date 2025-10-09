import json
import os
from io import StringIO
from typing import Any, cast
from unittest.mock import MagicMock, patch

from smooai_logger import (
    AwsServerLogger,
    Context,
    HttpRequestContext,
    Level,
    reset_global_context,
)


class TestAwsLambdaLogger:
    """Test AwsServerLogger class functionality."""

    def setup_method(self):
        """Reset global context before each test."""
        reset_global_context()

    def test_aws_lambda_logger_initialization_defaults(self):
        logger = AwsServerLogger()
        assert logger.name == "AwsServerLogger"
        assert logger.level == Level.INFO
        assert "correlationId" in logger.context
        assert "requestId" in logger.context
        assert "traceId" in logger.context

    def test_aws_lambda_logger_initialization_with_params(self):
        context = cast(Context, cast(object, {"custom": "value"}))
        logger = AwsServerLogger(name="TestAwsLogger", level=Level.DEBUG, context=context, pretty_print=True)
        assert logger.name == "TestAwsLogger"
        assert logger.level == Level.DEBUG
        assert cast(dict[str, Any], cast(object, logger.context))["custom"] == "value"
        assert logger.pretty_print is True

    @patch.dict(
        os.environ,
        {
            "AWS_LAMBDA_FUNCTION_NAME": "test-function",
            "AWS_LAMBDA_FUNCTION_VERSION": "1",
            "AWS_EXECUTION_ENV": "AWS_Lambda_python3.9",
            "AWS_LAMBDA_LOG_GROUP_NAME": "/aws/lambda/test-function",
            "AWS_LAMBDA_LOG_STREAM_NAME": "2023/01/01/[$LATEST]abc123",
            "AWS_LAMBDA_FUNCTION_MEMORY_SIZE": "128",
            "AWS_DEFAULT_REGION": "us-east-1",
            "NODE_ENV": "production",
        },
        clear=True,
    )
    def test_get_lambda_environment_context(self):
        logger = AwsServerLogger()
        context = logger.get_lambda_environment_context()

        assert context["awsLambda"]["functionName"] == "test-function"
        assert context["awsLambda"]["functionVersion"] == "1"
        assert context["awsLambda"]["executionEnv"] == "AWS_Lambda_python3.9"
        assert context["awsLambda"]["logGroupName"] == "/aws/lambda/test-function"
        assert context["awsLambda"]["logStreamName"] == "2023/01/01/[$LATEST]abc123"
        assert context["awsLambda"]["memorySizeMB"] == "128"
        assert context["region"] == "us-east-1"
        assert context["nodeEnv"] == "production"

    @patch.dict(os.environ, {}, clear=True)
    def test_get_lambda_environment_context_empty_env(self):
        logger = AwsServerLogger()
        context = logger.get_lambda_environment_context()

        assert context["awsLambda"]["functionName"] is None
        assert context["awsLambda"]["functionVersion"] is None
        assert context["awsLambda"]["executionEnv"] is None
        assert context["awsLambda"]["logGroupName"] is None
        assert context["awsLambda"]["logStreamName"] is None
        assert context["awsLambda"]["memorySizeMB"] is None
        assert context["region"] is None
        assert context["nodeEnv"] is None

    @patch("sys.stdout", new_callable=StringIO)
    def test_add_lambda_context_with_correlation_id(self, mock_stdout):
        logger = AwsServerLogger(pretty_print=False)

        # Mock Lambda event and context
        event = {
            "headers": {"X-Correlation-Id": "test-correlation-123"},
            "requestContext": {"http": {"method": "POST", "protocol": "HTTP/1.1", "sourceIp": "192.168.1.1", "userAgent": "test-agent"}},
            "rawPath": "/api/test",
            "rawQueryString": "param=value",
            "body": '{"test": "data"}',
        }

        mock_context = MagicMock()
        mock_context.aws_request_id = "test-request-456"
        mock_context.get_remaining_time_in_millis.return_value = 5000

        logger.add_lambda_context(event, mock_context)

        # Check that context was reset and correlation ID was set
        assert logger.context.get("correlationId") == "test-correlation-123"
        aws_lambda = logger.context.get("awsLambda")
        assert aws_lambda is not None
        assert aws_lambda.get("requestId") == "test-request-456"
        assert aws_lambda.get("remainingTimeMs") == 5000

        # Check HTTP context was added
        http_context = logger.context.get("http")
        assert http_context is not None
        request_context = http_context.get("request")
        assert request_context is not None
        assert request_context.get("method") == "POST"
        assert request_context.get("path") == "/api/test"
        assert request_context.get("protocol") == "HTTP/1.1"
        assert request_context.get("sourceIp") == "192.168.1.1"
        assert request_context.get("userAgent") == "test-agent"
        assert request_context.get("queryString") == "param=value"
        assert request_context.get("body") == '{"test": "data"}'

        # Check that invocation was logged
        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())
        assert parsed.get("msg") == "lambda:invoked"
        assert parsed.get("context", {}).get("event", {}).get("route") is None

    @patch("sys.stdout", new_callable=StringIO)
    def test_add_lambda_context_without_correlation_id(self, mock_stdout):
        logger = AwsServerLogger(pretty_print=False)

        # Mock Lambda event without correlation ID
        event = {"requestContext": {"http": {"method": "GET", "routeKey": "GET /api/health"}}, "rawPath": "/api/health"}

        mock_context = MagicMock()
        mock_context.aws_request_id = "test-request-789"
        mock_context.get_remaining_time_in_millis.return_value = 3000

        logger.add_lambda_context(event, mock_context)

        # Check that correlation ID was not changed (should use default)
        assert "correlationId" in logger.context
        aws_lambda = logger.context.get("awsLambda")
        assert aws_lambda is not None
        assert aws_lambda.get("requestId") == "test-request-789"
        assert aws_lambda.get("remainingTimeMs") == 3000

        # Check that invocation was logged with route
        output = mock_stdout.getvalue()
        parsed = json.loads(output.strip())
        assert parsed.get("msg") == "lambda:invoked"
        assert parsed.get("context", {}).get("event", {}).get("route") == "GET /api/health"

    @patch.dict(
        os.environ,
        {
            "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI": "/creds",
            "ECS_CONTAINER_METADATA_URI_V4": "http://localhost:8080/v4",
            "ECS_CONTAINER_METADATA_URI": "http://localhost:8080",
            "ECS_AGENT_URI": "http://localhost:51678",
            "AWS_EXECUTION_ENV": "AWS_ECS_FARGATE",
            "AWS_DEFAULT_REGION": "us-west-2",
            "AWS_REGION": "us-west-2",
        },
        clear=True,
    )
    def test_add_ecs_context(self):
        logger = AwsServerLogger()

        # ECS context should be added during initialization
        context_data = logger.context.get("context", {})
        assert context_data is not None
        ecs_context = context_data.get("ecs")
        assert ecs_context is not None
        assert ecs_context.get("containerCredentialsRelativeUri") == "/creds"
        assert ecs_context.get("containerMetadataUriV4") == "http://localhost:8080/v4"
        assert ecs_context.get("containerMetadataUri") == "http://localhost:8080"
        assert ecs_context.get("agentUri") == "http://localhost:51678"
        assert ecs_context.get("executionEnv") == "AWS_ECS_FARGATE"
        assert ecs_context.get("defaultRegion") == "us-west-2"
        assert ecs_context.get("region") == "us-west-2"

    @patch.dict(os.environ, {}, clear=True)
    def test_add_ecs_context_empty_env(self):
        logger = AwsServerLogger()

        # ECS context should still be added with empty values
        context_data = logger.context.get("context", {})
        assert context_data is not None
        ecs_context = context_data.get("ecs")
        assert ecs_context is not None
        assert ecs_context.get("containerCredentialsRelativeUri") == ""
        assert ecs_context.get("containerMetadataUriV4") == ""
        assert ecs_context.get("containerMetadataUri") == ""
        assert ecs_context.get("agentUri") == ""
        assert ecs_context.get("executionEnv") == ""
        assert ecs_context.get("defaultRegion") == ""
        assert ecs_context.get("region") == ""

    def test_parse_sqs_message_attributes(self):
        logger = AwsServerLogger()

        # Test message attributes with different data types
        message_attributes = {
            "stringAttr": {"DataType": "String", "StringValue": "test-string"},
            "numberAttr": {"DataType": "Number", "StringValue": "123"},
            "binaryAttr": {"DataType": "Binary", "BinaryValue": b"test-binary"},
        }

        result = logger.parse_sqs_message_attributes(message_attributes)

        assert result["stringAttr"] == "test-string"
        assert result["numberAttr"] == 123
        assert result["binaryAttr"] == b"test-binary"

    def test_parse_sqs_message_attributes_empty(self):
        logger = AwsServerLogger()

        result = logger.parse_sqs_message_attributes({})
        assert result == {}

    def test_parse_sqs_message_attributes_invalid_number(self):
        logger = AwsServerLogger()

        message_attributes = {"invalidNumber": {"DataType": "Number", "StringValue": "not-a-number"}}

        result = logger.parse_sqs_message_attributes(message_attributes)
        assert result["invalidNumber"] == 0  # Default value when conversion fails

    def test_write_partial_sqs_attributes_with_http_context(self):
        logger = AwsServerLogger()

        # Add HTTP context first
        request: HttpRequestContext = {"userAgent": "test-agent", "sourceIp": "192.168.1.1"}
        logger.add_request_context(request)

        # Set correlation ID using the proper method
        logger.correlation_id = "test-correlation-123"

        result = logger.write_partial_sqs_attributes()

        assert result["correlationId"]["DataType"] == "String"
        assert result["correlationId"]["StringValue"] == "test-correlation-123"

        assert result["http"]["DataType"] == "String"
        http_value = json.loads(result["http"]["StringValue"])
        assert http_value["request"]["userAgent"] == "test-agent"
        assert http_value["request"]["sourceIp"] == "192.168.1.1"

    def test_write_partial_sqs_attributes_without_http_context(self):
        logger = AwsServerLogger()

        # Set correlation ID only using the proper method
        logger.correlation_id = "test-correlation-456"

        result = logger.write_partial_sqs_attributes()

        assert result["correlationId"]["DataType"] == "String"
        assert result["correlationId"]["StringValue"] == "test-correlation-456"

        # Should not have http attribute
        assert "http" not in result

    def test_add_wsgi_environ_context(self):
        logger = AwsServerLogger()

        # Mock WSGI environ dict
        environ = {
            "REQUEST_METHOD": "POST",
            "PATH_INFO": "/api/users",
            "SERVER_PROTOCOL": "HTTP/1.1",
            "REMOTE_ADDR": "10.0.0.1",
            "HTTP_USER_AGENT": "Mozilla/5.0",
            "QUERY_STRING": "page=1&limit=10",
            "HTTP_ACCEPT": "application/json",
            "HTTP_AUTHORIZATION": "Bearer token123",
            "CONTENT_TYPE": "application/json",
            "CONTENT_LENGTH": "1024",
        }

        logger.add_wsgi_environ_context(environ)

        # Check HTTP context was added correctly
        http_context = logger.context.get("http")
        assert http_context is not None
        request_context = http_context.get("request")
        assert request_context is not None

        assert request_context.get("method") == "POST"
        assert request_context.get("path") == "/api/users"
        assert request_context.get("protocol") == "HTTP/1.1"
        assert request_context.get("sourceIp") == "10.0.0.1"
        assert request_context.get("userAgent") == "Mozilla/5.0"
        assert request_context.get("queryString") == "page=1&limit=10"

        # Check headers were extracted correctly
        headers = request_context.get("headers")
        assert headers is not None
        assert headers.get("accept") == "application/json"
        assert headers.get("authorization") == "Bearer token123"
        assert headers.get("content-type") == "application/json"
        assert headers.get("content-length") == "1024"

    def test_add_wsgi_environ_context_minimal(self):
        logger = AwsServerLogger()

        # Minimal WSGI environ dict
        environ = {"REQUEST_METHOD": "GET", "PATH_INFO": "/health"}

        logger.add_wsgi_environ_context(environ)

        # Check HTTP context was added correctly
        http_context = logger.context.get("http")
        assert http_context is not None
        request_context = http_context.get("request")
        assert request_context is not None

        assert request_context.get("method") == "GET"
        assert request_context.get("path") == "/health"

        # Other fields should be None
        assert request_context.get("protocol") is None
        assert request_context.get("sourceIp") is None
        assert request_context.get("userAgent") is None
        assert request_context.get("queryString") is None
        assert request_context.get("headers") is None

    def test_add_wsgi_environ_context_with_non_string_values(self):
        logger = AwsServerLogger()

        # WSGI environ with non-string values
        environ = {
            "REQUEST_METHOD": "POST",
            "PATH_INFO": "/api/test",
            "HTTP_USER_AGENT": "test-agent",
            "HTTP_ACCEPT": 123,  # Non-string value
            "CONTENT_LENGTH": 1024,  # Non-string value
        }

        logger.add_wsgi_environ_context(environ)

        # Check HTTP context was added correctly
        http_context = logger.context.get("http")
        assert http_context is not None
        request_context = http_context.get("request")
        assert request_context is not None

        assert request_context.get("method") == "POST"
        assert request_context.get("path") == "/api/test"
        assert request_context.get("userAgent") == "test-agent"

        # Non-string values should be filtered out
        headers = request_context.get("headers")
        assert headers is not None
        assert "accept" not in headers  # Should be filtered out
        assert "content-length" not in headers  # Should be filtered out


class TestAwsLambdaLoggerIntegration:
    """Integration tests for AwsServerLogger."""

    def setup_method(self):
        """Reset global context before each test."""
        reset_global_context()

    @patch("sys.stdout", new_callable=StringIO)
    @patch.dict(os.environ, {"AWS_LAMBDA_FUNCTION_NAME": "integration-test", "AWS_DEFAULT_REGION": "us-east-1"}, clear=True)
    def test_aws_lambda_logger_full_workflow(self, mock_stdout):
        # Create logger with custom context
        context = cast(Context, cast(object, {"service": "aws-service", "version": "2.0.0"}))
        logger = AwsServerLogger(name="IntegrationTest", level=Level.INFO, context=context, pretty_print=False)

        # Mock Lambda event and context
        event = {
            "headers": {"X-Correlation-Id": "integration-correlation-123"},
            "requestContext": {
                "http": {
                    "method": "PUT",
                    "protocol": "HTTP/1.1",
                    "sourceIp": "203.0.113.1",
                    "userAgent": "integration-test-agent",
                    "routeKey": "PUT /api/integration",
                }
            },
            "rawPath": "/api/integration",
            "rawQueryString": "test=true",
            "body": '{"integration": "test"}',
        }

        mock_context = MagicMock()
        mock_context.aws_request_id = "integration-request-456"
        mock_context.get_remaining_time_in_millis.return_value = 10000

        # Add Lambda context
        logger.add_lambda_context(event, mock_context)

        # Log with exception and context
        try:
            raise RuntimeError("Integration test error")
        except RuntimeError as e:
            logger.error("Integration test failed", {"user_id": 789}, e)

        output = mock_stdout.getvalue()
        lines = output.strip().split("\n")

        # Should have 2 log entries: lambda:invoked and the error
        assert len(lines) == 2

        # Check the error log entry
        error_log = json.loads(lines[1])
        assert error_log.get("msg") == "Integration test failed"
        assert error_log.get("level") == "error"
        assert error_log.get("name") == "IntegrationTest"
        assert error_log.get("service") == "aws-service"
        assert error_log.get("version") == "2.0.0"
        assert error_log.get("error") == "Integration test error"
        assert error_log.get("correlationId") == "integration-correlation-123"

        # Check AWS Lambda context
        aws_lambda = error_log.get("awsLambda")
        assert aws_lambda is not None
        assert aws_lambda.get("functionName") == "integration-test"
        assert aws_lambda.get("requestId") == "integration-request-456"
        assert aws_lambda.get("remainingTimeMs") == 10000

        # Check HTTP context
        http_context = error_log.get("http")
        assert http_context is not None
        request_context = http_context.get("request")
        assert request_context is not None
        assert request_context.get("method") == "PUT"
        assert request_context.get("path") == "/api/integration"
        assert request_context.get("protocol") == "HTTP/1.1"
        assert request_context.get("sourceIp") == "203.0.113.1"
        assert request_context.get("userAgent") == "integration-test-agent"
        assert request_context.get("queryString") == "test=true"
        assert request_context.get("body") == '{"integration": "test"}'

        # Check ECS context (should be present from initialization)
        context_data = error_log.get("context", {})
        assert context_data is not None
        assert "ecs" in context_data

        # Check other required fields
        assert "errorDetails" in error_log
        assert "callerContext" in error_log
        assert "time" in error_log
