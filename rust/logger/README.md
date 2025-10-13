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

## About smooai-logger (Rust)

**The missing piece for AWS & Browser logging** - A contextual logging system that automatically captures the full execution context you need to debug production issues, without the manual setup.

![Crates.io Version](https://img.shields.io/crates/v/smooai-logger?style=for-the-badge)
![Crates.io Downloads](https://img.shields.io/crates/d/smooai-logger?style=for-the-badge)
![Crates.io License](https://img.shields.io/crates/l/smooai-logger?style=for-the-badge)

![GitHub License](https://img.shields.io/github/license/SmooAI/logger?style=for-the-badge)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/SmooAI/logger/release.yml?style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/SmooAI/logger?style=for-the-badge)

### Rust Crate

A Rust port of [@smooai/logger](https://www.npmjs.com/package/@smooai/logger) that mirrors the feature set of the TypeScript and Python versions. The crate exposes a JSON-first logging API with correlation tracking, HTTP helpers, optional pretty-printing, and rotating-file output.

### Why smooai-logger?

Ever spent hours debugging a Rust service in production, only to realize you're missing critical context? Traditional loggers give you the message, but not the story.

**smooai-logger automatically captures:**

**For AWS Services:**

- 📍 **Exact code location** - File, line number, and call stack for every log
- 🔗 **Request journey** - Correlation IDs that follow requests across services
- ⚡ **AWS context** - Service-specific metadata and execution details
- 🌐 **HTTP details** - Headers, methods, status codes from API Gateway
- 📬 **Message context** - SQS attributes, EventBridge events, SNS messages
- 🔧 **Service integration** - Lambda, ECS, Fargate, EC2, and more

### Install

Add the Git dependency until the crate is published to crates.io:

```toml
[dependencies]
smooai-logger = { git = "https://github.com/SmooAI/logger", package = "smooai-logger" }
```

## The Power of Automatic Context

### See Where Your Logs Come From

Every log entry includes the exact location in your code:

```rust
use smooai_logger::Logger;

let logger = Logger::default();
logger.info(log_args!["User created"]);

// Output includes:
{
  "callerContext": {
    "stack": [
      "at UserService::create_user (src/services/user_service.rs:42:16)",
      "at process_request (src/handlers/user_handler.rs:15:23)",
      "at handler (src/main.rs:8:10)"
    ]
  }
}
```

No more guessing which function logged what - the full execution path is right there.

### Track Requests Across Services

Correlation IDs automatically flow through your entire system:

```rust
// Service A: API Gateway Handler
logger.add_telemetry_fields(TelemetryFields {
    correlation_id: Some("abc-123".into()),
    ..Default::default()
});
logger.info(log_args!["Request received"]);  // Correlation ID: abc-123

// Service B: SQS Processor (automatically extracts ID)
logger.add_http_request(HttpRequest {
    correlation_id: Some("abc-123".into()),
    ..Default::default()
});
logger.info(log_args!["Processing message"]);  // Same Correlation ID: abc-123

// Service C: Another Lambda (receives via HTTP header)
logger.info(log_args!["Completing workflow"]);  // Still Correlation ID: abc-123
```

### Production-Ready Examples

#### AWS Lambda with API Gateway

```rust
use smooai_logger::{log_args, Logger, Level, HttpRequest};
use anyhow::Result;

fn main() -> Result<()> {
    let logger = Logger::new(LoggerOptions {
        name: Some("UserAPI".into()),
        level: Some(Level::Info),
        ..Default::default()
    })?;

    logger.add_http_request(HttpRequest {
        method: Some("POST".into()),
        path: Some("/users".into()),
        ..Default::default()
    });

    match create_user(&event_body) {
        Ok(user) => {
            logger.info(log_args![
                "User created successfully",
                serde_json::json!({"userId": user.id})
            ])?;
        }
        Err(error) => {
            logger.error(log_args![
                "Failed to create user",
                log_error(error),
                serde_json::json!({
                    "body": event_body,
                    "headers": event_headers
                })
            ])?;
            return Err(error);
        }
    }

    Ok(())
}
```

#### AWS ECS/Fargate Services

```rust
use smooai_logger::{log_args, Logger, Level};
use std::env;

let logger = Logger::new(LoggerOptions {
    name: Some("OrderService".into()),
    level: Some(Level::Info),
    ..Default::default()
})?;

// Automatically captures container metadata
logger.add_context(serde_json::json!({
    "taskArn": env::var("ECS_TASK_ARN").ok(),
    "containerName": env::var("ECS_CONTAINER_NAME").ok(),
}));

logger.info(log_args![
    "Processing order",
    serde_json::json!({
        "orderId": order_id,
        "amount": amount
    })
])?;
```

#### HTTP Request Processing

```rust
use smooai_logger::{log_args, HttpRequest, HttpResponse};

logger.add_http_request(HttpRequest {
    method: Some("GET".into()),
    path: Some("/api/orders".into()),
    headers: Some(request_headers),
    ..Default::default()
});

logger.info(log_args![
    "Processing request",
    serde_json::json!({
        "messageId": message_id,
        "attempt": attempt_count
    })
])?;

// Logger maintains context throughout async operations
let response = process_request().await?;

logger.add_http_response(HttpResponse {
    status_code: Some(200),
    headers: Some(response_headers),
    ..Default::default()
});
```

## Advanced Features

### Smart Error Handling

Errors are automatically serialized with full context:

```rust
use smooai_logger::{log_args, log_error};
use anyhow::anyhow;

match risky_operation() {
    Ok(result) => { /* handle success */ }
    Err(error) => {
        logger.error(log_args![
            "Operation failed",
            log_error(error),
            serde_json::json!({"context": "additional-info"})
        ])?;
        // Includes: error message, stack trace, error type, and your context
    }
}
```

### Flexible Context Management

```rust
// Add user context that persists across logs
logger.add_user_context(UserContext {
    id: Some("user-123".into()),
    role: Some("admin".into()),
    ..Default::default()
});

// Add telemetry for performance tracking
logger.add_telemetry_fields(TelemetryFields {
    duration_ms: Some(150),
    operation: Some("db-query".into()),
    ..Default::default()
});

// Add custom context for specific logs
logger.info(log_args![
    "Payment processed",
    serde_json::json!({
        "amount": 99.99,
        "currency": "USD"
    })
])?;
```

### Local Development Features

#### Pretty Printing

Pretty output is automatically enabled in local or build environments (`SST_DEV`, `IS_LOCAL`, or `GITHUB_ACTIONS`):

```rust
let logger = Logger::new(LoggerOptions {
    pretty_print: Some(true), // Force enable for readable console output
    ..Default::default()
})?;
```

#### Automatic Log Rotation

File logging can be enabled explicitly and honours rotation options:

```rust
use smooai_logger::{Logger, LoggerOptions, RotationOptions};

let logger = Logger::new(LoggerOptions {
    log_to_file: Some(true),
    rotation: Some(RotationOptions {
        path: Some(".smooai-logs".into()),
        filename_prefix: Some("app".into()),
        extension: Some("log".into()),
        size: Some("10M".into()),        // Rotate at 10MB
        interval: Some("1d".into()),     // Daily rotation
        max_files: Some(10),             // Keep 10 files
        max_total_size: Some("100M".into()), // Total size limit
        ..Default::default()
    }),
    ..Default::default()
})?;
```

## API Reference

### Logger Creation

```rust
use smooai_logger::{Logger, LoggerOptions, Level};

let logger = Logger::new(LoggerOptions {
    name: Some("MyService".into()),
    level: Some(Level::Info),
    pretty_print: Some(true),
    log_to_file: Some(false),
    ..Default::default()
})?;

// Or use defaults
let logger = Logger::default();
```

### Context Helpers

```rust
// HTTP context
logger.add_http_request(HttpRequest {
    method: Some("GET".into()),
    path: Some("/api/users".into()),
    headers: Some(headers_map),
    ..Default::default()
});

logger.add_http_response(HttpResponse {
    status_code: Some(200),
    headers: Some(response_headers),
    ..Default::default()
});

// User context
logger.add_user_context(UserContext {
    id: Some("user-123".into()),
    role: Some("admin".into()),
    ..Default::default()
});

// Telemetry and tracing
logger.add_telemetry_fields(TelemetryFields {
    correlation_id: Some("abc-123".into()),
    request_id: Some("req-456".into()),
    trace_id: Some("trace-789".into()),
    duration_ms: Some(250),
    operation: Some("user-creation".into()),
    namespace: Some("user-service".into()),
    service: Some("api-gateway".into()),
    ..Default::default()
});

// Custom context
logger.add_context(serde_json::json!({
    "customField": "value",
    "nested": {
        "key": "value"
    }
}));

// Reset correlation and request IDs
logger.reset_context();

// Set namespace override
logger.set_namespace("custom-namespace");
```

### Logging Methods

```rust
use smooai_logger::{log_args, log_error};

// Simple message
logger.info(log_args!["User created successfully"])?;

// With structured data
logger.info(log_args![
    "Processing request",
    serde_json::json!({"userId": "123", "action": "create"})
])?;

// With error
logger.error(log_args![
    log_error(anyhow::anyhow!("Database connection failed"))
])?;

// Combining message, data, and error
logger.error(log_args![
    "Failed to create user",
    log_error(error),
    serde_json::json!({"userId": "123", "attempt": 3})
])?;
```

## Configuration

### Log Levels

- `TRACE` - Detailed debugging information
- `DEBUG` - Diagnostic information
- `INFO` - General operational information
- `WARN` - Warning conditions
- `ERROR` - Error conditions
- `FATAL` - Critical failures

### Environment Variables

The logger respects these environment variables for automatic configuration:

- `SST_DEV` - Enables pretty printing in SST development
- `IS_LOCAL` - Enables pretty printing for local development
- `GITHUB_ACTIONS` - Enables pretty printing in CI/CD

## Built With

- Rust 2021 Edition - Memory safety and performance
- Serde - JSON serialization and deserialization
- Tokio - Async runtime support
- Anyhow - Error handling
- Smart log rotation with compression

## Related Packages

- [@smooai/logger](https://www.npmjs.com/package/@smooai/logger) - TypeScript/JavaScript version
- [smooai-logger (Python)](https://pypi.org/project/smooai-logger/) - Python version

## Development

### Running tests

```bash
cargo test
```

### Building

```bash
cargo build --release
```

### Linting and Formatting

```bash
cargo clippy
cargo fmt
```

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

## License

MIT © SmooAI
