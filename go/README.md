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
    <img src="../../images/logo.png" alt="SmooAI Logo" />
  </a>
</div>

<!-- ABOUT THE PROJECT -->

## About SmooAI

SmooAI is an AI-powered platform for helping businesses multiply their customer, employee, and developer experience.

Learn more on [smoo.ai](https://smoo.ai)

## SmooAI Packages

Check out other SmooAI packages at [smoo.ai/open-source](https://smoo.ai/open-source)

## About smooai-logger (Go)

**The missing piece for AWS & Go logging** - A contextual logging system that automatically captures the full execution context you need to debug production issues, without the manual setup.

[![Go Reference](https://pkg.go.dev/badge/github.com/SmooAI/logger/go/v3.svg)](https://pkg.go.dev/github.com/SmooAI/logger/go/v3)

![GitHub License](https://img.shields.io/github/license/SmooAI/logger?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/SmooAI/logger/release.yml?style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/SmooAI/logger?style=for-the-badge)

### Go Package

A Go port of [@smooai/logger](https://www.npmjs.com/package/@smooai/logger) that mirrors the feature set of the TypeScript, Python, and Rust versions. The package exposes a JSON-first logging API with correlation tracking, HTTP helpers, AWS Lambda integration, optional pretty-printing, and rotating-file output — all idiomatic Go with no global init required.

### Why smooai-logger?

Ever spent hours debugging a Go service in production, only to realize you're missing critical context? Traditional loggers give you the message, but not the story.

**smooai-logger automatically captures:**

**For AWS Services:**

- **Exact code location** - File, line number, and function name for every log
- **Request journey** - Correlation IDs that follow requests across services
- **AWS context** - Service-specific metadata and execution details
- **HTTP details** - Headers, methods, status codes from API Gateway
- **Message context** - SQS attributes, EventBridge events, SNS messages
- **Service integration** - Lambda, ECS, Fargate, EC2, and more

### Install

```bash
go get github.com/SmooAI/logger/go/v3
```

### Cross-Language Support

The same structured log format works across all your services:

| Language   | Package | Install |
| ---------- | ------- | ------- |
| TypeScript | [`@smooai/logger`](https://www.npmjs.com/package/@smooai/logger) | `pnpm add @smooai/logger` |
| Python     | [`smooai-logger`](https://pypi.org/project/smooai-logger/) | `pip install smooai-logger` |
| Rust       | [`smooai-logger`](https://crates.io/crates/smooai-logger) | `cargo add smooai-logger` |
| Go         | `github.com/SmooAI/logger/go/v3` | `go get github.com/SmooAI/logger/go/v3` |

## The Power of Automatic Context

### See Where Your Logs Come From

Every log entry includes the exact location in your code:

```go
import logger "github.com/SmooAI/logger/go/v3"

log := logger.Default()
log.Info("User created")

// Output includes:
{
  "caller": {
    "file":     "src/services/user_service.go",
    "line":     42,
    "function": "UserService.CreateUser"
  }
}
```

No more guessing which function logged what - the full call site is right there.

### Track Requests Across Services

Correlation IDs automatically flow through your entire system:

```go
// Service A: API Gateway Handler
lambdaLog.AddAPIGatewayContext(request)
lambdaLog.Info("Request received")  // Correlation ID: abc-123

// Service B: SQS Processor (automatically extracts ID from message)
lambdaLog.AddSQSRecordContext(record)
lambdaLog.Info("Processing message")  // Same Correlation ID: abc-123

// Service C: Another Lambda (receives via HTTP header)
lambdaLog.Info("Completing workflow")  // Still Correlation ID: abc-123
```

### Production-Ready Examples

#### AWS Lambda with API Gateway

```go
package main

import (
    "context"

    "github.com/aws/aws-lambda-go/events"
    "github.com/aws/aws-lambda-go/lambda"
    logger "github.com/SmooAI/logger/go/v3"
)

var log *logger.LambdaLogger

func init() {
    base, _ := logger.New(logger.Options{Name: "UserAPI"})
    log = logger.NewLambdaLogger(base)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
    log.AddLambdaContext(ctx)
    log.AddAPIGatewayContext(request)

    user, err := createUser(request.Body)
    if err != nil {
        log.Error("Failed to create user", err, map[string]any{
            "body":    request.Body,
            "headers": request.Headers,
        })
        return events.APIGatewayProxyResponse{StatusCode: 500}, err
    }

    log.Info("User created successfully", map[string]any{"userId": user.ID})
    return events.APIGatewayProxyResponse{StatusCode: 201}, nil
}

func main() {
    lambda.Start(handler)
}
```

#### AWS ECS/Fargate Services

```go
import (
    "os"
    logger "github.com/SmooAI/logger/go/v3"
)

log, _ := logger.New(logger.Options{
    Name:  "OrderService",
    Level: logger.LevelInfo,
})

// Add container metadata for ECS/Fargate
log.AddContext(logger.Map{
    "taskArn":       os.Getenv("ECS_TASK_ARN"),
    "containerName": os.Getenv("ECS_CONTAINER_NAME"),
})

log.Info("Processing order", map[string]any{
    "orderId": orderId,
    "amount":  amount,
})
```

#### SQS Message Processing

```go
func sqsHandler(ctx context.Context, event events.SQSEvent) error {
    for _, record := range event.Records {
        lambdaLog.AddSQSRecordContext(record)
        lambdaLog.Info("Processing message", map[string]any{
            "messageId": record.MessageId,
            "attempt":   record.Attributes["ApproximateReceiveCount"],
        })

        // Logger maintains context throughout the operation
        if err := processOrder(record.Body); err != nil {
            lambdaLog.Error("Failed to process order", err)
            return err
        }
    }
    return nil
}
```

#### HTTP Request Processing

```go
log.AddHTTPRequest(logger.HTTPRequest{
    Method:  "GET",
    Path:    "/api/orders",
    Headers: map[string]string{"X-Correlation-Id": correlationId},
})

log.Info("Processing request", map[string]any{
    "messageId": messageId,
    "attempt":   attemptCount,
})

// Process the request...
response, err := processRequest()

log.AddHTTPResponse(logger.HTTPResponse{
    StatusCode: 200,
    Headers:    responseHeaders,
})
```

## Advanced Features

### Smart Error Handling

Errors are automatically serialized with full context, including the goroutine stack trace and the full error chain:

```go
_, err := riskyOperation()
if err != nil {
    log.Error("Operation failed", err, map[string]any{
        "context": "additional-info",
    })
    // Logged fields include: error message, stack trace, error type, causes, and your context
}
```

### Flexible Context Management

```go
// Add user context that persists across all subsequent logs
log.AddUserContext(logger.User{
    ID:   "user-123",
    Role: "admin",
})

// Add telemetry for performance tracking
log.AddTelemetryFields(logger.TelemetryFields{
    Duration:  150,
    Namespace: "db-query",
})

// Add custom context for a specific log
log.Info("Payment processed", map[string]any{
    "amount":   99.99,
    "currency": "USD",
})
```

### Correlation ID Management

```go
// Set a specific correlation ID (also sets requestId and traceId)
log.SetCorrelationID("abc-123")

// Read the current correlation ID
id := log.CorrelationID()

// Generate a fresh correlation ID
log.ResetCorrelationID()

// Reset all context and generate new IDs
log.ResetContext()
```

### Local Development Features

#### Pretty Printing

Pretty output is automatically enabled in local or CI environments (`SST_DEV`, `IS_LOCAL`, or `GITHUB_ACTIONS`):

```go
prettyOn := true
log, _ := logger.New(logger.Options{
    PrettyPrint: &prettyOn, // Force enable for readable console output
})
```

#### Automatic Log Rotation

File logging is automatically enabled in local environments and can be configured explicitly:

```go
fileOn := true
log, _ := logger.New(logger.Options{
    LogToFile: &fileOn,
    Rotation: &logger.RotationOptions{
        Path:           ".smooai-logs",
        FilenamePrefix: "app",
        Extension:      "log",
        Size:           "10M",  // Rotate at 10 MB
        Interval:       "1d",   // Daily rotation
        MaxFiles:       10,     // Keep 10 files
        MaxTotalSize:   "100M", // Total size limit
    },
})
```

## API Reference

### Logger Creation

```go
import logger "github.com/SmooAI/logger/go/v3"

// With options
prettyOn := true
log, err := logger.New(logger.Options{
    Name:        "MyService",
    Level:       logger.LevelInfo,
    PrettyPrint: &prettyOn,
})

// With defaults
log := logger.Default()
```

### Context Helpers

```go
// HTTP context (also extracts X-Correlation-Id header automatically)
log.AddHTTPRequest(logger.HTTPRequest{
    Method:  "GET",
    Path:    "/api/users",
    Headers: map[string]string{"X-Correlation-Id": "abc-123"},
})

log.AddHTTPResponse(logger.HTTPResponse{
    StatusCode: 200,
    Headers:    responseHeaders,
})

// User context
log.AddUserContext(logger.User{
    ID:    "user-123",
    Email: "user@example.com",
    Role:  "admin",
})

// Telemetry and tracing
log.AddTelemetryFields(logger.TelemetryFields{
    RequestID: "req-456",
    TraceID:   "trace-789",
    Duration:  250,
    Namespace: "user-service",
    Service:   "api-gateway",
})

// Arbitrary custom context (merged into the "context" field)
log.AddContext(logger.Map{
    "customField": "value",
    "nested": logger.Map{
        "key": "value",
    },
})

// Set a single base-level key
log.AddBaseContextKey("region", "us-east-1")

// Set namespace
log.SetNamespace("custom-namespace")

// Reset all context and regenerate correlation IDs
log.ResetContext()
```

### Lambda Helpers

```go
lambdaLog := logger.NewLambdaLogger(log)

// Add Lambda invocation context (request ID, function ARN, Cognito identity)
lambdaLog.AddLambdaContext(ctx)

// Add Lambda environment variables (function name, version, region, memory)
lambdaLog.AddLambdaEnvironmentContext()

// Add API Gateway request context
lambdaLog.AddAPIGatewayContext(request)

// Add SQS record context (also sets correlation ID from message ID)
lambdaLog.AddSQSRecordContext(record)

// Strip verbose context when running locally
lambdaLog.SlimDownLocally()
```

### Logging Methods

```go
// Simple message
log.Info("User created successfully")

// With structured data (map[string]any args are merged into the "context" field)
log.Info("Processing request", map[string]any{
    "userId": "123",
    "action": "create",
})

// With error (stack trace and error chain captured automatically)
log.Error("Database connection failed", err)

// Combining message, error, and data
log.Error("Failed to create user", err, map[string]any{
    "userId":  "123",
    "attempt": 3,
})

// All log levels
log.Trace("Verbose detail")
log.Debug("Diagnostic info")
log.Info("Operational message")
log.Warn("Warning condition")
log.Error("Error condition", err)
log.Fatal("Critical failure", err)
```

### Lifecycle

```go
// Close flushes and closes the file writer (call on shutdown)
defer log.Close()
```

## Configuration

### Log Levels

- `LevelTrace` (10) - Detailed debugging information
- `LevelDebug` (20) - Diagnostic information
- `LevelInfo` (30) - General operational information
- `LevelWarn` (40) - Warning conditions
- `LevelError` (50) - Error conditions
- `LevelFatal` (60) - Critical failures

Log level can also be set via the `LOG_LEVEL` environment variable (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).

### Environment Variables

The logger respects these environment variables for automatic configuration:

- `SST_DEV` - Enables pretty printing and file logging in SST development
- `IS_LOCAL` - Enables pretty printing and file logging for local development
- `IS_DEPLOYED_STAGE` - When set to `true`, disables local-mode behaviour
- `GITHUB_ACTIONS` - Enables pretty printing in CI/CD
- `LOG_LEVEL` - Sets the minimum log level (default: `info`)

## Built With

- Go 1.22+ - Static typing and first-class concurrency
- `encoding/json` - Standard library JSON serialization
- `github.com/aws/aws-lambda-go` - AWS Lambda context and event types
- `github.com/google/uuid` - Correlation ID generation
- Automatic log rotation with configurable size, interval, and retention

## Related Packages

- [@smooai/logger](https://www.npmjs.com/package/@smooai/logger) - TypeScript/JavaScript version
- [smooai-logger (Python)](https://pypi.org/project/smooai-logger/) - Python version
- [smooai-logger (Rust)](https://crates.io/crates/smooai-logger) - Rust version

## Development

### Running tests

```bash
go test ./...
```

### Building

```bash
go build ./...
```

### Linting and Formatting

```bash
go vet ./...
gofmt -w .
```

<!-- CONTACT -->

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Brent Rager

- [Email](mailto:brent@smoo.ai)
- [LinkedIn](https://www.linkedin.com/in/brentrager/)
- [BlueSky](https://bsky.app/profile/brentragertech.bsky.social)

Smoo Github: [https://github.com/SmooAI](https://github.com/SmooAI)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

MIT © SmooAI
