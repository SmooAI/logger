<p align="center">
  <a href="https://smoo.ai"><img src="https://smoo.ai/images/logo/logo.svg" alt="Smoo AI" width="220" /></a>
</p>

<h1 align="center">@smooai/logger</h1>

<p align="center">
  <strong>Contextual logging for AWS and the browser — the full execution story, captured automatically.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@smooai/logger"><img src="https://img.shields.io/npm/v/@smooai/logger?style=flat-square&color=00A6A6&label=npm" alt="npm"></a>
  <img src="https://img.shields.io/badge/Smoo_AI-platform-00A6A6?style=flat-square" alt="Smoo AI">
  <img src="https://img.shields.io/badge/license-MIT-F49F0A?style=flat-square" alt="license">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go">
</p>

<p align="center">
  <a href="#-features">Features</a> ·
  <a href="#-install">Install</a> ·
  <a href="#-usage">Usage</a> ·
  <a href="#-part-of-smoo-ai">Platform</a>
</p>

---

> A contextual logging system that captures the full execution context you need to debug production issues — without the manual setup. It's built for AWS services and the browser, and it ships with native implementations in TypeScript, Python, Rust, and Go so every service in your stack logs the same way.

Traditional loggers give you the message, but not the story. `@smooai/logger` records where the log came from, the request journey that led there, and the runtime around it — so a production failure reads like a trace, not a guess.

## ✨ Features

**For AWS services**, it captures automatically:

- 📍 **Exact code location** — file, line number, and call stack for every log
- 🔗 **Request journey** — correlation IDs that follow requests across services
- ⚡ **AWS context** — service-specific metadata and execution details
- 🌐 **HTTP details** — headers, methods, and status codes from API Gateway
- 📬 **Message context** — SQS attributes, EventBridge events, SNS messages
- 🔧 **Service integration** — Lambda, ECS, Fargate, EC2, and more

**For the browser**, it captures automatically:

- 🖥️ **Device intelligence** — desktop, mobile, or tablet detection
- 🌏 **Browser context** — name, version, platform, and user agent
- 📱 **Platform details** — operating system and architecture
- 🔍 **Request tracking** — correlation across API calls
- 🚨 **Rich errors** — full stack traces with source map support

## 📦 Install

```sh
pnpm add @smooai/logger
```

### Python

The Python port mirrors the TypeScript API for backend services.

```sh
pip install smooai-logger
# or, with uv:
uv add smooai-logger
```

See [`python/README.md`](python/README.md) for usage examples aligned with the TypeScript docs below.

### Rust

A parity crate lives in [`rust/logger/`](rust/logger/):

```toml
[dependencies]
smooai-logger = { git = "https://github.com/SmooAI/logger", package = "smooai-logger" }
```

Usage examples and API notes are documented in [`rust/logger/README.md`](rust/logger/README.md).

### Go

The Go port provides the same structured logging for Go services:

```sh
go get github.com/smooai/logger
```

```go
import "github.com/smooai/logger"

l, err := logger.New(logger.Options{
    Name:  "MyService",
    Level: logger.LevelInfo,
})
if err != nil {
    log.Fatal(err)
}
defer l.Close()

// Add HTTP request context (auto-sets namespace and extracts correlation ID)
l.AddHTTPRequest(logger.HTTPRequest{
    Method:  "POST",
    Path:    "/api/users",
    Headers: map[string]string{"X-Correlation-Id": "abc-123"},
})

// Structured logging with context maps
l.Info("User created", logger.Map{"userId": "123"})

// Error logging with automatic stack traces
l.Error("Operation failed", fmt.Errorf("database timeout"))

// User context, telemetry, and correlation tracking
l.AddUserContext(logger.User{ID: "user-456", Role: "admin"})
l.SetCorrelationID("custom-trace-id")
```

The Go port covers all six log levels (TRACE through FATAL), structured JSON output, ANSI pretty-printing in local dev, automatic file rotation to `.smooai-logs/`, global context with correlation/request/trace IDs, HTTP request/response context, user context, and telemetry fields. See [`go/`](go/) for the full source and `go/logger_test.go` for the test suite.

## 🚀 Usage

### See where your logs come from

Every log entry includes the exact location in your code:

```typescript
const logger = new AwsServerLogger();
logger.info('User created');

// Output includes:
{
  "callerContext": {
    "stack": [
      "at UserService.createUser (/src/services/UserService.ts:42:16)",
      "at processRequest (/src/handlers/userHandler.ts:15:23)",
      "at Runtime.handler (/src/index.ts:8:10)"
    ]
  }
}
```

The full execution path is right there — no guessing which function logged what.

### Track requests across services

Correlation IDs flow through your entire system automatically:

```typescript
// Service A: API Gateway handler
logger.addLambdaContext(event, context);
logger.info("Request received"); // Correlation ID: abc-123

// Service B: SQS processor (automatically extracts the ID)
logger.addSQSRecordContext(record);
logger.info("Processing message"); // Same correlation ID: abc-123

// Service C: another Lambda (receives via HTTP header)
logger.info("Completing workflow"); // Still correlation ID: abc-123
```

### Production-ready examples

#### AWS Lambda with API Gateway

```typescript
import { AwsServerLogger } from "@smooai/logger/AwsServerLogger";

const logger = new AwsServerLogger({ name: "UserAPI" });

export const handler = async (event, context) => {
  logger.addLambdaContext(event, context);

  try {
    const user = await createUser(event.body);
    logger.info("User created successfully", { userId: user.id });
    return { statusCode: 201, body: JSON.stringify(user) };
  } catch (error) {
    logger.error("Failed to create user", error, {
      body: event.body,
      headers: event.headers,
    });
    throw error;
  }
};
```

#### AWS ECS / Fargate services

```typescript
const logger = new AwsServerLogger({
  name: "OrderService",
  level: Level.Info,
});

// Automatically captures container metadata
app.post("/orders", async (req, res) => {
  logger.addContext({
    taskArn: process.env.ECS_TASK_ARN,
    containerName: process.env.ECS_CONTAINER_NAME,
  });

  logger.info("Processing order", {
    orderId: req.body.orderId,
    amount: req.body.amount,
  });
});
```

#### SQS message processing

```typescript
export const sqsHandler = async (event) => {
  for (const record of event.Records) {
    logger.addSQSRecordContext(record);
    logger.info("Processing order", {
      messageId: record.messageId,
      attempt: record.attributes.ApproximateReceiveCount,
    });

    // Logger maintains context throughout async operations
    await processOrder(record.body);
  }
};
```

#### Browser tracking

```typescript
import { BrowserLogger } from '@smooai/logger/browser/BrowserLogger';

const logger = new BrowserLogger({ name: 'CheckoutFlow' });

// Automatically captures browser context
const response = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'X-Correlation-Id': logger.correlationId() }
});

logger.addResponseContext(response);
logger.info('Checkout completed', { orderId: data.id });

// Output includes rich browser context:
{
  "browserContext": {
    "name": "Chrome",
    "version": "120.0.0",
    "platform": "MacIntel",
    "userAgent": "Mozilla/5.0...",
    "isDesktop": true,
    "isMobile": false,
    "isTablet": false
  },
  "http": {
    "request": {
      "method": "POST",
      "path": "/api/checkout",
      "headers": { "x-correlation-id": "abc-123" }
    },
    "response": {
      "statusCode": 200,
      "headers": { "content-type": "application/json" }
    }
  }
}
```

## 📖 Advanced features

### Smart error handling

Errors are serialized with full context:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error("Operation failed", error, { context: "additional-info" });
  // Includes: error message, stack trace, error type, and your context
}
```

### Flexible context management

```typescript
// Add user context that persists across logs
logger.addUserContext({ id: "user-123", role: "admin" });

// Add telemetry for performance tracking
logger.addTelemetryFields({ duration: 150, operation: "db-query" });

// Add custom context for specific logs
logger.info("Payment processed", {
  amount: 99.99,
  currency: "USD",
});
```

### Local development

#### Pretty printing

```typescript
const logger = new AwsServerLogger({
  prettyPrint: true, // Readable console output for development
});
```

#### Automatic log rotation

Logs are saved to disk in development with smart rotation:

```typescript
// Auto-enabled in local environments — saves to .smooai-logs/ with ANSI colors
const logger = new AwsServerLogger({
  rotation: {
    size: "10M", // Rotate at 10MB
    interval: "1d", // Daily rotation
    compress: true, // Gzip old logs
  },
});
```

### Import paths

```typescript
// AWS environments (Lambda, ECS, EC2, etc.)
import { AwsServerLogger, Level } from "@smooai/logger/AwsServerLogger";

// Browser environments
import { BrowserLogger, Level } from "@smooai/logger/browser/BrowserLogger";
```

### Configuration

**Log levels:**

- `TRACE` — detailed debugging information
- `DEBUG` — diagnostic information
- `INFO` — general operational information
- `WARN` — warning conditions
- `ERROR` — error conditions
- `FATAL` — critical failures

**Context presets:**

- `MINIMAL` — essential context only
- `FULL` — all available context (default)

### Built with

- **TypeScript** — core implementation with full type safety, AWS SDK integration, browser detection, and rotating file streams
- **Python** — Pydantic-based structured logging with rich terminal output and AWS context support
- **Rust** — high-performance structured logging with serde serialization and colored output
- **Go** — native structured logging with JSON output, ANSI pretty-printing, and automatic file rotation
- **Log Viewer** — desktop application (Rust/egui) for viewing and analyzing SmooAI logs with filtering and DuckDB-powered queries

## 🧩 Part of Smoo AI

`@smooai/logger` is part of the [Smoo AI](https://smoo.ai) platform — an AI-powered business platform with AI built into every product. It's one of a family of open-source packages we maintain to keep our own stack honest:

- [@smooai/fetch](https://github.com/SmooAI/fetch) — resilient, type-safe HTTP client
- [@smooai/config](https://github.com/SmooAI/config) — type-safe config, secrets, and feature flags
- [smooth](https://github.com/SmooAI/smooth) — the SmooAI developer toolchain

Use them in your stack, or take them as a reference for how we build.

## 🤝 Contributing

Contributions are welcome. This project uses [changesets](https://github.com/changesets/changesets) to manage versions and releases — add one with `pnpm changeset`, then open a pull request referencing any related issues.

## 📄 License

MIT © SmooAI. See [LICENSE](LICENSE).

## Contact

Brent Rager

- [Email](mailto:brent@smoo.ai)
- [LinkedIn](https://www.linkedin.com/in/brentrager/)
- [BlueSky](https://bsky.app/profile/brentragertech.bsky.social)
- [TikTok](https://www.tiktok.com/@brentragertech)
- [Instagram](https://www.instagram.com/brentragertech/)

Smoo GitHub: [github.com/SmooAI](https://github.com/SmooAI)

---

<p align="center">
  Built by <a href="https://smoo.ai"><strong>Smoo AI</strong></a> — AI built into every product.
</p>
