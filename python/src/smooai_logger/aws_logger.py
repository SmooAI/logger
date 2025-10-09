import json
import os
from typing import Any, cast

from .logger import (
    Context,
    HttpRequestContext,
    LambdaEnvContext,
    Level,
    Logger,
    _get_global_context,
    _set_global_context,
)


class AwsServerLogger(Logger):
    """
    Extension of Logger that adds AWS Lambda and ECS context, plus SQS helpers.
    """

    def __init__(
        self,
        name: str | None = None,
        level: Level | None = None,
        context: Context | None = None,
        pretty_print: bool | None = None,
    ) -> None:
        super().__init__(
            name=name or "AwsServerLogger",
            level=level,
            context=context,
            pretty_print=pretty_print,
        )
        self.add_ecs_context()

    def get_lambda_environment_context(self) -> dict[str, Any]:
        return {
            "awsLambda": {
                "functionName": os.getenv("AWS_LAMBDA_FUNCTION_NAME"),
                "functionVersion": os.getenv("AWS_LAMBDA_FUNCTION_VERSION"),
                "executionEnv": os.getenv("AWS_EXECUTION_ENV"),
                "logGroupName": os.getenv("AWS_LAMBDA_LOG_GROUP_NAME"),
                "logStreamName": os.getenv("AWS_LAMBDA_LOG_STREAM_NAME"),
                "memorySizeMB": os.getenv("AWS_LAMBDA_FUNCTION_MEMORY_SIZE"),
            },
            "region": os.getenv("AWS_DEFAULT_REGION") or os.getenv("AWS_REGION"),
            "nodeEnv": os.getenv("NODE_ENV"),
        }

    def add_lambda_context(self, event: dict[str, Any], ctx: Any) -> None:
        """
        Reset context, merge Lambda + HTTP, then log invocation.
        """
        # Store existing context to preserve custom values
        existing_context = _get_global_context()

        # Reset context but preserve custom values (excluding AWS Lambda and HTTP specific ones)
        new_context: Context = {}

        # Preserve custom context values (like service, version, ecs, etc.)
        for key, value in existing_context.items():
            if key not in ["awsLambda", "http", "region", "nodeEnv"]:
                new_context[key] = value

        # Set correlation ID from event headers if present, otherwise preserve existing
        corr = event.get("headers", {}).get("X-Correlation-Id")
        if corr:
            new_context["correlationId"] = corr
        elif "correlationId" in existing_context:
            new_context["correlationId"] = existing_context["correlationId"]

        lam: dict[str, Any] = self.get_lambda_environment_context()
        lam["awsLambda"] = cast(LambdaEnvContext, cast(object, lam["awsLambda"]))
        lam["awsLambda"]["requestId"] = getattr(ctx, "aws_request_id", None)
        lam["awsLambda"]["remainingTimeMs"] = getattr(ctx, "get_remaining_time_in_millis", lambda: None)()
        # merge lam
        for k, v in lam.items():
            new_context[k] = v

        # Set the new context
        _set_global_context(new_context)

        # HTTP
        http = event.get("requestContext", {}).get("http", {})
        req: HttpRequestContext = {}
        if http.get("method"):
            req["method"] = http["method"]
        if event.get("rawPath"):
            req["path"] = event["rawPath"]
        if http.get("protocol"):
            req["protocol"] = http["protocol"]
        if http.get("sourceIp"):
            req["sourceIp"] = http["sourceIp"]
        if http.get("userAgent"):
            req["userAgent"] = http["userAgent"]
        if event.get("headers"):
            req["headers"] = event["headers"]
        if event.get("rawQueryString"):
            req["queryString"] = event["rawQueryString"]
        if event.get("body"):
            req["body"] = event["body"]

        if req:
            self.add_request_context(req)

        self.info({"event": {"route": http.get("routeKey")}}, "lambda:invoked")

    def add_ecs_context(self) -> None:
        """
        Add ECS metadata under 'ecs' key.
        """
        ecs_ctx = {
            "containerCredentialsRelativeUri": os.getenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI") or "",
            "containerMetadataUriV4": os.getenv("ECS_CONTAINER_METADATA_URI_V4") or "",
            "containerMetadataUri": os.getenv("ECS_CONTAINER_METADATA_URI") or "",
            "agentUri": os.getenv("ECS_AGENT_URI") or "",
            "executionEnv": os.getenv("AWS_EXECUTION_ENV") or "",
            "defaultRegion": os.getenv("AWS_DEFAULT_REGION") or "",
            "region": os.getenv("AWS_REGION") or "",
        }
        self.add_context({"ecs": ecs_ctx})

    # -----------------------------
    # SQS Message Attribute Helpers
    # -----------------------------
    def parse_sqs_message_attributes(self, message_attributes: dict[str, Any]) -> dict[str, Any]:
        """
        Convert raw SQS messageAttributes dict into simple Python types.
        """
        result: dict[str, Any] = {}
        for key, val in message_attributes.items():
            dt = val.get("DataType")
            if dt == "Number":
                try:
                    result[key] = int(val.get("StringValue", "0"))
                except ValueError:
                    result[key] = 0  # Default value when conversion fails
            elif dt == "Binary":
                result[key] = val.get("BinaryValue")
            else:
                result[key] = val.get("StringValue")
        return result

    def write_partial_sqs_attributes(self) -> dict[str, Any]:
        """
        Return a subset of context (correlationId + http) as SQS messageAttributes.
        """
        context = _get_global_context()
        out: dict[str, Any] = {"correlationId": {"DataType": "String", "StringValue": context.get("correlationId", "")}}
        http_ctx = cast(HttpRequestContext, cast(object, context.get("http", {}))).get("request")
        if http_ctx:
            out["http"] = {
                "DataType": "String",
                "StringValue": json.dumps({"request": {k: http_ctx.get(k) for k in ("userAgent", "sourceIp")}}),
            }
        return out

    def add_wsgi_environ_context(self, environ: dict[str, Any]) -> None:
        """Attach HTTP request context based on a WSGI environ dict per PEP 3333."""
        # Build request context
        request: HttpRequestContext = {}
        # Standard request fields
        request["method"] = environ.get("REQUEST_METHOD")
        request["path"] = environ.get("PATH_INFO")
        request["protocol"] = environ.get("SERVER_PROTOCOL")
        request["sourceIp"] = environ.get("REMOTE_ADDR")
        request["userAgent"] = environ.get("HTTP_USER_AGENT")
        request["queryString"] = environ.get("QUERY_STRING")
        # Extract headers from HTTP_* keys
        headers: dict[str, str] = {}
        for key, value in environ.items():
            if key.startswith("HTTP_") and isinstance(value, str):
                hdr = key[5:].replace("_", "-").lower()
                headers[hdr] = value
        # Include content headers
        if isinstance(environ.get("CONTENT_TYPE"), str):
            headers["content-type"] = environ["CONTENT_TYPE"]
        if isinstance(environ.get("CONTENT_LENGTH"), str):
            headers["content-length"] = environ["CONTENT_LENGTH"]
        if headers:
            request["headers"] = headers
        # Attach via existing helper
        self.add_request_context(request)
