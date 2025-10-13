<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a name="readme-top"></a>

<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://smoo.ai">
    <img src="../images/logo.png" alt="SmooAI Logo" />
  </a>
</div>

<!-- ABOUT THE PROJECT -->

## About SmooAI

SmooAI is an AI-powered platform for helping businesses multiply their customer, employee, and developer experience.

Learn more on [smoo.ai](https://smoo.ai)

## SmooAI Packages

Check out other SmooAI packages at [smoo.ai/open-source](https://smoo.ai/open-source)

## About smooai-logger (Python)

**The missing piece for AWS & Browser logging** - A contextual logging system that automatically captures the full execution context you need to debug production issues, without the manual setup.

![PyPI Version](https://img.shields.io/pypi/v/smooai-logger?style=for-the-badge)
![PyPI Downloads](https://img.shields.io/pypi/dw/smooai-logger?style=for-the-badge)
![PyPI Last Update](https://img.shields.io/pypi/last-update/smooai-logger?style=for-the-badge)

![GitHub License](https://img.shields.io/github/license/SmooAI/logger?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/SmooAI/logger/release.yml?style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/SmooAI/logger?style=for-the-badge)

### Python Package

This is the Python port of [@smooai/logger](https://www.npmjs.com/package/@smooai/logger), mirroring the TypeScript API for backend services. It provides the same contextual logging capabilities with automatic AWS context capture and correlation tracking.

### Why smooai-logger?

Ever spent hours debugging an AWS service in production, only to realize you're missing critical context? Traditional loggers give you the message, but not the story.

**smooai-logger automatically captures:**

**For AWS Services:**

- 📍 **Exact code location** - File, line number, and call stack for every log
- 🔗 **Request journey** - Correlation IDs that follow requests across services
- ⚡ **AWS context** - Service-specific metadata and execution details
- 🌐 **HTTP details** - Headers, methods, status codes from API Gateway
- 📬 **Message context** - SQS attributes, EventBridge events, SNS messages
- 🔧 **Service integration** - Lambda, ECS, Fargate, EC2, and more

### Install

```bash
pip install smooai-logger
```

or with [uv](https://docs.astral.sh/uv/):

```bash
uv add smooai-logger
```

## The Power of Automatic Context

### See Where Your Logs Come From

Every log entry includes the exact location in your code:

```python
from smooai_logger import AwsServerLogger

logger = AwsServerLogger()
logger.info("User created")

# Output includes:
{
  "callerContext": {
    "stack": [
      "at UserService.create_user (/src/services/user_service.py:42:16)",
      "at process_request (/src/handlers/user_handler.py:15:23)",
      "at handler (/src/index.py:8:10)"
    ]
  }
}
```

No more guessing which function logged what - the full execution path is right there.

### Track Requests Across Services

Correlation IDs automatically flow through your entire system:

```python
# Service A: API Gateway Handler
logger.add_lambda_context(event, context)
logger.info("Request received")  # Correlation ID: abc-123

# Service B: SQS Processor (automatically extracts ID)
logger.add_sqs_record_context(record)
logger.info("Processing message")  # Same Correlation ID: abc-123

# Service C: Another Lambda (receives via HTTP header)
logger.info("Completing workflow")  # Still Correlation ID: abc-123
```

### Production-Ready Examples

#### AWS Lambda with API Gateway

```python
from smooai_logger import AwsServerLogger, Level

logger = AwsServerLogger(name="UserAPI")

def handler(event, context):
    logger.add_lambda_context(event, context)

    try:
        user = create_user(event["body"])
        logger.info("User created successfully", {"userId": user.id})
        return {"statusCode": 201, "body": json.dumps(user)}
    except Exception as error:
        logger.error("Failed to create user", error, {
            "body": event["body"],
            "headers": event["headers"],
        })
        raise error
```

#### AWS ECS/Fargate Services

```python
import os
from smooai_logger import AwsServerLogger, Level

logger = AwsServerLogger(
    name="OrderService",
    level=Level.INFO,
)

# Automatically captures container metadata
@app.post('/orders')
async def create_order(request):
    logger.add_context({
        "taskArn": os.environ.get("ECS_TASK_ARN"),
        "containerName": os.environ.get("ECS_CONTAINER_NAME"),
    })

    logger.info("Processing order", {
        "orderId": request.json["orderId"],
        "amount": request.json["amount"],
    })
```

#### SQS Message Processing

```python
def sqs_handler(event):
    for record in event["Records"]:
        logger.add_sqs_record_context(record)
        logger.info("Processing order", {
            "messageId": record["messageId"],
            "attempt": record["attributes"]["ApproximateReceiveCount"],
        })

        # Logger maintains context throughout async operations
        process_order(record["body"])
```

## Advanced Features

### Smart Error Handling

Errors are automatically serialized with full context:

```python
try:
    risky_operation()
except Exception as error:
    logger.error("Operation failed", error, {"context": "additional-info"})
    # Includes: error message, stack trace, error type, and your context
```

### Flexible Context Management

```python
# Add user context that persists across logs
logger.add_user_context({"id": "user-123", "role": "admin"})

# Add telemetry for performance tracking
logger.add_telemetry_fields({"duration": 150, "operation": "db-query"})

# Add custom context for specific logs
logger.info("Payment processed", {
    "amount": 99.99,
    "currency": "USD",
})
```

### Local Development Features

#### Pretty Printing

```python
logger = AwsServerLogger(
    pretty_print=True  # Readable console output for development
)
```

#### Automatic Log Rotation

Logs are automatically saved to disk in development with smart rotation:

```python
# Auto-enabled in local environments
# Saves to .smooai-logs/ with ANSI colors for easy reading
logger = AwsServerLogger(
    rotation={
        "size": "10M",        # Rotate at 10MB
        "interval": "1d",     # Daily rotation
        "compress": True,     # Gzip old logs
    }
)
```

## Configuration

### Log Levels

- `TRACE` - Detailed debugging information
- `DEBUG` - Diagnostic information
- `INFO` - General operational information
- `WARN` - Warning conditions
- `ERROR` - Error conditions
- `FATAL` - Critical failures

### Context Presets

- `MINIMAL` - Essential context only
- `FULL` - All available context (default)

## Built With

- Python 3.8+ - Full type hints support
- AWS SDK Integration - Native support for Lambda, ECS, EC2, and more
- Automatic environment detection
- Smart log rotation

## Related Packages

- [@smooai/logger](https://www.npmjs.com/package/@smooai/logger) - TypeScript/JavaScript version
- [smooai-logger (Rust)](../rust/logger/) - Rust version

## Development

```bash
uv run poe install-dev
uv run pytest
uv run poe lint
uv run poe lint:fix   # optional fixer
uv run poe format
uv run poe typecheck
uv run poe build
```

Set `UV_PUBLISH_TOKEN` before running `uv run poe publish` to upload to PyPI.

<!-- CONTACT -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Brent Rager

- [Email](mailto:brent@smoo.ai)
- [LinkedIn](https://www.linkedin.com/in/brentrager/)
- [BlueSky](https://bsky.app/profile/brentragertech.bsky.social)
- [TikTok](https://www.tiktok.com/@brentragertech)
- [Instagram](https://www.instagram.com/brentragertech/)

Smoo Github: [https://github.com/SmooAI](https://github.com/SmooAI)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

MIT © SmooAI
