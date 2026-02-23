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
    <img src="images/logo.png" alt="SmooAI Logo" />
  </a>
</div>

<!-- ABOUT THE PROJECT -->

## About SmooAI

SmooAI is an AI-powered platform for helping businesses multiply their customer, employee, and developer experience.

Learn more on [smoo.ai](https://smoo.ai)

## SmooAI Packages

Check out other SmooAI packages at [smoo.ai/open-source](https://smoo.ai/open-source)

## About @smooai/logger

**The missing piece for AWS & Browser logging** - A contextual logging system that automatically captures the full execution context you need to debug production issues, without the manual setup.

![NPM Version](https://img.shields.io/npm/v/%40smooai%2Flogger?style=for-the-badge)
![NPM Downloads](https://img.shields.io/npm/dw/%40smooai%2Flogger?style=for-the-badge)
![NPM Last Update](https://img.shields.io/npm/last-update/%40smooai%2Flogger?style=for-the-badge)

![GitHub License](https://img.shields.io/github/license/SmooAI/logger?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/SmooAI/logger/release.yml?style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/SmooAI/logger?style=for-the-badge)

### Why @smooai/logger?

Ever spent hours debugging an AWS service in production, only to realize you're missing critical context? Or tracking down a browser issue without knowing the user's device or browser version? Traditional loggers give you the message, but not the story.

**@smooai/logger automatically captures:**

**For AWS Services:**

- 📍 **Exact code location** - File, line number, and call stack for every log
- 🔗 **Request journey** - Correlation IDs that follow requests across services
- ⚡ **AWS context** - Service-specific metadata and execution details
- 🌐 **HTTP details** - Headers, methods, status codes from API Gateway
- 📬 **Message context** - SQS attributes, EventBridge events, SNS messages
- 🔧 **Service integration** - Lambda, ECS, Fargate, EC2, and more

**For Browser:**

- 🖥️ **Device intelligence** - Desktop, mobile, or tablet detection
- 🌏 **Browser context** - Name, version, platform, and user agent
- 📱 **Platform details** - Operating system and architecture
- 🔍 **Request tracking** - Automatic correlation across API calls
- 🚨 **Rich errors** - Full stack traces with source map support

### Install

```sh
pnpm add @smooai/logger
```

### Python Package

The Python port mirrors the TypeScript API for backend services. Install it from PyPI:

```sh
pip install smooai-logger
```

or with [uv](https://docs.astral.sh/uv/):

```sh
uv add smooai-logger
```

See `python/README.md` for usage examples aligned with the TypeScript docs below.

### Rust Crate

Need the same structured logging features in Rust? A parity crate now lives in `rust/logger/`:

```toml
[dependencies]
smooai-logger = { git = "https://github.com/SmooAI/logger", package = "smooai-logger" }
```

Usage examples and API notes are documented in `rust/logger/README.md`.

### Go Package

The Go port provides the same structured logging features for Go services:

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
    Method: "POST",
    Path:   "/api/users",
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

Features: all 6 log levels (TRACE through FATAL), structured JSON output, ANSI pretty-printing in local dev, automatic file rotation to `.smooai-logs/`, global context with correlation/request/trace IDs, HTTP request/response context, user context, and telemetry fields.

See `go/` for the full source and `go/logger_test.go` for comprehensive test coverage (27 tests).

## The Power of Automatic Context

### See Where Your Logs Come From

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

No more guessing which function logged what - the full execution path is right there.

### Track Requests Across Services

Correlation IDs automatically flow through your entire system:

```typescript
// Service A: API Gateway Handler
logger.addLambdaContext(event, context);
logger.info('Request received'); // Correlation ID: abc-123

// Service B: SQS Processor (automatically extracts ID)
logger.addSQSRecordContext(record);
logger.info('Processing message'); // Same Correlation ID: abc-123

// Service C: Another Lambda (receives via HTTP header)
logger.info('Completing workflow'); // Still Correlation ID: abc-123
```

### Production-Ready Examples

#### AWS Lambda with API Gateway

```typescript
import { AwsServerLogger } from '@smooai/logger/AwsServerLogger';

const logger = new AwsServerLogger({ name: 'UserAPI' });

export const handler = async (event, context) => {
    logger.addLambdaContext(event, context);

    try {
        const user = await createUser(event.body);
        logger.info('User created successfully', { userId: user.id });
        return { statusCode: 201, body: JSON.stringify(user) };
    } catch (error) {
        logger.error('Failed to create user', error, {
            body: event.body,
            headers: event.headers,
        });
        throw error;
    }
};
```

#### AWS ECS/Fargate Services

```typescript
const logger = new AwsServerLogger({
    name: 'OrderService',
    level: Level.Info,
});

// Automatically captures container metadata
app.post('/orders', async (req, res) => {
    logger.addContext({
        taskArn: process.env.ECS_TASK_ARN,
        containerName: process.env.ECS_CONTAINER_NAME,
    });

    logger.info('Processing order', {
        orderId: req.body.orderId,
        amount: req.body.amount,
    });
});
```

#### SQS Message Processing

```typescript
export const sqsHandler = async (event) => {
    for (const record of event.Records) {
        logger.addSQSRecordContext(record);
        logger.info('Processing order', {
            messageId: record.messageId,
            attempt: record.attributes.ApproximateReceiveCount,
        });

        // Logger maintains context throughout async operations
        await processOrder(record.body);
    }
};
```

#### Browser Tracking

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

## Advanced Features

### Smart Error Handling

Errors are automatically serialized with full context:

```typescript
try {
    await riskyOperation();
} catch (error) {
    logger.error('Operation failed', error, { context: 'additional-info' });
    // Includes: error message, stack trace, error type, and your context
}
```

### Flexible Context Management

```typescript
// Add user context that persists across logs
logger.addUserContext({ id: 'user-123', role: 'admin' });

// Add telemetry for performance tracking
logger.addTelemetryFields({ duration: 150, operation: 'db-query' });

// Add custom context for specific logs
logger.info('Payment processed', {
    amount: 99.99,
    currency: 'USD',
});
```

### Local Development Features

#### Pretty Printing

```typescript
const logger = new AwsServerLogger({
    prettyPrint: true, // Readable console output for development
});
```

#### Automatic Log Rotation

Logs are automatically saved to disk in development with smart rotation:

```typescript
// Auto-enabled in local environments
// Saves to .smooai-logs/ with ANSI colors for easy reading
const logger = new AwsServerLogger({
    rotation: {
        size: '10M', // Rotate at 10MB
        interval: '1d', // Daily rotation
        compress: true, // Gzip old logs
    },
});
```

## Import Paths

```typescript
// AWS environments (Lambda, ECS, EC2, etc.)
import { AwsServerLogger, Level } from '@smooai/logger/AwsServerLogger';

// Browser environments
import { BrowserLogger, Level } from '@smooai/logger/browser/BrowserLogger';
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

- TypeScript - Full type safety
- AWS SDK Integration - Native support for Lambda, ECS, EC2, and more
- Browser Detection - Automatic environment adaptation
- Rotating File Stream - Smart log rotation

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

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[sst.dev-url]: https://reactjs.org/
[sst]: https://img.shields.io/badge/sst-EDE1DA?style=for-the-badge&logo=sst&logoColor=E27152
[sst-url]: https://sst.dev/
[next]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[next-url]: https://nextjs.org/
[aws]: https://img.shields.io/badge/aws-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white
[aws-url]: https://tailwindcss.com/
[tailwindcss]: https://img.shields.io/badge/tailwind%20css-0B1120?style=for-the-badge&logo=tailwindcss&logoColor=#06B6D4
[tailwindcss-url]: https://tailwindcss.com/
[zod]: https://img.shields.io/badge/zod-3E67B1?style=for-the-badge&logoColor=3E67B1
[zod-url]: https://zod.dev/
[sanity]: https://img.shields.io/badge/sanity-F36458?style=for-the-badge
[sanity-url]: https://www.sanity.io/
[vitest]: https://img.shields.io/badge/vitest-1E1E20?style=for-the-badge&logo=vitest&logoColor=#6E9F18
[vitest-url]: https://vitest.dev/
[pnpm]: https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white
[pnpm-url]: https://pnpm.io/
[turborepo]: https://img.shields.io/badge/turborepo-000000?style=for-the-badge&logo=turborepo&logoColor=#EF4444
[turborepo-url]: https://turbo.build/
